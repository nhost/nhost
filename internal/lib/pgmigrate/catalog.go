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
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version BIGINT NOT NULL,
    previous_id UUID NULL,
    identifier TEXT NOT NULL,
    up_sql BYTEA NOT NULL,
    down_sql BYTEA NOT NULL,
    up_sha256 BYTEA NOT NULL,
    down_sha256 BYTEA NOT NULL,
    format_version INTEGER NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ NULL,
    archive_batch_id UUID NULL,
    CONSTRAINT schema_migration_catalog_version_nonnegative CHECK (version >= 0),
    CONSTRAINT schema_migration_catalog_up_sql_nonempty CHECK (octet_length(up_sql) > 0),
    CONSTRAINT schema_migration_catalog_down_sql_nonempty CHECK (octet_length(down_sql) > 0),
    CONSTRAINT schema_migration_catalog_up_sha256_length CHECK (octet_length(up_sha256) = 32),
    CONSTRAINT schema_migration_catalog_down_sha256_length CHECK (octet_length(down_sha256) = 32),
    CONSTRAINT schema_migration_catalog_previous_id_fkey
        FOREIGN KEY (previous_id) REFERENCES %s (id) ON DELETE RESTRICT,
    CONSTRAINT schema_migration_catalog_archive_metadata_check CHECK (
        (archived_at IS NULL) = (archive_batch_id IS NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS schema_migration_catalog_active_version
    ON %s (version)
    WHERE archived_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS schema_migration_catalog_active_successor
    ON %s (previous_id)
    WHERE archived_at IS NULL AND previous_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS schema_migration_catalog_one_active_root
    ON %s ((previous_id IS NULL))
    WHERE archived_at IS NULL AND previous_id IS NULL;
`, c.relation, c.relation, c.relation, c.relation, c.relation)

	if err := c.database.exec(c.ctx, query); err != nil {
		return fmt.Errorf("bootstrapping migration catalog in schema %q: %w", c.schema, err)
	}

	return nil
}

func (c *catalog) reconcile(local *bundle, currentVersion int64) error {
	if local == nil {
		return &ConfigurationError{
			Field: "bundle",
			Issue: "must not be nil",
			Cause: nil,
		}
	}

	matches, err := c.activeFutureMatches(local, currentVersion)
	if err != nil {
		return err
	}

	if !matches {
		if err := c.archiveAfter(currentVersion); err != nil {
			return err
		}
	}

	return c.publish(local)
}

//nolint:cyclop,funlen // One ordered scan preserves divergence precedence and its lineage state.
func (c *catalog) activeFutureMatches(local *bundle, currentVersion int64) (bool, error) {
	query := fmt.Sprintf(`
SELECT version
FROM %s
WHERE archived_at IS NULL
ORDER BY version
`, c.relation)

	activeVersions, err := c.queryVersions(query, nil)
	if err != nil {
		return false, err
	}

	activeVersionSet := make(map[uint]struct{}, len(activeVersions))
	for _, version := range activeVersions {
		activeVersionSet[version] = struct{}{}
	}

	localByVersion := make(map[uint]*migration, len(local.migrations))
	localAppliedVersionMissingFromCatalog := false

	for index := range local.migrations {
		migration := &local.migrations[index]
		localByVersion[migration.version] = migration

		_, active := activeVersionSet[migration.version]
		if !active && !versionAfter(migration.version, currentVersion) {
			localAppliedVersionMissingFromCatalog = true
		}
	}

	var (
		lastCommonVersion          *uint
		firstMissingAppliedVersion *uint
		futureMatches              = true
	)

	for _, version := range activeVersions {
		stored, found, migrationErr := c.migration(version)
		if migrationErr != nil {
			return false, migrationErr
		}

		if !found {
			return false, missingMigration(version)
		}

		localMigration, present := localByVersion[version]
		if versionAfter(version, currentVersion) {
			if !present || !migrationMatches(*localMigration, stored) {
				futureMatches = false

				break
			}

			continue
		}

		if !present {
			if firstMissingAppliedVersion == nil {
				missingVersion := version
				firstMissingAppliedVersion = &missingVersion
			}

			continue
		}

		if err := compareMigration(*localMigration, stored); err != nil {
			if migrationLineageDiffers(*localMigration, stored) {
				return false, appliedLineageDivergence(version, lastCommonVersion)
			}

			return false, err
		}

		commonVersion := version
		lastCommonVersion = &commonVersion
	}

	// Defer this diagnostic so a later shared version can report its more specific mismatch first.
	if firstMissingAppliedVersion != nil &&
		(local.target > *firstMissingAppliedVersion || localAppliedVersionMissingFromCatalog) {
		return false, appliedLineageDivergence(*firstMissingAppliedVersion, lastCommonVersion)
	}

	return futureMatches, nil
}

func versionAfter(version uint, currentVersion int64) bool {
	if currentVersion < 0 {
		return true
	}

	return uint64(version) > uint64(currentVersion)
}

func (c *catalog) archiveAfter(version int64) error {
	query := fmt.Sprintf(`
WITH archive_batch AS MATERIALIZED (
    SELECT gen_random_uuid() AS id, CURRENT_TIMESTAMP AS archived_at
)
UPDATE %s AS migration
SET
    archived_at = archive_batch.archived_at,
    archive_batch_id = archive_batch.id
FROM archive_batch
WHERE migration.archived_at IS NULL AND migration.version > $1
`, c.relation)

	if err := c.database.exec(c.ctx, query, version); err != nil {
		return fmt.Errorf(
			"archiving migration catalog suffix after version %d in schema %q: %w",
			version,
			c.schema,
			err,
		)
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
    previous_id,
    identifier,
    up_sql,
    down_sql,
    up_sha256,
    down_sha256,
    format_version
) VALUES (
    $1,
    (SELECT id FROM %s WHERE version = $2 AND archived_at IS NULL),
    $3,
    $4,
    $5,
    $6,
    $7,
    $8
)
ON CONFLICT (version) WHERE archived_at IS NULL DO NOTHING
`, c.relation, c.relation)

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
			Version: new(migration.version),
			Issue:   "published row is missing",
			Cause:   nil,
		}
	}

	return compareMigration(*migration, stored)
}

