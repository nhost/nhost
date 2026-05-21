package queries

import (
	"fmt"
	"slices"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/permissions"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type table struct {
	schemaName      string
	tableName       string
	graphqlTypeName string
	dialect         dialect.Dialect
	cachedTableRef  string

	queryCollectionName          string
	queryByPkName                string
	queryAggregateName           string
	subscriptionStreamName       string
	mutationInsertCollectionName string
	mutationInsertOneName        string
	mutationUpdateName           string
	mutationUpdateManyName       string
	mutationUpdatebyPkName       string
	mutationDeleteCollectionName string
	mutationDeleteByPkName       string

	pkColumns     []*core.Column
	columns       []*core.Column
	relationships []*relationship
	functions     []*function

	// allTables is retained so _exists permission predicates can resolve
	// references to sibling tables within the same database.
	allTables []*table

	// permissions owns per-role row-level WHERE clauses, presets, and the
	// helpers used by mutation CTE plumbing. See queries/permissions for the
	// engine; *table is just an adapter that satisfies permissions.Table.
	permissions *permissions.Store
}

func newTable(schemaName, tableName string, dialect dialect.Dialect) *table {
	return &table{
		schemaName:      schemaName,
		tableName:       tableName,
		graphqlTypeName: "",
		dialect:         dialect,
		cachedTableRef:  dialect.TableRef(schemaName, tableName),

		queryCollectionName:          "",
		queryByPkName:                "",
		queryAggregateName:           "",
		subscriptionStreamName:       "",
		mutationInsertCollectionName: "",
		mutationInsertOneName:        "",
		mutationUpdateName:           "",
		mutationUpdateManyName:       "",
		mutationUpdatebyPkName:       "",
		mutationDeleteCollectionName: "",
		mutationDeleteByPkName:       "",
		pkColumns:                    []*core.Column{},
		columns:                      []*core.Column{},
		relationships:                []*relationship{},
		functions:                    []*function{},
		allTables:                    nil,

		permissions: permissions.NewStore(),
	}
}

// Initialize resolves the table's columns, primary keys, root field names, and
// relationships from introspection objects and metadata. The tables slice is
// retained so relationship lookups in permissions.Initialize and _exists checks
// can resolve other tables in the same database.
func (t *table) Initialize(
	objects *introspection.Objects,
	md metadata.TableMetadata,
	tables []*table,
) error {
	tableObj, found := objects.GetTable(md.Table.Schema, md.Table.Name)
	if !found {
		return fmt.Errorf("unable to find table %s.%s in introspection objects",
			md.Table.Schema, md.Table.Name)
	}

	columns := make([]*core.Column, len(tableObj.Columns))

	for i, colObj := range tableObj.Columns {
		graphqlName := colObj.Name

		if c, found := md.Configuration.ColumnConfig[colObj.Name]; found && c.CustomName != "" {
			graphqlName = c.CustomName
		}

		sqlType := colObj.Type
		if colObj.IsArray {
			sqlType = colObj.Type + "[]"
		}

		columns[i] = &core.Column{
			SQLName:     colObj.Name,
			GraphqlName: graphqlName,
			SQLType:     sqlType,
			IsArray:     colObj.IsArray,
			IsGenerated: colObj.IsGenerated,
		}

		if slices.Contains(tableObj.PrimaryKeys, colObj.Name) {
			t.pkColumns = append(t.pkColumns, columns[i])
		}
	}

	t.columns = columns
	t.allTables = tables

	t.initializeRootNames(md)

	if err := t.initializeRelationships(objects, tableObj, md, tables); err != nil {
		return fmt.Errorf("error initializing relationships: %w", err)
	}

	return nil
}

