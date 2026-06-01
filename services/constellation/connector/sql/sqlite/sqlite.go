// Package sqlite implements the csql.Driver interface for SQLite via the
// go-sqlite3 CGO driver.
//
// # Choosing a constructor
//
// Production code should call [New], which combines [Open] + [NewClient] +
// csql.NewConnector and returns a ready-to-use *csql.Connector. The two-step
// path ([Open] + [NewClient]) is exported only so [internal/lib/testdb] and
// integration-style tests in sibling packages can share a DB across helpers.
//
// # Client lifecycle
//
// A *Client owns its underlying DB exclusively: [Client.Close] is one-shot and
// the receiver must not be reused after closing. [Open] enables WAL journal
// mode and foreign-key enforcement on the connection; both PRAGMAs are
// idempotent so reopening a database returned by an earlier [Client.Close] is
// safe.
//
// # Scope
//
// This package is intentionally a thin shim around database/sql: introspection
// happens here (via PRAGMA commands in introspect.go), but the heavy SQL
// generation lives in connector/sql/graphql/queries/dialect.SQLiteDialect,
// which the [Client.Dialect] method exposes.
package sqlite

import (
	"context"
	"database/sql"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"log/slog"

	_ "github.com/mattn/go-sqlite3" // database/sql driver registration

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Querier abstracts SQLite query execution. Both DB and Tx satisfy this
// interface, which lets unexported helpers run against either a connection
// or a transaction without depending on database/sql directly.
//
// Querier, DB, Tx, Row, and Rows are exported only so mockgen can target
// them from the mock/ subpackage. The only non-test consumer outside this
// package is [internal/lib/testdb] (itself a test helper), which uses [Open]
// + [NewClient] to share a DB across the broader test suite — see the
// package-level godoc.
//
// The //nolint:ireturn directives on the adapter methods, [Open], [BeginTx],
// and [Client.Dialect] below are a deliberate consequence of this interface
// seam: the adapter pattern forces each method to return one of the local
// interfaces above, which is exactly what ireturn flags.
//
//go:generate mockgen -package mock -destination mock/sqlite.go . Querier,DB,Tx,Row,Rows
type Querier interface {
	QueryContext(ctx context.Context, query string, args ...any) (Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) Row
	ExecContext(ctx context.Context, query string, args ...any) error
}

// DB extends Querier with transaction and lifecycle management.
type DB interface {
	Querier
	BeginTx(ctx context.Context) (Tx, error)
	Close() error
}

// Tx is the subset of sql.Tx the package actually uses: a Querier plus
// commit/rollback. Keeping it local means database/sql never appears in
// this package's call boundaries.
type Tx interface {
	Querier
	Commit() error
	Rollback() error
}

// Row is the result of a single-row query — equivalent to sql.Row.
type Row interface {
	Scan(dest ...any) error
}

// Rows is the result of a multi-row query — the subset of sql.Rows the
// package uses.
type Rows interface {
	Close() error
	Next() bool
	Scan(dest ...any) error
	Err() error
}

// dbAdapter wraps *sql.DB so it satisfies the local DB interface
// (returning Rows/Row/Tx instead of *sql.Rows/*sql.Row/*sql.Tx).
//
// The //nolint:wrapcheck / //nolint:rowserrcheck directives on the adapter
// methods below mark them as deliberate passthroughs: error wrapping and
// rows.Err() handling happen at the corresponding Client method, which is
// the layer that actually owns call-site context.
type dbAdapter struct {
	db *sql.DB
}

func (a *dbAdapter) QueryContext( //nolint:ireturn,nolintlint
	ctx context.Context, query string, args ...any,
) (Rows, error) {
	return a.db.QueryContext(ctx, query, args...) //nolint:wrapcheck,rowserrcheck
}

func (a *dbAdapter) QueryRowContext( //nolint:ireturn,nolintlint
	ctx context.Context, query string, args ...any,
) Row {
	return a.db.QueryRowContext(ctx, query, args...)
}

func (a *dbAdapter) ExecContext(ctx context.Context, query string, args ...any) error {
	_, err := a.db.ExecContext(ctx, query, args...)
	return err //nolint:wrapcheck
}

func (a *dbAdapter) BeginTx(ctx context.Context) (Tx, error) { //nolint:ireturn,nolintlint
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	return &txAdapter{tx: tx}, nil
}

func (a *dbAdapter) Close() error {
	return a.db.Close() //nolint:wrapcheck
}

// txAdapter wraps *sql.Tx so it satisfies the local Tx interface.
type txAdapter struct {
	tx *sql.Tx
}

func (a *txAdapter) QueryContext( //nolint:ireturn,nolintlint
	ctx context.Context, query string, args ...any,
) (Rows, error) {
	return a.tx.QueryContext(ctx, query, args...) //nolint:wrapcheck,rowserrcheck
}

func (a *txAdapter) QueryRowContext( //nolint:ireturn,nolintlint
	ctx context.Context, query string, args ...any,
) Row {
	return a.tx.QueryRowContext(ctx, query, args...)
}

func (a *txAdapter) ExecContext(ctx context.Context, query string, args ...any) error {
	_, err := a.tx.ExecContext(ctx, query, args...)
	return err //nolint:wrapcheck
}

func (a *txAdapter) Commit() error {
	return a.tx.Commit() //nolint:wrapcheck
}

func (a *txAdapter) Rollback() error {
	return a.tx.Rollback() //nolint:wrapcheck
}

// Compile-time check that Client implements csql.Driver.
var _ csql.Driver = (*Client)(nil)

// Client implements the csql.Driver interface for SQLite.
type Client struct {
	db DB
}

// NewClient wraps the given DB in a Client. Production code goes through
// [New] (which combines [Open] + NewClient + csql.NewConnector); NewClient is
// exported so that [internal/lib/testdb] and white-box-style integration
// tests in sibling packages can build a *Client around a DB they already own.
func NewClient(db DB) *Client {
	return &Client{db: db}
}

// Open opens a SQLite database against connStr and enables WAL journal mode
// plus foreign-key enforcement on the connection. The returned DB is ready to
// pass to [NewClient].
//
// Production code goes through [New]; Open is exported so [internal/lib/testdb]
// and integration-style tests in sibling packages can build the DB and Client
// in two steps.
//
// Failure handling: if either PRAGMA fails the underlying *sql.DB is closed
// before returning, and the close error (if any) is joined onto the returned
// error via [errors.Join]. Callers therefore must not Close the returned DB on
// error — it is already closed. On success, the caller owns [DB.Close].
//
// see package-level interface seam note.
func Open(ctx context.Context, connStr string) (DB, error) { //nolint:ireturn,nolintlint
	rawDB, err := sql.Open("sqlite3", connStr)
	if err != nil {
		return nil, fmt.Errorf("opening sqlite database: %w", err)
	}

	if _, execErr := rawDB.ExecContext(ctx, "PRAGMA journal_mode=WAL"); execErr != nil {
		return nil, errors.Join(
			fmt.Errorf("enabling WAL mode: %w", execErr),
			rawDB.Close(),
		)
	}

	if _, execErr := rawDB.ExecContext(ctx, "PRAGMA foreign_keys=ON"); execErr != nil {
		return nil, errors.Join(
			fmt.Errorf("enabling foreign keys: %w", execErr),
			rawDB.Close(),
		)
	}

	return &dbAdapter{db: rawDB}, nil
}

// New creates a SQLite-backed sql.Connector — convenience for
// Open + NewClient + csql.NewConnector for callers who just want the full
// connector wired up from a connection string. inconsistencies receives per-
// table / per-column / per-function reconciliation entries (pass nil to drop
// them on the floor).
func New(
	ctx context.Context,
	connStr string,
	dbMeta *metadata.DatabaseMetadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
) (*csql.Connector, error) {
	db, err := Open(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("creating sqlite client: %w", err)
	}

	c, err := csql.NewConnector(ctx, NewClient(db), dbMeta, inconsistencies, logger)
	if err != nil {
		return nil, errors.Join(
			fmt.Errorf("creating sql connector: %w", err),
			db.Close(),
		)
	}

	return c, nil
}

// Dialect returns the SQLite SQL dialect.
func (c *Client) Dialect() dialect.Dialect { //nolint:ireturn,nolintlint
	return dialect.NewSQLiteDialect()
}

// Close releases the underlying database connection. The csql.Driver
// contract has no error return, so we log instead of propagating — close
// failures (e.g. write-back failure on WAL checkpoint) are otherwise
// invisible.
func (c *Client) Close() {
	if err := c.db.Close(); err != nil {
		slog.Error("failed to close sqlite database", slog.String("error", err.Error()))
	}
}

// ExecuteOperations executes a list of SQL operations within a single
// transaction. Uses a named return so the rollback defer reads the actual
// error returned by the function body — adding an early `return nil, X`
// without setting err would otherwise silently skip rollback.
//
//nolint:nonamedreturns
func (c *Client) ExecuteOperations(
	ctx context.Context, operations []core.SQLOperation, logger *slog.Logger,
) (result map[string]any, err error) {
	tx, err := c.db.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	defer func() {
		if err == nil {
			return
		}

		logger.DebugContext(ctx, "rolling back transaction due to error")

		if rbErr := tx.Rollback(); rbErr != nil && !errors.Is(rbErr, context.Canceled) {
			logger.ErrorContext(
				ctx, "failed to rollback transaction", slog.String("error", rbErr.Error()),
			)
		}
	}()

	opsResults := make(map[string]any, len(operations))

	for _, op := range operations {
		opResult, opErr := executeOperation(ctx, tx, op)
		if opErr != nil {
			err = fmt.Errorf("failed to execute operation %s: %w", op.Name, opErr)
			logger.ErrorContext(
				ctx, "failed to execute operation",
				slog.String("operation", op.Name), slog.String("error", opErr.Error()),
			)

			return nil, err
		}

		opsResults[op.Name] = opResult
	}

	if err = tx.Commit(); err != nil {
		logger.ErrorContext(
			ctx, "failed to commit transaction", slog.String("error", err.Error()),
		)

		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return opsResults, nil
}

// executeOperation executes a single SQL operation and returns the JSON result.
func executeOperation(ctx context.Context, q Querier, op core.SQLOperation) (any, error) {
	row := q.QueryRowContext(ctx, op.SQL, op.Parameters...)

	var rawJSON string

	if err := row.Scan(&rawJSON); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil //nolint:nilnil
		}

		return nil, fmt.Errorf("failed to scan result row: %w", err)
	}

	return jsontext.Value(rawJSON), nil
}

// ExecuteMultiplexedOperation executes a multiplexed subscription query and
// returns each row as a {SubscriptionID, Data} pair — the two-column shape
// used by the subscription poller.
func (c *Client) ExecuteMultiplexedOperation(
	ctx context.Context, sqlQuery string, args []any, logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	logger.DebugContext(
		ctx, "executing multiplexed query",
		slog.String("sql", sqlQuery),
		slog.Int("args", len(args)),
	)

	rows, err := c.db.QueryContext(ctx, sqlQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute multiplexed query: %w", err)
	}
	defer rows.Close()

	var results []core.MultiplexedResult

	for rows.Next() {
		var (
			subID string
			data  []byte
		)

		if err := rows.Scan(&subID, &data); err != nil {
			return nil, fmt.Errorf("failed to scan multiplexed result: %w", err)
		}

		results = append(results, core.MultiplexedResult{
			SubscriptionID: subID,
			Data:           data,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating multiplexed results: %w", err)
	}

	logger.DebugContext(
		ctx, "multiplexed query returned results",
		slog.Int("count", len(results)),
	)

	return results, nil
}
