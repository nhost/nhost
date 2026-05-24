package queries

import (
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// This file holds the *table and *relationship methods that satisfy
// permissions.Table / permissions.Relationship, plus a couple of thin
// per-query helpers that bridge to permissions.Store.
//
// The interface methods are named to avoid colliding with where.Table /
// arguments.Table on the same receiver (Go does not allow covariant return
// types):
//
//   - LookupRelationship instead of RelationshipFromGraphqlName (where) or
//     Relationship (arguments)
//   - SiblingTable instead of TableBySchemaName (where)
//   - LookupTarget on *relationship instead of Target (where) or
//     TargetTable (arguments)

// Name satisfies permissions.Table; it returns the bare table name and is
// used only in error messages.
func (t *table) Name() string { return t.tableName }

func (t *table) LookupRelationship(name string) permissions.Relationship {
	r := t.relationshipFromGraphqlName(name)
	if r == nil {
		return nil
	}

	return r
}

func (t *table) SiblingTable(schema, name string) permissions.Table {
	other := t.tableBySchemaName(schema, name)
	if other == nil {
		return nil
	}

	return other
}

// Name satisfies permissions.Relationship; it returns the GraphQL field name
// of the relationship and is used in permission error messages.
func (r *relationship) Name() string { return r.name }

// LookupTarget satisfies permissions.Relationship. Returns a nil interface
// for remote/remote-schema relationships with no local target.
func (r *relationship) LookupTarget() permissions.Table {
	if r.table == nil {
		return nil
	}

	return r.table
}

// InitializePermissions delegates to permissions.Initialize so the existing
// roots.go call shape (tables[i].InitializePermissions(tableMeta)) stays.
func (t *table) InitializePermissions(md metadata.TableMetadata) error {
	return permissions.Initialize(t, t.permissions, md) //nolint:wrapcheck
}

// hasRowLevelPermissions and writeRowLevelPermissions stay as unexported
// methods on *table so the per-query builders keep their existing call sites.

func (t *table) hasRowLevelPermissions(role string) bool {
	return t.permissions.HasRowLevel(role)
}

// writeRowLevelPermissions defaults sourceRef to the fully-qualified table
// reference when callers don't pass one; the previous implementation did the
// same and several call sites still rely on it.
func (t *table) writeRowLevelPermissions(
	b *strings.Builder,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
	sourceRef string,
) ([]any, int, error) {
	source := sourceRef
	if source == "" {
		source = t.tableFromClause()
	}

	return t.permissions.WriteRowLevel( //nolint:wrapcheck
		b, params, paramIndex, role, sessionVariables, source,
	)
}
