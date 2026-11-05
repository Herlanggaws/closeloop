package application

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/closeloop/api/internal/infrastructure/auth"
	"github.com/google/uuid"
)

var (
	ErrNotFound       = errors.New("not found")
	ErrUnauthorized   = errors.New("unauthorized")
	ErrForbidden      = errors.New("forbidden")
	ErrConflict       = errors.New("conflict")
	ErrPlanRequired   = errors.New("plan required")
	ErrInvalidInput   = errors.New("invalid input")
)

type Store struct {
	DB *sql.DB
}

type User struct {
	ID           string         `json:"id"`
	Email        string         `json:"email"`
	PasswordHash sql.NullString `json:"-"`
	Name         string         `json:"name"`
}

type Org struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Plan string `json:"plan"`
}

type Project struct {
	ID                 string   `json:"id"`
	OrgID              string   `json:"org_id"`
	Name               string   `json:"name"`
	Platforms          []string `json:"platforms"`
	NotifyEnabled      bool     `json:"notify_enabled"`
	SensitiveSelectors []string `json:"sensitive_selectors"`
}

type Ticket struct {
	ID          string         `json:"id"`
	ProjectID   string         `json:"project_id"`
	Type        string         `json:"type"`
	Status      string         `json:"status"`
	Title       string         `json:"title"`
	ReportCount int            `json:"report_count"`
	FixedAt     sql.NullTime   `json:"-"`
	FixedNote   sql.NullString `json:"-"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (t Ticket) MarshalJSON() ([]byte, error) {
	var fixedAt any
	var fixedNote any
	if t.FixedAt.Valid {
		fixedAt = t.FixedAt.Time
	}
	if t.FixedNote.Valid {
		fixedNote = t.FixedNote.String
	}
	return json.Marshal(map[string]any{
		"id":           t.ID,
		"project_id":   t.ProjectID,
		"type":         t.Type,
		"status":       t.Status,
		"title":        t.Title,
		"report_count": t.ReportCount,
		"fixed_at":     fixedAt,
		"fixed_note":   fixedNote,
		"created_at":   t.CreatedAt,
		"updated_at":   t.UpdatedAt,
	})
}

type Report struct {
	ID             string          `json:"id"`
	TicketID       string          `json:"ticket_id"`
	ReporterID     *string         `json:"reporter_id"`
	ReporterEmail  *string         `json:"reporter_email,omitempty"`
	ExternalUserID *string         `json:"external_user_id,omitempty"`
	Message        string          `json:"message"`
	Platform       string          `json:"platform"`
	Context        json.RawMessage `json:"context"`
	AppVersion     *string         `json:"app_version"`
	CreatedAt      time.Time       `json:"created_at"`
}

type TicketEvent struct {
	ID        string          `json:"id"`
	TicketID  string          `json:"ticket_id"`
	Actor     string          `json:"actor"`
	Kind      string          `json:"kind"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"created_at"`
}

func (s *Store) Register(ctx context.Context, email, password, name string) (User, Org, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return User{}, Org{}, ErrInvalidInput
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return User{}, Org{}, err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return User{}, Org{}, err
	}
	defer tx.Rollback()

	var user User
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users(email, password_hash, name) VALUES ($1,$2,$3)
		RETURNING id, email, password_hash, name`, email, hash, name).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			return User{}, Org{}, ErrConflict
		}
		return User{}, Org{}, err
	}
	var org Org
	err = tx.QueryRowContext(ctx, `
		INSERT INTO organizations(name, plan) VALUES ($1,'indie')
		RETURNING id, name, plan`, name+"'s org").
		Scan(&org.ID, &org.Name, &org.Plan)
	if err != nil {
		return User{}, Org{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO memberships(org_id, user_id, role) VALUES ($1,$2,'owner')`, org.ID, user.ID); err != nil {
		return User{}, Org{}, err
	}
	if err := tx.Commit(); err != nil {
		return User{}, Org{}, err
	}
	return user, org, nil
}

func (s *Store) Login(ctx context.Context, email, password string) (User, error) {
	var user User
	err := s.DB.QueryRowContext(ctx, `SELECT id, email, password_hash, name FROM users WHERE email=$1`, strings.ToLower(email)).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUnauthorized
	}
	if err != nil {
		return User{}, err
	}
	if !user.PasswordHash.Valid || !auth.CheckPassword(user.PasswordHash.String, password) {
		return User{}, ErrUnauthorized
	}
	return user, nil
}

func (s *Store) SaveRefresh(ctx context.Context, userID, raw string, expires time.Time) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES ($1,$2,$3)`,
		userID, auth.SHA256(raw), expires)
	return err
}

