package pgmigrate

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"os"
	"strings"

	"github.com/golang-migrate/migrate/v4/source"
	"github.com/lib/pq"
)

const (
	catalogTableName = "schema_migration_catalog"
	catalogFormatV1  = int64(1)
	maximumChainRows = 2
)

var errInvalidCatalogVersion = errors.New("invalid catalog version")

type catalogRows interface {
	Next() bool
	Scan(dest ...any) error
	Err() error
	Close() error
}

type catalogDatabase interface {
	exec(ctx context.Context, query string, args ...any) error
	query(ctx context.Context, query string, args ...any) (catalogRows, error)
}

type sqlCatalogDatabase struct {
	connection *sql.Conn
}

func (d *sqlCatalogDatabase) exec(ctx context.Context, query string, args ...any) error {
	_, err := d.connection.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("executing catalog statement: %w", err)
	}

	return nil
}

// This adapter returns rows through the narrow catalogRows boundary; queryRows checks Err.
func (d *sqlCatalogDatabase) query( //nolint:ireturn // Returns the catalogRows boundary.
	ctx context.Context,
	query string,
	args ...any,
) (catalogRows, error) {
	//nolint:rowserrcheck // queryRows checks Err through the returned catalogRows boundary.
	rows, err := d.connection.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying catalog: %w", err)
	}

	return rows, nil
}

type catalog struct {
	// source.Driver has no context-aware methods, so the operation context must
	// remain bound to the catalog used by that driver.
	ctx      context.Context //nolint:containedctx // See comment above.
	database catalogDatabase
	schema   string
	relation string
}

type storedMigration struct {
	version         uint
	previousVersion *uint
	identifier      string
	upSQL           []byte
	downSQL         []byte
	upChecksum      []byte
	downChecksum    []byte
	formatVersion   int64
}

