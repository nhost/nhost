package resolver

import "github.com/vektah/gqlparser/v2/ast"

// collectReferencedFragments returns only the fragments from allFragments that are
// transitively referenced by the operation's selection set via fragment spreads.
func collectReferencedFragments(
	op *ast.OperationDefinition,
	allFragments ast.FragmentDefinitionList,
) ast.FragmentDefinitionList {
	if op == nil || len(allFragments) == 0 {
		return nil
	}

	seen := make(map[string]struct{})

	var collect func(selections ast.SelectionSet)

	collect = func(selections ast.SelectionSet) {
		for _, sel := range selections {
			switch s := sel.(type) {
			case *ast.FragmentSpread:
				if _, ok := seen[s.Name]; ok {
					continue
				}

				seen[s.Name] = struct{}{}

				if frag := allFragments.ForName(s.Name); frag != nil {
					collect(frag.SelectionSet)
				}
			case *ast.InlineFragment:
				collect(s.SelectionSet)
			case *ast.Field:
				collect(s.SelectionSet)
			}
		}
	}

	collect(op.SelectionSet)

	if len(seen) == 0 {
		return nil
	}

	result := make(ast.FragmentDefinitionList, 0, len(seen))

	for _, frag := range allFragments {
		if _, ok := seen[frag.Name]; ok {
			result = append(result, frag)
		}
	}

	return result
}