func (t *table) initializeRootNames(md metadata.TableMetadata) {
	orFn := func(a, b string) string {
		if a != "" {
			return a
		}

		return b
	}

	customTableName := orFn(md.Configuration.CustomName, md.Table.Name)

	t.graphqlTypeName = customTableName
	t.queryCollectionName = orFn(md.Configuration.CustomRootFields.Select, customTableName)
	t.queryByPkName = orFn(md.Configuration.CustomRootFields.SelectByPk, customTableName+"_by_pk")
	t.queryAggregateName = orFn(
		md.Configuration.CustomRootFields.SelectAggregate,
		customTableName+"_aggregate",
	)
	t.subscriptionStreamName = orFn(
		md.Configuration.CustomRootFields.SelectStream,
		customTableName+"_stream",
	)
	t.mutationInsertCollectionName = orFn(
		md.Configuration.CustomRootFields.Insert,
		"insert_"+customTableName,
	)
	t.mutationInsertOneName = orFn(
		md.Configuration.CustomRootFields.InsertOne,
		"insert_"+customTableName+"_one",
	)
	t.mutationUpdateName = orFn(md.Configuration.CustomRootFields.Update, "update_"+customTableName)
	t.mutationUpdateManyName = orFn(
		md.Configuration.CustomRootFields.UpdateMany,
		"update_"+customTableName+"_many",
	)
	t.mutationUpdatebyPkName = orFn(
		md.Configuration.CustomRootFields.UpdateByPk,
		"update_"+customTableName+"_by_pk",
	)
	t.mutationDeleteCollectionName = orFn(
		md.Configuration.CustomRootFields.Delete,
		"delete_"+customTableName,
	)
	t.mutationDeleteByPkName = orFn(
		md.Configuration.CustomRootFields.DeleteByPk,
		"delete_"+customTableName+"_by_pk",
	)
}

func (t *table) initializeRelationships(
	objects *introspection.Objects,
	tableObj *introspection.Table,
	md metadata.TableMetadata,
	tables []*table,
) error {
	t.relationships = make(
		[]*relationship,
		0,
		len(md.ObjectRelationships)+len(md.ArrayRelationships),
	)

	for _, relMeta := range md.ArrayRelationships {
		rel, err := newRelationship(
			relMeta.Name,
			relMeta.Using,
			true,
			tableObj,
			objects,
			tables,
		)
		if err != nil {
			return fmt.Errorf("error initializing array relationship %s: %w", relMeta.Name, err)
		}

		t.relationships = append(t.relationships, rel)
	}

	for _, relMeta := range md.ObjectRelationships {
		rel, err := newRelationship(
			relMeta.Name,
			relMeta.Using,
			false,
			tableObj,
			objects,
			tables,
		)
		if err != nil {
			return fmt.Errorf("error initializing object relationship %s: %w", relMeta.Name, err)
		}

		t.relationships = append(t.relationships, rel)
	}

	return nil
}

func (t *table) columnFromGraphqlName(name string) *core.Column {
	for _, c := range t.columns {
		if c.GraphqlName == name {
			return c
		}
	}

	return nil
}

func (t *table) columnFromSQLName(name string) *core.Column {
	for _, c := range t.columns {
		if c.SQLName == name {
			return c
		}
	}

	return nil
}

func (t *table) relationshipFromGraphqlName(name string) *relationship {
	for _, r := range t.relationships {
		if r.name == name || r.aggregateName == name {
			return r
		}
	}

	return nil
}

func (t *table) tableBySchemaName(schema, name string) *table {
	for _, table := range t.allTables {
		if table.schemaName == schema && table.tableName == name {
			return table
		}
	}

	return nil
}

// AddFunction adds a function to this table.
func (t *table) AddFunction(fn *function) {
	t.functions = append(t.functions, fn)
}

