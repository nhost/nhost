package queries

import (
	"fmt"
	"slices"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/arguments"
)

// inputVariables implements input presence after variable coercion. A missing
// nullable variable omits an argument/object field, but contributes null in a
// list. Explicit null stays present. Definitions come from the selected
// operation, not VariableDefinition pointers shared by multi-operation fragments.
// All edits are copy-on-write because validated documents are cached.
type inputVariables struct {
	definitions ast.VariableDefinitionList
	variables   map[string]any
	fragments   ast.FragmentDefinitionList
	normalized  map[string]*ast.FragmentDefinition
}

// NormalizeInputVariables applies omission, input defaults and non-null use-site
// checks to a validated operation with coerced variables. It returns request-local
// copies only where inputs change, including reachable fragments. Callers that
// plan remote selections must use it before dropping variable or field definitions.
// Unvalidated/generated arguments remain untouched.
func NormalizeInputVariables(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) (*ast.OperationDefinition, ast.FragmentDefinitionList, error) {
	needed := false
	for _, definition := range operation.VariableDefinitions {
		value, exists := variables[definition.Variable]
		if exists && value == nil || !exists && definition.Type != nil && !definition.Type.NonNull {
			needed = true
			break
		}
	}

	if !needed {
		return operation, fragments, nil
	}

	inputs := &inputVariables{
		definitions: operation.VariableDefinitions,
		variables:   variables,
		fragments:   fragments,
		normalized:  make(map[string]*ast.FragmentDefinition),
	}

	selections, err := inputs.selectionSet(operation.SelectionSet, "")
	if err != nil {
		return nil, nil, fmt.Errorf("normalizing operation inputs: %w", err)
	}

	result := operation
	if !slices.Equal(selections, operation.SelectionSet) {
		cloned := *operation
		cloned.SelectionSet = selections
		result = &cloned
	}

	var resolvedFragments ast.FragmentDefinitionList
	for i, fragment := range fragments {
		if resolved, ok := inputs.normalized[fragment.Name]; ok && resolved != fragment {
			if resolvedFragments == nil {
				resolvedFragments = slices.Clone(fragments)
			}

			resolvedFragments[i] = resolved
		}
	}

	if resolvedFragments == nil {
		resolvedFragments = fragments
	}

	return result, resolvedFragments, nil
}

func (v *inputVariables) selectionSet(
	selections ast.SelectionSet,
	parentPath string,
) (ast.SelectionSet, error) {
	var result ast.SelectionSet
	for i, selection := range selections {
		resolved, err := v.selection(selection, parentPath)
		if err != nil {
			return nil, err
		}

		if resolved == selection {
			continue
		}

		if result == nil {
			result = slices.Clone(selections)
		}

		result[i] = resolved
	}

	if result == nil {
		return selections, nil
	}

	return result, nil
}

//nolint:ireturn // gqlparser selection sets intentionally contain different AST node types.
func (v *inputVariables) selection(
	selection ast.Selection,
	parentPath string,
) (ast.Selection, error) {
	switch selected := selection.(type) {
	case *ast.Field:
		return v.field(selected, childArgumentPath(parentPath, selected))
	case *ast.InlineFragment:
		selections, err := v.selectionSet(selected.SelectionSet, parentPath)
		if err != nil {
			return nil, err
		}

		if slices.Equal(selections, selected.SelectionSet) {
			return selected, nil
		}

		cloned := *selected
		cloned.SelectionSet = selections

		return &cloned, nil
	case *ast.FragmentSpread:
		fragment, err := v.fragment(selected.Name, parentPath)
		if err != nil {
			return nil, err
		}

		if fragment == selected.Definition {
			return selected, nil
		}

		cloned := *selected
		cloned.Definition = fragment

		return &cloned, nil
	default:
		return selection, nil
	}
}

