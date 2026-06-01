// Package schema generates a role-scoped GraphQL schema for a SQL backend.
//
// Given a set of introspected database objects (tables, columns, relationships,
// enum tables, tracked functions) and Hasura-compatible permission metadata,
// GenerateForRole emits a graph.Schema containing the type families a Hasura
// consumer expects:
//
//   - Object types per table (with relationship fields wired via metadata).
//   - Input types: <table>_bool_exp, <table>_order_by, comparison_exp /
//     array_comparison_exp / cast_exp per scalar, <table>_insert_input /
//     _set_input / _inc_input / _pk_columns_input / _on_conflict and the
//     append/prepend/delete_* JSONB families.
//   - Enums: <table>_select_column, <table>_update_column, <table>_constraint,
//     and the global order_by / cursor_ordering enums.
//   - Aggregate types: <table>_aggregate, _aggregate_fields, _aggregate_order_by,
//     _aggregate_bool_exp.
//   - Mutation response wrappers, function fields, and subscription fields
//     (including subscription_stream).
//
// The package sits downstream of connector/sql/introspection.Objects and
// upstream of graph.Schema.ToAST(), which produces the gqlparser AST consumed
// by the controller. There are two extension axes:
//
//   - Capabilities (a value type built from the SQL dialect's SupportsX methods)
//     gates emission of features the backend cannot serve -- e.g. SupportsJSONB
//     suppresses jsonb-specific operators, SupportsArrays suppresses
//     array_comparison_exp types, SupportsFunctions suppresses function fields.
//     Capabilities.Kind also drives a Postgres-vs-other namespacing convention
//     for comparison/cast/array_comparison_exp type names (see
//     Capabilities.namespaceTypeName).
//   - Per-role permission metadata controls which columns, relationships and
//     mutations a role sees; "admin" is treated as a permission shortcut and
//     gets the unrestricted projection.
package schema

