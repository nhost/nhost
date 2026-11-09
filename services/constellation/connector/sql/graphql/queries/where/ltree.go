package where

import (
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

// PostgreSQL ltree's operators have different RHS types for paths and queries.
// The type and operator strings are fixed here; only operands are parameters.
type ltreeFilter struct {
	column   *core.Column
	target   *comparisonTarget
	operator string
	rhsType  string
	value    any
	dialect  dialect.Dialect
}

func (f *ltreeFilter) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	comparisonTargetFor(f.column, f.target).writeSQL(b, source)
	b.WriteByte(' ')
	b.WriteString(f.operator)
	b.WriteByte(' ')

	if !strings.HasSuffix(f.rhsType, "[]") {
		b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.rhsType))
		return append(params, f.value), paramIndex + 1, nil
	}

	if paths, ok := f.value.([]string); ok {
		// Bind each element separately: subscriber-specific session markers
		// remain typed, and pgx never needs an extension-array codec.
		var array strings.Builder
		array.WriteString("ARRAY[")

		for i, path := range paths {
			if i > 0 {
				array.WriteString(", ")
			}

			array.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "text"))

			params = append(params, path)
			paramIndex++
		}

		array.WriteByte(']')
		b.WriteString(f.dialect.TypeCast(f.dialect.TypeCast(array.String(), "text[]"), f.rhsType))

		return params, paramIndex, nil
	}
	// Hasura also accepts a whole-array session marker. Its value is a
	// PostgreSQL array literal; bind it as text before the array cast.
	b.WriteString(
		f.dialect.TypeCast(
			f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "text"),
			f.rhsType,
		),
	)

	return append(params, f.value), paramIndex + 1, nil
}

func resolveLtreeOperand(v *ast.Value, vars map[string]any, many bool) (any, error) {
	if !many {
		value, err := resolveScalarValue(v, vars)
		if err != nil {
			return nil, err
		}

		if _, ok := value.(string); !ok {
			return nil, errLtreeOperand
		}

		return value, nil
	}

	if v.Kind == ast.StringValue || v.Kind == ast.EnumValue {
		if strings.HasPrefix(strings.ToLower(v.Raw), "x-hasura-") {
			return strings.ToLower(v.Raw), nil
		}
	}

	list, err := resolveArrayValue(v, vars)
	if err != nil {
		return nil, err
	}

	paths := make([]string, len(list))
	for i, item := range list {
		path, ok := item.(string)
		if !ok {
			return nil, errLtreeOperand
		}

		paths[i] = path
	}

	return paths, nil
}

func ltreeParser(operator, rhsType string, many bool) operatorParser {
	return func(c *core.Column, target *comparisonTarget, v *ast.Value,
		vars map[string]any, d dialect.Dialect,
	) (Statement, error) {
		if !d.SupportsRegex() || comparisonTargetFor(c, target).sqlType != "ltree" {
			return nil, errLtreeOperatorUnsupported
		}

		operand, err := resolveLtreeOperand(v, vars, many)
		if err != nil {
			return nil, err
		}

		castType := rhsType
		if many {
			castType += "[]"
		}

		return &ltreeFilter{
			column: c, target: target, operator: operator, rhsType: castType,
			value: operand, dialect: d,
		}, nil
	}
}
