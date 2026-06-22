package resolver

import (
	"fmt"
	"sort"
	"strings"

	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2/ast"
)

// schemaResolver handles remote relationships to GraphQL schemas.
// Uses aliased fields for batching: _0: field(arg: val1), _1: field(arg: val2).
type schemaResolver struct {
	lhsFields       []string                        // Fields from source used for joining
	remoteFieldPath []metadata.RemoteFieldPathEntry // Remote field path with arguments
}

// newSchemaResolver creates a new schemaResolver.
func newSchemaResolver(
	lhsFields []string,
	remoteFieldPath []metadata.RemoteFieldPathEntry,
) *schemaResolver {
	return &schemaResolver{
		lhsFields:       lhsFields,
		remoteFieldPath: remoteFieldPath,
	}
}

// BuildOperation constructs the GraphQL operation to execute against the target schema.
// For multiple join arguments, it creates aliased fields to batch them in a single query:
//
//	{
//	  _0: teamByDepartment(departmentId: "id1") { name }
//	  _1: teamByDepartment(departmentId: "id2") { name }
//	}
func (r *schemaResolver) BuildOperation(rq *remoteQuery) *ast.OperationDefinition {
	if len(r.remoteFieldPath) == 0 || len(rq.joinArguments) == 0 {
		return nil
	}

	// Build aliased fields for each unique join argument
	selectionSet := make(ast.SelectionSet, 0, len(rq.joinArguments))

	for i, joinArg := range rq.joinArguments {
		// Build the remote field structure from the path for this single argument
		remoteField := r.buildRemoteFieldFromPath(rq.sourceField.SelectionSet, joinArg)

		if remoteField != nil {
			// Copy over any user-provided arguments that aren't already set by the metadata path
			mergeSourceFieldArguments(remoteField, rq.sourceField.Arguments)

			// Add alias to distinguish results: _0, _1, _2, etc.
			remoteField.Alias = fmt.Sprintf("_%d", i)
			selectionSet = append(selectionSet, remoteField)
		}
	}

	if len(selectionSet) == 0 {
		return nil
	}

	return &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:    ast.Query,
		SelectionSet: selectionSet,
	}
}

// buildRemoteFieldFromPath constructs a GraphQL field from the remote field path
// for a single join argument.
func (r *schemaResolver) buildRemoteFieldFromPath(
	selectionSet ast.SelectionSet,
	joinArg *remoteJoinArgument,
) *ast.Field {
	if len(r.remoteFieldPath) == 0 {
		return nil
	}

	return r.buildRemoteFieldFromPathRecursive(r.remoteFieldPath, selectionSet, joinArg)
}

// buildRemoteFieldFromPathRecursive constructs a GraphQL field from the remote field path recursively.
func (r *schemaResolver) buildRemoteFieldFromPathRecursive(
	path []metadata.RemoteFieldPathEntry,
	selectionSet ast.SelectionSet,
	joinArg *remoteJoinArgument,
) *ast.Field {
	if len(path) == 0 {
		return nil
	}

	entry := path[0]
	field := &ast.Field{ //nolint:exhaustruct
		Name: entry.FieldName,
	}

	// Build arguments from the path entry for this single join argument
	if len(entry.Arguments) > 0 {
		field.Arguments = r.buildRemoteFieldArguments(entry.Arguments, joinArg)
	}

	// If there are more path entries, nest them
	if len(path) > 1 {
		nestedField := r.buildRemoteFieldFromPathRecursive(path[1:], selectionSet, joinArg)
		if nestedField != nil {
			field.SelectionSet = ast.SelectionSet{nestedField}
		}
	} else {
		// Last entry in path - use the original selection set
		field.SelectionSet = selectionSet
	}

	return field
}

