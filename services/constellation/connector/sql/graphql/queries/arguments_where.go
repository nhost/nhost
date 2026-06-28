package queries

import (
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

// parseWhere parses a GraphQL where-clause argument into a where.Clause.
// Thin delegate to where.Parse; the *table value satisfies where.Table via
// adapter methods below.
func (t *table) parseWhere(
	whereArg *ast.Value,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	nestingLevel int,
	aliases where.Aliases,
) (where.Clause, error) {
	return where.Parse( //nolint:wrapcheck
		t, whereArg, variables, role, sessionVariables, nestingLevel, aliases,
	)
}

// ParseFieldComparison satisfies the where.Table interface so the parser can
// dispatch operator parsing back through the table value.
func (t *table) ParseFieldComparison( //nolint:ireturn,nolintlint
	column *core.Column,
	value *ast.Value,
	variables map[string]any,
) (where.Statement, error) {
	return where.ParseFieldComparison(t, column, value, variables) //nolint:wrapcheck
}

// Table interface satisfaction for where.Table.

func (t *table) Dialect() dialect.Dialect { return t.dialect } //nolint:ireturn,nolintlint

func (t *table) SchemaName() string { return t.schemaName }

func (t *table) TableFromClause() string { return t.tableFromClause() }

func (t *table) ColumnFromGraphqlName(name string) *core.Column {
	return t.columnFromGraphqlName(name)
}

// RelationshipFromGraphqlName returns nil interface when no relationship matches,
// avoiding the typed-nil-through-interface trap callers would hit otherwise.
func (t *table) RelationshipFromGraphqlName( //nolint:ireturn,nolintlint
	name string,
) where.Relationship {
	r := t.relationshipFromGraphqlName(name)
	if r == nil {
		return nil
	}

	return r
}

// TableBySchemaName returns nil interface when no sibling table matches.
func (t *table) TableBySchemaName(schema, name string) where.Table { //nolint:ireturn,nolintlint
	other := t.tableBySchemaName(schema, name)
	if other == nil {
		return nil
	}

	return other
}

// HasRowLevelPermissions / WriteRowLevelPermissions are renames of the
// existing unexported methods, defined in permissions_adapter.go.
func (t *table) HasRowLevelPermissions(role string) bool {
	return t.hasRowLevelPermissions(role)
}

func (t *table) WriteRowLevelPermissions(
	b *strings.Builder,
	params []any,
	paramIndex int,
	role string,
	sessionVariables map[string]any,
	sourceRef string,
) ([]any, int, error) {
	return t.writeRowLevelPermissions(b, params, paramIndex, role, sessionVariables, sourceRef)
}

// Relationship interface satisfaction for where.Relationship.

// Target returns the target table interface; returns nil interface for
// remote/remote-schema relationships that have no local target table.
func (r *relationship) Target() where.Table { //nolint:ireturn,nolintlint
	if r.table == nil {
		return nil
	}

	return r.table
}

func (r *relationship) ParentColumns() []string { return r.parentColumns }

func (r *relationship) WriteJoinConditionAliased(
	b *strings.Builder, parentAlias, targetAlias string,
) {
	r.writeJoinConditionAliased(b, parentAlias, targetAlias)
}

// AggregateName satisfies where.Relationship; it returns the relationship's
// aggregate key (<name>_aggregate) so the where parser can tell an aggregate
// predicate apart from a plain relationship filter. Name() and IsArray() are
// defined on the permissions/arguments adapters and reused here.
func (r *relationship) AggregateName() string { return r.aggregateName }
