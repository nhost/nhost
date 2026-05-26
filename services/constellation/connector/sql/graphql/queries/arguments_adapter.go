package queries

import (
	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// This file holds the methods on *table and *relationship that satisfy the
// arguments.Table and arguments.Relationship interfaces. The methods shared
// with the where adapter (Dialect, ColumnFromGraphqlName) live in
// arguments_where.go and are reused as-is.
//
// arguments.Table.Relationship has a different name from
// where.Table.RelationshipFromGraphqlName specifically so a single *table can
// satisfy both interfaces (Go does not allow covariant return types).
// arguments.Relationship's methods (Name, TargetTable, FKColumns, IsArray)
// don't collide with where.Relationship (Target, ParentColumns,
// WriteJoinConditionAliased), so *relationship satisfies both directly.

func (t *table) TableName() string { return t.tableName }

func (t *table) PKColumns() []*core.Column { return t.pkColumns }

func (t *table) ColumnFromSQLName(name string) *core.Column {
	return t.columnFromSQLName(name)
}

// Relationship satisfies arguments.Table. Returns a nil interface (not a
// typed-nil) when no relationship matches, so callers can compare against nil.
func (t *table) Relationship(name string) arguments.Relationship { //nolint:ireturn,nolintlint
	r := t.relationshipFromGraphqlName(name)
	if r == nil {
		return nil
	}

	return r
}

func (t *table) InsertPresets(role string) map[string]any {
	return t.permissions.InsertPresets[role]
}

func (t *table) UpdatePresets(role string) map[string]any {
	return t.permissions.UpdatePresets[role]
}

// ParseWhere satisfies arguments.Table; it is the exported sibling of the
// parseWhere delegate already used by the where adapter. The arguments
// package calls back through this so it doesn't need to know about
// where.Aliases / nestingLevel wiring at every call site.
func (t *table) ParseWhere(
	whereArg *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases where.Aliases,
) (where.Clause, error) {
	return t.parseWhere(whereArg, variables, role, sessionVariables, nestingLevel, aliases)
}

// arguments.Relationship satisfaction for *relationship.
// (Name() lives in permissions_adapter.go since the permissions interface
// is the actual consumer.)

// TargetTable returns a nil interface for remote/remote-schema relationships
// that have no local target table, avoiding the typed-nil-through-interface
// trap.
func (r *relationship) TargetTable() arguments.Table { //nolint:ireturn,nolintlint
	if r.table == nil {
		return nil
	}

	return r.table
}

func (r *relationship) FKColumns() []string { return r.fkColumns }

func (r *relationship) IsArray() bool { return r.isArray }
