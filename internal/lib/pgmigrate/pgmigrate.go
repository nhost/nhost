package pgmigrate

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"math"
	"os"
	"strings"
	"time"

	"github.com/golang-migrate/migrate/v4"
	migratedatabase "github.com/golang-migrate/migrate/v4/database"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source"
)

const (
	sourceConnectionAcquireTimeout = 5 * time.Second
	cleanupTimeout                 = 5 * time.Second
)

var (
	errAdvisoryLockNotHeld    = errors.New("advisory lock was not held")
	errEmptyDatabaseName      = errors.New("database name is empty")
	errNilExecutionConnection = errors.New("database returned a nil execution connection")
	errNilMigrationSourceConn = errors.New("database returned a nil source connection")
)

// Migrate publishes the embedded migration bundle and migrates schema to the
// bundle's explicit target version. The caller owns the dedicated migration
// database; Migrate acquires and closes two connections, resets the execution
// session before releasing it, and does not close the pool. Sharing a
// long-lived application pool is unsupported.
func Migrate(
	ctx context.Context,
	logger *slog.Logger,
	database Database,
	fsys fs.FS,
	migrationPath string,
	schema string,
	target uint,
) (result error) {
	local, err := loadBundle(fsys, migrationPath, target)
	if err != nil {
		return fmt.Errorf("loading PostgreSQL migration bundle: %w", err)
	}

	if err := validateMigrationConfiguration(ctx, database, schema, target); err != nil {
		return fmt.Errorf("validating PostgreSQL migration configuration: %w", err)
	}

	executionConnection, err := acquireExecutionConnection(ctx, database)
	if err != nil {
		return err
	}

	var (
		sourceConnection *sql.Conn
		outerLock        *postgresAdvisoryLock
	)
	defer func() {
		result = cleanupMigrationConnections(
			ctx,
			result,
			outerLock,
			sourceConnection,
			executionConnection,
		)
	}()

	sourceConnection, err = acquireSourceConnection(ctx, database)
	if err != nil {
		return err
	}

	databaseName, outerLock, err := lockMigrationSession(ctx, executionConnection, schema)
	if err != nil {
		return err
	}

	if err := migrateUnderLock(
		ctx,
		logger,
		local,
		schema,
		target,
		databaseName,
		executionConnection,
		sourceConnection,
	); err != nil {
		return fmt.Errorf("running locked PostgreSQL migration operation: %w", err)
	}

	return nil
}

func lockMigrationSession(
	ctx context.Context,
	executionConnection *sql.Conn,
	schema string,
) (string, *postgresAdvisoryLock, error) {
	databaseName, err := currentDatabase(ctx, executionConnection)
	if err != nil {
		return "", nil, err
	}

	outerLock, err := newPostgresAdvisoryLock(executionConnection, databaseName, schema)
	if err != nil {
		return "", nil, err
	}

	if err := outerLock.lock(ctx); err != nil {
		return "", nil, err
	}

	return databaseName, outerLock, nil
}

func acquireExecutionConnection(ctx context.Context, database Database) (*sql.Conn, error) {
	connection, err := database.Conn(ctx)
	if err != nil {
		return nil, fmt.Errorf("acquiring PostgreSQL migration execution connection: %w", err)
	}

	if connection == nil {
		return nil, errNilExecutionConnection
	}

	return connection, nil
}

func acquireSourceConnection(ctx context.Context, database Database) (*sql.Conn, error) {
	sourceCtx, cancel := context.WithTimeout(ctx, sourceConnectionAcquireTimeout)
	defer cancel()

	connection, err := database.Conn(sourceCtx)
	if err != nil {
		return nil, fmt.Errorf(
			"acquiring PostgreSQL migration source connection; migrations require two dedicated "+
				"connections (configure MaxOpenConns to at least 2): %w",
			err,
		)
	}

	if connection == nil {
		return nil, errNilMigrationSourceConn
	}

	return connection, nil
}

func cleanupMigrationConnections(
	ctx context.Context,
	operationErr error,
	outerLock *postgresAdvisoryLock,
	sourceConnection *sql.Conn,
	executionConnection *sql.Conn,
) error {
	cleanupCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cleanupTimeout)
	defer cancel()

	var unlockErr error
	if outerLock != nil {
		unlockErr = outerLock.unlock(cleanupCtx)
	}

	executionResetErr := resetMigrationConnection(cleanupCtx, executionConnection)
	sourceCloseErr := closeMigrationConnection(sourceConnection, "source")
	executionCloseErr := closeMigrationConnection(executionConnection, "execution")

	if joined := errors.Join(
		operationErr,
		unlockErr,
		executionResetErr,
		sourceCloseErr,
		executionCloseErr,
	); joined != nil {
		return fmt.Errorf("completing PostgreSQL migration operation and cleanup: %w", joined)
	}

	return nil
}

