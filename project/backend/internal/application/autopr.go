package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	AutoprCostCapCents   = 200 // $2.00
	AutoprStarterCredits = 10
)

type AutoprRun struct {
	ID         string     `json:"id"`
	OrgID      string     `json:"org_id"`
	ProjectID  string     `json:"project_id"`
	TicketID   string     `json:"ticket_id"`
	Status     string     `json:"status"`
	Repo       string     `json:"repo"`
	Branch     string     `json:"branch"`
	PRURL      string     `json:"pr_url"`
	PRNumber   *int       `json:"pr_number,omitempty"`
	CostCents  int        `json:"cost_cents"`
	Error      string     `json:"error"`
	LogExcerpt string     `json:"log_excerpt"`
	CreatedAt  time.Time  `json:"created_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty"`
	// needs_reroute (US-57): the runner thinks the fix belongs in another repo.
	SuggestedRepo string `json:"suggested_repo"`
	RerouteReason string `json:"reroute_reason"`
}

type CreditLedgerEntry struct {
	ID        string    `json:"id"`
	OrgID     string    `json:"org_id"`
	Delta     int       `json:"delta"`
	Reason    string    `json:"reason"`
	RunID     *string   `json:"run_id,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type GitHubAppConfig struct {
	InstallationID int64  `json:"installation_id"`
	AccountLogin   string `json:"account_login"`
	RepoFullName   string `json:"repo_full_name"`
	DefaultBranch  string `json:"default_branch"`
}

func ParseGitHubAppConfig(raw json.RawMessage) (GitHubAppConfig, error) {
	var cfg GitHubAppConfig
	if len(raw) == 0 {
		return cfg, ErrInvalidInput
	}
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return cfg, ErrInvalidInput
	}
	if cfg.InstallationID == 0 {
		// also accept string-ish via map
		var m map[string]any
		if err := json.Unmarshal(raw, &m); err == nil {
			switch v := m["installation_id"].(type) {
			case float64:
				cfg.InstallationID = int64(v)
			case string:
				var n int64
				fmt.Sscan(v, &n)
				cfg.InstallationID = n
			}
			if s, ok := m["account_login"].(string); ok {
				cfg.AccountLogin = s
			}
			if s, ok := m["repo_full_name"].(string); ok {
				cfg.RepoFullName = s
			}
			if s, ok := m["default_branch"].(string); ok {
				cfg.DefaultBranch = s
			}
		}
	}
	if cfg.InstallationID == 0 {
		return cfg, ErrInvalidInput
	}
	cfg.AccountLogin = strings.TrimSpace(cfg.AccountLogin)
	cfg.RepoFullName = strings.TrimSpace(cfg.RepoFullName)
	cfg.DefaultBranch = strings.TrimSpace(cfg.DefaultBranch)
	if cfg.DefaultBranch == "" {
		cfg.DefaultBranch = "main"
	}
	return cfg, nil
}

func StarterCreditsForPlan(plan string) int {
	if NormalizePlan(plan) == "free" {
		return 0
	}
	return AutoprStarterCredits
}

func (s *Store) OrgAutoPRCredits(ctx context.Context, orgID string) (int, error) {
	var n int
	err := s.DB.QueryRowContext(ctx, `SELECT auto_pr_credits FROM organizations WHERE id=$1`, orgID).Scan(&n)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	return n, err
}

func (s *Store) GrantAutoPRCredits(ctx context.Context, orgID string, delta int, reason string) (int, error) {
	if delta == 0 {
		return s.OrgAutoPRCredits(ctx, orgID)
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	var bal int
	err = tx.QueryRowContext(ctx, `
		UPDATE organizations SET auto_pr_credits = auto_pr_credits + $2
		WHERE id=$1
		RETURNING auto_pr_credits`, orgID, delta).Scan(&bal)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrNotFound
	}
	if err != nil {
		return 0, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO credit_ledger(org_id, delta, reason) VALUES ($1,$2,$3)`,
		orgID, delta, reason); err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return bal, nil
}

