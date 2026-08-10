package resolver

import (
	"fmt"
	"sort"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
)

// databaseResolver handles remote relationships to other databases.
// Uses WHERE col IN (...) pattern for batching.
type databaseResolver struct {
	joinColumns     map[string]string // local col → remote col
	targetTableName string            // Target table's GraphQL root query name
}

// newDatabaseResolver creates a new databaseResolver.
func newDatabaseResolver(joinColumns map[string]string, targetTableName string) *databaseResolver {
	return &databaseResolver{
		joinColumns:     joinColumns,
		targetTableName: targetTableName,
	}
}

// BuildOperation constructs the GraphQL operation to execute against the target database.
// It builds a WHERE clause with _in filter for join columns.
func (r *databaseResolver) BuildOperation(rq *remoteQuery) *ast.OperationDefinition {
	if len(rq.joinArguments) == 0 {
		return nil
	}

	whereArg := r.buildWhereArgument(rq)
	if userWhere := findWhereArgument(rq.sourceField.Arguments); rq.isArray && userWhere != nil {
		whereArg.Value = andMergeWhereValues(whereArg.Value, userWhere.Value)
	}

	// We need the remote join columns in the result to match against parent rows.
	selectionSet := make(ast.SelectionSet, 0, len(rq.sourceField.SelectionSet)+len(r.joinColumns))
	selectionSet = append(selectionSet, rq.sourceField.SelectionSet...)

	// Add remote join columns if not already in selection and track which ones we inject.
	responseKeys := collectSelectionResponseKeys(rq.sourceField.SelectionSet, rq.fragments)
	for _, remoteCol := range r.joinColumns {
		if selectionContainsField(rq.sourceField.SelectionSet, rq.fragments, remoteCol) {
			continue
		}

		alias := ""

		phantomResponseKey := remoteCol
		if _, collides := responseKeys[remoteCol]; collides {
			alias = makeRemotePhantomAlias(remoteCol, responseKeys)
			phantomResponseKey = alias

			if rq.remoteJoinAliases == nil {
				rq.remoteJoinAliases = make(map[string]string)
			}

			rq.remoteJoinAliases[remoteCol] = alias
		}

		selectionSet = append(selectionSet, &ast.Field{ //nolint:exhaustruct
			Alias: alias,
			Name:  remoteCol,
		})
		// Mark as phantom response key to remove later since user didn't request it.
		rq.remotePhantomFields = append(rq.remotePhantomFields, phantomResponseKey)
	}

	// Create a new field for the remote query
	remoteField := &ast.Field{ //nolint:exhaustruct
		Name:         r.targetTableName, // Use the target table's root query name
		Arguments:    []*ast.Argument{whereArg},
		SelectionSet: selectionSet,
	}

	// Copy over any existing arguments except 'where' (we override it)
	for _, arg := range rq.sourceField.Arguments {
		if arg.Name != "where" {
			remoteField.Arguments = append(remoteField.Arguments, arg)
		}
	}

	return &ast.OperationDefinition{ //nolint:exhaustruct
		Operation:    ast.Query,
		SelectionSet: ast.SelectionSet{remoteField},
	}
}

// buildWhereArgument builds a WHERE argument with _in filter for join columns.
func (r *databaseResolver) buildWhereArgument(rq *remoteQuery) *ast.Argument {
	// Build the _in values for each remote column
	children := make([]*ast.ChildValue, 0, len(r.joinColumns))

	for localCol, remoteCol := range r.joinColumns {
		// Collect unique values for this column
		values := make([]any, 0, len(rq.joinArguments))
		seen := make(map[string]struct{})

		for _, arg := range rq.joinArguments {
			val := arg.values[localCol]
			if val == nil {
				continue
			}

			key := joinValueDedupKey(val)
			if _, ok := seen[key]; ok {
				continue
			}

			seen[key] = struct{}{}

			values = append(values, val)
		}

		// Create the _in filter: { remote_column: { _in: [values] } }
		inValue := &ast.Value{ //nolint:exhaustruct
			Kind: ast.ListValue,
			Children: func() ast.ChildValueList {
				inChildren := make(ast.ChildValueList, 0, len(values))

				for _, v := range values {
					inChildren = append(inChildren, &ast.ChildValue{ //nolint:exhaustruct
						Value: &ast.Value{ //nolint:exhaustruct
							Kind: valueKindForType(v),
							Raw:  fmt.Sprintf("%v", v),
						},
					})
				}

				return inChildren
			}(),
		}

		inFilter := &ast.Value{ //nolint:exhaustruct
			Kind: ast.ObjectValue,
			Children: ast.ChildValueList{
				{Name: "_in", Value: inValue},
			},
		}

		children = append(children, &ast.ChildValue{ //nolint:exhaustruct
			Name:  remoteCol,
			Value: inFilter,
		})
	}

	return &ast.Argument{ //nolint:exhaustruct
		Name: "where",
		Value: &ast.Value{ //nolint:exhaustruct
			Kind:     ast.ObjectValue,
			Children: children,
		},
	}
}

