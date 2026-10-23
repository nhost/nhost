package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// rootTableMarker prefixes a column-comparison operand that refers to the
// root table of a permission (the table the permission is defined on) rather
// than the table the comparison sits in.
const rootTableMarker = "$"

// columnReference is the right-hand side of a column-comparison operator
// (_ceq, _cneq, _cgt, _cgte, _clt, _clte).
type columnReference struct {
	// column is the SQL name of the referenced column.
	column string
	// fromRoot is true for the ["$", column] form.
	fromRoot bool
}

// parseColumnReference accepts the operand shapes Hasura allows for
// column-comparison operators: "column", ["column"] and ["$", "column"].
//
// Column comparisons only exist in permission filters, which the permissions
// package normalises before parsing: by the time an operand reaches here its
// column name is a SQL name that has been checked against the right table.
// The GraphQL schema never exposes these operators, so user where clauses
// cannot reach this parser.
func parseColumnReference(value *ast.Value) (columnReference, error) {
	switch value.Kind { //nolint:exhaustive // every other kind is invalid.
	case ast.StringValue, ast.EnumValue:
		return columnReference{column: value.Raw, fromRoot: false}, nil
	case ast.ListValue:
		parts := make([]string, 0, len(value.Children))

		for _, child := range value.Children {
			if child.Value.Kind != ast.StringValue && child.Value.Kind != ast.EnumValue {
				return columnReference{}, errInvalidColumnReference
			}

			parts = append(parts, child.Value.Raw)
		}

		switch {
		case len(parts) == 1 && parts[0] != rootTableMarker:
			return columnReference{column: parts[0], fromRoot: false}, nil
		case len(parts) == 2 && parts[0] == rootTableMarker:
			return columnReference{column: parts[1], fromRoot: true}, nil
		}
	}

	return columnReference{}, errInvalidColumnReference
}

// columnComparisonParser returns the operatorParser for a column-comparison
// operator rendering as sqlOperator (e.g. " = ").
func columnComparisonParser(sqlOperator string) operatorParser {
	return func(
		c *core.Column,
		target *comparisonTarget,
		v *ast.Value,
		_ map[string]any,
		_ dialect.Dialect,
	) (Statement, error) {
		ref, err := parseColumnReference(v)
		if err != nil {
			return nil, fmt.Errorf("column %s: %w", c.SQLName, err)
		}

		return &columnComparisonFilter{
			column:   c,
			target:   target,
			operator: sqlOperator,
			ref:      ref,
		}, nil
	}
}

// columnComparisonFilter compares a column against another column instead of
// a value. The referenced column lives either in the same table as the
// compared column or, for the ["$", column] form, in the root table of the
// permission, whose alias it reads from the renderContext. No parameters are
// bound: both sides are quoted identifiers.
type columnComparisonFilter struct {
	column   *core.Column
	target   *comparisonTarget
	operator string
	ref      columnReference
}

func (f *columnComparisonFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	return f.writeConditionCtx(b, source, params, paramIndex, newRenderContext(source, nil))
}

func (f *columnComparisonFilter) writeConditionCtx(
	b *strings.Builder, source string, params []any, paramIndex int, rc renderContext,
) ([]any, int, error) {
	comparisonTargetFor(f.column, f.target).writeSQL(b, source)
	b.WriteString(f.operator)

	refSource := source
	if f.ref.fromRoot {
		refSource = rc.root
	}

	core.WriteQualifiedColumn(b, refSource, f.ref.column)

	return params, paramIndex, nil
}

// sourceColumns reports the columns this filter reads from its own source. A
// root reference is reported by collectRootColumns instead, because it is
// read from the root source wherever the filter is nested.
func (f *columnComparisonFilter) sourceColumns() []string {
	column := sourceColumnForTarget(f.column, f.target)
	if f.ref.fromRoot {
		return []string{column}
	}

	return []string{column, f.ref.column}
}