func (v *inputVariables) fragment(name, parentPath string) (*ast.FragmentDefinition, error) {
	if fragment, ok := v.normalized[name]; ok {
		return fragment, nil
	}

	fragment := v.fragments.ForName(name)
	if fragment == nil {
		return fragment, nil
	}
	// Validation rejects cycles. Mark before descending so an unvalidated cycle
	// cannot recurse forever in this preparatory pass either.
	v.normalized[name] = fragment

	selections, err := v.selectionSet(fragment.SelectionSet, parentPath)
	if err != nil {
		return nil, fmt.Errorf("normalizing fragment %s: %w", name, err)
	}

	if slices.Equal(selections, fragment.SelectionSet) {
		return fragment, nil
	}

	cloned := *fragment
	cloned.SelectionSet = selections
	v.normalized[name] = &cloned

	return &cloned, nil
}

func (v *inputVariables) field(field *ast.Field, path string) (*ast.Field, error) {
	args, err := v.arguments(field)
	if err != nil {
		return nil, fmt.Errorf(
			"normalizing field %s: %w",
			field.Name,
			annotateQueryValidationError(err, path),
		)
	}

	selections, err := v.selectionSet(field.SelectionSet, path)
	if err != nil {
		return nil, err
	}

	if slices.Equal(args, field.Arguments) && slices.Equal(selections, field.SelectionSet) {
		return field, nil
	}

	cloned := *field
	cloned.Arguments = args
	cloned.SelectionSet = selections

	return &cloned, nil
}

func (v *inputVariables) arguments(field *ast.Field) (ast.ArgumentList, error) {
	// Without a validated field definition, a missing selector must continue to
	// fail in its parser rather than being mistaken for an optional argument.
	if field.Definition == nil {
		return field.Arguments, nil
	}

	result := make(ast.ArgumentList, 0, len(field.Arguments))
	for _, argument := range field.Arguments {
		resolved := argument
		if definition := field.Definition.Arguments.ForName(argument.Name); definition != nil {
			value, err := v.value(argument.Value, definition.DefaultValue)
			if err != nil {
				return nil, fmt.Errorf("normalizing argument %s: %w", argument.Name, err)
			}

			if value == nil {
				continue
			}

			if value != argument.Value {
				cloned := *argument
				cloned.Value = value
				resolved = &cloned
			}
		}

		result = append(result, resolved)
	}

	if slices.Equal(result, field.Arguments) {
		return field.Arguments, nil
	}

	return result, nil
}

// value returns nil only for an omitted optional variable with no input default.
func (v *inputVariables) value(value, fallback *ast.Value) (*ast.Value, error) {
	if value.Kind == ast.Variable {
		return v.variable(value, fallback)
	}

	if value.Kind != ast.ObjectValue && value.Kind != ast.ListValue {
		return value, nil
	}

	result := make(ast.ChildValueList, 0, len(value.Children))
	for _, child := range value.Children {
		var childDefault *ast.Value
		if value.Kind == ast.ObjectValue && value.Definition != nil {
			if definition := value.Definition.Fields.ForName(child.Name); definition != nil {
				childDefault = definition.DefaultValue
			}
		}

		resolved, err := v.value(child.Value, childDefault)
		if err != nil {
			return nil, fmt.Errorf("normalizing input field %s: %w", child.Name, err)
		}

		if resolved == nil {
			if value.Kind == ast.ObjectValue {
				continue
			}

			cloned := *child.Value
			cloned.Kind = ast.NullValue
			cloned.Raw = "null"
			resolved = &cloned
		}

		copiedChild := child
		if resolved != child.Value {
			cloned := *child
			cloned.Value = resolved
			copiedChild = &cloned
		}

		result = append(result, copiedChild)
	}

	if slices.Equal(result, value.Children) {
		return value, nil
	}

	cloned := *value
	cloned.Children = result

	return &cloned, nil
}

func (v *inputVariables) variable(value, fallback *ast.Value) (*ast.Value, error) {
	if provided, exists := v.variables[value.Raw]; exists {
		if provided == nil && value.ExpectedType != nil && value.ExpectedType.NonNull {
			return nil, fmt.Errorf("variable $%s: %w", value.Raw, arguments.NewNullInputError())
		}

		return value, nil
	}

	definition := v.definitions.ForName(value.Raw)
	if definition == nil || definition.Type == nil || definition.Type.NonNull {
		return value, nil
	}

	if definition.DefaultValue != nil {
		return definition.DefaultValue, nil
	}

	if value.ExpectedType != nil && value.ExpectedType.NonNull && fallback == nil {
		return value, nil
	}

	return fallback, nil
}
