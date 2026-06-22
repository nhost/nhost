package store

import (
	"context"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nhost/nhost/services/constellation/connector/action"
)

const (
	defaultSchema = "hdb_catalog"
	defaultTable  = "hdb_action_log"
)

var (
	errPostgresConfigMissingDatabaseURL = errors.New("postgres action log database URL is required")
	errPostgresMissingRequiredColumns   = errors.New("missing required columns")
)

// PostgresConfig configures a Hasura-compatible PostgreSQL action-log store.
type PostgresConfig struct {
	DatabaseURL       string
	Schema            string
	Table             string
	CreateIfNotExists bool
}

// PostgresStore persists asynchronous action logs in PostgreSQL.
type PostgresStore struct {
	pool  *pgxpool.Pool
	table string
}

// NewPostgres creates and validates a PostgreSQL-backed action log store.
func NewPostgres(ctx context.Context, cfg PostgresConfig) (*PostgresStore, error) {
	cfg = cfg.withDefaults()
	if cfg.DatabaseURL == "" {
		return nil, errPostgresConfigMissingDatabaseURL
	}

	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("creating action log pool: %w", err)
	}

	store := &PostgresStore{
		pool:  pool,
		table: qualifiedTable(cfg.Schema, cfg.Table),
	}

	if err := store.ensureSchema(ctx, cfg); err != nil {
		pool.Close()

		return nil, err
	}

	return store, nil
}

func (cfg PostgresConfig) withDefaults() PostgresConfig {
	if cfg.Schema == "" {
		cfg.Schema = defaultSchema
	}

	if cfg.Table == "" {
		cfg.Table = defaultTable
	}

	return cfg
}

func (s *PostgresStore) ensureSchema(ctx context.Context, cfg PostgresConfig) error {
	if cfg.CreateIfNotExists {
		if err := s.createSchema(ctx, cfg.Schema, cfg.Table); err != nil {
			return fmt.Errorf("creating action log table: %w", err)
		}
	}

	if err := s.validateSchema(ctx, cfg.Schema, cfg.Table); err != nil {
		return fmt.Errorf("validating action log table: %w", err)
	}

	return nil
}

func (s *PostgresStore) createSchema(ctx context.Context, schema, table string) error {
	_, err := s.pool.Exec(
		ctx,
		"CREATE SCHEMA IF NOT EXISTS "+quoteIdentifier(schema),
	)
	if err != nil {
		return fmt.Errorf("creating schema: %w", err)
	}

	_, err = s.pool.Exec(ctx, "CREATE TABLE IF NOT EXISTS "+qualifiedTable(schema, table)+` (
		id uuid PRIMARY KEY,
		action_name text NOT NULL,
		input_payload jsonb NOT NULL,
		request_headers jsonb NOT NULL,
		session_variables jsonb NOT NULL,
		response_payload jsonb,
		errors jsonb,
		created_at timestamptz NOT NULL DEFAULT now(),
		response_received_at timestamptz,
		status text NOT NULL DEFAULT 'created'
	)`)
	if err != nil {
		return fmt.Errorf("creating table: %w", err)
	}

	_, err = s.pool.Exec(
		ctx,
		"CREATE INDEX IF NOT EXISTS "+quoteIdentifier(table+"_status_created_at_idx")+
			" ON "+qualifiedTable(schema, table)+" (status, created_at)",
	)
	if err != nil {
		return fmt.Errorf("creating status index: %w", err)
	}

	return nil
}

func (s *PostgresStore) validateSchema(ctx context.Context, schema, table string) error {
	rows, err := s.pool.Query(
		ctx,
		`SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = $1 AND table_name = $2`,
		schema,
		table,
	)
	if err != nil {
		return fmt.Errorf("querying information_schema.columns: %w", err)
	}
	defer rows.Close()

	columns := make(map[string]struct{})
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return fmt.Errorf("scanning action log column: %w", err)
		}

		columns[name] = struct{}{}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating action log columns: %w", err)
	}

	missing := missingColumns(columns, []string{
		"id",
		"action_name",
		"input_payload",
		"request_headers",
		"session_variables",
		"response_payload",
		"errors",
		"created_at",
		"response_received_at",
		"status",
	})
	if len(missing) > 0 {
		return fmt.Errorf("%w: %s", errPostgresMissingRequiredColumns, strings.Join(missing, ", "))
	}

	return nil
}

