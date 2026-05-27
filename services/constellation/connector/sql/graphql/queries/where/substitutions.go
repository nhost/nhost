package where

import (
	"fmt"
	"strings"
)

// TableSubstitutions maps a relationship target's `TableFromClause()` value
// (e.g. `"public"."kb_entries"`) to an alternate FROM source (typically a CTE
// alias like `mutation_result`).
//
// This exists so insert-permission checks emitted inside a CTE chain can
// redirect an EXISTS subquery from the underlying table — which doesn't see
// in-flight INSERTs in the same statement, per Postgres' WITH snapshot
// semantics — to the parent CTE that holds the just-inserted rows.
type TableSubstitutions map[string]string

// substitutingStatement is implemented by Statement types that can rewrite
// themselves under a TableSubstitutions map. Leaf filters that never touch a
// target table need not implement it; the dispatch helper falls back to
// regular [Statement.WriteCondition] for them.
type substitutingStatement interface {
	writeConditionSubstituted(
		b *strings.Builder,
		source string,
		params []any,
		paramIndex int,
		subs TableSubstitutions,
	) ([]any, int, error)
}

// WriteConditionSubstituted renders stmt like [Statement.WriteCondition] but
// applies subs to any relationship-EXISTS subqueries it encounters. Composite
// filters (Clause, _and, _or, _not) propagate subs into their children;
// leaf filters that don't reference a target table fall through to the
// standard WriteCondition path.
//
// Passing a nil or empty subs is equivalent to calling stmt.WriteCondition
// directly.
func WriteConditionSubstituted(
	stmt Statement,
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
	subs TableSubstitutions,
) ([]any, int, error) {
	if len(subs) == 0 {
		return stmt.WriteCondition(b, source, params, paramIndex) //nolint:wrapcheck
	}

	if ss, ok := stmt.(substitutingStatement); ok {
		return ss.writeConditionSubstituted(b, source, params, paramIndex, subs)
	}

	return stmt.WriteCondition(b, source, params, paramIndex) //nolint:wrapcheck
}

// writeConditionSubstituted on Clause forwards subs to each child statement.
func (w Clause) writeConditionSubstituted(
	b *strings.Builder, source string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	var err error
	for i, condition := range w {
		params, paramIndex, err = WriteConditionSubstituted(
			condition, b, source, params, paramIndex, subs,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write where condition at pos %d: %w", i, err)
		}

		if i < len(w)-1 {
			b.WriteString(" AND ")
		}
	}

	return params, paramIndex, nil
}

func (f *andFilter) writeConditionSubstituted(
	b *strings.Builder, source string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	var err error
	for i, condition := range f.conditions {
		if i > 0 {
			b.WriteString(" AND ")
		}

		params, paramIndex, err = WriteConditionSubstituted(
			condition, b, source, params, paramIndex, subs,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write AND condition at pos %d: %w", i, err)
		}
	}

	return params, paramIndex, nil
}

func (f *orFilter) writeConditionSubstituted(
	b *strings.Builder, source string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	b.WriteByte('(')

	var err error
	for i, clause := range f.conditions {
		params, paramIndex, err = WriteConditionSubstituted(
			clause, b, source, params, paramIndex, subs,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write OR condition at pos %d: %w", i, err)
		}

		if i < len(f.conditions)-1 {
			b.WriteString(" OR ")
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

func (f *notFilter) writeConditionSubstituted(
	b *strings.Builder, source string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	b.WriteString("NOT (")

	params, paramIndex, err := WriteConditionSubstituted(
		f.condition, b, source, params, paramIndex, subs,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write NOT condition: %w", err)
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

// writeConditionSubstituted on relationshipFilter swaps the target's
// TableFromClause for the substitution (if any), then walks any nested
// conditions with the same subs so deeper EXISTS subqueries see the same
// rewrites. The row-level permission filter on the target is intentionally
// skipped when the target was substituted: the substitute is typically the
// parent's just-inserted RETURNING (the parent's own insert-permission gate
// has already validated those rows), not a generic SELECT against the table.
func (r *relationshipFilter) writeConditionSubstituted(
	b *strings.Builder, source string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	targetAlias := fmt.Sprintf("\"%s%d\"", r.aliasPrefix, r.nestingLevel)
	if r.nestingLevel == 0 {
		targetAlias = r.aliasPrefix
	}

	target := r.relationship.Target()
	fromClause := target.TableFromClause()

	substituted := false

	if alt, ok := subs[fromClause]; ok {
		fromClause = alt
		substituted = true
	}

	b.WriteString("EXISTS (SELECT 1 FROM ")
	b.WriteString(fromClause)
	b.WriteString(" ")
	b.WriteString(targetAlias)
	b.WriteString(" WHERE ")

	r.relationship.WriteJoinConditionAliased(b, source, targetAlias)

	var err error

	if r.conditions != nil {
		b.WriteString(" AND ")

		params, paramIndex, err = WriteConditionSubstituted(
			r.conditions, b, targetAlias, params, paramIndex, subs,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write relationship conditions: %w", err)
		}
	}

	if !substituted && r.role != "" && target.HasRowLevelPermissions(r.role) {
		b.WriteString(" AND ")

		params, paramIndex, err = target.WriteRowLevelPermissions(
			b, params, paramIndex, r.role, r.sessionVariables, targetAlias,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to apply row-level permissions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

// writeConditionSubstituted on existsFilter recurses into its inner where
// clause so any relationship filters inside _exists also see subs.
func (f *existsFilter) writeConditionSubstituted(
	b *strings.Builder, _ string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	targetAlias := fmt.Sprintf("\"%s%d\"", f.aliasPrefix, f.nestingLevel)
	if f.nestingLevel == 0 {
		targetAlias = f.aliasPrefix
	}

	b.WriteString("EXISTS (SELECT 1 FROM ")
	b.WriteString(f.targetTable.TableFromClause())
	b.WriteString(" ")
	b.WriteString(targetAlias)

	if f.conditions != nil {
		b.WriteString(" WHERE ")

		var err error

		params, paramIndex, err = WriteConditionSubstituted(
			f.conditions, b, targetAlias, params, paramIndex, subs,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write _exists conditions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}
