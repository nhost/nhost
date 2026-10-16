package where

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
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

// WriteConditionSubstituted renders stmt like [Statement.WriteCondition] but
// applies subs to any relationship-EXISTS subqueries it encounters. Composite
// filters (Clause, _and, _or, _not) propagate subs into their children;
// leaf filters that don't reference a target table ignore them.
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
	return writeConditionCtx(stmt, b, source, params, paramIndex, newRenderContext(source, subs))
}

// writeConditionCtx on relationshipFilter swaps the target's
// TableFromClause for the substitution (if any), then walks any nested
// conditions with the same subs so deeper EXISTS subqueries see the same
// rewrites. The row-level permission filter on the target is intentionally
// skipped when the target was substituted: the substitute is typically the
// parent's just-inserted RETURNING (the parent's own insert-permission gate
// has already validated those rows), not a generic SELECT against the table.
func (r *relationshipFilter) writeConditionCtx(
	b *strings.Builder, source string, params []any, paramIndex int, rc renderContext,
) ([]any, int, error) {
	targetAlias := fmt.Sprintf("\"%s%d\"", r.aliasPrefix, r.nestingLevel)
	if r.nestingLevel == 0 {
		targetAlias = r.aliasPrefix
	}

	target := r.relationship.Target()
	fromClause := target.TableFromClause()

	substituted := false

	if alt, ok := rc.subs[fromClause]; ok {
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

		params, paramIndex, err = writeConditionCtx(
			r.conditions, b, targetAlias, params, paramIndex, rc,
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

// writeConditionCtx on aggregateRelationshipFilter mirrors
// relationshipFilter: it swaps the target's TableFromClause for the
// substitution (if any) so the correlated aggregate subquery reads the parent's
// in-flight CTE instead of the base table under Postgres' WITH snapshot
// semantics, walks the nested filter with the same subs so deeper EXISTS
// subqueries see the rewrites too, and skips the target's row-level permission
// filter when the target was substituted (the substitute is the parent's
// already-validated RETURNING, not a generic table SELECT).
func (f *aggregateRelationshipFilter) writeConditionCtx(
	b *strings.Builder, source string, params []any, paramIndex int, rc renderContext,
) ([]any, int, error) {
	targetAlias := fmt.Sprintf("%saggt%d", f.aliasPrefix, f.nestingLevel)
	subAlias := fmt.Sprintf("%saggs%d", f.aliasPrefix, f.nestingLevel)
	quotedTarget := core.QuoteIdentifier(targetAlias)
	quotedSub := core.QuoteIdentifier(subAlias)

	fromClause := f.target.TableFromClause()

	substituted := false

	if alt, ok := rc.subs[fromClause]; ok {
		fromClause = alt
		substituted = true
	}

	b.WriteString("EXISTS (SELECT 1 FROM (SELECT ")
	f.writeAggregateExpr(b, quotedTarget)
	b.WriteString(" AS ")
	core.WriteQuotedIdentifier(b, aggResultColumn)
	b.WriteString(" FROM ")
	b.WriteString(fromClause)
	b.WriteByte(' ')
	b.WriteString(quotedTarget)
	b.WriteString(" WHERE ")

	f.relationship.WriteJoinConditionAliased(b, source, quotedTarget)

	var err error

	if f.filter != nil {
		b.WriteString(" AND ")

		params, paramIndex, err = writeConditionCtx(
			f.filter, b, quotedTarget, params, paramIndex, rc,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write aggregate filter: %w", err)
		}
	}

	if !substituted {
		params, paramIndex, err = f.writeTargetRowLevelPermissions(
			b, params, paramIndex, quotedTarget,
		)
		if err != nil {
			return nil, 0, err
		}
	}

	b.WriteString(") ")
	b.WriteString(quotedSub)
	b.WriteString(" WHERE ")

	params, paramIndex, err = writeConditionCtx(
		f.predicate, b, quotedSub, params, paramIndex, rc,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to write aggregate predicate: %w", err)
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

// writeTargetRowLevelPermissions appends the target table's row-level permission
// predicate (qualified with targetAlias) when the configured role has one,
// AND-ed onto the inner subquery's WHERE. It is a no-op when role is empty or
// the role carries no row-level filter. Callers that substituted the target FROM
// clause must skip this: the substitute is the parent's already-validated
// RETURNING, not a generic table SELECT.
func (f *aggregateRelationshipFilter) writeTargetRowLevelPermissions(
	b *strings.Builder, params []any, paramIndex int, targetAlias string,
) ([]any, int, error) {
	if f.role == "" || !f.target.HasRowLevelPermissions(f.role) {
		return params, paramIndex, nil
	}

	b.WriteString(" AND ")

	params, paramIndex, err := f.target.WriteRowLevelPermissions(
		b, params, paramIndex, f.role, f.sessionVariables, targetAlias,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to apply row-level permissions: %w", err)
	}

	return params, paramIndex, nil
}

// writeConditionCtx on existsFilter recurses into its inner where
// clause so any relationship filters inside _exists also see subs and the
// root alias.
func (f *existsFilter) writeConditionCtx(
	b *strings.Builder, _ string, params []any, paramIndex int, rc renderContext,
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

		params, paramIndex, err = writeConditionCtx(
			f.conditions, b, targetAlias, params, paramIndex, rc,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to write _exists conditions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}
