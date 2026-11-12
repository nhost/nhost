// Package postgres implements the sql.Driver interface for PostgreSQL
// using pgx connection pools. NewClient/New install a small SQL helper
// (constellation_throw_error) on first connect so server-side functions
// can raise errors with custom SQLSTATE codes.
package postgres

import (
	"bytes"
	"context"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"log/slog"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var (
	errSequentialNonJSONResult = errors.New("sequential operation returned non-JSON result")
	errBeginTransaction        = errors.New("failed to begin transaction")
	errReplicaBehind           = errors.New("read replica is behind data already delivered")
	errNoReplayPosition        = errors.New("server reported no WAL replay position")
)

const (
	replayPositionSQL  = "SELECT (pg_last_wal_replay_lsn() - '0/0'::pg_lsn)::bigint"
	primaryPositionSQL = "SELECT (pg_current_wal_insert_lsn() - '0/0'::pg_lsn)::bigint"
)

// Querier abstracts database query execution. Both Pool and Tx satisfy this
// interface, which lets unexported helpers run against either a pool or a
// transaction without depending on pgx directly.
//
// Querier, Pool, Tx, Row, and Rows are exported only so mockgen can target
// them from the mock/ subpackage; no production caller outside this package
// references them.
//
//go:generate mockgen -package mock -destination mock/postgres.go . Querier,Pool,Tx,Row,Rows
type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) Row
	Exec(ctx context.Context, sql string, args ...any) error
}

// Pool extends Querier with transaction and lifecycle management.
type Pool interface {
	Querier
	BeginTx(ctx context.Context) (Tx, error)
	Close()
}

// Tx is the subset of pgx.Tx the package actually uses: a Querier plus
// commit/rollback. Keeping it local means pgx never appears in this
// package's call boundaries.
type Tx interface {
	Querier
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

// Row is the local single-row result type. Keeping it local means pgx.Row
// never appears on this package's call boundaries.
type Row interface {
	Scan(dest ...any) error
}

// Rows is the subset of pgx.Rows the package uses, declared locally so pgx
// never appears on this package's call boundaries.
type Rows interface {
	Close()
	Next() bool
	Scan(dest ...any) error
	Err() error
}

const (
	poolMinMaxConns          = 4
	poolMinMinConns          = 1
	poolMinMaxConnLifetime   = time.Hour
	poolMinMaxConnIdleTime   = time.Minute * 30
	poolMinHealthCheckPeriod = time.Minute
	replicaConnectTimeout    = 5 * time.Second
)

// Retry configuration for the constellation_throw_error init SQL. Declared as
// variables so internal tests can shrink the delay; production code never
// mutates them.
//
//nolint:gochecknoglobals
var (
	sqlInitMaxRetries     = 5
	sqlInitBaseRetryDelay = 1000 * time.Millisecond
)

func newPool( //nolint:ireturn,nolintlint
	ctx context.Context, connStr string,
) (Pool, error) {
	config, err := pgxpool.ParseConfig(connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database config: %w", err)
	}

	if config.MaxConns < poolMinMaxConns {
		config.MaxConns = poolMinMaxConns
	}

	if config.MinConns < poolMinMinConns {
		config.MinConns = poolMinMinConns
	}

	if config.MaxConnLifetime < poolMinMaxConnLifetime {
		config.MaxConnLifetime = poolMinMaxConnLifetime
	}

	if config.MaxConnIdleTime < poolMinMaxConnIdleTime {
		config.MaxConnIdleTime = poolMinMaxConnIdleTime
	}

	if config.HealthCheckPeriod < poolMinHealthCheckPeriod {
		config.HealthCheckPeriod = poolMinHealthCheckPeriod
	}

	pgxPool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return &poolAdapter{Pool: pgxPool}, nil
}

// poolAdapter wraps *pgxpool.Pool so it implements the local Pool interface
// (returning Rows/Row/Tx instead of pgx.Rows/pgx.Row/pgx.Tx).
type poolAdapter struct {
	*pgxpool.Pool
}

// Pass-throughs to *pgxpool.Pool that narrow pgx return types to the local
// interfaces. Each caller wraps the resulting error with its own context, and
// owns Close() on the returned Rows.
func (p *poolAdapter) Query( //nolint:ireturn,nolintlint
	ctx context.Context, sql string, args ...any,
) (Rows, error) {
	return p.Pool.Query(ctx, sql, args...) //nolint:sqlclosecheck,wrapcheck
}

func (p *poolAdapter) QueryRow( //nolint:ireturn,nolintlint
	ctx context.Context, sql string, args ...any,
) Row {
	return &rowAdapter{Row: p.Pool.QueryRow(ctx, sql, args...)}
}

func (p *poolAdapter) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := p.Pool.Exec(ctx, sql, args...)
	return err //nolint:wrapcheck
}