func newCatalog(
	ctx context.Context,
	database catalogDatabase,
	schema string,
) (*catalog, error) {
	if ctx == nil {
		return nil, &ConfigurationError{
			Field: "context",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	if database == nil {
		return nil, &ConfigurationError{
			Field: "database",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	if strings.TrimSpace(schema) == "" {
		return nil, &ConfigurationError{
			Field: "schema",
			Issue: "must not be blank",
			Cause: nil,
		}
	}

	if strings.ContainsRune(schema, 0) {
		return nil, &ConfigurationError{
			Field: "schema",
			Issue: "must not contain a zero byte",
			Cause: nil,
		}
	}

	return &catalog{
		ctx:      ctx,
		database: database,
		schema:   schema,
		relation: pq.QuoteIdentifier(schema) + "." + pq.QuoteIdentifier(catalogTableName),
	}, nil
}

func newSQLCatalog(ctx context.Context, connection *sql.Conn, schema string) (*catalog, error) {
	if connection == nil {
		return nil, &ConfigurationError{
			Field: "connection",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	return newCatalog(ctx, &sqlCatalogDatabase{connection: connection}, schema)
}

func (c *catalog) bootstrap() error {
	query := fmt.Sprintf(`
CREATE TABLE IF NOT EXISTS %s (
    version BIGINT PRIMARY KEY,
    previous_version BIGINT NULL,
    identifier TEXT NOT NULL,
    up_sql BYTEA NOT NULL,
    down_sql BYTEA NOT NULL,
    up_sha256 BYTEA NOT NULL,
    down_sha256 BYTEA NOT NULL,
    format_version INTEGER NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT schema_migration_catalog_version_nonnegative CHECK (version >= 0),
    CONSTRAINT schema_migration_catalog_up_sql_nonempty CHECK (octet_length(up_sql) > 0),
    CONSTRAINT schema_migration_catalog_down_sql_nonempty CHECK (octet_length(down_sql) > 0),
    CONSTRAINT schema_migration_catalog_up_sha256_length CHECK (octet_length(up_sha256) = 32),
    CONSTRAINT schema_migration_catalog_down_sha256_length CHECK (octet_length(down_sha256) = 32),
    CONSTRAINT schema_migration_catalog_previous_version_fkey
        FOREIGN KEY (previous_version) REFERENCES %s (version) ON DELETE RESTRICT,
    CONSTRAINT schema_migration_catalog_previous_version_key UNIQUE (previous_version)
);
CREATE UNIQUE INDEX IF NOT EXISTS schema_migration_catalog_one_root
    ON %s ((previous_version IS NULL))
    WHERE previous_version IS NULL;
`, c.relation, c.relation, c.relation)

	if err := c.database.exec(c.ctx, query); err != nil {
		return fmt.Errorf("bootstrapping migration catalog in schema %q: %w", c.schema, err)
	}

	return nil
}

func (c *catalog) publish(local *bundle) error {
	if local == nil {
		return &ConfigurationError{
			Field: "bundle",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	query := fmt.Sprintf(`
INSERT INTO %s (
    version,
    previous_version,
    identifier,
    up_sql,
    down_sql,
    up_sha256,
    down_sha256,
    format_version
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (version) DO NOTHING
`, c.relation)

	for index := range local.migrations {
		if err := c.publishMigration(query, &local.migrations[index]); err != nil {
			return err
		}
	}

	return nil
}

func (c *catalog) publishMigration(query string, migration *migration) error {
	version, err := catalogVersion(migration.version)
	if err != nil {
		return err
	}

	var previousVersion any
	if migration.previousVersion != nil {
		previousVersion, err = catalogVersion(*migration.previousVersion)
		if err != nil {
			return err
		}
	}

	// Concurrent inserts of the same row can hit a chain unique index before
	// PostgreSQL resolves the version conflict. Only an exact readback turns
	// that unique violation into success.
	insertErr := c.database.exec(
		c.ctx,
		query,
		version,
		previousVersion,
		migration.identifier,
		migration.upSQL,
		migration.downSQL,
		migration.upChecksum[:],
		migration.downChecksum[:],
		catalogFormatV1,
	)
	if insertErr != nil && !isUniqueViolation(insertErr) {
		return catalogPublicationError(migration.version, insertErr)
	}

	stored, found, err := c.migration(migration.version)
	if err != nil {
		if insertErr != nil {
			return catalogPublicationError(migration.version, errors.Join(insertErr, err))
		}

		return err
	}

	if !found {
		if insertErr != nil {
			return catalogPublicationError(migration.version, insertErr)
		}

		return &IntegrityError{
			Version: migration.version,
			Issue:   "published row is missing",
			Cause:   nil,
		}
	}

	return compareMigration(*migration, stored)
}

func catalogPublicationError(version uint, cause error) error {
	return &IntegrityError{
		Version: version,
		Issue:   "cannot publish immutable catalog row",
		Cause:   cause,
	}
}

func isUniqueViolation(err error) bool {
	var postgresError *pq.Error

	return errors.As(err, &postgresError) && postgresError.Code == pq.ErrorCode("23505")
}

func compareMigration(local migration, stored storedMigration) error {
	if stored.version != local.version {
		return immutableFieldMismatch(local.version, "version")
	}

	if !equalOptionalVersion(stored.previousVersion, local.previousVersion) {
		return immutableFieldMismatch(local.version, "previous version")
	}

	if stored.identifier != local.identifier {
		return immutableFieldMismatch(local.version, "identifier")
	}

	if !bytes.Equal(stored.upSQL, local.upSQL) {
		return immutableFieldMismatch(local.version, "up SQL")
	}

	if !bytes.Equal(stored.downSQL, local.downSQL) {
		return immutableFieldMismatch(local.version, "down SQL")
	}

	if !bytes.Equal(stored.upChecksum, local.upChecksum[:]) {
		return immutableFieldMismatch(local.version, "up checksum")
	}

	if !bytes.Equal(stored.downChecksum, local.downChecksum[:]) {
		return immutableFieldMismatch(local.version, "down checksum")
	}

	if stored.formatVersion != catalogFormatV1 {
		return immutableFieldMismatch(local.version, "format version")
	}

	return nil
}

func immutableFieldMismatch(version uint, field string) error {
	return &IntegrityError{
		Version: version,
		Issue:   fmt.Sprintf("stored %s does not match embedded migration", field),
		Cause:   nil,
	}
}

func equalOptionalVersion(left, right *uint) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}

	return *left == *right
}

func (c *catalog) migration(version uint) (storedMigration, bool, error) {
	databaseVersion, err := catalogVersion(version)
	if err != nil {
		return storedMigration{}, false, err
	}

	query := fmt.Sprintf(`
SELECT
    version,
    previous_version,
    identifier,
    up_sql,
    down_sql,
    up_sha256,
    down_sha256,
    format_version
FROM %s
WHERE version = $1
`, c.relation)

	var (
		got   storedMigration
		found bool
	)

	err = c.queryRows(query, []any{databaseVersion}, func(rows catalogRows) error {
		if !rows.Next() {
			return nil
		}

		var scanErr error

		got, scanErr = scanStoredMigration(rows, version)
		if scanErr != nil {
			return scanErr
		}

		found = true

		if rows.Next() {
			return &IntegrityError{
				Version: version,
				Issue:   "catalog contains duplicate versions",
				Cause:   nil,
			}
		}

		return nil
	})
	if err != nil {
		return storedMigration{}, false, err
	}

	return got, found, nil
}

func scanStoredMigration(rows catalogRows, requestedVersion uint) (storedMigration, error) {
	var (
		got             storedMigration
		storedVersion   int64
		previousVersion sql.NullInt64
	)
	if err := rows.Scan(
		&storedVersion,
		&previousVersion,
		&got.identifier,
		&got.upSQL,
		&got.downSQL,
		&got.upChecksum,
		&got.downChecksum,
		&got.formatVersion,
	); err != nil {
		return storedMigration{}, &IntegrityError{
			Version: requestedVersion,
			Issue:   "cannot decode catalog row",
			Cause:   err,
		}
	}

	convertedVersion, err := sourceVersion(storedVersion)
	if err != nil {
		return storedMigration{}, &IntegrityError{
			Version: requestedVersion,
			Issue:   "catalog row has an invalid version",
			Cause:   err,
		}
	}

	got.version = convertedVersion

	if previousVersion.Valid {
		convertedPrevious, conversionErr := sourceVersion(previousVersion.Int64)
		if conversionErr != nil {
			return storedMigration{}, &IntegrityError{
				Version: requestedVersion,
				Issue:   "catalog row has an invalid previous version",
				Cause:   conversionErr,
			}
		}

		got.previousVersion = &convertedPrevious
	}

	return got, nil
}

func (c *catalog) queryRows(
	query string,
	args []any,
	scan func(catalogRows) error,
) (err error) {
	rows, err := c.database.query(c.ctx, query, args...)
	if err != nil {
		return fmt.Errorf("reading migration catalog in schema %q: %w", c.schema, err)
	}

	defer func() {
		if closeErr := rows.Close(); closeErr != nil {
			err = errors.Join(
				err,
				fmt.Errorf("closing migration catalog rows in schema %q: %w", c.schema, closeErr),
			)
		}
	}()

	if err := scan(rows); err != nil {
		return err
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating migration catalog rows in schema %q: %w", c.schema, err)
	}

	return nil
}

func (c *catalog) first() (uint, error) {
	query := fmt.Sprintf(`
SELECT version
FROM %s
WHERE previous_version IS NULL
ORDER BY version
LIMIT 2
`, c.relation)

	roots, err := c.queryVersions(query, nil)
	if err != nil {
		return 0, err
	}

	switch len(roots) {
	case 1:
		return roots[0], nil
	case maximumChainRows:
		return 0, &IntegrityError{
			Version: roots[1],
			Issue:   "catalog contains multiple roots",
			Cause:   nil,
		}
	}

	query = fmt.Sprintf(`
SELECT version
FROM %s
ORDER BY version
LIMIT 1
`, c.relation)

	versions, err := c.queryVersions(query, nil)
	if err != nil {
		return 0, err
	}

	if len(versions) == 0 {
		return 0, os.ErrNotExist
	}

	return 0, &IntegrityError{
		Version: versions[0],
		Issue:   "catalog contains migrations but has no root",
		Cause:   nil,
	}
}

func (c *catalog) previous(version uint) (uint, error) {
	stored, found, err := c.migration(version)
	if err != nil {
		return 0, err
	}

	if !found {
		return 0, missingMigration(version)
	}

	if stored.previousVersion == nil {
		return 0, os.ErrNotExist
	}

	_, found, err = c.migration(*stored.previousVersion)
	if err != nil {
		return 0, err
	}

	if !found {
		return 0, &IntegrityError{
			Version: version,
			Issue: fmt.Sprintf(
				"references missing predecessor version %d",
				*stored.previousVersion,
			),
			Cause: nil,
		}
	}

	return *stored.previousVersion, nil
}

func (c *catalog) next(version uint) (uint, error) {
	_, found, err := c.migration(version)
	if err != nil {
		return 0, err
	}

	if !found {
		return 0, missingMigration(version)
	}

	databaseVersion, err := catalogVersion(version)
	if err != nil {
		return 0, err
	}

	query := fmt.Sprintf(`
SELECT version
FROM %s
WHERE previous_version = $1
ORDER BY version
LIMIT 2
`, c.relation)

	successors, err := c.queryVersions(query, []any{databaseVersion})
	if err != nil {
		return 0, err
	}

	switch len(successors) {
	case 0:
		return 0, os.ErrNotExist
	case 1:
		return successors[0], nil
	default:
		return 0, &IntegrityError{
			Version: version,
			Issue:   "catalog contains multiple successors",
			Cause:   nil,
		}
	}
}

func (c *catalog) read(version uint, direction source.Direction) ([]byte, string, error) {
	stored, found, err := c.migration(version)
	if err != nil {
		return nil, "", err
	}

	if !found {
		return nil, "", missingMigration(version)
	}

	if err := validateStoredMigration(version, stored); err != nil {
		return nil, "", err
	}

	body, checksum, err := bodyForDirection(version, stored, direction)
	if err != nil {
		return nil, "", err
	}

	if err := validateStoredBody(version, direction, body, checksum); err != nil {
		return nil, "", err
	}

	return bytes.Clone(body), stored.identifier, nil
}

func validateStoredMigration(version uint, stored storedMigration) error {
	if stored.formatVersion != catalogFormatV1 {
		return &IntegrityError{
			Version: version,
			Issue: fmt.Sprintf(
				"unsupported catalog format version %d",
				stored.formatVersion,
			),
			Cause: nil,
		}
	}

	if strings.TrimSpace(stored.identifier) == "" {
		return &IntegrityError{
			Version: version,
			Issue:   "identifier is blank",
			Cause:   nil,
		}
	}

	return nil
}

func bodyForDirection(
	version uint,
	stored storedMigration,
	direction source.Direction,
) ([]byte, []byte, error) {
	switch direction {
	case source.Up:
		return stored.upSQL, stored.upChecksum, nil
	case source.Down:
		return stored.downSQL, stored.downChecksum, nil
	default:
		return nil, nil, &IntegrityError{
			Version: version,
			Issue:   fmt.Sprintf("unsupported migration direction %q", direction),
			Cause:   nil,
		}
	}
}

func validateStoredBody(
	version uint,
	direction source.Direction,
	body []byte,
	checksum []byte,
) error {
	if len(bytes.TrimSpace(body)) == 0 {
		return &IntegrityError{
			Version: version,
			Issue:   fmt.Sprintf("%s migration body is blank", direction),
			Cause:   nil,
		}
	}

	if len(checksum) != sha256.Size {
		return &IntegrityError{
			Version: version,
			Issue:   fmt.Sprintf("%s checksum has invalid length", direction),
			Cause:   nil,
		}
	}

	calculated := sha256.Sum256(body)
	if !bytes.Equal(checksum, calculated[:]) {
		return &IntegrityError{
			Version: version,
			Issue:   fmt.Sprintf("%s checksum does not match the migration body", direction),
			Cause:   nil,
		}
	}

	return nil
}

func (c *catalog) queryVersions(query string, args []any) ([]uint, error) {
	versions := make([]uint, 0, maximumChainRows)

	err := c.queryRows(query, args, func(rows catalogRows) error {
		for rows.Next() {
			var stored int64
			if scanErr := rows.Scan(&stored); scanErr != nil {
				return &IntegrityError{
					Version: 0,
					Issue:   "cannot decode catalog chain",
					Cause:   scanErr,
				}
			}

			version, conversionErr := sourceVersion(stored)
			if conversionErr != nil {
				return &IntegrityError{
					Version: 0,
					Issue:   "catalog chain contains an invalid version",
					Cause:   conversionErr,
				}
			}

			versions = append(versions, version)
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return versions, nil
}

func missingMigration(version uint) error {
	return &IntegrityError{
		Version: version,
		Issue:   "catalog row is missing",
		Cause:   nil,
	}
}

func catalogVersion(version uint) (int64, error) {
	if uint64(version) > math.MaxInt64 {
		return 0, &IntegrityError{
			Version: version,
			Issue:   "version cannot be represented by the PostgreSQL catalog",
			Cause:   nil,
		}
	}

	return int64(version), nil //nolint:gosec // The bound above proves this conversion is safe.
}

func sourceVersion(version int64) (uint, error) {
	if version < 0 {
		return 0, fmt.Errorf("%w: version %d is negative", errInvalidCatalogVersion, version)
	}

	converted := uint(version)
	if uint64(converted) != uint64(version) {
		return 0, fmt.Errorf(
			"%w: version %d exceeds the platform uint range",
			errInvalidCatalogVersion,
			version,
		)
	}

	return converted, nil
}
