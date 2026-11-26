package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

// Multi-repo per project (D-11…D-19, PRD Multi-repo per Project).

var (
	// ErrRepoLimit means the project already has as many repos as the plan allows.
	ErrRepoLimit = errors.New("repo limit reached")
	// ErrRepoNotConnected means an owner/name is not one of the project's repos.
	ErrRepoNotConnected = errors.New("repo not connected to this project")
)

// PlatformConflictError is returned when a platform already routes to another repo.
type PlatformConflictError struct {
	Platform string
	Repo     string
}

func (e *PlatformConflictError) Error() string {
	return fmt.Sprintf("%s already routes to %s. Remove it there first, or uncheck it here.", PlatformLabel(e.Platform), e.Repo)
}

var RepoPlatforms = []string{"web", "android", "ios", "backend", "shared"}

func validRepoPlatform(p string) bool {
	return slices.Contains(RepoPlatforms, p)
}

func PlatformLabel(p string) string {
	switch p {
	case "ios":
		return "iOS"
	case "web":
		return "Web"
	case "android":
		return "Android"
	case "backend":
		return "Backend"
	case "shared":
		return "Shared"
	default:
		return p
	}
}

type RepoRoute struct {
	Platform string `json:"platform"`
	Path     string `json:"path"`
}

type ProjectRepo struct {
	ID             string      `json:"id"`
	ProjectID      string      `json:"project_id"`
	InstallationID int64       `json:"installation_id"`
	AccountLogin   string      `json:"account_login"`
	FullName       string      `json:"full_name"`
	DefaultBranch  string      `json:"default_branch"`
	IsFallback     bool        `json:"is_fallback"`
	RoutingPaused  bool        `json:"routing_paused"`
	Provider       string      `json:"provider"`
	Routes         []RepoRoute `json:"routes"`
	CreatedAt      time.Time   `json:"created_at"`
}

type RepoInput struct {
	InstallationID int64       `json:"installation_id"`
	AccountLogin   string      `json:"account_login"`
	FullName       string      `json:"full_name"`
	DefaultBranch  string      `json:"default_branch"`
	IsFallback     *bool       `json:"is_fallback"`
	Provider       string      `json:"provider"`
	Routes         []RepoRoute `json:"routes"`
}

func normalizeRoutes(in []RepoRoute) ([]RepoRoute, error) {
	seen := map[string]bool{}
	out := make([]RepoRoute, 0, len(in))
	for _, r := range in {
		p := strings.ToLower(strings.TrimSpace(r.Platform))
		if !validRepoPlatform(p) {
			return nil, fmt.Errorf("%w: invalid platform %q", ErrInvalidInput, r.Platform)
		}
		if seen[p] {
			return nil, fmt.Errorf("%w: platform %s listed twice", ErrInvalidInput, p)
		}
		seen[p] = true
		out = append(out, RepoRoute{Platform: p, Path: strings.Trim(strings.TrimSpace(r.Path), "/")})
	}
	return out, nil
}

