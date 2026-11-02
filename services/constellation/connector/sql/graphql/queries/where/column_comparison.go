package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

const columnComparisonTableCount = 2

// Column comparison RHS values are names, not parameter values. Resolve them
// against actual physical columns of the current or root table at parse time.
func columnReference(value *ast.Value, variables map[string]any) (string, bool, error) {
	resolved, err := values.ResolveVariable(value, variables)
	if err != nil {
		return "", false, fmt.Errorf("resolving column reference: %w", err)
	}

	if resolved.Kind == ast.StringValue || resolved.Kind == ast.EnumValue {
		return resolved.Raw, false, nil
	}

	if resolved.Kind != ast.ListValue {
		return "", false, errColumnReferenceShape
	}

	if len(resolved.Children) == 1 &&
		(resolved.Children[0].Value.Kind == ast.StringValue || resolved.Children[0].Value.Kind == ast.EnumValue) {
		return resolved.Children[0].Value.Raw, false, nil
	}

	if len(resolved.Children) == 2 && resolved.Children[0].Value.Raw == "$" &&
		(resolved.Children[1].Value.Kind == ast.StringValue || resolved.Children[1].Value.Kind == ast.EnumValue) {
		return resolved.Children[1].Value.Raw, true, nil
	}

	return "", false, errColumnReferenceShape
}

type columnComparisonFilter struct {
	column   *core.Column
	target   *comparisonTarget
	rhs      *core.Column
	root     bool
	operator string
}

func (f *columnComparisonFilter) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	return f.writeWithRoot(b, source, source, params, paramIndex)
}

func (f *columnComparisonFilter) writeWithRoot(
	b *strings.Builder, source, root string, params []any, paramIndex int,
) ([]any, int, error) {
	comparisonTargetFor(f.column, f.target).writeSQL(b, source)
	b.WriteByte(' ')
	b.WriteString(f.operator)
	b.WriteByte(' ')

	if f.root {
		source = root
	}

	core.WriteQualifiedColumn(b, source, f.rhs.SQLName)

	return params, paramIndex, nil
}

func columnComparisonOperator(name string) string {
	switch name {
	case "_ceq":
		return "="
	case "_cne", "_cneq":
		return "<>"
	case "_cgt":
		return ">"
	case "_clt":
		return "<"
	case "_cgte":
		return ">="
	case "_clte":
		return "<="
	default:
		return ""
	}
}

func parseColumnComparison( //nolint:ireturn // Parsed operators compose Statement implementations.
	column *core.Column, target *comparisonTarget, value *ast.Value,
	variables map[string]any, d dialect.Dialect, current, root Table, op string,
) (Statement, error) {
	if !d.SupportsRegex() || current == nil || root == nil {
		return nil, errColumnComparisonUnsupported
	}

	name, isRoot, err := columnReference(value, variables)
	if err != nil {
		return nil, err
	}

	table := current
	if isRoot {
		table = root
	}

	rhs := table.ColumnFromGraphqlName(name)
	if rhs == nil || rhs.SQLType != comparisonTargetFor(column, target).sqlType ||
		rhs.IsArray != column.IsArray {
		return nil, fmt.Errorf("%w: %s", errColumnComparisonMismatch, name)
	}

	return &columnComparisonFilter{
		column: column, target: target, rhs: rhs, root: isRoot,
		operator: columnComparisonOperator(op),
	}, nil
}
