package controller

import (
	"github.com/vektah/gqlparser/v2/ast"
)

// shouldInclude evaluates the spec @skip / @include directives against the
// already-coerced request variables and reports whether the selection they
// decorate should be kept. A field/fragment is dropped when @skip(if: true) or
// @include(if: false). This is the single source of truth for directive
// evaluation reused by every selection walk in the package.
func shouldInclude(directives ast.DirectiveList, vars map[string]any) bool {
	if skip := directives.ForName("skip"); skip != nil && directiveCondition(skip, vars) {
		return false
	}

	if include := directives.ForName("include"); include != nil &&
		!directiveCondition(include, vars) {
		return false
	}

	return true
}

// directiveCondition resolves the boolean `if` argument of a @skip / @include
// directive. Literal booleans and variable references (looked up in the coerced
// variables, falling back to their declared default) are both supported. A
// missing or non-boolean argument resolves to false; gqlparser already
// validates that `if` is a non-null Boolean, so this only guards against
// malformed input reaching the executor.
func directiveCondition(d *ast.Directive, vars map[string]any) bool {
	arg := d.Arguments.ForName("if")
	if arg == nil || arg.Value == nil {
		return false
	}

	val, err := arg.Value.Value(vars)
	if err != nil {
		return false
	}

	cond, _ := val.(bool)

	return cond
}

// normalizeRootSelections returns the operation's root selection set with
// @skip/@include evaluated and root-level fragment spreads / inline fragments
// expanded into their constituent field selections. Duplicate root fields are
// merged by response name, matching GraphQL field collection before connector
// routing. After normalization every root selection is a plain *ast.Field, so
// the connector-routing logic only has to reason about fields. Nested selection
// sets are pruned of skipped fields but keep their fragment structure
// (connectors expand those via the fragment list).
//
// The cached query document is never mutated: every returned node is freshly
// allocated when its children change. frags is consulted to resolve named
// fragment spreads at the root.
func normalizeRootSelections(
	selections ast.SelectionSet,
	frags ast.FragmentDefinitionList,
	vars map[string]any,
) ast.SelectionSet {
	out := make(ast.SelectionSet, 0, len(selections))

	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			if !shouldInclude(s.Directives, vars) {
				continue
			}

			out = append(out, pruneField(s, vars))

		case *ast.InlineFragment:
			if !shouldInclude(s.Directives, vars) {
				continue
			}

			out = append(out, normalizeRootSelections(s.SelectionSet, frags, vars)...)

		case *ast.FragmentSpread:
			if !shouldInclude(s.Directives, vars) {
				continue
			}

			frag := frags.ForName(s.Name)
			if frag == nil {
				continue
			}

			out = append(out, normalizeRootSelections(frag.SelectionSet, frags, vars)...)
		}
	}

	return mergeFieldsByResponseName(out)
}

// mergeFieldsByResponseName performs the GraphQL field-collection merge for an
// already validated selection set. The validator has rejected incompatible
// fields with the same response name, so merging can keep the first field's
// identity and combine compatible sub-selection sets while preserving first
// occurrence order.
func mergeFieldsByResponseName(selections ast.SelectionSet) ast.SelectionSet {
	if len(selections) <= 1 {
		return selections
	}

	out := make(ast.SelectionSet, 0, len(selections))
	fieldByResponseName := make(map[string]fieldCollectionEntry, len(selections))

	for _, selection := range selections {
		field, ok := selection.(*ast.Field)
		if !ok {
			out = append(out, selection)

			continue
		}

		name := responseFieldName(field)
		if entry, exists := fieldByResponseName[name]; exists {
			merged := mergeCompatibleFields(entry.field, field)
			out[entry.index] = merged
			fieldByResponseName[name] = fieldCollectionEntry{
				index: entry.index,
				field: merged,
			}

			continue
		}

		fieldByResponseName[name] = fieldCollectionEntry{
			index: len(out),
			field: field,
		}
		out = append(out, field)
	}

	return out
}

type fieldCollectionEntry struct {
	index int
	field *ast.Field
}

