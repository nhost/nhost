package queries

import (
	json "encoding/json/v2"
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
	// Name is the GraphQL input-field name. Positional-only PostgreSQL
	// arguments use generated GraphQL names such as arg_1.
	Name string
	// SQLName is the PostgreSQL argument name for named-argument calls. It is
	// empty for positional-only PostgreSQL arguments.
	SQLName    string
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
	for i, arg := range fnInfo.Arguments {
		f.arguments = append(f.arguments, &functionArgument{
			Name:       arg.GraphQLName(i),
			SQLName:    arg.Name,
			SQLType:    arg.Type,
			HasDefault: arg.HasDefault,
		})
	}

	if !fnInfo.ReturnType.IsTableType() {
		return "", "", fmt.Errorf("%w: %s.%s",
			errFunctionDoesNotReturnTableType,
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
		return nil, errArgsMustBeObject
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

	var err error

	params, paramIndex, err = f.writeFunctionArguments(
		b, argsMap, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return functionCallResult{}, err
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

// writeFunctionArguments emits the argument list for a function call, mixing
// PostgreSQL positional and named-argument notation as the signature requires.
//
// Omitted defaulted arguments are dropped entirely so PostgreSQL applies their
// declared defaults; the SQL DEFAULT keyword is invalid in a function call and
// must never be emitted.
//
// PostgreSQL requires every positional argument to precede every named one, a
// positional argument cannot skip an earlier slot, and an unnamed argument can
// only ever be bound positionally (its generated GraphQL name, arg_1 ..., is
// not a valid SQL argument name). The notation for each argument therefore
// depends on look-ahead, not on the argument alone: every unnamed *supplied*
// argument forces the positional region to extend at least to its index, so
// any earlier argument — even a named one — must also be emitted positionally.
//
// The rule, keyed off lastUnnamedSuppliedIdx (the highest index among supplied
// arguments that is unnamed, or -1 when none is), is:
//   - supplied, index <= lastUnnamedSuppliedIdx → positional ($N); it must
//     precede the trailing unnamed positional argument, even if it has a name.
//   - supplied, index > lastUnnamedSuppliedIdx → named ("name" := $N); such an
//     argument is guaranteed to have a SQL name (an unnamed supplied argument
//     would have pushed lastUnnamedSuppliedIdx higher), and naming keeps the
//     binding correct across omitted middle/later defaults.
//   - omitted (defaulted) before lastUnnamedSuppliedIdx → genuine error: the
//     positional region cannot skip a gap, and the trailing unnamed argument
//     cannot be named to escape it.
//   - omitted (defaulted) after lastUnnamedSuppliedIdx → skipped; PostgreSQL
//     applies the default and we are in (or entering) the named region.
func (f *function) writeFunctionArguments(
	b *strings.Builder,
	argsMap map[string]any,
	sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	lastUnnamedSuppliedIdx := f.lastUnnamedSuppliedArgIndex(argsMap)

	w := functionArgWriter{
		f:                      f,
		b:                      b,
		params:                 params,
		paramIndex:             paramIndex,
		wrote:                  false,
		lastUnnamedSuppliedIdx: lastUnnamedSuppliedIdx,
	}

	for i, arg := range f.arguments {
		value, supplied := argsMap[arg.Name]

		switch {
		// If this is the session argument, inject session variables as JSON for
		// ordinary execution or as a whole-session marker for subscription cohorts.
		case f.isSessionArgument(arg):
			sessionArgument, err := f.sessionArgumentValue(arg, sessionVariables)
			if err != nil {
				return nil, 0, err
			}

			w.write(i, arg, sessionArgument)

		case supplied:
			w.write(i, arg, value)

		case arg.HasDefault:
			// Omit so PostgreSQL applies the declared default. An omitted slot
			// before a later supplied unnamed (positional) argument leaves an
			// unfillable gap in the positional region, which PostgreSQL cannot
			// express.
			if i < lastUnnamedSuppliedIdx {
				return nil, 0, fmt.Errorf("%w: %s.%s argument %q",
					errCannotCallFunctionArgumentPositionally,
					f.schemaName, f.functionName, arg.Name)
			}

		default:
			return nil, 0, fmt.Errorf("%w: %s.%s argument %q",
				errMissingRequiredFunctionArgument, f.schemaName, f.functionName, arg.Name)
		}
	}

	return w.params, w.paramIndex, nil
}

// isSessionArgument reports whether arg is the configured session argument,
// which is injected from the role's session variables rather than from user
// input.
func (f *function) isSessionArgument(arg *functionArgument) bool {
	return f.sessionArgument != "" && arg.Name == f.sessionArgument
}

func (f *function) sessionArgumentValue(
	arg *functionArgument,
	sessionVariables map[string]any,
) (any, error) {
	if isSubscriptionTemplateSessionArgument(sessionVariables) {
		return core.FunctionSessionArgument{SQLType: arg.SQLType}, nil
	}

	sessionJSON, err := marshalSessionArgument(arg.Name, sessionVariables)
	if err != nil {
		return nil, err
	}

	return sessionJSON, nil
}

// lastUnnamedSuppliedArgIndex returns the highest index among arguments that
// are supplied (user-provided or the session argument) and have no SQL name,
// or -1 when no such argument exists. It defines the extent of the positional
// region: every argument up to and including this index must be emitted
// positionally so the trailing unnamed argument keeps its declared slot.
func (f *function) lastUnnamedSuppliedArgIndex(argsMap map[string]any) int {
	last := -1

	for i, arg := range f.arguments {
		if arg.SQLName != "" {
			continue
		}

		_, supplied := argsMap[arg.Name]
		if supplied || f.isSessionArgument(arg) {
			last = i
		}
	}

	return last
}

// functionArgWriter accumulates the SQL argument list for a single function
// call. It threads the params slice and placeholder index through each emitted
// argument and uses the precomputed lastUnnamedSuppliedIdx to choose positional
// vs named notation (see function.writeFunctionArguments for the rules).
type functionArgWriter struct {
	f          *function
	b          *strings.Builder
	params     []any
	paramIndex int
	// wrote reports whether at least one argument has already been emitted, so
	// the next one is prefixed with ", ".
	wrote bool
	// lastUnnamedSuppliedIdx is the highest index among supplied arguments that
	// is unnamed, or -1 when none is. Arguments at or below it are emitted
	// positionally; arguments above it are emitted by name.
	lastUnnamedSuppliedIdx int
}

// write emits one supplied argument at position idx, choosing positional
// notation while idx is within the positional region (<= lastUnnamedSuppliedIdx)
// and named notation otherwise. Every argument emitted by name is guaranteed to
// carry a SQL name, because any unnamed supplied argument would have pushed
// lastUnnamedSuppliedIdx to at least idx.
func (w *functionArgWriter) write(idx int, arg *functionArgument, value any) {
	if w.wrote {
		w.b.WriteString(", ")
	}

	w.wrote = true

	w.params = append(w.params, value)

	if idx > w.lastUnnamedSuppliedIdx {
		core.WriteQuotedIdentifier(w.b, arg.SQLName)
		w.b.WriteString(" := ")
	}

	w.b.WriteString(w.f.dialect.Placeholder(w.paramIndex))
	w.paramIndex++
}

// marshalSessionArgument encodes the role's session variables as a JSON string
// for binding to the function's session argument. A nil map is encoded as an
// empty object so the serialization is consistent. The value is returned as a
// string (not raw bytes) so pgx binds it as JSON rather than nested PostgreSQL
// types.
func marshalSessionArgument(argName string, sessionVariables map[string]any) (string, error) {
	sv := sessionVariables
	if sv == nil {
		sv = make(map[string]any)
	}

	// Deterministic(true) sorts map keys so the serialized session object is
	// byte-stable across runs/processes; without it json/v2 emits map keys in
	// randomized order, which makes the bound parameter (and golden files)
	// flap.
	jsonBytes, err := json.Marshal(sv, json.Deterministic(true))
	if err != nil {
		return "", fmt.Errorf(
			"failed to marshal session variables for function argument %q: %w",
			argName, err,
		)
	}

	return string(jsonBytes), nil
}