func (p *poolAdapter) BeginTx(ctx context.Context) (Tx, error) { //nolint:ireturn,nolintlint
	tx, err := p.Pool.BeginTx(ctx, pgx.TxOptions{}) //nolint:exhaustruct
	if err != nil {
		return nil, err //nolint:wrapcheck
	}

	return &txAdapter{Tx: tx}, nil
}

// rowAdapter is a pass-through wrapper over pgx.Row, present so the
// poolAdapter and txAdapter can return the local Row interface instead of
// pgx.Row directly.
type rowAdapter struct {
	pgx.Row
}

// txAdapter narrows pgx.Tx return types (Query, QueryRow) to the locally
// defined Rows/Row interfaces, so callers in this package never import pgx.
type txAdapter struct {
	pgx.Tx
}

func (t *txAdapter) Query( //nolint:ireturn,nolintlint
	ctx context.Context, sql string, args ...any,
) (Rows, error) {
	return t.Tx.Query(ctx, sql, args...) //nolint:sqlclosecheck,wrapcheck
}

func (t *txAdapter) QueryRow( //nolint:ireturn,nolintlint
	ctx context.Context, sql string, args ...any,
) Row {
	return &rowAdapter{Row: t.Tx.QueryRow(ctx, sql, args...)}
}

func (t *txAdapter) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := t.Tx.Exec(ctx, sql, args...)
	return err //nolint:wrapcheck
}

// Client implements the sql.Driver interface for PostgreSQL.
type Client struct {
	pool        Pool
	replicas    []Pool
	nextReplica atomic.Uint64
	// readFloor is the newest WAL position whose data a subscription poll may
	// already have delivered. A replica that has not replayed up to it is
	// skipped so no subscriber is sent older data than it has seen.
	readFloor atomic.Int64
}

const sqlInit = `CREATE OR REPLACE FUNCTION constellation_throw_error(message text, errcode text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '%', message USING ERRCODE = errcode;
END;
$$;`

func execSQLInit(ctx context.Context, q Querier) error {
	var err error

	for attempt := range sqlInitMaxRetries {
		if err = q.Exec(ctx, sqlInit); err == nil {
			return nil
		}

		if attempt < sqlInitMaxRetries-1 {
			delay := sqlInitBaseRetryDelay << attempt

			select {
			case <-ctx.Done():
				return fmt.Errorf("context cancelled while retrying sqlInit: %w", ctx.Err())
			case <-time.After(delay):
			}
		}
	}

	return fmt.Errorf(
		"failed to initialize constellation functions after %d attempts: %w",
		sqlInitMaxRetries,
		err,
	)
}

// NewClient wraps the given Pool in a Client. Production code goes through
// [New] (which combines [Open] + NewClient + csql.NewConnector); NewClient is
// exported so that [internal/lib/testdb] and white-box-style integration
// tests in sibling packages (e.g. connector/sql/graphql/queries,
// connector/sql/graphql/schema) can build a *Client around a Pool they
// already own.
func NewClient(pool Pool) *Client {
	return &Client{
		pool:        pool,
		replicas:    nil,
		nextReplica: atomic.Uint64{},
		readFloor:   atomic.Int64{},
	}
}

// Open opens a pgx connection pool against connStr and runs the
// constellation_throw_error init SQL on it. The returned Pool is ready to
// pass to [NewClient]. Production code goes through [New]; Open is exported
// so [internal/lib/testdb] and integration-style tests in sibling packages
// can build the Pool and Client in two steps when they need to share the
// pool across helpers.
func Open(ctx context.Context, connStr string) (Pool, error) { //nolint:ireturn,nolintlint
	pool, err := newPool(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get database pool: %w", err)
	}

	if err := execSQLInit(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("initializing constellation functions: %w", err)
	}

	return pool, nil
}

// New creates a PostgreSQL-backed sql.Connector — convenience for
// Open + NewClient + csql.NewConnector for callers who just want the full
// connector wired up from a connection string. replicaURLs holds one entry per
// metadata read replica, in order; an empty entry marks a replica that was
// already skipped. inconsistencies receives per-table / per-column /
// per-function reconciliation entries and skipped replicas (pass nil to drop
// them on the floor).
func New(
	ctx context.Context,
	connStr string,
	replicaURLs []string,
	dbMeta *metadata.DatabaseMetadata,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
) (*csql.Connector, error) {
	pool, err := Open(ctx, connStr)
	if err != nil {
		return nil, err
	}

	client := NewClient(pool)
	client.replicas = openReplicas(ctx, replicaURLs, dbMeta.Name, inconsistencies, logger)

	c, err := csql.NewConnector(ctx, client, dbMeta, inconsistencies, logger)
	if err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to create sql connector: %w", err)
	}

	return c, nil
}

