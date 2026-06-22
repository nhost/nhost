package where

import (
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

//go:generate mockgen -package mock -destination mock/where.go . Table,Relationship

// Table is the contract the where parser needs from a parent-package table.
// It exposes column/relationship lookup, dialect access, sibling table lookup
// for _exists, and row-level permission emission for relationship subqueries.
type Table interface {
	// Dialect returns the SQL dialect used to render placeholders, casts, etc.
	Dialect() dialect.Dialect

	// SchemaName returns the schema the table lives in. Used as the default
	// schema for _exists when a where clause omits _table.schema.
	SchemaName() string

	// TableFromClause returns the FROM-clause source for this table.
	TableFromClause() string

	// ColumnFromGraphqlName resolves a GraphQL field name to its column.
	// Returns nil if no column matches.
	ColumnFromGraphqlName(name string) *core.Column

	// RelationshipFromGraphqlName resolves a GraphQL field name to its
	// relationship. Returns a nil interface (not a typed-nil) when no
	// relationship matches.
	RelationshipFromGraphqlName(name string) Relationship

	// TableBySchemaName resolves a (schema, name) pair to a sibling table,
	// used by the _exists operator. Returns a nil interface when not found.
	TableBySchemaName(schema, name string) Table

	// HasRowLevelPermissions reports whether the given role has any
	// row-level filter to apply on this table.
	HasRowLevelPermissions(role string) bool

	// WriteRowLevelPermissions emits the row-level permission predicate for
	// the given role, qualifying columns with sourceRef and substituting
	// session variables.
	WriteRowLevelPermissions(
		b *strings.Builder, params []any, paramIndex int,
		role string, sessionVariables map[string]any, sourceRef string,
	) ([]any, int, error)

	// ParseFieldComparison parses an operator object ({_eq: ..., _in: ..., …})
	// into a single Statement. Implementations should delegate to
	// where.ParseFieldComparison so they share the same operator table.
	ParseFieldComparison(
		column *core.Column, value *ast.Value, variables map[string]any,
	) (Statement, error)
}

// Relationship is the contract the where parser needs from a relationship value.
// It exposes the target table, the parent-side join columns (for permission
// column collection), and the join condition emission.
type Relationship interface {
	// Target returns the target table of the relationship. Returns a nil
	// interface for remote/remote-schema relationships that have no local
	// target.
	Target() Table

	// ParentColumns lists the columns on the parent side of the join. Used
	// when collecting columns that a permission filter references.
	ParentColumns() []string

	// WriteJoinConditionAliased writes the join predicate qualifying parent
	// columns with parentAlias and target columns with targetAlias.
	WriteJoinConditionAliased(b *strings.Builder, parentAlias, targetAlias string)

	// Name is the relationship's GraphQL field name (e.g. "posts"). Used to
	// distinguish the plain relationship key from the aggregate key, which
	// both resolve to the same relationship.
	Name() string

	// AggregateName is the aggregate bool_exp / order_by key for an array
	// relationship (e.g. "posts_aggregate"). A where field matching this name
	// (and not Name) is an aggregate predicate, not a plain relationship filter.
	AggregateName() string

	// IsArray reports whether this is an array relationship. Aggregate
	// predicates are only valid on array relationships.
	IsArray() bool
}