// Insert appends a created action-log entry.
func (s *PostgresStore) Insert(
	ctx context.Context,
	entry action.ActionLogInsert,
) (action.ActionLogEntry, error) {
	id := uuid.New()

	inputPayload, err := json.Marshal(entry.InputPayload)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("marshaling input payload: %w", err)
	}

	requestHeaders, err := json.Marshal(headerToJSON(entry.RequestHeaders))
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("marshaling request headers: %w", err)
	}

	sessionVariables, err := json.Marshal(entry.SessionVariables)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("marshaling session variables: %w", err)
	}

	var createdAt time.Time

	err = s.pool.QueryRow(
		ctx,
		"INSERT INTO "+s.table+` (
			id, action_name, input_payload, request_headers, session_variables, status
		) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6) RETURNING created_at`,
		id.String(),
		entry.ActionName,
		inputPayload,
		requestHeaders,
		sessionVariables,
		string(action.LogStatusCreated),
	).Scan(&createdAt)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("inserting action log row: %w", err)
	}

	return action.ActionLogEntry{
		ID:                 id,
		ActionName:         entry.ActionName,
		InputPayload:       cloneAnyMap(entry.InputPayload),
		RequestHeaders:     cloneHeader(entry.RequestHeaders),
		SessionVariables:   cloneAnyMap(entry.SessionVariables),
		ResponsePayload:    nil,
		Errors:             nil,
		CreatedAt:          createdAt,
		ResponseReceivedAt: nil,
		Status:             action.LogStatusCreated,
	}, nil
}

// ClaimPending atomically marks created rows as processing and returns them.
func (s *PostgresStore) ClaimPending(
	ctx context.Context,
	limit int,
) ([]action.ActionLogEntry, error) {
	if limit <= 0 {
		return nil, nil
	}

	rows, err := s.pool.Query(
		ctx, `WITH claimed AS (
		SELECT id FROM `+s.table+`
		WHERE status = $1
		ORDER BY created_at
		LIMIT $2
		FOR UPDATE SKIP LOCKED
	)
	UPDATE `+s.table+` AS log
	SET status = $3
	FROM claimed
	WHERE log.id = claimed.id
	RETURNING log.id::text, log.action_name, log.input_payload, log.request_headers,
		log.session_variables, log.response_payload, log.errors, log.created_at,
		log.response_received_at, log.status`,
		string(action.LogStatusCreated),
		limit,
		string(action.LogStatusProcessing),
	)
	if err != nil {
		return nil, fmt.Errorf("claiming pending action logs: %w", err)
	}
	defer rows.Close()

	entries, err := pgx.CollectRows(rows, scanActionLogEntry)
	if err != nil {
		return nil, fmt.Errorf("scanning claimed action logs: %w", err)
	}

	return entries, nil
}

// normalizeResponsePayload coerces a webhook response body into a valid JSON
// value so it can be stored as jsonb. An empty body (an empty 2xx response)
// becomes JSON null; a body that is already valid JSON is kept verbatim; any
// other (non-JSON, e.g. plain-text "OK") body is wrapped as a JSON string. This
// keeps the Postgres (::jsonb) and in-memory stores in agreement and prevents
// an empty or non-JSON 2xx response from failing Complete and stranding the row
// in 'processing' forever (ClaimPending only reclaims status='created').
func normalizeResponsePayload(payload []byte) []byte {
	if len(strings.TrimSpace(string(payload))) == 0 {
		return []byte("null")
	}

	var probe any
	if json.Unmarshal(payload, &probe) == nil {
		return payload
	}

	wrapped, err := json.Marshal(string(payload))
	if err != nil {
		return []byte("null")
	}

	return wrapped
}

// Complete stores a successful webhook payload for a processing row. The
// responsePayload is normalized to a valid JSON value (see
// normalizeResponsePayload) so an empty or non-JSON body does not fail the
// ::jsonb cast.
func (s *PostgresStore) Complete(
	ctx context.Context,
	id uuid.UUID,
	responsePayload []byte,
) error {
	responsePayload = normalizeResponsePayload(responsePayload)

	cmd, err := s.pool.Exec(
		ctx,
		"UPDATE "+s.table+` SET status = $2, response_payload = $3::jsonb,
			errors = NULL, response_received_at = now()
		WHERE id = $1 AND status = $4`,
		id.String(),
		string(action.LogStatusCompleted),
		responsePayload,
		string(action.LogStatusProcessing),
	)
	if err != nil {
		return fmt.Errorf("completing action log row: %w", err)
	}

	if cmd.RowsAffected() == 0 {
		return action.ErrActionLogStaleClaim
	}

	return nil
}