// ExtractResults extracts results from the remote response.
// For database queries, results come under the target table name.
func (r *databaseResolver) ExtractResults(_ *remoteQuery, response any) []any {
	dataMap, ok := response.(map[string]any)
	if !ok {
		return nil
	}

	tableData, ok := dataMap[r.targetTableName]
	if !ok {
		return nil
	}

	switch v := tableData.(type) {
	case []any:
		return v
	case map[string]any:
		return []any{v}
	default:
		return nil
	}
}

// BuildResultLookup creates a lookup map from join key to results.
// Keys are built from remote column values for matching against parent rows.
func (r *databaseResolver) BuildResultLookup(rq *remoteQuery, results []any) map[string][]any {
	resultLookup := make(map[string][]any)

	// Sort local columns for consistent key building
	localCols := make([]string, 0, len(r.joinColumns))
	for localCol := range r.joinColumns {
		localCols = append(localCols, localCol)
	}

	sort.Strings(localCols)

	// Build a map from column name to its alias in the selection set
	// This handles cases where the user aliased the join column (e.g., "userId: id")
	colToAlias := buildColumnAliasMap(rq.sourceField.SelectionSet, rq.fragments)

	for _, result := range results {
		resultMap, ok := result.(map[string]any)
		if !ok {
			continue
		}

		// Get the join key values from the remote result using sorted local columns
		keyParts := make([]string, 0, len(localCols))

		for _, localCol := range localCols {
			remoteCol := r.joinColumns[localCol]
			// Try an injected phantom alias first, then a user alias, then the column name.
			lookupKey := remoteCol
			if alias, hasAlias := rq.remoteJoinAliases[remoteCol]; hasAlias {
				lookupKey = alias
			} else if alias, hasAlias := colToAlias[remoteCol]; hasAlias {
				lookupKey = alias
			}

			val := resultMap[lookupKey]
			keyParts = append(keyParts, fmt.Sprintf("%v", val))
		}

		key := strings.Join(keyParts, "|")
		resultLookup[key] = append(resultLookup[key], result)
	}

	return resultLookup
}

// GetJoinKeyFromParent extracts join key from a parent row for stitching.
func (r *databaseResolver) GetJoinKeyFromParent(rq *remoteQuery, parentRow map[string]any) string {
	// Sort local columns for consistent key building (must match BuildResultLookup)
	localCols := make([]string, 0, len(r.joinColumns))
	for localCol := range r.joinColumns {
		localCols = append(localCols, localCol)
	}

	sort.Strings(localCols)

	// Build the key from parent row using sorted local columns
	keyParts := make([]string, 0, len(localCols))

	for _, localCol := range localCols {
		lookupKey := localCol
		if alias, ok := rq.localJoinAliases[localCol]; ok {
			lookupKey = alias
		}

		val := parentRow[lookupKey]
		keyParts = append(keyParts, fmt.Sprintf("%v", val))
	}

	return strings.Join(keyParts, "|")
}

// buildColumnAliasMap builds a map from field name to its alias in the selection set.
// For example, if the selection has "userId: id", the map will have {"id": "userId"}.
// Fields without aliases are not included in the map.
func buildColumnAliasMap(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
) map[string]string {
	aliasMap := make(map[string]string)
	buildColumnAliasMapRecursive(selectionSet, fragments, aliasMap)

	return aliasMap
}