func (s *Store) ListProjectRepos(ctx context.Context, projectID string) ([]ProjectRepo, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, project_id, installation_id, account_login, full_name, default_branch, is_fallback, routing_paused, created_at, COALESCE(provider, 'github')
		FROM project_repos WHERE project_id=$1
		ORDER BY is_fallback DESC, created_at ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ProjectRepo{}
	byID := map[string]int{}
	for rows.Next() {
		var r ProjectRepo
		if err := rows.Scan(&r.ID, &r.ProjectID, &r.InstallationID, &r.AccountLogin, &r.FullName, &r.DefaultBranch, &r.IsFallback, &r.RoutingPaused, &r.CreatedAt, &r.Provider); err != nil {
			return nil, err
		}
		r.Routes = []RepoRoute{}
		byID[r.ID] = len(out)
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	frozen, err := repoRoutingFrozen(ctx, s.DB, projectID)
	if err != nil {
		return nil, err
	}
	for i := range out {
		if frozen[out[i].ID] {
			out[i].RoutingPaused = true
		}
	}
	routeRows, err := s.DB.QueryContext(ctx, `
		SELECT repo_id, platform, path FROM project_repo_routes WHERE project_id=$1
		ORDER BY array_position(ARRAY['web','android','ios','backend','shared'], platform)`, projectID)
	if err != nil {
		return nil, err
	}
	defer routeRows.Close()
	for routeRows.Next() {
		var repoID string
		var route RepoRoute
		if err := routeRows.Scan(&repoID, &route.Platform, &route.Path); err != nil {
			return nil, err
		}
		if i, ok := byID[repoID]; ok {
			out[i].Routes = append(out[i].Routes, route)
		}
	}
	return out, routeRows.Err()
}

func (s *Store) GetProjectRepo(ctx context.Context, projectID, repoID string) (ProjectRepo, error) {
	repos, err := s.ListProjectRepos(ctx, projectID)
	if err != nil {
		return ProjectRepo{}, err
	}
	for _, r := range repos {
		if r.ID == repoID {
			return r, nil
		}
	}
	return ProjectRepo{}, ErrNotFound
}

// ProjectRepoByFullName finds a connected repo by owner/name (case-insensitive).
func (s *Store) ProjectRepoByFullName(ctx context.Context, projectID, fullName string) (ProjectRepo, error) {
	repos, err := s.ListProjectRepos(ctx, projectID)
	if err != nil {
		return ProjectRepo{}, err
	}
	want := strings.ToLower(strings.TrimSpace(fullName))
	for _, r := range repos {
		if strings.ToLower(r.FullName) == want {
			return r, nil
		}
	}
	return ProjectRepo{}, ErrRepoNotConnected
}

// checkRouteConflicts rejects a platform that already routes to a different repo.
func checkRouteConflicts(ctx context.Context, tx *sql.Tx, projectID, repoID string, routes []RepoRoute) error {
	for _, r := range routes {
		var otherName string
		err := tx.QueryRowContext(ctx, `
			SELECT pr.full_name FROM project_repo_routes rr
			JOIN project_repos pr ON pr.id = rr.repo_id
			WHERE rr.project_id=$1 AND rr.platform=$2 AND rr.repo_id <> $3`,
			projectID, r.Platform, repoID).Scan(&otherName)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return err
		}
		return &PlatformConflictError{Platform: r.Platform, Repo: otherName}
	}
	return nil
}

func replaceRoutes(ctx context.Context, tx *sql.Tx, projectID, repoID string, routes []RepoRoute) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM project_repo_routes WHERE repo_id=$1`, repoID); err != nil {
		return err
	}
	for _, r := range routes {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO project_repo_routes(project_id, platform, repo_id, path) VALUES ($1,$2,$3,$4)`,
			projectID, r.Platform, repoID, r.Path); err != nil {
			return err
		}
	}
	return nil
}