func (s *Store) ListCreditLedger(ctx context.Context, orgID string, limit int) ([]CreditLedgerEntry, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, delta, reason, run_id, created_at
		FROM credit_ledger WHERE org_id=$1
		ORDER BY created_at DESC LIMIT $2`, orgID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []CreditLedgerEntry
	for rows.Next() {
		var e CreditLedgerEntry
		var runID sql.NullString
		if err := rows.Scan(&e.ID, &e.OrgID, &e.Delta, &e.Reason, &runID, &e.CreatedAt); err != nil {
			return nil, err
		}
		if runID.Valid {
			e.RunID = &runID.String
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) StartAutoprRun(ctx context.Context, projectID, ticketID, actorRole string) (AutoprRun, error) {
	if actorRole == "viewer" {
		return AutoprRun{}, ErrForbidden
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return AutoprRun{}, err
	}
	defer tx.Rollback()

	var orgID, plan string
	var credits int
	err = tx.QueryRowContext(ctx, `
		SELECT o.id, o.plan, o.auto_pr_credits
		FROM projects p JOIN organizations o ON o.id = p.org_id
		WHERE p.id=$1 AND p.deleted_at IS NULL`, projectID).
		Scan(&orgID, &plan, &credits)
	if errors.Is(err, sql.ErrNoRows) {
		return AutoprRun{}, ErrNotFound
	}
	if err != nil {
		return AutoprRun{}, err
	}
	if NormalizePlan(plan) == "free" {
		return AutoprRun{}, fmt.Errorf("%w: auto PR requires a paid plan", ErrForbidden)
	}
	if credits < 1 {
		return AutoprRun{}, fmt.Errorf("%w: insufficient auto PR credits", ErrForbidden)
	}

	var ticketProject, repoName string
	err = tx.QueryRowContext(ctx, `
		SELECT t.project_id, COALESCE(pr.full_name, '')
		FROM tickets t LEFT JOIN project_repos pr ON pr.id = t.repo_id
		WHERE t.id=$1`, ticketID).Scan(&ticketProject, &repoName)
	if errors.Is(err, sql.ErrNoRows) {
		return AutoprRun{}, ErrNotFound
	}
	if err != nil {
		return AutoprRun{}, err
	}
	if ticketProject != projectID {
		return AutoprRun{}, ErrForbidden
	}
	if repoName == "" {
		return AutoprRun{}, fmt.Errorf("%w: Pick a repo for this ticket first. Auto PR runs in the ticket's repo.", ErrInvalidInput)
	}
	var ghConnected bool
	if err := tx.QueryRowContext(ctx, `
		SELECT EXISTS(SELECT 1 FROM integrations WHERE project_id=$1 AND provider='github_app')`, projectID).Scan(&ghConnected); err != nil {
		return AutoprRun{}, err
	}
	if !ghConnected {
		return AutoprRun{}, fmt.Errorf("%w: connect GitHub App first", ErrInvalidInput)
	}

	var runID string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO autopr_runs(org_id, project_id, ticket_id, status, repo)
		VALUES ($1,$2,$3,'queued',$4)
		RETURNING id`,
		orgID, projectID, ticketID, repoName).Scan(&runID)
	if err != nil {
		return AutoprRun{}, err
	}

	if err := tx.QueryRowContext(ctx, `
		UPDATE organizations SET auto_pr_credits = auto_pr_credits - 1
		WHERE id=$1 AND auto_pr_credits >= 1
		RETURNING auto_pr_credits`, orgID).Scan(&credits); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return AutoprRun{}, fmt.Errorf("%w: insufficient auto PR credits", ErrForbidden)
		}
		return AutoprRun{}, err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO credit_ledger(org_id, delta, reason, run_id) VALUES ($1,-1,'autopr_run',$2)`,
		orgID, runID); err != nil {
		return AutoprRun{}, err
	}

	payload, _ := json.Marshal(map[string]string{"run_id": runID})
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO jobs(kind, payload) VALUES ('autopr_run', $1)`, payload); err != nil {
		return AutoprRun{}, err
	}

	if err := tx.Commit(); err != nil {
		return AutoprRun{}, err
	}
	return s.GetAutoprRun(ctx, runID)
}

