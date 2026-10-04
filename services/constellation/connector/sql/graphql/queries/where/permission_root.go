package where

import (
	"fmt"
	"strings"
)

// writeConditionRoot carries the outer row alias through logical and relational
// predicates so a permission's ["$", column] RHS is never rebound to a child.
// Ordinary leaf predicates use their established renderer unchanged.
//
//nolint:gocognit,cyclop,funlen // One dispatch preserves the outer alias through every boolean and relational filter.
func writeConditionRoot(stmt Statement, b *strings.Builder, source, root string,
	params []any, index int, subs TableSubstitutions,
) ([]any, int, error) {
	switch f := stmt.(type) {
	case *columnComparisonFilter:
		return f.writeWithRoot(b, source, root, params, index)
	case *computedComparison:
		return f.writeWithRoot(b, source, root, params, index)
	case *computedTableFilter:
		return f.writeWithRoot(b, source, root, params, index, subs)
	case Clause:
		for i, child := range f {
			var err error

			params, index, err = writeConditionRoot(child, b, source, root, params, index, subs)
			if err != nil {
				return nil, 0, fmt.Errorf("writing clause item %d: %w", i, err)
			}

			if i < len(f)-1 {
				b.WriteString(" AND ")
			}
		}

		return params, index, nil
	case *andFilter:
		for i, child := range f.conditions {
			if i > 0 {
				b.WriteString(" AND ")
			}

			var err error

			params, index, err = writeConditionRoot(child, b, source, root, params, index, subs)
			if err != nil {
				return nil, 0, fmt.Errorf("writing AND item %d: %w", i, err)
			}
		}

		return params, index, nil
	case *orFilter:
		if len(f.conditions) == 0 {
			b.WriteString("false")
			return params, index, nil
		}

		b.WriteByte('(')

		for i, child := range f.conditions {
			var err error

			params, index, err = writeConditionRoot(child, b, source, root, params, index, subs)
			if err != nil {
				return nil, 0, fmt.Errorf("writing OR item %d: %w", i, err)
			}

			if i < len(f.conditions)-1 {
				b.WriteString(" OR ")
			}
		}

		b.WriteByte(')')

		return params, index, nil
	case *notFilter:
		b.WriteString("NOT (")

		var err error

		params, index, err = writeConditionRoot(f.condition, b, source, root, params, index, subs)
		if err != nil {
			return nil, 0, fmt.Errorf("writing NOT: %w", err)
		}

		b.WriteByte(')')

		return params, index, nil
	case *relationshipFilter:
		return f.writeWithRoot(b, source, root, params, index, subs)
	case *existsFilter:
		return f.writeWithRoot(b, source, root, params, index, subs)
	default:
		return WriteConditionSubstituted(stmt, b, source, params, index, subs)
	}
}

func (r *relationshipFilter) writeWithRoot(b *strings.Builder, source, root string,
	params []any, index int, subs TableSubstitutions,
) ([]any, int, error) {
	alias := fmt.Sprintf("\"%s%d\"", r.aliasPrefix, r.nestingLevel)
	if r.nestingLevel == 0 {
		alias = r.aliasPrefix
	}

	target := r.relationship.Target()
	from := target.TableFromClause()

	substituted := false
	if replacement, ok := subs[from]; ok {
		from = replacement
		substituted = true
	}

	b.WriteString("EXISTS (SELECT 1 FROM ")
	b.WriteString(from)
	b.WriteString(" ")
	b.WriteString(alias)
	b.WriteString(" WHERE ")
	r.relationship.WriteJoinConditionAliased(b, source, alias)

	if r.conditions != nil {
		b.WriteString(" AND ")

		var err error

		params, index, err = writeConditionRoot(r.conditions, b, alias, root, params, index, subs)
		if err != nil {
			return nil, 0, fmt.Errorf("writing relationship conditions: %w", err)
		}
	}

	if !substituted && r.role != "" && target.HasRowLevelPermissions(r.role) {
		b.WriteString(" AND ")

		var err error

		params, index, err = target.WriteRowLevelPermissions(
			b,
			params,
			index,
			r.role,
			r.sessionVariables,
			alias,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("applying row-level permissions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, index, nil
}

func (f *existsFilter) writeWithRoot(b *strings.Builder, _, root string,
	params []any, index int, subs TableSubstitutions,
) ([]any, int, error) {
	alias := fmt.Sprintf("\"%s%d\"", f.aliasPrefix, f.nestingLevel)
	if f.nestingLevel == 0 {
		alias = f.aliasPrefix
	}

	b.WriteString("EXISTS (SELECT 1 FROM ")
	b.WriteString(f.targetTable.TableFromClause())
	b.WriteString(" ")
	b.WriteString(alias)

	if f.conditions != nil {
		b.WriteString(" WHERE ")

		var err error

		params, index, err = writeConditionRoot(f.conditions, b, alias, root, params, index, subs)
		if err != nil {
			return nil, 0, fmt.Errorf("writing _exists conditions: %w", err)
		}
	}

	b.WriteByte(')')

	return params, index, nil
}
