package core

import "strings"

// PermissionSessionTemplateKey marks a parsed permission predicate whose
// computed function session argument must be bound at execution, not build.
const PermissionSessionTemplateKey = "\x00nhost.permission.template"

// ComputedExpression is an argument-free computed expression used by row
// predicates and ordering. Scalar inputs require a role grant; table inputs
// require returned-table select access. Its writer binds session values at
// render time, after the enclosing query has allocated earlier placeholders.
type ComputedExpression interface {
	SQLType() string
	SourceColumns() []string
	WriteExpression(
		b *strings.Builder, source string, sessionVariables map[string]any,
		params []any, paramIndex int,
	) ([]any, int, error)
}

// ComputedTableExpression writes an argument-free table function as a FROM
// source, and identifies the tracked table whose row permissions apply to it.
type ComputedTableExpression interface {
	ComputedExpression
	TargetSchema() string
	TargetName() string
}