// buildRemoteFieldArguments builds GraphQL arguments from the path entry arguments
// for a single join argument.
func (r *schemaResolver) buildRemoteFieldArguments(
	arguments map[string]string,
	joinArg *remoteJoinArgument,
) []*ast.Argument {
	args := make([]*ast.Argument, 0, len(arguments))

	for argName, argValue := range arguments {
		var value *ast.Value

		// Check if this is a field reference ($field)
		if fieldName, ok := strings.CutPrefix(argValue, "$"); ok {
			// Get the value from the single join argument
			if v, ok := joinArg.values[fieldName]; ok && v != nil {
				value = &ast.Value{ //nolint:exhaustruct
					Kind: valueKindForType(v),
					Raw:  fmt.Sprintf("%v", v),
				}
			} else {
				continue // Skip arguments with no values
			}
		} else {
			// Literal value
			value = &ast.Value{ //nolint:exhaustruct
				Kind: ast.StringValue,
				Raw:  argValue,
			}
		}

		args = append(args, &ast.Argument{ //nolint:exhaustruct
			Name:  argName,
			Value: value,
		})
	}

	return args
}

// ExtractResults extracts results from the remote response.
// Results come as aliased fields: {"_0": result0, "_1": result1, ...}
// Returns results as an array in the same order as join arguments.
func (r *schemaResolver) ExtractResults(rq *remoteQuery, response any) []any {
	dataMap, ok := response.(map[string]any)
	if !ok {
		return nil
	}

	results := make([]any, len(rq.joinArguments))
	for i := range rq.joinArguments {
		alias := fmt.Sprintf("_%d", i)
		results[i] = dataMap[alias]
	}

	return results
}

// BuildResultLookup creates a lookup map from join key to results.
// The remote results are aliased with "_0", "_1", etc. corresponding to join argument indices.
func (r *schemaResolver) BuildResultLookup(rq *remoteQuery, results []any) map[string][]any {
	resultLookup := make(map[string][]any)

	// Sort LHS fields for consistent key building
	lhsFields := make([]string, len(r.lhsFields))
	copy(lhsFields, r.lhsFields)
	sort.Strings(lhsFields)

	// For each join argument, map its key to the corresponding result
	for i, arg := range rq.joinArguments {
		if i >= len(results) {
			continue
		}

		result := results[i]
		if result == nil {
			continue
		}

		// Build key from the join argument
		keyParts := make([]string, 0, len(lhsFields))

		for _, field := range lhsFields {
			val := arg.values[field]
			keyParts = append(keyParts, fmt.Sprintf("%v", val))
		}

		key := strings.Join(keyParts, "|")
		resultLookup[key] = append(resultLookup[key], result)
	}

	return resultLookup
}

// mergeSourceFieldArguments copies user-provided arguments from the source field
// onto the remote field, skipping any that are already set by the metadata path.
func mergeSourceFieldArguments(remoteField *ast.Field, sourceArgs ast.ArgumentList) {
	for _, arg := range sourceArgs {
		alreadySet := false

		for _, existing := range remoteField.Arguments {
			if existing.Name == arg.Name {
				alreadySet = true

				break
			}
		}

		if !alreadySet {
			remoteField.Arguments = append(remoteField.Arguments, arg)
		}
	}
}

// GetJoinKeyFromParent extracts join key from a parent row for stitching.
func (r *schemaResolver) GetJoinKeyFromParent(rq *remoteQuery, parentRow map[string]any) string {
	// Sort LHS fields for consistent key building
	lhsFields := make([]string, len(r.lhsFields))
	copy(lhsFields, r.lhsFields)
	sort.Strings(lhsFields)

	// Build the key from parent row using sorted LHS fields
	keyParts := make([]string, 0, len(lhsFields))

	for _, field := range lhsFields {
		lookupKey := field
		if alias, ok := rq.localJoinAliases[field]; ok {
			lookupKey = alias
		}

		val := parentRow[lookupKey]
		keyParts = append(keyParts, fmt.Sprintf("%v", val))
	}

	return strings.Join(keyParts, "|")
}