func setFallback(ctx context.Context, tx *sql.Tx, projectID, repoID string) error {
	if _, err := tx.ExecContext(ctx, `
		UPDATE project_repos SET is_fallback=false WHERE project_id=$1 AND id<>$2 AND is_fallback`, projectID, repoID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE project_repos SET is_fallback=true WHERE id=$1`, repoID)
	return err
}

// AddProjectRepo connects a repo, enforcing the plan's repo limit and platform uniqueness.
// The first repo of a project becomes its fallback automatically (US-47).
func (s *Store) AddProjectRepo(ctx context.Context, projectID string, in RepoInput) (ProjectRepo, error) {
	in.FullName = strings.TrimSpace(in.FullName)
	if in.FullName == "" || !strings.Contains(in.FullName, "/") {
		return ProjectRepo{}, fmt.Errorf("%w: full_name must be owner/name", ErrInvalidInput)
	}
	routes, err := normalizeRoutes(in.Routes)
	if err != nil {
		return ProjectRepo{}, err
	}
	branch := strings.TrimSpace(in.DefaultBranch)
	if branch == "" {
		branch = "main"
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return ProjectRepo{}, err
	}
	defer tx.Rollback()

	var plan string
	if err := tx.QueryRowContext(ctx, `
		SELECT o.plan FROM projects p JOIN organizations o ON o.id=p.org_id
		WHERE p.id=$1 FOR UPDATE OF p`, projectID).Scan(&plan); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ProjectRepo{}, ErrNotFound
		}
		return ProjectRepo{}, err
	}
	var count int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM project_repos WHERE project_id=$1`, projectID).Scan(&count); err != nil {
		return ProjectRepo{}, err
	}
	if LimitsForPlan(plan).RepoLimitReached(count) {
		return ProjectRepo{}, ErrRepoLimit
	}
	if err := checkRouteConflicts(ctx, tx, projectID, "00000000-0000-0000-0000-000000000000", routes); err != nil {
		return ProjectRepo{}, err
	}
	provider := strings.ToLower(strings.TrimSpace(in.Provider))
	if provider == "" {
		provider = "github"
	}
	if provider != "github" && provider != "gitlab" {
		return ProjectRepo{}, fmt.Errorf("%w: invalid provider %q", ErrInvalidInput, in.Provider)
	}

	var id string
	err = tx.QueryRowContext(ctx, `
		INSERT INTO project_repos(project_id, installation_id, account_login, full_name, default_branch, provider)
		VALUES ($1,$2,$3,$4,$5,$6)
		ON CONFLICT (project_id, full_name) DO NOTHING
		RETURNING id`, projectID, in.InstallationID, strings.TrimSpace(in.AccountLogin), in.FullName, branch, provider).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return ProjectRepo{}, fmt.Errorf("%w: %s is already connected", ErrConflict, in.FullName)
	}
	if err != nil {
		return ProjectRepo{}, err
	}
	if err := replaceRoutes(ctx, tx, projectID, id, routes); err != nil {
		return ProjectRepo{}, err
	}
	if count == 0 || (in.IsFallback != nil && *in.IsFallback) {
		if err := setFallback(ctx, tx, projectID, id); err != nil {
			return ProjectRepo{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return ProjectRepo{}, err
	}
	return s.GetProjectRepo(ctx, projectID, id)
}

// UpdateProjectRepo changes routes, branch or the fallback flag of a connected repo.
func (s *Store) UpdateProjectRepo(ctx context.Context, projectID, repoID string, in RepoInput) (ProjectRepo, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return ProjectRepo{}, err
	}
	defer tx.Rollback()
	var exists bool
	if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM project_repos WHERE id=$1 AND project_id=$2)`, repoID, projectID).Scan(&exists); err != nil {
		return ProjectRepo{}, err
	}
	if !exists {
		return ProjectRepo{}, ErrNotFound
	}
	if in.Routes != nil {
		routes, err := normalizeRoutes(in.Routes)
		if err != nil {
			return ProjectRepo{}, err
		}
		if err := checkRouteConflicts(ctx, tx, projectID, repoID, routes); err != nil {
			return ProjectRepo{}, err
		}
		if err := replaceRoutes(ctx, tx, projectID, repoID, routes); err != nil {
			return ProjectRepo{}, err
		}
	}
	if p := strings.ToLower(strings.TrimSpace(in.Provider)); p != "" {
		if p != "github" && p != "gitlab" {
			return ProjectRepo{}, fmt.Errorf("%w: invalid provider %q", ErrInvalidInput, in.Provider)
		}
		if _, err := tx.ExecContext(ctx, `UPDATE project_repos SET provider=$2 WHERE id=$1`, repoID, p); err != nil {
			return ProjectRepo{}, err
		}
	}
	if b := strings.TrimSpace(in.DefaultBranch); b != "" {
		if _, err := tx.ExecContext(ctx, `UPDATE project_repos SET default_branch=$2 WHERE id=$1`, repoID, b); err != nil {
			return ProjectRepo{}, err
		}
	}
	if in.IsFallback != nil {
		if *in.IsFallback {
			if err := setFallback(ctx, tx, projectID, repoID); err != nil {
				return ProjectRepo{}, err
			}
		} else if _, err := tx.ExecContext(ctx, `UPDATE project_repos SET is_fallback=false WHERE id=$1`, repoID); err != nil {
			return ProjectRepo{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return ProjectRepo{}, err
	}
	return s.GetProjectRepo(ctx, projectID, repoID)
}

// DeleteProjectRepo disconnects a repo. Tickets keep existing with no repo; the UI asks
// for a new fallback before removing the current one (US-47).
func (s *Store) DeleteProjectRepo(ctx context.Context, projectID, repoID string) error {
	res, err := s.DB.ExecContext(ctx, `DELETE FROM project_repos WHERE id=$1 AND project_id=$2`, repoID, projectID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// SetActiveRepos keeps the given repos routing and pauses the rest (downgrade, US-48).
// The fallback always stays on. Nothing is deleted.
func (s *Store) SetActiveRepos(ctx context.Context, projectID string, keepIDs []string) ([]ProjectRepo, error) {
	repos, err := s.ListProjectRepos(ctx, projectID)
	if err != nil {
		return nil, err
	}
	plan, err := s.OrgPlanForProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	keep := map[string]bool{}
	for _, id := range keepIDs {
		keep[id] = true
	}
	for _, r := range repos {
		if r.IsFallback {
			keep[r.ID] = true
		}
	}
	if limit := LimitsForPlan(plan).MaxReposPerProject; limit > 0 && len(keep) > limit {
		return nil, fmt.Errorf("%w: %s includes %d repos per project", ErrRepoLimit, PlanDisplayName(plan), limit)
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	for _, r := range repos {
		if _, err := tx.ExecContext(ctx, `UPDATE project_repos SET routing_paused=$2 WHERE id=$1`, r.ID, !keep[r.ID]); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return s.ListProjectRepos(ctx, projectID)
}

// SetCrossRepoRead toggles read-only access to other repos for auto PR runners (US-58).
func (s *Store) SetCrossRepoRead(ctx context.Context, projectID string, on bool) error {
	_, err := s.DB.ExecContext(ctx, `UPDATE projects SET allow_cross_repo_read=$2 WHERE id=$1`, projectID, on)
	return err
}

func (s *Store) CrossRepoRead(ctx context.Context, projectID string) (bool, error) {
	var on bool
	err := s.DB.QueryRowContext(ctx, `SELECT allow_cross_repo_read FROM projects WHERE id=$1`, projectID).Scan(&on)
	return on, err
}

type queryRower interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// RouteForPlatform picks the repo a new report goes to (US-49): the platform's repo,
// else the fallback, else none. Paused repos, and repos beyond the plan's limit after a
// downgrade, are skipped.
func RouteForPlatform(ctx context.Context, q dbQuerier, projectID, platform string) (repoID, path, kind string, err error) {
	frozen, err := repoRoutingFrozen(ctx, q, projectID)
	if err != nil {
		return "", "", "", err
	}
	err = q.QueryRowContext(ctx, `
		SELECT rr.repo_id, rr.path FROM project_repo_routes rr
		JOIN project_repos pr ON pr.id = rr.repo_id
		WHERE rr.project_id=$1 AND rr.platform=$2 AND NOT pr.routing_paused`, projectID, platform).Scan(&repoID, &path)
	if err == nil && !frozen[repoID] {
		return repoID, path, "auto", nil
	}
	if err == nil {
		err = sql.ErrNoRows // repo over the plan's limit after a downgrade: use the fallback
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", "", "", err
	}
	err = q.QueryRowContext(ctx, `
		SELECT id FROM project_repos WHERE project_id=$1 AND is_fallback`, projectID).Scan(&repoID)
	if err == nil {
		return repoID, "", "fallback", nil
	}
	if errors.Is(err, sql.ErrNoRows) {
		return "", "", "none", nil
	}
	return "", "", "", err
}

// RerouteTicket moves a ticket to another connected repo and logs ticket_rerouted (US-51, US-54).
func (s *Store) RerouteTicket(ctx context.Context, ticketID, repoID, actor, reason, source string) (Ticket, error) {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return Ticket{}, err
	}
	repo, err := s.GetProjectRepo(ctx, t.ProjectID, repoID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Ticket{}, ErrRepoNotConnected
		}
		return Ticket{}, err
	}
	platform := s.ticketPrimaryPlatform(ctx, ticketID)
	path := ""
	for _, r := range repo.Routes {
		if r.Platform == platform {
			path = r.Path
		}
	}
	if _, err := s.DB.ExecContext(ctx, `
		UPDATE tickets SET repo_id=$2, repo_path=$3, updated_at=now() WHERE id=$1`, ticketID, repo.ID, path); err != nil {
		return Ticket{}, err
	}
	payload := map[string]any{
		"from":     t.RepoFullName,
		"to":       repo.FullName,
		"platform": platform,
		"source":   source,
	}
	if strings.TrimSpace(reason) != "" {
		payload["reason"] = strings.TrimSpace(reason)
	}
	if _, err := s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload) VALUES ($1,$2,'ticket_rerouted',$3)`,
		ticketID, actor, mustJSON(payload)); err != nil {
		return Ticket{}, err
	}
	return s.GetTicket(ctx, ticketID)
}