import (
	"errors"
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// roleAdmin is a package-local alias for [metadata.RoleAdmin], kept to avoid
// noise at every comparison site in this package. The canonical constant
// lives in the metadata package.
const roleAdmin = metadata.RoleAdmin

// DBKind identifies the SQL backend that produced a schema. It namespaces the
// comparison/cast/array_comparison_exp type families so a single GraphQL
// schema can host inputs from multiple backends without collisions. The
// Postgres value is treated as the legacy default: when used as Capabilities.Kind
// it produces un-namespaced names for backwards compatibility with Hasura
// clients.
type DBKind string

const (
	// KindPostgres is the DBKind value for PostgreSQL backends. The empty
	// string is treated equivalently for backwards compatibility.
	KindPostgres DBKind = "postgres"
	// KindSQLite is the DBKind value for SQLite backends.
	KindSQLite DBKind = "sqlite"
)

// Capabilities describes the SQL dialect's feature support for schema
// generation. Prefer NewCapabilities to construct values; the exported fields
// are kept for backwards compatibility but the constructor is the only path
// that stays in sync with the Dialect interface.
type Capabilities struct {
	// Kind identifies the backend. The empty value is treated as KindPostgres
	// for backwards compatibility; it controls namespacing of the
	// comparison_exp / cast_exp / array_comparison_exp type families via
	// namespaceTypeName.
	Kind DBKind
	// SupportsRegex gates the emission of regex comparison operators
	// (_regex, _iregex, _similar and their negations) on String/citext
	// comparison_exp inputs.
	SupportsRegex bool
	// SupportsJSONB gates the emission of jsonb-specific comparison
	// operators (_contains, _contained_in, _has_key, _has_keys_all,
	// _has_keys_any, _cast) and the jsonb_cast_exp input type.
	SupportsJSONB bool
	// SupportsDistinctOn gates the emission of the distinct_on argument on
	// collection fields and array relationships.
	SupportsDistinctOn bool
	// SupportsFunctions gates the emission of GraphQL fields for tracked
	// SQL functions.
	SupportsFunctions bool
	// SupportsArrays gates the emission of <scalar>_array_comparison_exp
	// input types and array-typed column fields on bool_exp inputs.
	SupportsArrays bool
	// SupportsVarianceAggregates gates the emission of the stddev/variance
	// aggregate family (stddev, stddev_pop, stddev_samp, var_pop, var_samp,
	// variance) on <table>_aggregate_fields and their <table>_<fn>_fields object
	// types. SQLite lacks these aggregate functions, so exposing the fields would
	// produce an opaque runtime "no such function" error; omitting them yields a
	// clean GraphQL validation error instead. avg/sum/min/max/count are native
	// everywhere and are emitted regardless.
	SupportsVarianceAggregates bool
	// SupportsStableVarianceOrderBy gates the emission of the stddev/variance
	// aggregate order_by family (the <table>_<fn>_order_by input types and the
	// stddev/stddev_pop/stddev_samp/var_pop/var_samp/variance fields on
	// <table>_aggregate_order_by). It is distinct from
	// SupportsVarianceAggregates: ordering needs a result numerically faithful to
	// PostgreSQL's, which SQLite cannot provide, so the aggregate-order_by builder
	// rejects these functions when the backend lacks stable variance ordering
	// (see queries/arguments.varianceOrderByFuncs). Advertising them in the
	// schema while the runtime rejects them is schema/runtime drift; gating both
	// on this flag keeps the advertised order_by surface equal to what the
	// runtime accepts. avg/sum/min/max/count order_by are accepted everywhere and
	// are emitted regardless.
	SupportsStableVarianceOrderBy bool
}

// ErrUnknownDBKind reports that a string did not parse as a known DBKind.
// Callers can match on it with errors.Is when converting an untyped
// metadata.DatabaseMetadata.Kind into a typed DBKind via ParseDBKind.
var ErrUnknownDBKind = errors.New("unknown database kind")

// ParseDBKind converts an untyped string (typically
// metadata.DatabaseMetadata.Kind) into a typed DBKind, returning
// ErrUnknownDBKind for any value other than "", "postgres", or "sqlite". The
// empty string is mapped to KindPostgres for backwards compatibility with
// older metadata that predates the Kind field. This is the single validation
// point for the otherwise-unchecked string→DBKind boundary; bypassing it
// (i.e. constructing DBKind("postgress") via a direct conversion) silently
// routes through the non-Postgres namespacing branch with no diagnostic.
func ParseDBKind(s string) (DBKind, error) {
	switch s {
	case "", string(KindPostgres):
		return KindPostgres, nil
	case string(KindSQLite):
		return KindSQLite, nil
	default:
		return "", fmt.Errorf("%w: %q", ErrUnknownDBKind, s)
	}
}

// NewCapabilities projects a dialect.Dialect onto a Capabilities value. This
// is the canonical way to build a Capabilities -- it keeps the schema package
// in sync with the Dialect interface so a new SupportsX method becomes a
// one-line change here rather than two parallel edits in different packages.
// The kind argument should be obtained from ParseDBKind so unknown backends
// surface as errors at the metadata boundary rather than silently emitting
// mis-namespaced types.
func NewCapabilities(kind DBKind, dial dialect.Dialect) Capabilities {
	return Capabilities{
		Kind:                          kind,
		SupportsRegex:                 dial.SupportsRegex(),
		SupportsJSONB:                 dial.SupportsJSONB(),
		SupportsDistinctOn:            dial.SupportsDistinctOn(),
		SupportsFunctions:             dial.SupportsFunctions(),
		SupportsArrays:                dial.SupportsArrays(),
		SupportsVarianceAggregates:    dial.SupportsVarianceAggregates(),
		SupportsStableVarianceOrderBy: dial.SupportsStableVarianceOrderBy(),
	}
}

// namespaceTypeName returns a dialect-namespaced type name of the form
// "<prefix>_<suffix>" for Postgres (and the empty Kind, which defaults to
// Postgres for backwards compatibility) and "<prefix>_<kind>_<suffix>" for
// every other backend. It is the single source of truth for the namespacing
// convention used by comparison_exp, cast_exp and array_comparison_exp types;
// callers must route through this method rather than re-implementing the
// branch with bare string concatenation.
func (c Capabilities) namespaceTypeName(prefix, suffix string) string {
	if c.Kind == "" || c.Kind == KindPostgres {
		return prefix + "_" + suffix
	}

	return prefix + "_" + string(c.Kind) + "_" + suffix
}

// comparisonExpName returns the namespaced comparison expression type name for a scalar type.
func (c Capabilities) comparisonExpName(scalarType string) string {
	return c.namespaceTypeName(scalarType, "comparison_exp")
}

// castExpName returns the namespaced cast expression type name for a scalar type.
func (c Capabilities) castExpName(scalarType string) string {
	return c.namespaceTypeName(scalarType, "cast_exp")
}

// arrayComparisonExpName returns the comparison expression type name for an array column
// whose element type is the given scalar type.
func (c Capabilities) arrayComparisonExpName(elementType string) string {
	return c.namespaceTypeName(elementType, "array_comparison_exp")
}

// GenerateForRole builds a graph.Schema scoped to a single role. The admin
// role is treated as a permission shortcut and gets the unrestricted
// projection of objects; every other role is filtered through the per-table
// permission metadata. objects and md must be non-nil -- both are retained
// for the duration of the call so callers must not mutate them concurrently.
// Returns an error if metadata or objects is nil or if enum-table generation
// fails because a referenced enum table has no introspected values.
func GenerateForRole(
	objects *introspection.Objects,
	role string,
	md *metadata.DatabaseMetadata,
	caps Capabilities,
) (*graph.Schema, error) {
	if md == nil || objects == nil {
		return nil, errors.New("metadata and objects must not be nil") //nolint:err113
	}

	schema := &graph.Schema{} //nolint:exhaustruct

	addGlobalEnums(schema)

	var (
		queryFields                 []*graph.Field
		mutationFields              []*graph.Field
		subscriptionFields          []*graph.Field
		usedScalars                 = make(map[string]struct{})
		selectUsedScalars           = make(map[string]struct{})
		selectUsedArrayElementTypes = make(map[string]struct{})
		neededEnums                 = make(map[string]struct{})
		generatedAggregateOrderBy   = make(map[string]struct{})
		generatedAggregateBoolExp   = make(map[string]struct{})
	)

	tablesWithObjRelInsert, tablesWithArrRelInsert := findRelationships(objects, md, role)

	for i := range md.Tables {
		tableMeta := &md.Tables[i]

		if role != roleAdmin && getSelectPermission(tableMeta, role) == nil {
			continue
		}

		tableInfo, ok := objects.GetTable(tableMeta.Table.Schema, tableMeta.Table.Name)
		if !ok {
			continue
		}

		generateForTable(
			schema, tableMeta, tableInfo, role, objects, md,
			&queryFields, &mutationFields, &subscriptionFields, usedScalars,
			selectUsedScalars, selectUsedArrayElementTypes,
			neededEnums, generatedAggregateOrderBy, generatedAggregateBoolExp,
			tablesWithObjRelInsert, tablesWithArrRelInsert, caps,
		)
	}

	generateFunctions(
		schema, objects, role, md, caps,
		&queryFields, &mutationFields, &subscriptionFields, usedScalars,
	)

	addOperationTypes(schema, queryFields, mutationFields, subscriptionFields)

	generateScalars(
		schema, usedScalars, selectUsedScalars, selectUsedArrayElementTypes, caps,
	)

	if err := generateEnumTypes(schema, md, objects.EnumValues, neededEnums); err != nil {
		return nil, fmt.Errorf("failed to generate enum types: %w", err)
	}

	return schema, nil
}

func generateFunctions(
	schema *graph.Schema,
	objects *introspection.Objects,
	role string,
	md *metadata.DatabaseMetadata,
	caps Capabilities,
	queryFields, mutationFields, subscriptionFields *[]*graph.Field,
	usedScalars map[string]struct{},
) {
	if !caps.SupportsFunctions {
		return
	}

	for i := range md.Functions {
		fnMeta := &md.Functions[i]

		fnInfo, ok := objects.GetFunction(fnMeta.Function.Schema, fnMeta.Function.Name)
		if !ok {
			continue
		}

		generateForFunction(
			schema, fnMeta, fnInfo, role, md,
			queryFields, mutationFields, subscriptionFields, usedScalars, caps,
		)
	}
}

func findRelationships( //nolint:cyclop,gocognit
	objects *introspection.Objects,
	md *metadata.DatabaseMetadata,
	role string,
) (map[string]struct{}, map[string]struct{}) {
	tablesWithObjRelInsert := make(map[string]struct{})
	tablesWithArrRelInsert := make(map[string]struct{})

	for i := range md.Tables {
		tableMeta := &md.Tables[i]

		if role != roleAdmin && getInsertPermission(tableMeta, role) == nil {
			continue
		}

		tableInfo, ok := objects.GetTable(tableMeta.Table.Schema, tableMeta.Table.Name)
		if !ok {
			continue
		}

		for _, rel := range tableMeta.ObjectRelationships {
			if isTargetTableAccessible(md, tableInfo, rel.Using, role) { //nolint:nestif
				if targetMeta := getRelationshipTarget(
					tableInfo,
					md.Tables,
					rel.Using,
				); targetMeta != nil {
					if role == roleAdmin || getInsertPermission(targetMeta, role) != nil {
						if !targetIsInsertable(objects, targetMeta) {
							continue
						}

						targetName := getRelationshipTargetName(md, tableInfo, rel.Using)
						if targetName != "" {
							tablesWithObjRelInsert[targetName] = struct{}{}
						}
					}
				}
			}
		}

		for _, rel := range tableMeta.ArrayRelationships {
			if isTargetTableAccessible(md, tableInfo, rel.Using, role) { //nolint:nestif
				if targetMeta := getRelationshipTarget(
					tableInfo,
					md.Tables,
					rel.Using,
				); targetMeta != nil {
					if role == roleAdmin || getInsertPermission(targetMeta, role) != nil {
						if !targetIsInsertable(objects, targetMeta) {
							continue
						}

						targetName := getRelationshipTargetName(md, tableInfo, rel.Using)
						if targetName != "" {
							tablesWithArrRelInsert[targetName] = struct{}{}
						}
					}
				}
			}
		}
	}

	return tablesWithObjRelInsert, tablesWithArrRelInsert
}

func addOperationTypes(
	schema *graph.Schema,
	queryFields, mutationFields, subscriptionFields []*graph.Field,
) {
	if len(queryFields) > 0 {
		queryTypeName := "query_root"
		schema.QueryType = &queryTypeName
		schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
			Name:   "query_root",
			Fields: queryFields,
		})
	}

	if len(mutationFields) > 0 {
		mutationTypeName := "mutation_root"
		schema.MutationType = &mutationTypeName
		schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
			Name:        "mutation_root",
			Description: "mutation root",
			Fields:      mutationFields,
		})
	}

	if len(subscriptionFields) > 0 {
		subscriptionTypeName := "subscription_root"
		schema.SubscriptionType = &subscriptionTypeName
		schema.Types = append(schema.Types, &graph.ObjectType{ //nolint:exhaustruct
			Name:   "subscription_root",
			Fields: subscriptionFields,
		})
	}
}