func (s *Store) UserByRefresh(ctx context.Context, raw string) (User, error) {
	var user User
	err := s.DB.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.password_hash, u.name
		FROM refresh_tokens rt
		JOIN users u ON u.id = rt.user_id
		WHERE rt.token_hash=$1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`, auth.SHA256(raw)).
		Scan(&user.ID, &user.Email, &user.PasswordHash, &user.Name)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrUnauthorized
	}
	return user, err
}

func (s *Store) RevokeRefresh(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	_, err := s.DB.ExecContext(ctx, `
		UPDATE refresh_tokens SET revoked_at=now()
		WHERE token_hash=$1 AND revoked_at IS NULL`, auth.SHA256(raw))
	return err
}

func (s *Store) PrimaryOrg(ctx context.Context, userID string) (Org, string, error) {
	var org Org
	var role string
	err := s.DB.QueryRowContext(ctx, `
		SELECT o.id, o.name, o.plan, m.role
		FROM memberships m JOIN organizations o ON o.id=m.org_id
		WHERE m.user_id=$1 ORDER BY m.role='owner' DESC LIMIT 1`, userID).
		Scan(&org.ID, &org.Name, &org.Plan, &role)
	if errors.Is(err, sql.ErrNoRows) {
		return Org{}, "", ErrNotFound
	}
	return org, role, err
}

func (s *Store) CreateProject(ctx context.Context, orgID, name string, platforms []string) (Project, string, error) {
	if name == "" {
		return Project{}, "", ErrInvalidInput
	}
	if len(platforms) == 0 {
		platforms = []string{"web"}
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return Project{}, "", err
	}
	defer tx.Rollback()

	var p Project
	var plats, sels StringArray
	err = tx.QueryRowContext(ctx, `
		INSERT INTO projects(org_id, name, platforms) VALUES ($1,$2,$3)
		RETURNING id, org_id, name, platforms, notify_enabled, sensitive_selectors`,
		orgID, name, asArray(platforms)).
		Scan(&p.ID, &p.OrgID, &p.Name, &plats, &p.NotifyEnabled, &sels)
	if err != nil {
		return Project{}, "", err
	}
	p.Platforms, p.SensitiveSelectors = []string(plats), []string(sels)
	publicKey := "pk_" + uuid.NewString()
	_, err = tx.ExecContext(ctx, `INSERT INTO project_keys(project_id, public_key) VALUES ($1,$2)`, p.ID, publicKey)
	if err != nil {
		return Project{}, "", err
	}
	if err := tx.Commit(); err != nil {
		return Project{}, "", err
	}
	return p, publicKey, nil
}

func (s *Store) ListProjects(ctx context.Context, orgID string) ([]Project, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, org_id, name, platforms, notify_enabled, sensitive_selectors
		FROM projects WHERE org_id=$1 ORDER BY created_at`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Project
	for rows.Next() {
		var p Project
		var plats, sels StringArray
		if err := rows.Scan(&p.ID, &p.OrgID, &p.Name, &plats, &p.NotifyEnabled, &sels); err != nil {
			return nil, err
		}
		p.Platforms, p.SensitiveSelectors = []string(plats), []string(sels)
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) ProjectByID(ctx context.Context, projectID string) (Project, error) {
	var p Project
	var plats, sels StringArray
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, org_id, name, platforms, notify_enabled, sensitive_selectors
		FROM projects WHERE id=$1`, projectID).
		Scan(&p.ID, &p.OrgID, &p.Name, &plats, &p.NotifyEnabled, &sels)
	if errors.Is(err, sql.ErrNoRows) {
		return Project{}, ErrNotFound
	}
	p.Platforms, p.SensitiveSelectors = []string(plats), []string(sels)
	return p, err
}

func (s *Store) ProjectByPublicKey(ctx context.Context, key string) (Project, error) {
	var p Project
	var plats, sels StringArray
	err := s.DB.QueryRowContext(ctx, `
		SELECT p.id, p.org_id, p.name, p.platforms, p.notify_enabled, p.sensitive_selectors
		FROM project_keys pk JOIN projects p ON p.id=pk.project_id
		WHERE pk.public_key=$1 AND pk.revoked_at IS NULL`, key).
		Scan(&p.ID, &p.OrgID, &p.Name, &plats, &p.NotifyEnabled, &sels)
	if errors.Is(err, sql.ErrNoRows) {
		return Project{}, ErrUnauthorized
	}
	p.Platforms, p.SensitiveSelectors = []string(plats), []string(sels)
	return p, err
}

func (s *Store) PublicKeyForProject(ctx context.Context, projectID string) (string, error) {
	var key string
	err := s.DB.QueryRowContext(ctx, `
		SELECT public_key FROM project_keys
		WHERE project_id=$1 AND revoked_at IS NULL ORDER BY created_at DESC LIMIT 1`, projectID).Scan(&key)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return key, err
}

func (s *Store) UpdateProjectSettings(ctx context.Context, projectID string, notify *bool, selectors *[]string) error {
	p, err := s.ProjectByID(ctx, projectID)
	if err != nil {
		return err
	}
	if notify != nil {
		p.NotifyEnabled = *notify
	}
	if selectors != nil {
		p.SensitiveSelectors = *selectors
	}
	_, err = s.DB.ExecContext(ctx, `
		UPDATE projects SET notify_enabled=$2, sensitive_selectors=$3 WHERE id=$1`,
		projectID, p.NotifyEnabled, asArray(p.SensitiveSelectors))
	return err
}

func (s *Store) CreateMCPToken(ctx context.Context, projectID string, write bool) (raw string, prefix string, err error) {
	rawToken, err := auth.RandomToken(24)
	if err != nil {
		return "", "", err
	}
	raw = "cl_mcp_" + rawToken
	prefix = raw[:12]
	scopes := []string{"read"}
	if write {
		scopes = append(scopes, "write")
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO mcp_tokens(project_id, token_hash, prefix, scopes) VALUES ($1,$2,$3,$4)`,
		projectID, auth.SHA256(raw), prefix, asArray(scopes))
	return raw, prefix, err
}

