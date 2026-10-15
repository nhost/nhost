package where

import "strings"

// renderContext is the state composite statements forward unchanged to their
// children while rendering. It is built once at the outermost WriteCondition
// call and never mutated, so a parsed Clause stays safe to render concurrently.
type renderContext struct {
	// root is the source alias of the outermost statement being rendered,
	// i.e. the table a permission filter is defined on. Column-comparison
	// operands prefixed with "$" are qualified with it.
	root string
	// subs redirects relationship-EXISTS subqueries; see TableSubstitutions.
	subs TableSubstitutions
}

func newRenderContext(root string, subs TableSubstitutions) renderContext {
	return renderContext{root: root, subs: subs}
}

// contextStatement is implemented by statements that need a renderContext:
// composites that forward it to their children and leaves that read it.
// Leaf filters that need neither fall back to [Statement.WriteCondition].
type contextStatement interface {
	writeConditionCtx(
		b *strings.Builder, source string, params []any, paramIndex int, rc renderContext,
	) ([]any, int, error)
}

func writeConditionCtx(
	stmt Statement,
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
	rc renderContext,
) ([]any, int, error) {
	if cs, ok := stmt.(contextStatement); ok {
		return cs.writeConditionCtx(b, source, params, paramIndex, rc)
	}

	return stmt.WriteCondition(b, source, params, paramIndex) //nolint:wrapcheck
}
