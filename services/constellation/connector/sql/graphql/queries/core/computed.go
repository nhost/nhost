package core

import "strings"

// PermissionSessionTemplateKey marks a parsed permission predicate whose
// computed function session argument must be bound at execution, not build.
const PermissionSessionTemplateKey = "\x00nhost.permission.template"

// ComputedExpression is a role-granted, argument-free computed scalar used by
// user-facing row predicates and ordering. Its writer binds session values at
// render time, after the enclosing query has allocated earlier placeholders.
type ComputedExpression interface {
	SQLType() string
	SourceColumns() []string
	WriteExpression(
		b *strings.Builder, source string, sessionVariables map[string]any,
		params []any, paramIndex int,
	) ([]any, int, error)
}
