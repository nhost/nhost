package queries

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
	"github.com/nhost/nhost/services/constellation/metadata"
)

var (
	errComputedArgsObject    = errors.New("computed args must be an object")
	errComputedPositionalGap = errors.New("cannot omit positional computed argument")
	errComputedNonJSONPath   = errors.New("path requires a JSON computed field")
)

type computedScalar struct {
	name            string
	function        *introspection.ComputedFunction
	sessionArgument string
}

func (t *table) initializeComputedScalars(
	objects *introspection.Objects,
	md metadata.TableMetadata,
) {
	for _, field := range md.ComputedFields {
		lookup, found := objects.GetComputedFunction(t.schemaName, t.tableName, field.Name)
		if !found || lookup.Function == nil || lookup.Function.ReturnSet ||
			lookup.Function.ReturnRelOID != 0 ||
			lookup.Function.ReturnType.Kind != "b" {
			continue
		}

		t.computedScalars = append(t.computedScalars, computedScalar{
			name:            field.Name,
			function:        lookup.Function,
			sessionArgument: field.Definition.SessionArgument,
		})
	}
}

// ComputedScalarFromGraphqlName resolves only argument-free, granted inputs.
// The selection surface is wider: Hasura accepts user arguments in selections
// and aggregate outputs, but not in bool_exp or order_by.
//
//nolint:ireturn // The parser boundary deliberately returns the expression contract.
func (t *table) ComputedScalarFromGraphqlName(
	name, role string,
) core.ComputedExpression {
	computed := t.computedFromGraphqlName(name, role)
	if computed == nil {
		return nil
	}

	for _, name := range computed.function.GraphQLArgumentNames(computed.sessionArgument) {
		if name != "" {
			return nil
		}
	}

	return &computedInput{table: t, computed: computed}
}

type computedInput struct {
	table    *table
	computed *computedScalar
}

func (input *computedInput) SQLType() string {
	return input.computed.function.ReturnType.Name
}

func (input *computedInput) WriteExpression(
	b *strings.Builder, source string, sessionVariables map[string]any,
	params []any, paramIndex int,
) ([]any, int, error) {
	if source == input.table.cachedTableRef {
		source = input.table.tableName
	} else {
		source = strings.Trim(source, `"`)
	}

	return input.table.writeComputedCall(
		b, input.computed, nil, source, "", nil, sessionVariables,
		params, paramIndex,
	)
}

func (t *table) computedFromGraphqlName(name, role string) *computedScalar {
	for i := range t.computedScalars {
		if t.computedScalars[i].name != name {
			continue
		}

		if role == metadata.RoleAdmin {
			return &t.computedScalars[i]
		}

		if slices.Contains(t.computedGrants[role], name) {
			return &t.computedScalars[i]
		}
	}

	return nil
}