func mergeCompatibleFields(left, right *ast.Field) *ast.Field {
	if len(left.SelectionSet) == 0 {
		if len(right.SelectionSet) == 0 {
			return left
		}

		return cloneFieldWithSelectionSet(left, right.SelectionSet)
	}

	if len(right.SelectionSet) == 0 {
		return left
	}

	return cloneFieldWithSelectionSet(
		left,
		mergeFieldsByResponseName(appendSelectionSets(left.SelectionSet, right.SelectionSet)),
	)
}

func cloneFieldWithSelectionSet(field *ast.Field, selectionSet ast.SelectionSet) *ast.Field {
	clone := *field
	clone.SelectionSet = selectionSet

	return &clone
}

func appendSelectionSets(left, right ast.SelectionSet) ast.SelectionSet {
	out := make(ast.SelectionSet, 0, len(left)+len(right))
	out = append(out, left...)
	out = append(out, right...)

	return out
}

// pruneNestedSelections returns a copy of a nested selection set with
// @skip/@include-excluded selections removed. Unlike the root walk it does not
// flatten fragment spreads — connectors resolve those through the (also pruned)
// fragment list — but it does recurse into fields and inline fragments so nested
// excluded fields never reach a connector or the planner.
func pruneNestedSelections(
	selections ast.SelectionSet,
	vars map[string]any,
) ast.SelectionSet {
	out := make(ast.SelectionSet, 0, len(selections))

	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			if !shouldInclude(s.Directives, vars) {
				continue
			}

			out = append(out, pruneField(s, vars))

		case *ast.InlineFragment:
			if !shouldInclude(s.Directives, vars) {
				continue
			}

			out = append(out, &ast.InlineFragment{ //nolint:exhaustruct
				TypeCondition:    s.TypeCondition,
				Directives:       s.Directives,
				SelectionSet:     pruneNestedSelections(s.SelectionSet, vars),
				ObjectDefinition: s.ObjectDefinition,
				Position:         s.Position,
			})

		case *ast.FragmentSpread:
			if !shouldInclude(s.Directives, vars) {
				continue
			}

			out = append(out, s)
		}
	}

	return out
}

// pruneField returns field with its nested selection set pruned of
// @skip/@include-excluded selections. Leaf fields (no selection set) are
// returned unchanged: they are read-only downstream, so sharing the cached node
// is safe and avoids needless allocation.
func pruneField(field *ast.Field, vars map[string]any) *ast.Field {
	if len(field.SelectionSet) == 0 {
		return field
	}

	return &ast.Field{ //nolint:exhaustruct
		Alias:        field.Alias,
		Name:         field.Name,
		Arguments:    field.Arguments,
		Directives:   field.Directives,
		SelectionSet: pruneNestedSelections(field.SelectionSet, vars),
		Position:     field.Position,
		Definition:   field.Definition,
	}
}

// pruneFragments returns copies of the fragment definitions with
// @skip/@include-excluded selections removed from their bodies. Spread-site
// directives are handled where the spread appears; this prunes the field-level
// directives inside each definition so connectors expanding the (kept) spread
// only see included fields.
func pruneFragments(
	frags ast.FragmentDefinitionList,
	vars map[string]any,
) ast.FragmentDefinitionList {
	if len(frags) == 0 {
		return frags
	}

	out := make(ast.FragmentDefinitionList, 0, len(frags))
	for _, frag := range frags {
		out = append(out, &ast.FragmentDefinition{ //nolint:exhaustruct
			Name:               frag.Name,
			VariableDefinition: frag.VariableDefinition,
			TypeCondition:      frag.TypeCondition,
			Directives:         frag.Directives,
			SelectionSet:       pruneNestedSelections(frag.SelectionSet, vars),
			Definition:         frag.Definition,
			Position:           frag.Position,
		})
	}

	return out
}

// pruneConnectorDocument trims the already-normalized connector operation into
// a standalone executable GraphQL document. Root fragment expansion and
// directive pruning can leave definitions that no remaining selection uses;
// remote schemas validate the forwarded document and reject those leftovers as
// unused variables/fragments, so drop them before connector execution.
func pruneConnectorDocument(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) (*ast.OperationDefinition, ast.FragmentDefinitionList) {
	if operation == nil {
		return nil, nil
	}

	execFragments := referencedFragmentsForOperation(operation, fragments)
	usedVariables := variableReferencesInOperation(operation, execFragments)

	return pruneOperationVariableDefinitions(operation, usedVariables), execFragments
}