func (s *Store) MCPByToken(ctx context.Context, raw string) (projectID string, scopes []string, plan string, err error) {
	var sc StringArray
	err = s.DB.QueryRowContext(ctx, `
		SELECT mt.project_id, mt.scopes, o.plan
		FROM mcp_tokens mt
		JOIN projects p ON p.id=mt.project_id
		JOIN organizations o ON o.id=p.org_id
		WHERE mt.token_hash=$1`, auth.SHA256(raw)).
		Scan(&projectID, &sc, &plan)
	scopes = []string(sc)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil, "", ErrUnauthorized
	}
	if err == nil {
		_, _ = s.DB.ExecContext(ctx, `UPDATE mcp_tokens SET last_used_at=now() WHERE token_hash=$1`, auth.SHA256(raw))
	}
	return
}

func (s *Store) EnsureReporter(ctx context.Context, projectID, externalUID, email string) (string, error) {
	if externalUID == "" && email == "" {
		id := uuid.NewString()
		_, err := s.DB.ExecContext(ctx, `INSERT INTO reporters(id, project_id, email) VALUES ($1,$2,$3)`, id, projectID, nullStr(email))
		return id, err
	}
	var id string
	if externalUID != "" {
		err := s.DB.QueryRowContext(ctx, `
			INSERT INTO reporters(project_id, external_user_id, email)
			VALUES ($1,$2,$3)
			ON CONFLICT (project_id, external_user_id) WHERE external_user_id IS NOT NULL
			DO UPDATE SET email=COALESCE(EXCLUDED.email, reporters.email)
			RETURNING id`, projectID, externalUID, nullStr(email)).Scan(&id)
		return id, err
	}
	err := s.DB.QueryRowContext(ctx, `
		INSERT INTO reporters(project_id, email) VALUES ($1,$2) RETURNING id`, projectID, email).Scan(&id)
	return id, err
}