// openReplicas opens a pool for every non-empty replica URL. A replica that
// cannot be reached is recorded as an inconsistency and left out, so the
// source keeps serving from its primary.
func openReplicas(
	ctx context.Context,
	replicaURLs []string,
	source string,
	inconsistencies *metadata.Inconsistencies,
	logger *slog.Logger,
) []Pool {
	var replicas []Pool

	for i, connStr := range replicaURLs {
		if connStr == "" {
			continue
		}

		replica, err := openReplica(ctx, connStr)
		if err != nil {
			inconsistencies.RecordReadReplica(ctx, logger, source, i, err.Error())
			continue
		}

		replicas = append(replicas, replica)
	}

	return replicas
}

// openReplica opens a pool against a read-only replica. Unlike [Open] it runs
// no init SQL, which would fail on a standby, and instead checks that the
// replica answers a query.
func openReplica(ctx context.Context, connStr string) (Pool, error) { //nolint:ireturn,nolintlint
	pool, err := newPool(ctx, connStr)
	if err != nil {
		return nil, fmt.Errorf("opening read replica: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, replicaConnectTimeout)
	defer cancel()

	if err := pool.Exec(pingCtx, "SELECT 1"); err != nil {
		pool.Close()
		return nil, fmt.Errorf("connecting to read replica: %w", err)
	}

	return pool, nil
}

// Dialect returns the PostgreSQL SQL dialect.
func (c *Client) Dialect() dialect.Dialect { //nolint:ireturn,nolintlint
	return dialect.NewPostgresDialect()
}

// Close releases the primary and replica connection pools.
func (c *Client) Close() {
	c.pool.Close()

	for _, replica := range c.replicas {
		replica.Close()
	}
}

// ExecuteOperations executes a list of SQL operations within a single
// transaction on the primary.
func (c *Client) ExecuteOperations(
	ctx context.Context, operations []core.SQLOperation, logger *slog.Logger,
) (map[string]any, error) {
	return c.executeOperationsOn(ctx, c.pool, operations, logger)
}

// ExecuteReadOperations executes read-only operations on the next read
// replica in turn, or on the primary when the source has none. If the replica
// cannot start a transaction the operations run on the primary instead; any
// other failure is returned as is.
func (c *Client) ExecuteReadOperations(
	ctx context.Context, operations []core.SQLOperation, logger *slog.Logger,
) (map[string]any, error) {
	if len(c.replicas) == 0 {
		return c.executeOperationsOn(ctx, c.pool, operations, logger)
	}

	result, err := c.executeOperationsOn(ctx, c.pickReplica(), operations, logger)
	if errors.Is(err, errBeginTransaction) {
		logger.WarnContext(
			ctx, "read replica unavailable, running query on primary",
			slog.String("error", err.Error()),
		)

		return c.executeOperationsOn(ctx, c.pool, operations, logger)
	}

	return result, err
}

// pickReplica returns the next read replica in turn. The client must have at
// least one.
func (c *Client) pickReplica() Pool { //nolint:ireturn,nolintlint
	return c.replicas[(c.nextReplica.Add(1)-1)%uint64(len(c.replicas))]
}

// executeOperationsOn executes operations within a single transaction on
// pool. Uses named returns so the rollback defer reads the actual error
// returned by the function body.
//
//nolint:nonamedreturns
func (c *Client) executeOperationsOn(
	ctx context.Context, pool Pool, operations []core.SQLOperation, logger *slog.Logger,
) (result map[string]any, err error) {
	tx, err := pool.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errBeginTransaction, err)
	}

	defer func() {
		if err == nil {
			return
		}

		logger.DebugContext(ctx, "rolling back transaction due to error")

		if rbErr := tx.Rollback(ctx); rbErr != nil && !errors.Is(rbErr, context.Canceled) {
			logger.ErrorContext(
				ctx, "failed to rollback transaction", slog.String("error", rbErr.Error()),
			)
		}
	}()

	opsResults := make(map[string]any, len(operations))

	for _, op := range operations {
		opResult, opErr := c.executeOperation(ctx, tx, op)
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

	if err = tx.Commit(ctx); err != nil {
		logger.ErrorContext(
			ctx, "failed to commit transaction", slog.String("error", err.Error()),
		)

		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return opsResults, nil
}

func (c *Client) executeOperation(
	ctx context.Context,
	q Querier,
	op core.SQLOperation,
) (any, error) {
	if op.Insert != nil {
		result, err := executeInsertPlan(ctx, q, op.Insert)
		if err != nil || result == nil {
			return nil, err
		}

		return result, nil
	}

	if len(op.Sequential) > 0 {
		return c.executeSequentialOperation(ctx, q, op.Sequential)
	}

	row := q.QueryRow(ctx, op.SQL, op.Parameters...)

	var rawJSON []byte
	if err := row.Scan(&rawJSON); err != nil {
		// A no-rows scan is a successful operation that returned nothing;
		// upstream distinguishes nil from a populated jsontext.Value.
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil //nolint:nilnil
		}

		return nil, fmt.Errorf("failed to scan result row: %w", err)
	}

	return jsontext.Value(rawJSON), nil
}

func (c *Client) executeSequentialOperation(
	ctx context.Context,
	q Querier,
	operations []core.SQLOperation,
) (jsontext.Value, error) {
	var b bytes.Buffer

	b.WriteByte('[')

	for i, op := range operations {
		if i > 0 {
			b.WriteByte(',')
		}

		result, err := c.executeOperation(ctx, q, op)
		if err != nil {
			return nil, fmt.Errorf("failed to execute sequential operation %s: %w", op.Name, err)
		}

		if result == nil {
			b.WriteString("null")

			continue
		}

		value, ok := result.(jsontext.Value)
		if !ok {
			return nil, fmt.Errorf(
				"%w: %s returned %T", errSequentialNonJSONResult, op.Name, result,
			)
		}

		b.Write(value)
	}

	b.WriteByte(']')

	return jsontext.Value(b.Bytes()), nil
}

// ExecuteMultiplexedOperation executes a multiplexed SQL query and returns
// each row as a {SubscriptionID, Data} pair — the two-column shape used by
// the subscription poller.
func (c *Client) ExecuteMultiplexedOperation(
	ctx context.Context,
	sqlQuery string,
	args []any,
	logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	logger.DebugContext(
		ctx, "executing multiplexed query",
		slog.String("sql", sqlQuery),
		slog.Int("args", len(args)),
	)

	if len(c.replicas) == 0 {
		return queryMultiplexed(ctx, c.pool, sqlQuery, args, logger)
	}

	results, err := c.multiplexedOnReplica(ctx, c.pickReplica(), sqlQuery, args, logger)
	if err == nil {
		return results, nil
	}

	logger.DebugContext(
		ctx, "running subscription poll on primary", slog.String("reason", err.Error()),
	)

	return c.multiplexedOnPrimary(ctx, sqlQuery, args, logger)
}

// multiplexedOnReplica runs a subscription poll on replica only if the replica
// has replayed everything a previous poll may have delivered. Its replay
// position is read before the poll query, to compare with the floor, and
// after it, to raise the floor: the query saw data between the two.
func (c *Client) multiplexedOnReplica(
	ctx context.Context, replica Pool, sqlQuery string, args []any, logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	before, err := walPosition(ctx, replica, replayPositionSQL)
	if err != nil {
		return nil, err
	}

	if before < c.readFloor.Load() {
		return nil, errReplicaBehind
	}

	results, err := queryMultiplexed(ctx, replica, sqlQuery, args, logger)
	if err != nil {
		return nil, err
	}

	after, err := walPosition(ctx, replica, replayPositionSQL)
	if err != nil {
		return nil, err
	}

	c.raiseReadFloor(after)

	return results, nil
}

// multiplexedOnPrimary runs a subscription poll on the primary and raises the
// floor to the primary's WAL position read after the query.
func (c *Client) multiplexedOnPrimary(
	ctx context.Context, sqlQuery string, args []any, logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	results, err := queryMultiplexed(ctx, c.pool, sqlQuery, args, logger)
	if err != nil {
		return nil, err
	}

	after, err := walPosition(ctx, c.pool, primaryPositionSQL)
	if err != nil {
		return nil, err
	}

	c.raiseReadFloor(after)

	return results, nil
}

func (c *Client) raiseReadFloor(position int64) {
	for {
		current := c.readFloor.Load()
		if position <= current || c.readFloor.CompareAndSwap(current, position) {
			return
		}
	}
}

// walPosition returns the WAL position reported by positionSQL as a byte
// offset.
func walPosition(ctx context.Context, q Querier, positionSQL string) (int64, error) {
	var position *int64
	if err := q.QueryRow(ctx, positionSQL).Scan(&position); err != nil {
		return 0, fmt.Errorf("reading WAL position: %w", err)
	}

	if position == nil {
		return 0, errNoReplayPosition
	}

	return *position, nil
}

func queryMultiplexed(
	ctx context.Context, q Querier, sqlQuery string, args []any, logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	rows, err := q.Query(ctx, sqlQuery, args...)
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
