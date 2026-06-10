package schema

import (
	"fmt"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// generateForFunction generates all GraphQL schema elements for a tracked function.
// Functions returning SETOF table or table inherit permissions from the base table.
func generateForFunction( //nolint:funlen
	schema *graph.Schema,
	fnMeta *metadata.FunctionMetadata,
	fnInfo *introspection.Function,
	role string,
	md *metadata.DatabaseMetadata,
	queryFields *[]*graph.Field,
	mutationFields *[]*graph.Field,
	subscriptionFields *[]*graph.Field,
	usedScalars map[string]struct{},
	caps Capabilities,
) {
	if !fnInfo.ReturnType.IsTableType() {
		return
	}

	baseTableMeta := findTableMeta(md, fnInfo.ReturnType.TableSchema, fnInfo.ReturnType.TableName)
	if baseTableMeta == nil {
		return
	}

	if !functionHasPermission(fnMeta, fnInfo, baseTableMeta, role) {
		return
	}

	// custom_name takes precedence over the introspected function name.
	baseName := DefaultTypeName(fnMeta.Function.Schema, fnMeta.Function.Name)
	if fnMeta.Configuration.CustomName != "" {
		baseName = fnMeta.Configuration.CustomName
	}

	// custom_root_fields.function further overrides the GraphQL field name.
	graphqlName := baseName
	if fnMeta.Configuration.CustomRootFields.Function != "" {
		graphqlName = fnMeta.Configuration.CustomRootFields.Function
	}

	aggregateName := baseName + "_aggregate"
	if fnMeta.Configuration.CustomRootFields.FunctionAggregate != "" {
		aggregateName = fnMeta.Configuration.CustomRootFields.FunctionAggregate
	}

	baseTableName := getCustomOrDefaultTypeName(baseTableMeta)

	sessionArg := fnMeta.Configuration.SessionArgument

	argsTypeName := baseName + "_args"
	generateFunctionArgsInputType(
		schema, fnInfo, argsTypeName, sessionArg, usedScalars,
	)

	// STABLE/IMMUTABLE default to query; VOLATILE defaults to mutation.
	// The explicit ExposedAs override wins.
	isQuery := fnInfo.Volatility == introspection.VolatilityStable ||
		fnInfo.Volatility == introspection.VolatilityImmutable
	switch fnMeta.Configuration.ExposedAs {
	case "mutation":
		isQuery = false
	case "query":
		isQuery = true
	}

	var selectField *graph.Field
	if fnInfo.ReturnType.IsSetOf {
		selectField = buildFunctionSelectField(
			graphqlName, fnMeta, fnInfo, baseTableName, argsTypeName, sessionArg, caps,
		)
	} else {
		selectField = buildFunctionSelectOneField(
			graphqlName, fnMeta, fnInfo, baseTableName, argsTypeName, sessionArg,
		)
	}

	// Aggregates only apply to SETOF functions; the permission is inherited
	// from the base table.
	aggregationsAllowed := fnInfo.ReturnType.IsSetOf && allowAggregations(baseTableMeta, role)

	if isQuery {
		*queryFields = append(*queryFields, selectField)
		// Query-exposed functions are also valid subscription roots.
		*subscriptionFields = append(*subscriptionFields, selectField)

		if aggregationsAllowed {
			aggregateField := buildFunctionAggregateField(
				aggregateName,
				fnMeta,
				fnInfo,
				baseTableName,
				argsTypeName,
				sessionArg,
				caps,
			)
			*queryFields = append(*queryFields, aggregateField)
			*subscriptionFields = append(*subscriptionFields, aggregateField)
		}
	} else {
		*mutationFields = append(*mutationFields, selectField)
	}
}

// functionHasPermission checks if a role can access a function.
// For volatile functions (mutations), this checks explicit permissions on the function.
// For stable/immutable functions (queries), this inherits from the base table's select permissions.
func functionHasPermission(
	fnMeta *metadata.FunctionMetadata,
	fnInfo *introspection.Function,
	baseTableMeta *metadata.TableMetadata,
	role string,
) bool {
	if role == roleAdmin {
		return true
	}

	// STABLE/IMMUTABLE functions default to query; VOLATILE defaults to mutation.
	// The explicit ExposedAs override wins.
	isQuery := fnInfo.Volatility == introspection.VolatilityStable ||
		fnInfo.Volatility == introspection.VolatilityImmutable
	switch fnMeta.Configuration.ExposedAs {
	case "mutation":
		isQuery = false
	case "query":
		isQuery = true
	}

	if isQuery {
		return getSelectPermission(baseTableMeta, role) != nil
	}

	for _, perm := range fnMeta.Permissions {
		if perm.Role == role {
			return getSelectPermission(baseTableMeta, role) != nil
		}
	}

	return false
}

// findTableMeta finds the table metadata for a given schema and table name.
func findTableMeta(
	md *metadata.DatabaseMetadata,
	schemaName, tableName string,
) *metadata.TableMetadata {
	for i := range md.Tables {
		if md.Tables[i].Table.Schema == schemaName && md.Tables[i].Table.Name == tableName {
			return &md.Tables[i]
		}
	}

	return nil
}

// generateFunctionArgsInputType generates the input type for function arguments.
// For example: input search_news_args { search: String }.
// The sessionArgument parameter specifies an argument that should be hidden from the schema
// (it will be injected with session variables at query execution time).
func generateFunctionArgsInputType(
	schema *graph.Schema,
	fnInfo *introspection.Function,
	argsTypeName string,
	sessionArgument string,
	usedScalars map[string]struct{},
) {
	fields := make([]*graph.InputField, 0, len(fnInfo.Arguments))

	for i, arg := range fnInfo.Arguments {
		graphqlName := arg.GraphQLName(i)

		// The session argument is hidden from the GraphQL schema and
		// injected at execution time from the role's session variables. The
		// match is keyed off the GraphQL name (mirroring the execution-side
		// queries.function.isSessionArgument check).
		if sessionArgument != "" && graphqlName == sessionArgument {
			continue
		}

		scalarType := getGraphQLScalarType(arg.Type)
		usedScalars[scalarType] = struct{}{}

		// Arguments with defaults are nullable; others are non-null.
		var graphqlType *graph.Type
		if arg.HasDefault {
			graphqlType = graph.NewNamedType(scalarType)
		} else {
			graphqlType = graph.NewNonNullType(scalarType)
		}

		fields = append(fields, &graph.InputField{ //nolint:exhaustruct
			Name: graphqlName,
			Type: graphqlType,
		})
	}

	if len(fields) > 0 {
		schema.Inputs = append(schema.Inputs, &graph.InputObjectType{ //nolint:exhaustruct
			Name:   argsTypeName,
			Fields: fields,
		})
	}
}

// buildFunctionSelectField creates the GraphQL field for a function that returns a collection (SETOF).
func buildFunctionSelectField(
	graphqlName string,
	fnMeta *metadata.FunctionMetadata,
	fnInfo *introspection.Function,
	baseTableName string,
	argsTypeName string,
	sessionArgument string,
	caps Capabilities,
) *graph.Field {
	qualifiedName := getQualifiedName(fnMeta.Function.Schema, fnMeta.Function.Name)
	description := fmt.Sprintf(
		`execute function "%s" which returns "%s"`,
		qualifiedName,
		baseTableName,
	)

	arguments := buildFunctionFieldArguments(
		graphqlName, fnInfo, baseTableName, argsTypeName, sessionArgument, caps,
	)

	return &graph.Field{ //nolint:exhaustruct
		Name:        graphqlName,
		Description: description,
		Type:        graph.NewNonNullListType(graph.NewNonNullType(baseTableName)),
		Arguments:   arguments,
	}
}

// buildFunctionSelectOneField creates the GraphQL field for a function that returns a single row.
func buildFunctionSelectOneField(
	graphqlName string,
	fnMeta *metadata.FunctionMetadata,
	fnInfo *introspection.Function,
	baseTableName string,
	argsTypeName string,
	sessionArgument string,
) *graph.Field {
	qualifiedName := getQualifiedName(fnMeta.Function.Schema, fnMeta.Function.Name)
	description := fmt.Sprintf(
		`execute function "%s" which returns "%s"`,
		qualifiedName,
		baseTableName,
	)

	// Single-row functions omit the collection modifiers (limit, offset,
	// order_by, where, distinct_on) -- they apply only to SETOF returns.
	arguments := make([]*graph.Argument, 0, 1)
	if hasVisibleArguments(fnInfo.Arguments, sessionArgument) {
		arguments = append(arguments, &graph.Argument{ //nolint:exhaustruct
			Name:        "args",
			Description: fmt.Sprintf(`input parameters for function "%s"`, graphqlName),
			Type:        graph.NewNonNullType(argsTypeName),
		})
	}

	// Return type is nullable: a single-row function may produce zero rows.
	return &graph.Field{ //nolint:exhaustruct
		Name:        graphqlName,
		Description: description,
		Type:        graph.NewNamedType(baseTableName),
		Arguments:   arguments,
	}
}

// buildFunctionAggregateField creates the GraphQL field for a function's aggregate query.
func buildFunctionAggregateField(
	aggregateName string,
	fnMeta *metadata.FunctionMetadata,
	fnInfo *introspection.Function,
	baseTableName string,
	argsTypeName string,
	sessionArgument string,
	caps Capabilities,
) *graph.Field {
	qualifiedName := getQualifiedName(fnMeta.Function.Schema, fnMeta.Function.Name)
	description := fmt.Sprintf(
		`execute function "%s" and query aggregates on result of table type "%s"`,
		qualifiedName, baseTableName,
	)

	arguments := buildFunctionFieldArguments(
		aggregateName, fnInfo, baseTableName, argsTypeName, sessionArgument, caps,
	)

	return &graph.Field{ //nolint:exhaustruct
		Name:        aggregateName,
		Description: description,
		Type:        graph.NewNonNullType(baseTableName + "_aggregate"),
		Arguments:   arguments,
	}
}

// buildFunctionFieldArguments creates the arguments for a function field.
// This includes the args input object and the standard table query modifiers.
// fieldName is the GraphQL name of the field these arguments belong to; it is
// used only to render the `args` description, which Hasura keys off the field's
// own name (so the aggregate field uses the aggregate name, not the base name).
func buildFunctionFieldArguments(
	fieldName string,
	fnInfo *introspection.Function,
	baseTableName string,
	argsTypeName string,
	sessionArgument string,
	caps Capabilities,
) []*graph.Argument {
	arguments := make([]*graph.Argument, 0, 6) //nolint:mnd

	if hasVisibleArguments(fnInfo.Arguments, sessionArgument) {
		arguments = append(arguments, &graph.Argument{ //nolint:exhaustruct
			Name:        "args",
			Description: fmt.Sprintf(`input parameters for function "%s"`, fieldName),
			Type:        graph.NewNonNullType(argsTypeName),
		})
	}

	arguments = append(arguments, collectionArguments(baseTableName, caps)...)

	return arguments
}

// hasVisibleArguments returns true if the function has arguments that should be visible
// in the GraphQL schema (excluding the session argument).
func hasVisibleArguments(args []introspection.FunctionArgument, sessionArgument string) bool {
	for i, arg := range args {
		graphqlName := arg.GraphQLName(i)
		if sessionArgument == "" || graphqlName != sessionArgument {
			return true
		}
	}

	return false
}