// writeComputedScalar binds every client/session value, preserving the catalog
// argument positions even when the row is not the first function argument.
func (t *table) writeComputedScalar(
	b *strings.Builder,
	selected columnSelection,
	alias, argumentPath string,
	variables, sessionVariables map[string]any,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	var call strings.Builder

	params, paramIndex, err := t.writeComputedCall(
		&call, selected.computed, selected.field, alias, argumentPath,
		variables, sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	expr := call.String()
	if pgtypes.IsSpatial(selected.computed.function.ReturnType.Name) &&
		t.dialect.SupportsSpatialTypes() {
		expr = t.dialect.SpatialOutputExpression(expr, selected.computed.function.ReturnType.Name)
	}

	expr, params, paramIndex, err = t.computedPathExpression(
		expr, selected, variables, argumentPath, params, paramIndex,
	)
	if err != nil {
		return nil, 0, err
	}

	t.dialect.WriteJSONRowColumn(b, selected.alias, expr)

	return params, paramIndex, nil
}

//nolint:gocognit,cyclop,funlen // Catalog slots, defaults and session markers share one parameter accumulator.
func (t *table) writeComputedCall(
	call *strings.Builder, computed *computedScalar, field *ast.Field,
	alias, argumentPath string, variables, sessionVariables map[string]any,
	params []any, paramIndex int,
) ([]any, int, error) {
	fn := computed.function
	argumentNames := fn.GraphQLArgumentNames(computed.sessionArgument)

	args := map[string]any{}

	var argument *ast.Argument
	if field != nil {
		argument = field.Arguments.ForName("args")
	}

	if argument != nil {
		arg := argument

		resolved, err := resolveComputedArgsValue(arg.Value, variables)
		if err != nil {
			return nil, 0, fmt.Errorf("resolving computed arguments: %w", err)
		}

		if resolved == nil {
			invalid := arguments.NewComputedNullArgumentError(
				"args", computed.name+"_"+t.graphqlTypeName+"_args",
			)
			invalid.StampArgumentPath(argumentPath)

			return nil, 0, invalid
		}

		var ok bool

		args, ok = resolved.(map[string]any)
		if !ok {
			return nil, 0, fmt.Errorf("%w: %s", errComputedArgsObject, computed.name)
		}
	}

	if args == nil {
		args = map[string]any{}
	}

	core.WriteQuotedIdentifier(call, fn.Schema)
	call.WriteByte('.')
	core.WriteQuotedIdentifier(call, fn.Name)
	call.WriteByte('(')

	wrote := false
	// An unnamed input must be positional; all preceding arguments must then
	// be supplied. Named arguments after this point may omit defaults.
	positionalEnd := -1
	for i, arg := range fn.Arguments {
		if arg.Name == "" && (i == fn.RowArgument || !arg.HasDefault) {
			positionalEnd = i
		}

		if arg.Name == "" && argumentNames[i] != "" {
			if _, present := args[argumentNames[i]]; present {
				positionalEnd = i
			}
		}
	}

	for i, arg := range fn.Arguments {
		if arg.Mode != "i" {
			continue
		}

		var value any

		present := true
		switch {
		case i == fn.RowArgument:
			// Emitted below from the full physical row; no role-projected columns.
		case arg.Name == computed.sessionArgument && computed.sessionArgument != "":
			if isSubscriptionTemplateSessionArgument(sessionVariables) {
				value = core.FunctionSessionArgument{SQLType: arg.Type.Name}
			} else {
				encoded, err := marshalSessionArgument(arg.Name, sessionVariables)
				if err != nil {
					return nil, 0, fmt.Errorf("serializing computed session argument: %w", err)
				}

				value = encoded
			}
		default:
			value, present = args[argumentNames[i]]
		}

		if !present {
			if !arg.HasDefault {
				return nil, 0, arguments.NewComputedOmissionError(argumentPath)
			}

			if i < positionalEnd {
				return nil, 0, fmt.Errorf("%w %q", errComputedPositionalGap, arg.Name)
			}

			continue
		}

		if wrote {
			call.WriteString(", ")
		}

		wrote = true

		if i > positionalEnd && arg.Name != "" {
			core.WriteQuotedIdentifier(call, arg.Name)
			call.WriteString(" := ")
		}

		if i == fn.RowArgument {
			names := make([]string, len(t.columns))
			for j, col := range t.columns {
				names[j] = col.SQLName
			}

			dialect.WritePostgresComputedRow(call, alias, t.schemaName, t.tableName, names)
		} else {
			coerced, err := t.writeComputedArgument(call, arg, value, paramIndex)
			if err != nil {
				return nil, 0, err
			}

			params = append(params, coerced)
			paramIndex++
		}
	}

	call.WriteByte(')')

	return params, paramIndex, nil
}

// GraphQL substitutes null for an unset optional variable supplied as a field
// argument. Limit this fallback to the computed field boundary; other query
// arguments retain their existing missing-variable handling.
func resolveComputedOptionalValue(value *ast.Value, variables map[string]any) (any, error) {
	if value.Kind == ast.Variable {
		if _, exists := variables[value.Raw]; !exists {
			return nil, nil //nolint:nilnil // Unset optional GraphQL variable is null.
		}
	}

	resolved, err := values.ResolveASTValue(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving computed optional value: %w", err)
	}

	return resolved, nil
}

// An unset variable inside a literal args object is an explicit SQL NULL,
// including for a required function argument. An absent object key instead
// retains its omission/default semantics.
func resolveComputedArgsValue(value *ast.Value, variables map[string]any) (any, error) {
	if value.Kind != ast.ObjectValue {
		return resolveComputedOptionalValue(value, variables)
	}

	args := make(map[string]any, len(value.Children))
	for _, child := range value.Children {
		resolved, err := resolveComputedOptionalValue(child.Value, variables)
		if err != nil {
			return nil, fmt.Errorf("resolving field %q: %w", child.Name, err)
		}

		args[child.Name] = resolved
	}

	return args, nil
}

func (t *table) writeComputedArgument(
	b *strings.Builder, arg introspection.ComputedFunctionArgument, value any, paramIndex int,
) (any, error) {
	placeholder := t.dialect.Placeholder(paramIndex)
	if pgtypes.IsSpatial(arg.Type.Name) && t.dialect.SupportsSpatialTypes() {
		coerced, err := values.CoerceSQLValue(arg.Type.Name, value)
		if err != nil {
			return nil, fmt.Errorf("coercing computed spatial argument: %w", err)
		}

		b.WriteString(t.dialect.SpatialValueExpression(placeholder, arg.Type.Name))

		return coerced, nil
	}

	b.WriteString(placeholder)
	// PostgreSQL needs a concrete type for nullable / JSON placeholders.
	b.WriteString("::")
	core.WriteQuotedIdentifier(b, arg.Type.Schema)
	b.WriteByte('.')
	core.WriteQuotedIdentifier(b, arg.Type.Name)

	return value, nil
}

func (t *table) computedPathExpression(
	expr string, selected columnSelection, variables map[string]any,
	argumentPath string, params []any, paramIndex int,
) (string, []any, int, error) {
	path := selected.field.Arguments.ForName("path")
	if path == nil {
		return expr, params, paramIndex, nil
	}

	resolved, err := resolveComputedOptionalValue(path.Value, variables)
	if err != nil {
		return "", nil, 0, fmt.Errorf("resolving computed JSON path: %w", err)
	}

	if resolved == nil {
		invalid := arguments.NewComputedNullArgumentError("path", "String")
		invalid.StampArgumentPath(argumentPath)

		return "", nil, 0, invalid
	}

	returnType := selected.computed.function.ReturnType.Name
	if returnType != "json" && returnType != "jsonb" {
		return "", nil, 0, errComputedNonJSONPath
	}

	text, ok := resolved.(string)
	if !ok {
		invalid := arguments.NewComputedJSONPathError(fmt.Sprint(resolved))
		invalid.StampArgumentPath(argumentPath)

		return "", nil, 0, invalid
	}

	parts, err := parseComputedPath(text)
	if err != nil {
		invalid := arguments.NewComputedJSONPathError(text)
		invalid.StampArgumentPath(argumentPath)

		return "", nil, 0, invalid
	}

	// PostgreSQL text cannot contain NUL. Keep the function call (and all its
	// argument placeholders) while a strict JSON path lookup yields null.
	for _, part := range parts {
		if strings.ContainsRune(part, 0) {
			return dialect.PostgresComputedOutput(expr, "NULL"), params, paramIndex, nil
		}
	}

	expr = dialect.PostgresComputedOutput(expr, t.dialect.Placeholder(paramIndex))

	return expr, append(params, parts), paramIndex + 1, nil
}