func migrateUnderLock(
	ctx context.Context,
	logger *slog.Logger,
	local *bundle,
	schema string,
	target uint,
	databaseName string,
	executionConnection *sql.Conn,
	sourceConnection *sql.Conn,
) error {
	driver, catalogDriver, err := prepareMigrationDrivers(
		ctx,
		schema,
		databaseName,
		executionConnection,
		sourceConnection,
	)
	if err != nil {
		return fmt.Errorf("preparing PostgreSQL migration drivers: %w", err)
	}

	currentVersion, err := readCleanMigrationState(driver, schema)
	if err != nil {
		return fmt.Errorf("validating PostgreSQL migration state: %w", err)
	}

	if err := catalogDriver.catalog.reconcile(local, int64(currentVersion)); err != nil {
		return fmt.Errorf("reconciling migration bundle: %w", err)
	}

	if logger == nil {
		logger = slog.Default()
	}

	logMigrationDirection(ctx, logger, schema, currentVersion, target)

	preparedSource := newPreflightSource(catalogDriver)
	if err := preflightMigrationPath(preparedSource, currentVersion, target); err != nil {
		return fmt.Errorf(
			"preflighting PostgreSQL migration path for schema %q from version %d to %d: %w",
			schema,
			currentVersion,
			target,
			err,
		)
	}

	preparedSource.seal()

	if err := executeTargetMigration(
		ctx,
		logger,
		driver,
		preparedSource,
		schema,
		target,
	); err != nil {
		return fmt.Errorf("executing target migration: %w", err)
	}

	return archiveCatalogAfterTarget(catalogDriver.catalog, target)
}

func archiveCatalogAfterTarget(catalog *catalog, target uint) error {
	targetVersion, err := catalogVersion(target)
	if err != nil {
		return fmt.Errorf("converting migration target for catalog archival: %w", err)
	}

	if err := catalog.archiveAfter(targetVersion); err != nil {
		return fmt.Errorf("archiving unapplied migration catalog suffix: %w", err)
	}

	return nil
}

func prepareMigrationDrivers(
	ctx context.Context,
	schema string,
	databaseName string,
	executionConnection *sql.Conn,
	sourceConnection *sql.Conn,
) (*postgres.Postgres, *catalogSource, error) {
	driver, err := postgres.WithConnection(ctx, executionConnection, &postgres.Config{
		MigrationsTable:       postgres.DefaultMigrationsTable,
		MigrationsTableQuoted: false,
		MultiStatementEnabled: false,
		DatabaseName:          databaseName,
		SchemaName:            schema,
		StatementTimeout:      0,
		MultiStatementMaxSize: postgres.DefaultMultiStatementMaxSize,
	})
	if err != nil {
		return nil, nil, fmt.Errorf(
			"constructing PostgreSQL migration driver for schema %q: %w",
			schema,
			err,
		)
	}

	catalog, err := newSQLCatalog(ctx, sourceConnection, schema)
	if err != nil {
		return nil, nil, fmt.Errorf("constructing migration catalog: %w", err)
	}

	if err := catalog.bootstrap(); err != nil {
		return nil, nil, fmt.Errorf("bootstrapping migration catalog: %w", err)
	}

	catalogDriver := newCatalogSource(catalog)

	return driver, catalogDriver, nil
}

func readCleanMigrationState(driver *postgres.Postgres, schema string) (int, error) {
	currentVersion, dirty, err := driver.Version()
	if err != nil {
		return 0, fmt.Errorf("reading PostgreSQL migration state for schema %q: %w", schema, err)
	}

	if dirty {
		return 0, migrate.ErrDirty{Version: currentVersion}
	}

	if currentVersion < migratedatabase.NilVersion {
		return 0, &IntegrityError{
			Version: 0,
			Issue: fmt.Sprintf(
				"schema migration state contains unsupported version %d",
				currentVersion,
			),
			Cause: nil,
		}
	}

	return currentVersion, nil
}

