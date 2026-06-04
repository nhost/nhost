package arguments

import (
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/where"
)

//go:generate mockgen -package mock -destination mock/arguments.go . Table,Relationship

// Table is the contract the argument parser needs from a parent-package table.
// It exposes column/relationship lookup, dialect access, primary-key access,
// permission-preset lookups, row-level-permission emission (for relationship
// order_by subqueries), and a delegate back to the where-clause parser so the
// arguments package does not have to know about where.Aliases or nesting.
//
//nolint:interfacebloat // a single *table satisfies the parser's full contract.
type Table interface {
	// Dialect returns the SQL dialect used for placeholder rendering and type
	// casts in argument-derived SQL fragments (e.g. (*Update).WriteSQL).
	Dialect() dialect.Dialect

	// TableName returns the bare table name, used for error messages.
	TableName() string

	// PKColumns returns the primary-key columns in declaration order. Used by
	// ParseQueryByPk and ParseDeleteByPk to build equality filters.
	PKColumns() []*core.Column

	// ColumnFromGraphqlName resolves a GraphQL field name to its column.
	// Returns nil if no column matches.
	ColumnFromGraphqlName(name string) *core.Column

	// ColumnFromSQLName resolves an SQL column name to its column. Used by
	// preset application and nested-insert FK resolution.
	ColumnFromSQLName(name string) *core.Column

	// ConflictColumns returns the SQL column names backing the named unique or
	// primary-key constraint, in declaration order. Used to render the SQLite
	// ON CONFLICT column-list target. Returns an empty slice when the constraint
	// is unknown.
	ConflictColumns(constraintName string) []string

	// TableFromClause returns the FROM-clause source for this table (the
	// qualified table reference). Used as the parent correlation qualifier and
	// the target FROM clause when rendering relationship order_by subqueries.
	TableFromClause() string

	// HasRowLevelPermissions reports whether the given role has a row-level
	// filter on this table. Used to gate permission injection in relationship
	// order_by subqueries.
	HasRowLevelPermissions(role string) bool

	// WriteRowLevelPermissions emits the row-level permission predicate for the
	// role, qualifying columns with sourceRef. Relationship order_by subqueries
	// apply the target table's permissions so a restricted role orders only by
	// rows it is allowed to see, matching Hasura.
	WriteRowLevelPermissions(
		b *strings.Builder, params []any, paramIndex int,
		role string, sessionVariables map[string]any, sourceRef string,
	) ([]any, int, error)

	// Relationship resolves a GraphQL field name to its relationship.
	// Returns a nil interface (not a typed-nil) when none matches.
	//
	// Named differently from where.Table.RelationshipFromGraphqlName purely
	// so a single *table can satisfy both interfaces — Go doesn't allow
	// covariant return types.
	Relationship(name string) Relationship

	// ParseWhere delegates back to the where-clause parser so the arguments
	// package does not have to thread where.Aliases / nestingLevel parameters
	// at every call site. Implementations should delegate to where.Parse with
	// the queries-side aliases.
	ParseWhere(
		whereArg *ast.Value,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
		nestingLevel int,
		aliases where.Aliases,
	) (where.Clause, error)

	// InsertPresets returns the role-specific insert presets
	// (sql_column -> preset value). Returns a nil map when the role has no
	// presets.
	InsertPresets(role string) map[string]any

	// UpdatePresets returns the role-specific update presets
	// (sql_column -> preset value). Returns a nil map when the role has no
	// presets.
	UpdatePresets(role string) map[string]any
}

// Relationship is the contract the argument parser needs from a relationship
// value. It exposes the target table and FK metadata used to build nested
// inserts.
type Relationship interface {
	// TargetTable returns the target table of the relationship. Returns a nil
	// interface for remote/remote-schema relationships that have no local
	// target.
	TargetTable() Table

	// FKColumns returns the foreign-key column SQL names for the relationship,
	// in the order the metadata declared them. A single-column FK is returned
	// as a one-element slice.
	FKColumns() []string

	// FKSourceColumns maps each FK column populated by a nested insert to the
	// column read from the source CTE. For array relationships the source CTE is
	// the parent row; for object relationships it is the nested target row.
	FKSourceColumns() map[string]string

	// IsArray reports whether this is an array relationship (vs an object
	// relationship). Array relationships place the FK on the child row;
	// object relationships place it on the parent.
	IsArray() bool

	// Name is the relationship's GraphQL field name. Used by order_by to tell
	// an object/array relationship key from its `<name>_aggregate` key.
	Name() string

	// AggregateName is the array relationship's aggregate key
	// (`<name>_aggregate`), used by order_by to dispatch aggregate ordering.
	AggregateName() string

	// WriteJoinConditionAliased writes the relationship join predicate,
	// qualifying parent columns with parentAlias and target columns with
	// targetAlias. Used to correlate an order_by subquery with the outer row.
	WriteJoinConditionAliased(b *strings.Builder, parentAlias, targetAlias string)
}