// registerTableRoots writes this table's query/mutation/subscription root
// fields and SQL builders directly into the parent registry maps, then
// appends the function-backed roots. Called once per table by BuildRoots; the
// per-table value form used to exist as a (*table).Roots method but only
// served as an intermediate that BuildRoots immediately merged.
func registerTableRoots(
	t *table,
	rootsByOperation map[OperationKind]map[string]core.Operation,
	streamFields map[string]struct{},
) {
	rootsByOperation[OperationQuery][t.queryCollectionName] = t.buildQueryCollectionSQL
	rootsByOperation[OperationQuery][t.queryByPkName] = t.buildQueryByPkSQL
	rootsByOperation[OperationQuery][t.queryAggregateName] = t.buildQueryAggregateSQL

	rootsByOperation[OperationMutation][t.mutationInsertCollectionName] = t.buildMutationInsertCollectionSQL
	rootsByOperation[OperationMutation][t.mutationInsertOneName] = t.buildMutationInsertOneSQL
	rootsByOperation[OperationMutation][t.mutationUpdateName] = t.buildMutationUpdateSQL
	rootsByOperation[OperationMutation][t.mutationUpdateManyName] = t.buildMutationUpdateManySQL
	rootsByOperation[OperationMutation][t.mutationUpdatebyPkName] = t.buildMutationUpdateByPkSQL
	rootsByOperation[OperationMutation][t.mutationDeleteCollectionName] = t.buildMutationDeleteCollectionSQL
	rootsByOperation[OperationMutation][t.mutationDeleteByPkName] = t.buildMutationDeleteByPkSQL

	rootsByOperation[OperationSubscription][t.queryCollectionName] = multiplexify(
		"collection",
		t.buildQueryCollectionSQL,
	)
	rootsByOperation[OperationSubscription][t.queryByPkName] = multiplexify(
		"by_pk",
		t.buildQueryByPkSQL,
	)
	rootsByOperation[OperationSubscription][t.queryAggregateName] = multiplexify(
		"aggregate",
		t.buildQueryAggregateSQL,
	)
	rootsByOperation[OperationSubscription][t.subscriptionStreamName] = t.buildSubscriptionStreamSQL

	streamFields[t.subscriptionStreamName] = struct{}{}

	registerTableFunctionRoots(t, rootsByOperation)
}

// registerTableFunctionRoots writes the function-backed root-field builders
// for every function attached to t into rootsByOperation. SETOF functions
// expose a collection and an aggregate root; single-row functions expose only
// the one-row variant. Query functions also produce subscription roots,
// mutation functions do not.
func registerTableFunctionRoots(
	t *table,
	rootsByOperation map[OperationKind]map[string]core.Operation,
) {
	for _, fn := range t.functions {
		if fn.isSetOf {
			if fn.IsQuery() {
				rootsByOperation[OperationQuery][fn.querySelectName] = t.makeFunctionOp(
					fn,
					t.buildQueryFunctionCollectionSQL,
				)
				rootsByOperation[OperationQuery][fn.queryAggregateName] = t.makeFunctionOp(
					fn,
					t.buildQueryFunctionAggregateSQL,
				)
				rootsByOperation[OperationSubscription][fn.querySelectName] = multiplexify(
					"function collection",
					t.makeFunctionOp(fn, t.buildQueryFunctionCollectionSQL),
				)
				rootsByOperation[OperationSubscription][fn.queryAggregateName] = multiplexify(
					"function aggregate",
					t.makeFunctionOp(fn, t.buildQueryFunctionAggregateSQL),
				)
			} else {
				rootsByOperation[OperationMutation][fn.querySelectName] = t.makeFunctionOp(
					fn,
					t.buildQueryFunctionCollectionSQL,
				)
			}

			continue
		}

		if fn.IsQuery() {
			rootsByOperation[OperationQuery][fn.querySelectName] = t.makeFunctionOp(
				fn,
				t.buildQueryFunctionOneSQL,
			)
			rootsByOperation[OperationSubscription][fn.querySelectName] = multiplexify(
				"function one",
				t.makeFunctionOp(fn, t.buildQueryFunctionOneSQL),
			)
		} else {
			rootsByOperation[OperationMutation][fn.querySelectName] = t.makeFunctionOp(
				fn,
				t.buildQueryFunctionOneSQL,
			)
		}
	}
}

// functionSQLBuilder is the shared signature of every t.build*FunctionSQL
// method (query/subscription × collection/one/aggregate).
type functionSQLBuilder func(
	fn *function,
	field *ast.Field,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	roots map[string]core.Operation,
) (core.SQLOperation, error)

// makeFunctionOp wraps a function-SQL builder with its fn so it satisfies the
// core.Operation signature expected by Roots.
func (t *table) makeFunctionOp(fn *function, build functionSQLBuilder) core.Operation {
	return func(
		field *ast.Field,
		fragments ast.FragmentDefinitionList,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
		roots map[string]core.Operation,
	) (core.SQLOperation, error) {
		return build(fn, field, fragments, variables, role, sessionVariables, roots)
	}
}

// tableFromClause returns the FROM clause for selecting from this table.
func (t *table) tableFromClause() string {
	return t.cachedTableRef
}

// tableSourceRef returns the source reference for qualifying columns in WHERE clauses.
func (t *table) tableSourceRef() string {
	return t.cachedTableRef
}
