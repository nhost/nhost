package core

import "strings"

// ComputedExpression is a role-granted, argument-free computed scalar used by
// user-facing row predicates and ordering. Its writer binds session values at
// render time, after the enclosing query has allocated earlier placeholders.
type ComputedExpression interface {
	SQLType() string
	WriteExpression(
		b *strings.Builder, source string, sessionVariables map[string]any,
		params []any, paramIndex int,
	) ([]any, int, error)
}