// buildColumnAliasMapRecursive recursively builds the alias map from a selection set.
func buildColumnAliasMapRecursive(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	aliasMap map[string]string,
) {
	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			// If the field has an alias different from its name, record it
			if s.Alias != "" && s.Alias != s.Name {
				aliasMap[s.Name] = s.Alias
			}
		case *ast.FragmentSpread:
			// Find and process the fragment definition
			for _, frag := range fragments {
				if frag.Name == s.Name {
					buildColumnAliasMapRecursive(frag.SelectionSet, fragments, aliasMap)

					break
				}
			}
		case *ast.InlineFragment:
			// Process the inline fragment's selection set
			buildColumnAliasMapRecursive(s.SelectionSet, fragments, aliasMap)
		}
	}
}

func findWhereArgument(args ast.ArgumentList) *ast.Argument {
	for _, arg := range args {
		if arg.Name == "where" {
			return arg
		}
	}

	return nil
}

func andMergeWhereValues(generated, user *ast.Value) *ast.Value {
	if user == nil || user.Kind == ast.NullValue {
		return generated
	}

	return &ast.Value{ //nolint:exhaustruct
		Kind: ast.ObjectValue,
		Children: ast.ChildValueList{
			{
				Name: "_and",
				Value: &ast.Value{ //nolint:exhaustruct
					Kind: ast.ListValue,
					Children: ast.ChildValueList{
						{Value: generated},
						{Value: user},
					},
				},
			},
		},
	}
}

// selectionContainsField checks if the selection set contains a field with the given name,
// including fields within fragment spreads and inline fragments.
func selectionContainsField(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	fieldName string,
) bool {
	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			if s.Name == fieldName {
				return true
			}
		case *ast.FragmentSpread:
			for _, frag := range fragments {
				if frag.Name == s.Name {
					if selectionContainsField(frag.SelectionSet, fragments, fieldName) {
						return true
					}

					break
				}
			}
		case *ast.InlineFragment:
			if selectionContainsField(s.SelectionSet, fragments, fieldName) {
				return true
			}
		}
	}

	return false
}

func collectSelectionResponseKeys(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
) map[string]struct{} {
	responseKeys := make(map[string]struct{})
	collectSelectionResponseKeysRecursive(selectionSet, fragments, responseKeys)

	return responseKeys
}

func collectSelectionResponseKeysRecursive(
	selectionSet ast.SelectionSet,
	fragments ast.FragmentDefinitionList,
	responseKeys map[string]struct{},
) {
	for _, sel := range selectionSet {
		switch s := sel.(type) {
		case *ast.Field:
			responseKeys[responseKey(s)] = struct{}{}
		case *ast.FragmentSpread:
			for _, frag := range fragments {
				if frag.Name == s.Name {
					collectSelectionResponseKeysRecursive(
						frag.SelectionSet,
						fragments,
						responseKeys,
					)

					break
				}
			}
		case *ast.InlineFragment:
			collectSelectionResponseKeysRecursive(s.SelectionSet, fragments, responseKeys)
		}
	}
}

func makeRemotePhantomAlias(fieldName string, responseKeys map[string]struct{}) string {
	base := "_constellation_remote_phantom_" + fieldName
	alias := base

	for i := 1; ; i++ {
		if _, exists := responseKeys[alias]; !exists {
			responseKeys[alias] = struct{}{}

			return alias
		}

		alias = fmt.Sprintf("%s_%d", base, i)
	}
}

func responseKey(field *ast.Field) string {
	if field.Alias != "" {
		return field.Alias
	}

	return field.Name
}

func joinValueDedupKey(v any) string {
	return fmt.Sprintf("%#v", v)
}

// valueKindForType returns the appropriate AST value kind for a Go value.
func valueKindForType(v any) ast.ValueKind {
	switch v.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return ast.IntValue
	case float32, float64:
		return ast.FloatValue
	case bool:
		return ast.BooleanValue
	case string:
		return ast.StringValue
	default:
		return ast.StringValue
	}
}