func (s *Store) ticketPrimaryPlatform(ctx context.Context, ticketID string) string {
	var p string
	_ = s.DB.QueryRowContext(ctx, `
		SELECT COALESCE(NULLIF(platform,''),'web') FROM reports WHERE ticket_id=$1
		ORDER BY created_at ASC LIMIT 1`, ticketID).Scan(&p)
	if p == "" {
		p = "web"
	}
	return p
}

// TicketPlatforms lists reporter counts per platform on a ticket (US-55).
func (s *Store) TicketPlatforms(ctx context.Context, ticketID string) (map[string]int, error) {
	_, byPlatform, err := s.TicketReporterList(ctx, ticketID)
	return byPlatform, err
}

// RepoServesPlatforms lists the platforms a repo serves. The fallback also covers platforms
// that have no route of their own.
func (s *Store) RepoServesPlatforms(ctx context.Context, projectID, repoID string) (map[string]bool, error) {
	repos, err := s.ListProjectRepos(ctx, projectID)
	if err != nil {
		return nil, err
	}
	served := map[string]bool{}
	routed := map[string]bool{}
	var fallback string
	for _, r := range repos {
		for _, rt := range r.Routes {
			routed[rt.Platform] = true
			if r.ID == repoID {
				served[rt.Platform] = true
			}
		}
		if r.IsFallback {
			fallback = r.ID
		}
	}
	if fallback == repoID {
		for _, p := range RepoPlatforms {
			if !routed[p] {
				served[p] = true
			}
		}
	}
	return served, nil
}

// SyncLegacyGitHubRepo keeps project_repos in step with the single-repo GitHub App
// picker that still exists in S-13: the picked repo is added (as fallback when the
// project has none). Field repo_full_name stays readable for one release.
func (s *Store) SyncLegacyGitHubRepo(ctx context.Context, projectID string, raw json.RawMessage) error {
	cfg, err := ParseGitHubAppConfig(raw)
	if err != nil || cfg.RepoFullName == "" {
		return nil
	}
	if _, err := s.ProjectRepoByFullName(ctx, projectID, cfg.RepoFullName); err == nil {
		return nil
	}
	repos, err := s.ListProjectRepos(ctx, projectID)
	if err != nil {
		return err
	}
	hasFallback := false
	for _, r := range repos {
		if r.IsFallback {
			hasFallback = true
		}
	}
	fallback := !hasFallback
	_, err = s.AddProjectRepo(ctx, projectID, RepoInput{
		InstallationID: cfg.InstallationID,
		AccountLogin:   cfg.AccountLogin,
		FullName:       cfg.RepoFullName,
		DefaultBranch:  cfg.DefaultBranch,
		IsFallback:     &fallback,
	})
	if errors.Is(err, ErrRepoLimit) {
		return nil
	}
	return err
}