func (s *Store) ListAutoprRuns(ctx context.Context, projectID string, limit int) ([]AutoprRun, error) {
	if limit <= 0 {
		limit = 50
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, project_id, ticket_id, status, repo, branch, pr_url, pr_number, cost_cents, error, log_excerpt, created_at, finished_at, suggested_repo, reroute_reason
		FROM autopr_runs WHERE project_id=$1
		ORDER BY created_at DESC LIMIT $2`, projectID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAutoprRuns(rows)
}

func (s *Store) ListAutoprRunsForTicket(ctx context.Context, ticketID string, limit int) ([]AutoprRun, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, project_id, ticket_id, status, repo, branch, pr_url, pr_number, cost_cents, error, log_excerpt, created_at, finished_at, suggested_repo, reroute_reason
		FROM autopr_runs WHERE ticket_id=$1
		ORDER BY created_at DESC LIMIT $2`, ticketID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanAutoprRuns(rows)
}

func (s *Store) GetAutoprRun(ctx context.Context, runID string) (AutoprRun, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, project_id, ticket_id, status, repo, branch, pr_url, pr_number, cost_cents, error, log_excerpt, created_at, finished_at, suggested_repo, reroute_reason
		FROM autopr_runs WHERE id=$1`, runID)
	return scanAutoprRun(row)
}

func (s *Store) UpdateAutoprRun(ctx context.Context, run AutoprRun) error {
	_, err := s.DB.ExecContext(ctx, `
		UPDATE autopr_runs SET
			status=$2, branch=$3, pr_url=$4, pr_number=$5, cost_cents=$6, error=$7, log_excerpt=$8, finished_at=$9,
			suggested_repo=$10, reroute_reason=$11
		WHERE id=$1`,
		run.ID, run.Status, run.Branch, run.PRURL, run.PRNumber, run.CostCents, run.Error, run.LogExcerpt, run.FinishedAt,
		run.SuggestedRepo, run.RerouteReason)
	return err
}

func (s *Store) RefundAutoprCredit(ctx context.Context, orgID, runID, reason string) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `
		UPDATE organizations SET auto_pr_credits = auto_pr_credits + 1 WHERE id=$1`, orgID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO credit_ledger(org_id, delta, reason, run_id) VALUES ($1,1,$2,$3)`,
		orgID, reason, runID); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) FindAutoprRunByPR(ctx context.Context, repo string, prNumber int) (AutoprRun, error) {
	row := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, project_id, ticket_id, status, repo, branch, pr_url, pr_number, cost_cents, error, log_excerpt, created_at, finished_at, suggested_repo, reroute_reason
		FROM autopr_runs WHERE repo=$1 AND pr_number=$2
		ORDER BY created_at DESC LIMIT 1`, repo, prNumber)
	return scanAutoprRun(row)
}

func (s *Store) ProjectIDForInstallation(ctx context.Context, installationID int64) (string, error) {
	var projectID string
	err := s.DB.QueryRowContext(ctx, `
		SELECT project_id FROM integrations
		WHERE provider='github_app'
		  AND (config->>'installation_id')::bigint = $1
		ORDER BY updated_at DESC LIMIT 1`, installationID).Scan(&projectID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return projectID, err
}

func scanAutoprRuns(rows *sql.Rows) ([]AutoprRun, error) {
	var out []AutoprRun
	for rows.Next() {
		run, err := scanAutoprRun(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, run)
	}
	return out, rows.Err()
}

type scannable interface {
	Scan(dest ...any) error
}

func scanAutoprRun(row scannable) (AutoprRun, error) {
	var run AutoprRun
	var prNum sql.NullInt64
	var finished sql.NullTime
	err := row.Scan(&run.ID, &run.OrgID, &run.ProjectID, &run.TicketID, &run.Status, &run.Repo, &run.Branch, &run.PRURL,
		&prNum, &run.CostCents, &run.Error, &run.LogExcerpt, &run.CreatedAt, &finished, &run.SuggestedRepo, &run.RerouteReason)
	if errors.Is(err, sql.ErrNoRows) {
		return AutoprRun{}, ErrNotFound
	}
	if err != nil {
		return AutoprRun{}, err
	}
	if prNum.Valid {
		n := int(prNum.Int64)
		run.PRNumber = &n
	}
	if finished.Valid {
		t := finished.Time
		run.FinishedAt = &t
	}
	return run, nil
}
