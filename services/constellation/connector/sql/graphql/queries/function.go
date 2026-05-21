package queries

import (
	json "encoding/json/v2"
	"errors"
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

type function struct {
	schemaName         string
	functionName       string
	querySelectName    string
	queryAggregateName string
	arguments          []*functionArgument

	// volatility determines if function is query (STABLE/IMMUTABLE) or mutation (VOLATILE)
	volatility introspection.Volatility

	// exposedAs overrides the default exposure based on volatility
	exposedAs string

	// isSetOf indicates if the function returns SETOF (multiple rows) or a single row
	isSetOf bool

	sessionArgument string
	dialect         dialect.Dialect
}

type functionArgument struct {
	Name       string
	SQLType    string
	HasDefault bool
}

func newFunction(schemaName, functionName string, dialect dialect.Dialect) *function {
	return &function{
		schemaName:         schemaName,
		functionName:       functionName,
		querySelectName:    "",
		queryAggregateName: "",
		arguments:          nil,
		volatility:         introspection.VolatilityVolatile,
		exposedAs:          "",
		isSetOf:            false, // will be set during initialization
		sessionArgument:    "",
		dialect:            dialect,
	}
}

// Initialize loads the function's arguments from introspection and returns
// the base table schema and name to link it against.
func (f *function) Initialize(
	objects *introspection.Objects,
	fnMeta metadata.FunctionMetadata,
) (string, string, error) {
	fnInfo, ok := objects.GetFunction(fnMeta.Function.Schema, fnMeta.Function.Name)
	if !ok {
		return "", "", fmt.Errorf("function %s.%s: %w",
			fnMeta.Function.Schema, fnMeta.Function.Name, errFunctionNotFound)
	}

	// Set up GraphQL field names
	// Priority: custom_root_fields > custom_name > function.name
	baseName := fnMeta.Function.Name
	if fnMeta.Configuration.CustomName != "" {
		baseName = fnMeta.Configuration.CustomName
	}

	f.querySelectName = baseName
	if fnMeta.Configuration.CustomRootFields.Function != "" {
		f.querySelectName = fnMeta.Configuration.CustomRootFields.Function
	}

	f.queryAggregateName = baseName + "_aggregate"
	if fnMeta.Configuration.CustomRootFields.FunctionAggregate != "" {
		f.queryAggregateName = fnMeta.Configuration.CustomRootFields.FunctionAggregate
	}

	f.volatility = fnInfo.Volatility
	f.exposedAs = fnMeta.Configuration.ExposedAs
	f.isSetOf = fnInfo.ReturnType.IsSetOf
	f.sessionArgument = fnMeta.Configuration.SessionArgument

	f.arguments = make([]*functionArgument, 0, len(fnInfo.Arguments))
	for _, arg := range fnInfo.Arguments {
		f.arguments = append(f.arguments, &functionArgument{
			Name:       arg.Name,
			SQLType:    arg.Type,
			HasDefault: arg.HasDefault,
		})
	}

	if !fnInfo.ReturnType.IsTableType() {
		return "", "", fmt.Errorf("function %s.%s does not return a table type",
			fnMeta.Function.Schema, fnMeta.Function.Name)
	}

	return fnInfo.ReturnType.TableSchema, fnInfo.ReturnType.TableName, nil
}

// IsQuery returns true if the function should be exposed as a query/subscription.
func (f *function) IsQuery() bool {
	// ExposedAs takes precedence
	if f.exposedAs == "mutation" {
		return false
	}

	if f.exposedAs == "query" {
		return true
	}

	// Default: STABLE/IMMUTABLE -> query, VOLATILE -> mutation
	return f.volatility == introspection.VolatilityStable ||
		f.volatility == introspection.VolatilityImmutable
}

type functionCallResult struct {
	fromClause string
	sourceRef  string
	params     []any
	paramIndex int
}

// parseFunctionArguments extracts function arguments from the GraphQL args input.
func (f *function) parseFunctionArguments(
	arguments ast.ArgumentList,
	variables map[string]any,
) (map[string]any, error) {
	argsArg := arguments.ForName("args")
	if argsArg == nil {
		// No args provided
		return make(map[string]any), nil
	}

	argsValue, err := values.ResolveASTValue(argsArg.Value, variables)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve args value: %w", err)
	}

	argsMap, ok := argsValue.(map[string]any)
	if !ok {
		return nil, errors.New("args must be an object")
	}

	return argsMap, nil
}

// buildFunctionFromClause constructs the FROM clause for the function call.
// Returns the fromClause (for the FROM expression) and sourceRef (for column qualification).
// If sessionArgument is set, the session variables are injected as a JSON object.
func (f *function) buildFunctionFromClause(
	argsMap map[string]any,
	sessionVariables map[string]any,
	params []any,
	//nolint:unparam // paramIndex is the SQL placeholder offset for the function
	// arguments; it is threaded in alongside the params accumulator and returned via
	// functionCallResult.paramIndex so downstream WHERE/aggregate SQL continues the
	// same placeholder numbering. It is 1 today only because function args are the
	// first-bound parameters in every call shape; hardcoding it would bake in that
	// ordering assumption.
	paramIndex int,
) (functionCallResult, error) {
	b := &strings.Builder{}
	core.WriteQuotedIdentifier(b, f.schemaName)
	b.WriteByte('.')
	core.WriteQuotedIdentifier(b, f.functionName)
	b.WriteByte('(')

	for i, arg := range f.arguments {
		if i > 0 {
			b.WriteString(", ")
		}

		// If this is the session argument, inject session variables as JSON
		if f.sessionArgument != "" && arg.Name == f.sessionArgument {
			// Use empty map if session variables are nil to ensure consistent JSON serialization
			sv := sessionVariables
			if sv == nil {
				sv = make(map[string]any)
			}

			// Encode as JSON string to ensure pgx treats it as JSON, not as nested PostgreSQL types
			jsonBytes, err := json.Marshal(sv)
			if err != nil {
				return functionCallResult{}, fmt.Errorf(
					"failed to marshal session variables for function argument %q: %w",
					arg.Name, err,
				)
			}

			params = append(params, string(jsonBytes))

			b.WriteString(f.dialect.Placeholder(paramIndex))
			paramIndex++

			continue
		}

		if value, ok := argsMap[arg.Name]; ok {
			params = append(params, value)

			b.WriteString(f.dialect.Placeholder(paramIndex))
			paramIndex++
		} else if arg.HasDefault {
			b.WriteString("DEFAULT")
		} else {
			return functionCallResult{}, fmt.Errorf("%w: %s.%s argument %q",
				errMissingRequiredFunctionArgument, f.schemaName, f.functionName, arg.Name)
		}
	}

	b.WriteString(")")

	// Use an alias for the function call result so columns can be referenced in WHERE clauses.
	// PostgreSQL requires an alias to reference columns from a function result set.
	fnAlias := "_fn_" + f.functionName
	quotedAlias := core.QuoteIdentifier(fnAlias)
	fromClause := b.String() + " AS " + quotedAlias
	sourceRef := quotedAlias

	return functionCallResult{
		fromClause: fromClause,
		sourceRef:  sourceRef,
		params:     params,
		paramIndex: paramIndex,
	}, nil
}
