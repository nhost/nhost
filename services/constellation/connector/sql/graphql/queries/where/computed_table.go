package where

import (
	"errors"
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

var errComputedTableTargetNotTracked = errors.New("computed table target is not tracked")

// A table predicate is an EXISTS over the function result, not over the
// tracked base table. The target's select filter applies to these rows too.
type computedTableFilter struct {
	call             core.ComputedTableExpression
	target           Table
	conditions       Statement
	role             string
	sessionVariables map[string]any
	alias            string
}

//nolint:ireturn // The where parser composes Statement implementations.
func parseComputedTableFilter(
	t Table, call core.ComputedTableExpression, value *ast.Value,
	variables map[string]any, role string, sessionVariables map[string]any,
	nestingLevel int, aliases Aliases,
) (Statement, error) {
	target := t.TableBySchemaName(call.TargetSchema(), call.TargetName())
	if target == nil {
		return nil, fmt.Errorf("%w: %s.%s", errComputedTableTargetNotTracked,
			call.TargetSchema(), call.TargetName())
	}

	conditions, err := parseBoolExp(target, value, variables, role, sessionVariables,
		nestingLevel+1, aliases)
	if err != nil {
		return nil, fmt.Errorf("parsing computed table filter: %w", err)
	}

	var predicate Statement
	if len(conditions) != 0 {
		predicate = conditions
	}

	return &computedTableFilter{
		call: call, target: target, conditions: predicate, role: role,
		sessionVariables: sessionVariables,
		alias:            fmt.Sprintf("\"_cs_cf%s%d\"", aliases.Relationship, nestingLevel),
	}, nil
}

func (f *computedTableFilter) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	return f.writeWithRoot(b, source, source, params, paramIndex, nil)
}

func (f *computedTableFilter) writeConditionSubstituted(
	b *strings.Builder, source string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	return f.writeWithRoot(b, source, source, params, paramIndex, subs)
}

func (f *computedTableFilter) writeWithRoot(
	b *strings.Builder, source, root string, params []any, paramIndex int, subs TableSubstitutions,
) ([]any, int, error) {
	b.WriteString("EXISTS (SELECT 1 FROM ")

	var err error

	params, paramIndex, err = f.call.WriteExpression(
		b, source, f.sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed table source: %w", err)
	}

	b.WriteString(" AS ")
	b.WriteString(f.alias)

	//nolint:nestif // WHERE is emitted only if a target condition or row permission follows.
	if f.conditions != nil || f.role != "" && f.target.HasRowLevelPermissions(f.role) {
		b.WriteString(" WHERE ")

		if f.conditions != nil {
			params, paramIndex, err = writeConditionRoot(
				f.conditions, b, f.alias, root, params, paramIndex, subs,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("writing computed table predicate: %w", err)
			}
		}

		if f.role != "" && f.target.HasRowLevelPermissions(f.role) {
			if f.conditions != nil {
				b.WriteString(" AND ")
			}

			params, paramIndex, err = f.target.WriteRowLevelPermissions(
				b, params, paramIndex, f.role, f.sessionVariables, f.alias,
			)
			if err != nil {
				return nil, 0, fmt.Errorf("writing computed target permission: %w", err)
			}
		}
	}

	b.WriteByte(')')

	return params, paramIndex, nil
}

func (f *computedTableFilter) sourceColumns() []string { return f.call.SourceColumns() }