func executeTargetMigration(
	ctx context.Context,
	logger *slog.Logger,
	driver *postgres.Postgres,
	migrationSource source.Driver,
	schema string,
	target uint,
) error {
	migration, err := migrate.NewWithInstance("catalog", migrationSource, "postgres", driver)
	if err != nil {
		return fmt.Errorf("constructing migration runner for schema %q: %w", schema, err)
	}

	migration.Log = newSlogAdapter(ctx, logger)
	if err := migration.Migrate(target); err != nil && !isOnlyNoChange(err) {
		return fmt.Errorf("migrating PostgreSQL schema %q to version %d: %w", schema, target, err)
	}

	return nil
}

func isOnlyNoChange(err error) bool {
	if !errors.Is(err, migrate.ErrNoChange) || errors.Unwrap(err) != nil {
		return false
	}

	_, joinsMultipleErrors := err.(interface{ Unwrap() []error })

	return !joinsMultipleErrors
}

type preflightSource struct {
	upstream source.Driver
	sealed   bool
	first    cachedSourceVersion
	previous map[uint]cachedSourceVersion
	next     map[uint]cachedSourceVersion
	up       map[uint]cachedSourceBody
	down     map[uint]cachedSourceBody
}

type cachedSourceVersion struct {
	version uint
	err     error
	set     bool
}

type cachedSourceBody struct {
	body       []byte
	identifier string
	err        error
}

func newPreflightSource(upstream source.Driver) *preflightSource {
	return &preflightSource{
		upstream: upstream,
		sealed:   false,
		first: cachedSourceVersion{
			version: 0,
			err:     nil,
			set:     false,
		},
		previous: make(map[uint]cachedSourceVersion),
		next:     make(map[uint]cachedSourceVersion),
		up:       make(map[uint]cachedSourceBody),
		down:     make(map[uint]cachedSourceBody),
	}
}

func (s *preflightSource) seal() {
	s.sealed = true
}

func (s *preflightSource) Open( //nolint:ireturn // source.Driver contract.
	string,
) (source.Driver, error) {
	return nil, errCatalogSourceURL
}

func (s *preflightSource) Close() error {
	return nil
}

func (s *preflightSource) First() (uint, error) {
	if s.first.set {
		return s.first.version, s.first.err
	}

	if s.sealed {
		return 0, migrationPathError(0, "first migration was not covered by preflight")
	}

	version, err := s.upstream.First()
	if err != nil {
		err = fmt.Errorf("reading first catalog migration: %w", err)
	}

	s.first = cachedSourceVersion{version: version, err: err, set: true}

	return version, err
}

func (s *preflightSource) Prev(version uint) (uint, error) {
	return s.link(version, s.previous, s.upstream.Prev, "predecessor")
}

func (s *preflightSource) Next(version uint) (uint, error) {
	return s.link(version, s.next, s.upstream.Next, "successor")
}

func (s *preflightSource) ReadUp(version uint) (io.ReadCloser, string, error) {
	return s.read(version, s.up, s.upstream.ReadUp, "up")
}

func (s *preflightSource) ReadDown(version uint) (io.ReadCloser, string, error) {
	return s.read(version, s.down, s.upstream.ReadDown, "down")
}

func (s *preflightSource) link(
	version uint,
	cache map[uint]cachedSourceVersion,
	load func(uint) (uint, error),
	direction string,
) (uint, error) {
	if cached, found := cache[version]; found {
		return cached.version, cached.err
	}

	if s.sealed {
		return 0, migrationPathError(
			version,
			direction+" link was not covered by preflight",
		)
	}

	linked, err := load(version)
	if err != nil {
		err = fmt.Errorf("reading catalog %s from version %d: %w", direction, version, err)
	}

	cache[version] = cachedSourceVersion{version: linked, err: err, set: true}

	return linked, err
}

