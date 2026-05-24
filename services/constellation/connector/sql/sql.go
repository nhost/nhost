// Package sql implements the Connector interface for SQL database backends.
// It wires together introspection, schema generation, query building, and
// execution, delegating database-specific behavior to Driver implementations.
//
// The package name "sql" shadows the standard library "database/sql" alias.
// This package never imports database/sql directly, so the shadowing is
// inert. revive nevertheless emits a var-naming warning per file in the
// package, so every file carries //nolint:revive,nolintlint on its package
// declaration — see this comment for the rationale.
package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.

import (
	"context"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	groupedaggdispatch "github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/groupedaggregate"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/schema"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	sqlsub "github.com/nhost/nhost/services/constellation/connector/sql/subscription"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/subscription"
)

// Driver abstracts database-specific operations for SQL connectors.
// Implementations exist for PostgreSQL and SQLite.
//
//go:generate mockgen -package mock -destination mock/driver.go . Driver
type Driver interface {
	// Introspect returns the database objects (tables, columns, relationships, etc.)
	// described by the given metadata.
	Introspect(
		ctx context.Context, dbMeta *metadata.DatabaseMetadata,
	) (*introspection.Objects, error)
	// ExecuteOperations executes one or more SQL operations and returns the combined results.
	ExecuteOperations(
		ctx context.Context, operations []core.SQLOperation, logger *slog.Logger,
	) (map[string]any, error)
	// ExecuteMultiplexedOperation executes a multiplexed SQL query.
	ExecuteMultiplexedOperation(
		ctx context.Context, sql string, args []any, logger *slog.Logger,
	) ([]core.MultiplexedResult, error)
	// Dialect returns the SQL dialect for this driver.
	Dialect() dialect.Dialect
	// Close releases any resources held by the driver.
	Close()
}

// Connector implements the connector.Connector interface for SQL databases.
// It also satisfies groupedaggregate.Executor for batched grouped-aggregate
// dispatch. Both contracts are enforced by compile-time assertions in
// connector_assertions_test.go.
//
// Required fields have no sensible zero value; direct struct-literal
// construction is unsupported. Use [NewConnector].
type Connector struct {
	driver       Driver
	schemas      map[string]*graph.Schema
	roots        queries.Roots
	groupedAggOp *groupedaggdispatch.Ops
	dbMeta       *metadata.DatabaseMetadata
}

// NewConnector creates a Connector by introspecting the database, building query
// roots, and generating per-role GraphQL schemas.
func NewConnector(
	ctx context.Context, driver Driver, dbMeta *metadata.DatabaseMetadata,
) (*Connector, error) {
	dial := driver.Dialect()

	objects, err := driver.Introspect(ctx, dbMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to introspect database: %w", err)
	}

	roots, groupedAggOp, err := queries.BuildRoots(objects, dbMeta, dial)
	if err != nil {
		return nil, fmt.Errorf("failed to build GraphQL roots: %w", err)
	}

	schemas, err := reloadSchema(objects, dbMeta, dial)
	if err != nil {
		return nil, fmt.Errorf("failed to load schema: %w", err)
	}

	return &Connector{
		driver:       driver,
		schemas:      schemas,
		roots:        roots,
		groupedAggOp: groupedAggOp,
		dbMeta:       dbMeta,
	}, nil
}

// Close releases resources held by the underlying driver.
func (c *Connector) Close() {
	c.driver.Close()
}

// GetSchema returns the per-role GraphQL schemas built during [NewConnector].
// The error return is always nil — the connector.Connector interface mandates
// the signature, but this implementation pre-builds schemas at construction
// time, so no I/O happens here.
func (c *Connector) GetSchema() (map[string]*graph.Schema, error) {
	return c.schemas, nil
}

// GetTypeName returns the GraphQL type name for a table identified as "schema.table".
// Uses the custom name if configured, otherwise the table name.
func (c *Connector) GetTypeName(identifier string) string {
	schema, table, ok := strings.Cut(identifier, ".")
	if !ok {
		return ""
	}

	for i := range c.dbMeta.Tables {
		t := &c.dbMeta.Tables[i]
		if t.Table.Schema == schema && t.Table.Name == table {
			if t.Configuration.CustomName != "" {
				return t.Configuration.CustomName
			}

			return t.Table.Name
		}
	}

	return ""
}

// NewSubscriptionHandler creates a subscription handler for this backend.
// The returned subscription.Handler is non-nil; callers may dereference the
// result without a nil check. The controller relies on this contract when
// downcasting via its subscriptionCapableConnector probe.
func (c *Connector) NewSubscriptionHandler( //nolint:ireturn,nolintlint
	pollingInterval time.Duration,
	logger *slog.Logger,
) subscription.Handler {
	return sqlsub.NewHandler(c, c.roots, pollingInterval, logger)
}

func reloadSchema(
	objects *introspection.Objects,
	dbMeta *metadata.DatabaseMetadata,
	dial dialect.Dialect,
) (map[string]*graph.Schema, error) {
	roles := collectRolesFromDatabaseMetadata(dbMeta)

	schemas := make(map[string]*graph.Schema, len(roles))

	kind, err := schema.ParseDBKind(dbMeta.Kind)
	if err != nil {
		return nil, fmt.Errorf("parsing database kind: %w", err)
	}

	caps := schema.NewCapabilities(kind, dial)

	for _, role := range roles {
		sch, err := schema.GenerateForRole(
			objects,
			role,
			dbMeta,
			caps,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to generate schema for role %q: %w", role, err)
		}

		schemas[role] = sch
	}

	return schemas, nil
}

// collectRolesFromDatabaseMetadata collects all unique roles from the database metadata.
func collectRolesFromDatabaseMetadata(md *metadata.DatabaseMetadata) []string {
	roles := make([]string, 0, 4) //nolint:mnd

	appendRole := func(role string) {
		if !slices.Contains(roles, role) {
			roles = append(roles, role)
		}
	}

	if md == nil {
		return roles
	}

	for i := range md.Tables {
		tableMeta := &md.Tables[i]

		for _, perm := range tableMeta.SelectPermissions {
			appendRole(perm.Role)
		}

		for _, perm := range tableMeta.InsertPermissions {
			appendRole(perm.Role)
		}

		for _, perm := range tableMeta.UpdatePermissions {
			appendRole(perm.Role)
		}

		for _, perm := range tableMeta.DeletePermissions {
			appendRole(perm.Role)
		}
	}

	appendRole(metadata.RoleAdmin)

	return roles
}