type CreateReportInput struct {
	Type       string
	Message    string
	Platform   string
	Context    map[string]any
	AppVersion string
	Email      string
	ExternalID string
}

func (s *Store) CreateReport(ctx context.Context, project Project, in CreateReportInput) (ticketID, reportID, attachmentID, uploadToken, storageKey string, err error) {
	if in.Message == "" || in.Type == "" {
		return "", "", "", "", "", ErrInvalidInput
	}
	title := in.Message
	if len(title) > 120 {
		title = title[:120]
	}
	ctxBytes, _ := json.Marshal(in.Context)
	if in.Platform == "" {
		in.Platform = "web"
	}
	reporterID, err := s.EnsureReporter(ctx, project.ID, in.ExternalID, in.Email)
	if err != nil {
		return "", "", "", "", "", err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return "", "", "", "", "", err
	}
	defer tx.Rollback()

	ticketID = uuid.NewString()
	reportID = uuid.NewString()
	attachmentID = uuid.NewString()
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tickets(id, project_id, type, status, title) VALUES ($1,$2,$3,'open',$4)`,
		ticketID, project.ID, in.Type, title); err != nil {
		return "", "", "", "", "", err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO reports(id, ticket_id, reporter_id, message, platform, context, app_version)
		VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		reportID, ticketID, reporterID, in.Message, in.Platform, ctxBytes, nullStr(in.AppVersion)); err != nil {
		return "", "", "", "", "", err
	}
	uploadToken = auth.SHA256(uuid.NewString())[:32]
	storageKey = fmt.Sprintf("%s/screenshot/%s", project.ID, attachmentID)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO attachments(id, report_id, kind, storage_key, upload_token)
		VALUES ($1,$2,'screenshot',$3,$4)`, attachmentID, reportID, storageKey, uploadToken); err != nil {
		return "", "", "", "", "", err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,'user','created',$2)`, ticketID, mustJSON(map[string]any{"report_id": reportID})); err != nil {
		return "", "", "", "", "", err
	}
	if err := tx.Commit(); err != nil {
		return "", "", "", "", "", err
	}
	return ticketID, reportID, attachmentID, uploadToken, storageKey, nil
}

func (s *Store) CompleteUpload(ctx context.Context, attachmentID, token string, size int64) error {
	res, err := s.DB.ExecContext(ctx, `
		UPDATE attachments SET uploaded_at=now(), size_bytes=$3, upload_token=NULL
		WHERE id=$1 AND upload_token=$2`, attachmentID, token, size)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return ErrUnauthorized
	}
	return nil
}

func (s *Store) AttachmentForUpload(ctx context.Context, attachmentID, token string) (storageKey string, err error) {
	err = s.DB.QueryRowContext(ctx, `
		SELECT storage_key FROM attachments WHERE id=$1 AND upload_token=$2`, attachmentID, token).Scan(&storageKey)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrUnauthorized
	}
	return
}

func (s *Store) ListTickets(ctx context.Context, projectID, status, typ, platform string) ([]Ticket, error) {
	q := `SELECT id, project_id, type, status, title, report_count, fixed_at, fixed_note, created_at, updated_at
		FROM tickets WHERE project_id=$1`
	args := []any{projectID}
	i := 2
	if status != "" {
		q += fmt.Sprintf(" AND status=$%d", i)
		args = append(args, status)
		i++
	}
	if typ != "" {
		q += fmt.Sprintf(" AND type=$%d", i)
		args = append(args, typ)
		i++
	}
	_ = platform
	q += " ORDER BY created_at DESC LIMIT 100"
	rows, err := s.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Ticket
	for rows.Next() {
		var t Ticket
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Type, &t.Status, &t.Title, &t.ReportCount, &t.FixedAt, &t.FixedNote, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) GetTicket(ctx context.Context, ticketID string) (Ticket, error) {
	var t Ticket
	err := s.DB.QueryRowContext(ctx, `
		SELECT id, project_id, type, status, title, report_count, fixed_at, fixed_note, created_at, updated_at
		FROM tickets WHERE id=$1`, ticketID).
		Scan(&t.ID, &t.ProjectID, &t.Type, &t.Status, &t.Title, &t.ReportCount, &t.FixedAt, &t.FixedNote, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return Ticket{}, ErrNotFound
	}
	return t, err
}

func (s *Store) TicketReports(ctx context.Context, ticketID string) ([]Report, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT rep.id, rep.ticket_id, rep.reporter_id, r.email, r.external_user_id,
			rep.message, rep.platform, rep.context, rep.app_version, rep.created_at
		FROM reports rep
		LEFT JOIN reporters r ON r.id = rep.reporter_id
		WHERE rep.ticket_id=$1
		ORDER BY rep.created_at`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Report
	for rows.Next() {
		var (
			r          Report
			reporterID sql.NullString
			email      sql.NullString
			externalID sql.NullString
			appVersion sql.NullString
		)
		if err := rows.Scan(
			&r.ID, &r.TicketID, &reporterID, &email, &externalID,
			&r.Message, &r.Platform, &r.Context, &appVersion, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		if reporterID.Valid {
			r.ReporterID = &reporterID.String
		}
		if email.Valid && email.String != "" {
			r.ReporterEmail = &email.String
		}
		if externalID.Valid && externalID.String != "" {
			r.ExternalUserID = &externalID.String
		}
		if appVersion.Valid {
			r.AppVersion = &appVersion.String
		}
		if len(r.Context) == 0 {
			r.Context = json.RawMessage(`{}`)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *Store) ListTicketEvents(ctx context.Context, ticketID string) ([]TicketEvent, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT id, ticket_id, actor, kind, payload, created_at
		FROM ticket_events
		WHERE ticket_id=$1
		ORDER BY created_at`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TicketEvent
	for rows.Next() {
		var e TicketEvent
		if err := rows.Scan(&e.ID, &e.TicketID, &e.Actor, &e.Kind, &e.Payload, &e.CreatedAt); err != nil {
			return nil, err
		}
		if len(e.Payload) == 0 {
			e.Payload = json.RawMessage(`{}`)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) TicketReporterStats(ctx context.Context, ticketID string) (total int, withEmail int, err error) {
	err = s.DB.QueryRowContext(ctx, `
		SELECT
			COUNT(DISTINCT r.id),
			COUNT(DISTINCT r.id) FILTER (WHERE r.email IS NOT NULL AND r.email <> '')
		FROM reports rep
		JOIN reporters r ON r.id = rep.reporter_id
		WHERE rep.ticket_id=$1`, ticketID).Scan(&total, &withEmail)
	return total, withEmail, err
}

func (s *Store) TicketAttachments(ctx context.Context, ticketID string) ([]struct {
	ID         string
	ReportID   string
	Kind       string
	StorageKey string
	Uploaded   bool
}, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT a.id, a.report_id, a.kind, a.storage_key, a.uploaded_at IS NOT NULL
		FROM attachments a
		JOIN reports r ON r.id=a.report_id
		WHERE r.ticket_id=$1`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []struct {
		ID         string
		ReportID   string
		Kind       string
		StorageKey string
		Uploaded   bool
	}
	for rows.Next() {
		var a struct {
			ID         string
			ReportID   string
			Kind       string
			StorageKey string
			Uploaded   bool
		}
		if err := rows.Scan(&a.ID, &a.ReportID, &a.Kind, &a.StorageKey, &a.Uploaded); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

func (s *Store) UpdateTicketStatus(ctx context.Context, ticketID, status, actor, note string) error {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `
		UPDATE tickets SET status=$2, updated_at=now(),
			fixed_at=CASE WHEN $2='fixed' THEN now() ELSE fixed_at END,
			fixed_note=CASE WHEN $3<>'' THEN $3 ELSE fixed_note END
		WHERE id=$1`, ticketID, status, note)
	if err != nil {
		return err
	}
	_, err = s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,$2,'status_changed',$3)`, ticketID, actor, mustJSON(map[string]any{"from": t.Status, "to": status, "note": note}))
	return err
}

func (s *Store) AddNote(ctx context.Context, ticketID, actor, body string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,$2,'note',$3)`, ticketID, actor, mustJSON(map[string]any{"body": body}))
	return err
}

func (s *Store) MergeTickets(ctx context.Context, parentID, actor string, childIDs []string) error {
	if len(childIDs) == 0 {
		return ErrInvalidInput
	}

	parent, err := s.GetTicket(ctx, parentID)
	if err != nil {
		return err
	}

	mergedChildren := make([]string, 0, len(childIDs))
	for _, childID := range childIDs {
		if childID == parentID {
			continue
		}
		child, err := s.GetTicket(ctx, childID)
		if err != nil {
			return err
		}
		if child.ProjectID != parent.ProjectID {
			return ErrInvalidInput
		}
		mergedChildren = append(mergedChildren, childID)
	}
	if len(mergedChildren) == 0 {
		return ErrInvalidInput
	}

	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, childID := range mergedChildren {
		if _, err := tx.ExecContext(ctx, `UPDATE reports SET ticket_id=$1 WHERE ticket_id=$2`, parentID, childID); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `UPDATE tickets SET status='duplicate', updated_at=now() WHERE id=$1`, childID); err != nil {
			return err
		}
	}

	var reportCount int
	if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM reports WHERE ticket_id=$1`, parentID).Scan(&reportCount); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE tickets SET report_count=$2, updated_at=now()
		WHERE id=$1`, parentID, reportCount); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO ticket_events(ticket_id, actor, kind, payload)
		VALUES ($1,$2,'merged',$3)`, parentID, actor, mustJSON(map[string]any{
		"child_ids":    mergedChildren,
		"report_count": reportCount,
	})); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) EnqueueNotify(ctx context.Context, ticketID string) error {
	_, err := s.DB.ExecContext(ctx, `
		INSERT INTO jobs(kind, payload) VALUES ('notify_reporters', $1)`,
		mustJSON(map[string]any{"ticket_id": ticketID}))
	return err
}

func (s *Store) ClaimJobs(ctx context.Context, limit int) ([]struct {
	ID      string
	Kind    string
	Payload json.RawMessage
}, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `
		SELECT id, kind, payload FROM jobs
		WHERE status='pending' AND run_at<=now()
		ORDER BY created_at
		FOR UPDATE SKIP LOCKED
		LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var jobs []struct {
		ID      string
		Kind    string
		Payload json.RawMessage
	}
	var ids []string
	for rows.Next() {
		var j struct {
			ID      string
			Kind    string
			Payload json.RawMessage
		}
		if err := rows.Scan(&j.ID, &j.Kind, &j.Payload); err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
		ids = append(ids, j.ID)
	}
	for _, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE jobs SET status='running', attempts=attempts+1, updated_at=now() WHERE id=$1`, id); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return jobs, nil
}

func (s *Store) FinishJob(ctx context.Context, id string, jobErr error) error {
	if jobErr != nil {
		_, err := s.DB.ExecContext(ctx, `UPDATE jobs SET status='failed', last_error=$2, updated_at=now() WHERE id=$1`, id, jobErr.Error())
		return err
	}
	_, err := s.DB.ExecContext(ctx, `UPDATE jobs SET status='done', updated_at=now() WHERE id=$1`, id)
	return err
}

func (s *Store) NotifyReporters(ctx context.Context, ticketID, note string) (int, []struct{ Email, Body string }, error) {
	t, err := s.GetTicket(ctx, ticketID)
	if err != nil {
		return 0, nil, err
	}
	p, err := s.ProjectByID(ctx, t.ProjectID)
	if err != nil {
		return 0, nil, err
	}
	if !p.NotifyEnabled {
		return 0, nil, nil
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT DISTINCT r.id, r.email
		FROM reports rep
		JOIN reporters r ON r.id=rep.reporter_id
		WHERE rep.ticket_id=$1 AND r.email IS NOT NULL AND r.email<>''`, ticketID)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()
	body := note
	if body == "" && t.FixedNote.Valid {
		body = t.FixedNote.String
	}
	if body == "" {
		body = "Your report was fixed."
	}
	var mails []struct{ Email, Body string }
	count := 0
	for rows.Next() {
		var rid string
		var email sql.NullString
		if err := rows.Scan(&rid, &email); err != nil {
			return 0, nil, err
		}
		_, _ = s.DB.ExecContext(ctx, `
			INSERT INTO notifications(ticket_id, reporter_id, channel, body, sent_at)
			VALUES ($1,$2,'email',$3,now())`, ticketID, rid, body)
		_, _ = s.DB.ExecContext(ctx, `
			INSERT INTO notifications(ticket_id, reporter_id, channel, body, sent_at)
			VALUES ($1,$2,'in_app',$3,now())`, ticketID, rid, body)
		if email.Valid {
			mails = append(mails, struct{ Email, Body string }{Email: email.String, Body: body})
		}
		count++
	}
	return count, mails, rows.Err()
}