func (s *preflightSource) read(
	version uint,
	cache map[uint]cachedSourceBody,
	load func(uint) (io.ReadCloser, string, error),
	direction string,
) (io.ReadCloser, string, error) {
	if cached, found := cache[version]; found {
		return cached.reader()
	}

	if s.sealed {
		return nil, "", migrationPathError(
			version,
			direction+" body was not covered by preflight",
		)
	}

	reader, identifier, err := load(version)
	if err != nil {
		err = fmt.Errorf(
			"reading catalog migration version %d %s body: %w",
			version,
			direction,
			err,
		)
		cache[version] = cachedSourceBody{body: nil, identifier: "", err: err}

		return nil, "", err
	}

	if reader == nil {
		err = migrationPathError(version, direction+" body reader is nil")
		cache[version] = cachedSourceBody{body: nil, identifier: "", err: err}

		return nil, "", err
	}

	body, readErr := io.ReadAll(reader)

	closeErr := reader.Close()
	if err := errors.Join(readErr, closeErr); err != nil {
		err = fmt.Errorf(
			"buffering catalog migration version %d %s body: %w",
			version,
			direction,
			err,
		)
		cache[version] = cachedSourceBody{body: nil, identifier: "", err: err}

		return nil, "", err
	}

	cached := cachedSourceBody{
		body:       bytes.Clone(body),
		identifier: identifier,
		err:        nil,
	}
	cache[version] = cached

	return cached.reader()
}

func (b cachedSourceBody) reader() (io.ReadCloser, string, error) {
	if b.err != nil {
		return nil, "", b.err
	}

	return io.NopCloser(bytes.NewReader(b.body)), b.identifier, nil
}

func logMigrationDirection(
	ctx context.Context,
	logger *slog.Logger,
	schema string,
	currentVersion int,
	target uint,
) {
	logger.InfoContext(
		ctx,
		"migrating PostgreSQL schema to image target",
		"schema",
		schema,
		"current_version",
		currentVersion,
		"target_version",
		target,
		"direction",
		migrationDirection(currentVersion, target),
	)
}

