package planner

import (
	"github.com/nhost/nhost/services/constellation/controller/planner/transform"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
	"github.com/vektah/gqlparser/v2/ast"
)

// prepareRemoteSelection builds the target connector's selection without
// modifying the client's cached AST. Only a relationship's own remote result
// needs this pass; the primary operation is cleaned by the transformer.
func prepareRemoteSelection(
	remote *RemoteQueryPlan,
	analysis *analysisResult,
	schema *ast.Schema,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) *ast.Field {
	path := remote.SourcePath.Child(remote.OutputField)
	if !hasRemoteDescendant(path, analysis.RemoteQueries) {
		return remote.Selection
	}

	field := *remote.Selection

	typeName := ""
	if field.Definition != nil {
		typeName = field.Definition.Type.Name()
	}

	field.SelectionSet = prepareRemoteSelections(
		field.SelectionSet, typeName, path, analysis, schema, fragments, variables,
	)

	return &field
}

func hasRemoteDescendant(path jsonpath.Path, remotes []*RemoteQueryPlan) bool {
	for _, candidate := range remotes {
		if pathHasPrefix(candidate.SourcePath, path) {
			return true
		}
	}

	return false
}

func prepareRemoteSelections(
	selections ast.SelectionSet,
	typeName string,
	path jsonpath.Path,
	analysis *analysisResult,
	schema *ast.Schema,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) ast.SelectionSet {
	out := make(ast.SelectionSet, 0, len(selections))
	for _, selection := range selections {
		switch selected := selection.(type) {
		case *ast.Field:
			if !includeSelection(selected.Directives, variables) ||
				isRemoteField(path, typeName, selected, analysis.RemoteQueries) {
				continue
			}

			field := *selected
			if len(field.SelectionSet) > 0 {
				childType := transform.FieldReturnTypeOnType(schema, typeName, field.Name)
				field.SelectionSet = prepareRemoteSelections(
					field.SelectionSet, childType, path.Child(fieldResponseKey(&field)),
					analysis, schema, fragments, variables,
				)
			}

			out = append(out, &field)
		case *ast.FragmentSpread:
			if inline := prepareRemoteFragment(
				selected,
				path,
				analysis,
				schema,
				fragments,
				variables,
			); inline != nil {
				out = append(out, inline)
			}
		case *ast.InlineFragment:
			if !includeSelection(selected.Directives, variables) {
				continue
			}

			inline := *selected
			inline.Directives = nil // Already evaluated with this request's variables.

			childType := typeName
			if inline.TypeCondition != "" {
				childType = inline.TypeCondition
			}

			inline.SelectionSet = prepareRemoteSelections(
				inline.SelectionSet, childType, path, analysis, schema, fragments, variables,
			)
			if len(inline.SelectionSet) != 0 {
				out = append(out, &inline)
			}
		}
	}

	return append(out, phantomSelections(path, typeName, schema, analysis.PhantomFields)...)
}

func prepareRemoteFragment(
	spread *ast.FragmentSpread,
	path jsonpath.Path,
	analysis *analysisResult,
	schema *ast.Schema,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
) *ast.InlineFragment {
	if !includeSelection(spread.Directives, variables) {
		return nil
	}

	frag := fragments.ForName(spread.Name)
	if frag == nil {
		return nil
	}

	inline := &ast.InlineFragment{ //nolint:exhaustruct // Only type and selection are needed on the target.
		TypeCondition: frag.TypeCondition,
		SelectionSet: prepareRemoteSelections(
			frag.SelectionSet, frag.TypeCondition, path, analysis, schema, fragments, variables,
		),
	}
	if len(inline.SelectionSet) == 0 {
		return nil
	}

	return inline
}

func phantomSelections(
	path jsonpath.Path, typeName string, schema *ast.Schema, specs []*PhantomFieldSpec,
) ast.SelectionSet {
	var out ast.SelectionSet
	for _, spec := range specs {
		if spec.Path.String() != path.String() {
			continue
		}

		fields := make(ast.SelectionSet, 0, len(spec.Fields))
		for _, name := range spec.Fields {
			fields = append(fields, &ast.Field{ //nolint:exhaustruct
				Name: name, Alias: spec.Aliases[name],
			})
		}

		switch {
		case spec.SourceType == "" || typeName == spec.SourceType:
			out = append(out, fields...)
		case remoteSourceTypePossibleOn(schema, typeName, spec.SourceType):
			out = append(
				out,
				&ast.InlineFragment{ //nolint:exhaustruct // Only condition and selections are needed.
					TypeCondition: spec.SourceType,
					SelectionSet:  fields,
				},
			)
		}
	}

	return out
}

func remoteSourceTypePossibleOn(schema *ast.Schema, typeName, sourceType string) bool {
	for _, possible := range schema.PossibleTypes[typeName] {
		if possible.Name == sourceType {
			return true
		}
	}

	return false
}

func isRemoteField(
	path jsonpath.Path, typeName string, field *ast.Field, remotes []*RemoteQueryPlan,
) bool {
	for _, remote := range remotes {
		if remote.Name == field.Name && remote.SourcePath.String() == path.String() &&
			(remote.SourceType == "" || remote.SourceType == typeName) {
			return true
		}
	}

	return false
}