func referencedFragmentsForOperation(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) ast.FragmentDefinitionList {
	if operation == nil || len(fragments) == 0 {
		return nil
	}

	seen := make(map[string]struct{})
	collectReferencedFragmentNames(operation.SelectionSet, fragments, seen)

	if len(seen) == 0 {
		return nil
	}

	out := make(ast.FragmentDefinitionList, 0, len(seen))
	for _, frag := range fragments {
		if _, ok := seen[frag.Name]; ok {
			out = append(out, frag)
		}
	}

	return out
}

func collectReferencedFragmentNames(
	selections ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	seen map[string]struct{},
) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			collectReferencedFragmentNames(s.SelectionSet, fragments, seen)
		case *ast.InlineFragment:
			collectReferencedFragmentNames(s.SelectionSet, fragments, seen)
		case *ast.FragmentSpread:
			if _, ok := seen[s.Name]; ok {
				continue
			}

			frag := fragments.ForName(s.Name)
			if frag == nil {
				continue
			}

			seen[s.Name] = struct{}{}
			collectReferencedFragmentNames(frag.SelectionSet, fragments, seen)
		}
	}
}

func variableReferencesInOperation(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) map[string]struct{} {
	used := make(map[string]struct{})

	collectVariablesFromDirectives(operation.Directives, used)
	collectVariablesFromSelectionSet(operation.SelectionSet, used)

	for _, frag := range fragments {
		collectVariablesFromDirectives(frag.Directives, used)
		collectVariablesFromSelectionSet(frag.SelectionSet, used)
	}

	return used
}

func collectVariablesFromSelectionSet(
	selections ast.SelectionSet,
	used map[string]struct{},
) {
	for _, sel := range selections {
		switch s := sel.(type) {
		case *ast.Field:
			collectVariablesFromArguments(s.Arguments, used)
			collectVariablesFromDirectives(s.Directives, used)
			collectVariablesFromSelectionSet(s.SelectionSet, used)
		case *ast.InlineFragment:
			collectVariablesFromDirectives(s.Directives, used)
			collectVariablesFromSelectionSet(s.SelectionSet, used)
		case *ast.FragmentSpread:
			collectVariablesFromDirectives(s.Directives, used)
		}
	}
}

func collectVariablesFromDirectives(
	directives ast.DirectiveList,
	used map[string]struct{},
) {
	for _, directive := range directives {
		collectVariablesFromArguments(directive.Arguments, used)
	}
}

func collectVariablesFromArguments(
	arguments ast.ArgumentList,
	used map[string]struct{},
) {
	for _, arg := range arguments {
		collectVariablesFromValue(arg.Value, used)
	}
}

func collectVariablesFromValue(value *ast.Value, used map[string]struct{}) {
	if value == nil {
		return
	}

	if value.Kind == ast.Variable {
		used[value.Raw] = struct{}{}

		return
	}

	for _, child := range value.Children {
		collectVariablesFromValue(child.Value, used)
	}
}

func pruneOperationVariableDefinitions(
	operation *ast.OperationDefinition,
	used map[string]struct{},
) *ast.OperationDefinition {
	if operation == nil || len(operation.VariableDefinitions) == 0 {
		return operation
	}

	kept := make(ast.VariableDefinitionList, 0, len(operation.VariableDefinitions))
	for _, def := range operation.VariableDefinitions {
		if _, ok := used[def.Variable]; ok {
			kept = append(kept, def)
		}
	}

	if len(kept) == len(operation.VariableDefinitions) {
		return operation
	}

	clone := *operation
	if len(kept) == 0 {
		clone.VariableDefinitions = nil
	} else {
		clone.VariableDefinitions = kept
	}

	return &clone
}

// isMetaField reports whether name is a GraphQL introspection meta-field that
// the controller resolves locally rather than routing to a connector.
func isMetaField(name string) bool {
	switch name {
	case "__schema", "__type", "__typename":
		return true
	default:
		return false
	}
}