func validateMigrationConfiguration(
	ctx context.Context,
	database Database,
	schema string,
	target uint,
) error {
	if ctx == nil {
		return &ConfigurationError{
			Field: "context",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	if database == nil {
		return &ConfigurationError{
			Field: "database",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	if strings.TrimSpace(schema) == "" {
		return &ConfigurationError{
			Field: "schema",
			Issue: "must not be blank",
			Cause: nil,
		}
	}

	if strings.ContainsRune(schema, 0) {
		return &ConfigurationError{
			Field: "schema",
			Issue: "must not contain a zero byte",
			Cause: nil,
		}
	}

	if uint64(target) > uint64(math.MaxInt) {
		return &ConfigurationError{
			Field: "target",
			Issue: "must fit in the migration runner's integer version range",
			Cause: nil,
		}
	}

	return nil
}

type postgresAdvisoryLock struct {
	connection *sql.Conn
	identifier string
	locked     bool
}

func newPostgresAdvisoryLock(
	connection *sql.Conn,
	databaseName string,
	schema string,
) (*postgresAdvisoryLock, error) {
	identifier, err := migratedatabase.GenerateAdvisoryLockId(
		databaseName,
		schema,
		postgres.DefaultMigrationsTable,
	)
	if err != nil {
		return nil, fmt.Errorf("generating PostgreSQL migration advisory lock identifier: %w", err)
	}

	return &postgresAdvisoryLock{
		connection: connection,
		identifier: identifier,
		locked:     false,
	}, nil
}

func (l *postgresAdvisoryLock) lock(ctx context.Context) error {
	if _, err := l.connection.ExecContext(
		ctx,
		"SELECT pg_advisory_lock($1)",
		l.identifier,
	); err != nil {
		return fmt.Errorf("acquiring outer PostgreSQL migration advisory lock: %w", err)
	}

	l.locked = true

	return nil
}

func (l *postgresAdvisoryLock) unlock(ctx context.Context) error {
	if !l.locked {
		return nil
	}

	var unlocked bool
	if err := l.connection.QueryRowContext(
		ctx,
		"SELECT pg_advisory_unlock($1)",
		l.identifier,
	).Scan(&unlocked); err != nil {
		return fmt.Errorf("releasing outer PostgreSQL migration advisory lock: %w", err)
	}

	if !unlocked {
		return fmt.Errorf(
			"releasing outer PostgreSQL migration advisory lock: %w",
			errAdvisoryLockNotHeld,
		)
	}

	l.locked = false

	return nil
}

func currentDatabase(ctx context.Context, connection *sql.Conn) (string, error) {
	var name string
	if err := connection.QueryRowContext(ctx, "SELECT current_database()").Scan(&name); err != nil {
		return "", fmt.Errorf("reading current PostgreSQL database name: %w", err)
	}

	if name == "" {
		return "", fmt.Errorf("reading current PostgreSQL database name: %w", errEmptyDatabaseName)
	}

	return name, nil
}

func resetMigrationConnection(ctx context.Context, connection *sql.Conn) error {
	if connection == nil {
		return nil
	}

	if _, err := connection.ExecContext(ctx, "DISCARD ALL"); err != nil {
		return fmt.Errorf("resetting PostgreSQL migration execution connection: %w", err)
	}

	return nil
}

func closeMigrationConnection(connection *sql.Conn, purpose string) error {
	if connection == nil {
		return nil
	}

	if err := connection.Close(); err != nil {
		return fmt.Errorf("closing PostgreSQL migration %s connection: %w", purpose, err)
	}

	return nil
}

func migrationDirection(current int, target uint) string {
	if current < 0 {
		return "up"
	}

	currentVersion := uint(current)
	switch {
	case currentVersion < target:
		return "up"
	case currentVersion > target:
		return "down"
	default:
		return "none"
	}
}

func preflightMigrationPath(driver source.Driver, current int, target uint) error {
	if current == migratedatabase.NilVersion {
		if err := preflightFreshMigrationPath(driver, target); err != nil {
			return fmt.Errorf("preflighting fresh migration path: %w", err)
		}

		return nil
	}

	//nolint:gosec // Migrate rejects state below NilVersion before preflight.
	currentVersion := uint(current)
	if currentVersion <= target {
		if err := preflightUpMigrationPath(driver, currentVersion, target); err != nil {
			return fmt.Errorf("validating upward migration path: %w", err)
		}

		return nil
	}

	if err := preflightDownMigrationPath(driver, currentVersion, target); err != nil {
		return fmt.Errorf("validating downward migration path: %w", err)
	}

	return nil
}

func preflightFreshMigrationPath(driver source.Driver, target uint) error {
	first, err := driver.First()
	if err != nil {
		return fmt.Errorf("finding first catalog migration: %w", err)
	}

	if first > target {
		return migrationPathError(first, "first catalog version is newer than the target")
	}

	if err := preflightUpMigrationPathFrom(driver, first, target); err != nil {
		return fmt.Errorf("validating migrations from first version %d: %w", first, err)
	}

	return nil
}

func preflightUpMigrationPath(driver source.Driver, current, target uint) error {
	if err := preflightUpMigrationPathFrom(driver, current, target); err != nil {
		return fmt.Errorf("preflighting upward migration path: %w", err)
	}

	return nil
}

func preflightUpMigrationPathFrom(driver source.Driver, current, target uint) error {
	if err := preflightBody(driver.ReadUp, current); err != nil {
		return err
	}

	version := current

	for version < target {
		next, err := driver.Next(version)
		if err != nil {
			return fmt.Errorf("following catalog successor from version %d: %w", version, err)
		}

		if next <= version {
			return migrationPathError(next, "catalog successor does not increase the version")
		}

		if next > target {
			return migrationPathError(next, "catalog successor skips past the target")
		}

		if err := preflightBody(driver.ReadUp, next); err != nil {
			return err
		}

		version = next
	}

	return nil
}

func preflightDownMigrationPath(driver source.Driver, current, target uint) error {
	if err := preflightBody(driver.ReadUp, current); err != nil {
		return err
	}

	if err := preflightBody(driver.ReadUp, target); err != nil {
		return err
	}

	version := current
	for version > target {
		previous, err := driver.Prev(version)
		if errors.Is(err, os.ErrNotExist) {
			return migrationPathError(version, "catalog chain reaches its root before the target")
		}

		if err != nil {
			return fmt.Errorf("following catalog predecessor from version %d: %w", version, err)
		}

		if previous >= version {
			return migrationPathError(previous, "catalog predecessor does not decrease the version")
		}

		if previous < target {
			return migrationPathError(previous, "catalog predecessor skips past the target")
		}

		if err := preflightBody(driver.ReadDown, version); err != nil {
			return err
		}

		version = previous
	}

	return nil
}

func preflightBody(
	read func(uint) (io.ReadCloser, string, error),
	version uint,
) error {
	body, _, err := read(version)
	if err != nil {
		return fmt.Errorf("validating catalog migration version %d: %w", version, err)
	}

	if err := body.Close(); err != nil {
		return fmt.Errorf("closing catalog migration version %d body: %w", version, err)
	}

	return nil
}

func migrationPathError(version uint, issue string) error {
	return &IntegrityError{
		Version: version,
		Issue:   issue,
		Cause:   nil,
	}
}