func (s *Store) UnseenUpdates(ctx context.Context, projectID, externalUID, email string) ([]map[string]any, error) {
	q := `
		SELECT n.id, n.ticket_id, n.body, t.title, n.sent_at
		FROM notifications n
		JOIN reporters r ON r.id=n.reporter_id
		JOIN tickets t ON t.id=n.ticket_id
		WHERE n.channel='in_app' AND n.seen_at IS NULL AND r.project_id=$1`
	args := []any{projectID}
	if externalUID != "" {
		q += " AND r.external_user_id=$2"
		args = append(args, externalUID)
	} else if email != "" {
		q += " AND r.email=$2"
		args = append(args, email)
	} else {
		return nil, nil
	}
	rows, err := s.DB.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]any
	var ids []string
	for rows.Next() {
		var id, ticketID, body, title string
		var sent sql.NullTime
		if err := rows.Scan(&id, &ticketID, &body, &title, &sent); err != nil {
			return nil, err
		}
		ids = append(ids, id)
		item := map[string]any{"id": id, "ticket_id": ticketID, "body": body, "title": title}
		if sent.Valid {
			item["sent_at"] = sent.Time
		}
		out = append(out, item)
	}
	for _, id := range ids {
		_, _ = s.DB.ExecContext(ctx, `UPDATE notifications SET seen_at=now() WHERE id=$1`, id)
	}
	return out, rows.Err()
}

func (s *Store) UserCanAccessProject(ctx context.Context, userID, projectID string) (bool, error) {
	var ok bool
	err := s.DB.QueryRowContext(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM projects p
			JOIN memberships m ON m.org_id=p.org_id
			WHERE p.id=$1 AND m.user_id=$2
		)`, projectID, userID).Scan(&ok)
	return ok, err
}

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