func catalogPublicationError(version uint, cause error) error {
	return &IntegrityError{
		Version: new(version),
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

func migrationMatches(local migration, stored storedMigration) bool {
	return compareMigration(local, stored) == nil
}

func migrationLineageDiffers(local migration, stored storedMigration) bool {
	return stored.identifier != local.identifier ||
		!equalOptionalVersion(stored.previousVersion, local.previousVersion)
}

func appliedLineageDivergence(version uint, lastCommonVersion *uint) error {
	if lastCommonVersion == nil {
		return &IntegrityError{
			Version: new(version),
			Issue: fmt.Sprintf(
				"active catalog version %d belongs to a different lineage and is still applied; "+
					"the active and embedded bundles have no common lineage version, so pgmigrate "+
					"cannot replace this lineage in place; keep using a compatible bundle or "+
					"reinitialize the schema and explicitly migrate required data before deploying "+
					"this bundle",
				version,
			),
			Cause: nil,
		}
	}

	return &IntegrityError{
		Version: new(version),
		Issue: fmt.Sprintf(
			"active catalog version %d belongs to a different lineage and is still applied; "+
				"downgrade below version %d with an image whose bundle maximum is <= %d "+
				"before deploying this bundle",
			version,
			version,
			*lastCommonVersion,
		),
		Cause: nil,
	}
}

func immutableFieldMismatch(version uint, field string) error {
	return &IntegrityError{
		Version: new(version),
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
    migration.version,
    migration.previous_id,
    predecessor.version,
    migration.identifier,
    migration.up_sql,
    migration.down_sql,
    migration.up_sha256,
    migration.down_sha256,
    migration.format_version
FROM %s AS migration
LEFT JOIN %s AS predecessor ON predecessor.id = migration.previous_id
WHERE migration.version = $1 AND migration.archived_at IS NULL
`, c.relation, c.relation)

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
				Version: new(version),
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
		previousID      sql.NullString
		previousVersion sql.NullInt64
	)
	if err := rows.Scan(
		&storedVersion,
		&previousID,
		&previousVersion,
		&got.identifier,
		&got.upSQL,
		&got.downSQL,
		&got.upChecksum,
		&got.downChecksum,
		&got.formatVersion,
	); err != nil {
		return storedMigration{}, &IntegrityError{
			Version: new(requestedVersion),
			Issue:   "cannot decode catalog row",
			Cause:   err,
		}
	}

	convertedVersion, err := sourceVersion(storedVersion)
	if err != nil {
		return storedMigration{}, &IntegrityError{
			Version: new(requestedVersion),
			Issue:   "catalog row has an invalid version",
			Cause:   err,
		}
	}

	got.version = convertedVersion

	if previousID.Valid && !previousVersion.Valid {
		return storedMigration{}, &IntegrityError{
			Version: new(requestedVersion),
			Issue:   "references a missing predecessor row",
			Cause:   nil,
		}
	}

	if previousVersion.Valid {
		convertedPrevious, conversionErr := sourceVersion(previousVersion.Int64)
		if conversionErr != nil {
			return storedMigration{}, &IntegrityError{
				Version: new(requestedVersion),
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
WHERE archived_at IS NULL AND previous_id IS NULL
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
			Version: new(roots[1]),
			Issue:   "catalog contains multiple roots",
			Cause:   nil,
		}
	}

	query = fmt.Sprintf(`
SELECT version
FROM %s
WHERE archived_at IS NULL
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
		Version: new(versions[0]),
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
			Version: new(version),
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
SELECT successor.version
FROM %s AS successor
JOIN %s AS predecessor ON predecessor.id = successor.previous_id
WHERE predecessor.version = $1
  AND predecessor.archived_at IS NULL
  AND successor.archived_at IS NULL
ORDER BY successor.version
LIMIT 2
`, c.relation, c.relation)

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
			Version: new(version),
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
			Version: new(version),
			Issue: fmt.Sprintf(
				"unsupported catalog format version %d",
				stored.formatVersion,
			),
			Cause: nil,
		}
	}

	if strings.TrimSpace(stored.identifier) == "" {
		return &IntegrityError{
			Version: new(version),
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
			Version: new(version),
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
	if !containsMigrationSQL(body) {
		return &IntegrityError{
			Version: new(version),
			Issue:   fmt.Sprintf("%s migration body is blank", direction),
			Cause:   nil,
		}
	}

	if len(checksum) != sha256.Size {
		return &IntegrityError{
			Version: new(version),
			Issue:   fmt.Sprintf("%s checksum has invalid length", direction),
			Cause:   nil,
		}
	}

	calculated := sha256.Sum256(body)
	if !bytes.Equal(checksum, calculated[:]) {
		return &IntegrityError{
			Version: new(version),
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
					Version: nil,
					Issue:   "cannot decode catalog chain",
					Cause:   scanErr,
				}
			}

			version, conversionErr := sourceVersion(stored)
			if conversionErr != nil {
				return &IntegrityError{
					Version: nil,
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
		Version: new(version),
		Issue:   "catalog row is missing",
		Cause:   nil,
	}
}

func catalogVersion(version uint) (int64, error) {
	if uint64(version) > math.MaxInt64 {
		return 0, &IntegrityError{
			Version: new(version),
			Issue:   "version cannot be represented by the PostgreSQL catalog",
			Cause:   nil,
		}
	}

	return int64(version), nil
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