// Fail stores a GraphQL errors JSON payload for a processing row.
func (s *PostgresStore) Fail(
	ctx context.Context,
	id uuid.UUID,
	errorsPayload []byte,
) error {
	cmd, err := s.pool.Exec(
		ctx,
		"UPDATE "+s.table+` SET status = $2, response_payload = NULL,
			errors = $3::jsonb, response_received_at = now()
		WHERE id = $1 AND status = $4`,
		id.String(),
		string(action.LogStatusError),
		errorsPayload,
		string(action.LogStatusProcessing),
	)
	if err != nil {
		return fmt.Errorf("failing action log row: %w", err)
	}

	if cmd.RowsAffected() == 0 {
		return action.ErrActionLogStaleClaim
	}

	return nil
}

// Get returns one action-log row by UUID.
func (s *PostgresStore) Get(
	ctx context.Context,
	id uuid.UUID,
) (action.ActionLogEntry, bool, error) {
	row := s.pool.QueryRow(ctx, `SELECT id::text, action_name, input_payload, request_headers,
		session_variables, response_payload, errors, created_at, response_received_at, status
		FROM `+s.table+` WHERE id = $1`, id.String())

	entry, err := scanActionLogRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return emptyActionLogEntry(), false, nil
		}

		return action.ActionLogEntry{}, false, fmt.Errorf("scanning action log row: %w", err)
	}

	return entry, true, nil
}

// RequeueProcessing moves processing rows back to created.
func (s *PostgresStore) RequeueProcessing(ctx context.Context, ids []uuid.UUID) error {
	for _, id := range ids {
		_, err := s.pool.Exec(
			ctx,
			"UPDATE "+s.table+" SET status = $2 WHERE id = $1 AND status = $3",
			id.String(),
			string(action.LogStatusCreated),
			string(action.LogStatusProcessing),
		)
		if err != nil {
			return fmt.Errorf("requeueing action log row %s: %w", id, err)
		}
	}

	return nil
}

// Close closes the PostgreSQL pool.
func (s *PostgresStore) Close() {
	s.pool.Close()
}

func scanActionLogEntry(row pgx.CollectableRow) (action.ActionLogEntry, error) {
	return scanActionLogRow(row)
}

type actionLogScanner interface {
	Scan(dest ...any) error
}

func scanActionLogRow(row actionLogScanner) (action.ActionLogEntry, error) {
	var (
		idText             string
		inputPayload       []byte
		requestHeaders     []byte
		sessionVariables   []byte
		responsePayload    []byte
		errorsPayload      []byte
		responseReceivedAt *time.Time
		status             string
		entry              action.ActionLogEntry
	)

	err := row.Scan(
		&idText,
		&entry.ActionName,
		&inputPayload,
		&requestHeaders,
		&sessionVariables,
		&responsePayload,
		&errorsPayload,
		&entry.CreatedAt,
		&responseReceivedAt,
		&status,
	)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("scanning action log row: %w", err)
	}

	id, err := uuid.Parse(idText)
	if err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("parsing action log id: %w", err)
	}

	var input map[string]any
	if err := json.Unmarshal(inputPayload, &input); err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("decoding input payload: %w", err)
	}

	var headers map[string][]string
	if err := json.Unmarshal(requestHeaders, &headers); err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("decoding request headers: %w", err)
	}

	var session map[string]any
	if err := json.Unmarshal(sessionVariables, &session); err != nil {
		return action.ActionLogEntry{}, fmt.Errorf("decoding session variables: %w", err)
	}

	entry.ID = id
	entry.InputPayload = input
	entry.RequestHeaders = http.Header(headers)
	entry.SessionVariables = session

	entry.ResponsePayload = append([]byte(nil), responsePayload...)
	entry.Errors = append([]byte(nil), errorsPayload...)
	entry.ResponseReceivedAt = responseReceivedAt
	entry.Status = action.LogStatus(status)

	return entry, nil
}

func missingColumns(have map[string]struct{}, required []string) []string {
	missing := make([]string, 0)
	for _, column := range required {
		if _, ok := have[column]; !ok {
			missing = append(missing, column)
		}
	}

	return missing
}

func headerToJSON(headers http.Header) map[string][]string {
	if headers == nil {
		return map[string][]string{}
	}

	out := make(map[string][]string, len(headers))
	for name, values := range headers {
		out[name] = append([]string(nil), values...)
	}

	return out
}

func qualifiedTable(schema, table string) string {
	return quoteIdentifier(schema) + "." + quoteIdentifier(table)
}

func quoteIdentifier(identifier string) string {
	return pgx.Identifier{identifier}.Sanitize()
}
