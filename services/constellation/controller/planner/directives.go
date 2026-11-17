package planner

import "github.com/vektah/gqlparser/v2/ast"

// includeSelection evaluates spread-site directives against the request's
// coerced variables. Field and fragment-body directives are also pruned by
// the controller, but spreads retain their directives after pruning.
func includeSelection(directives ast.DirectiveList, variables map[string]any) bool {
	for _, directive := range directives {
		if directive.Name != "skip" && directive.Name != "include" {
			continue
		}

		argument := directive.Arguments.ForName("if")
		if argument == nil || argument.Value == nil {
			continue
		}

		value, err := argument.Value.Value(variables)
		if err != nil {
			continue // Validation has already checked the required Boolean argument.
		}

		condition, _ := value.(bool)
		if directive.Name == "skip" && condition || directive.Name == "include" && !condition {
			return false
		}
	}

	return true
}
