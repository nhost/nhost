package where

import (
	"errors"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
)

var errArrayMembershipSessionOperand = errors.New(
	"whole-list session operands are not supported for array-column _in/_nin permissions",
)

//nolint:ireturn // Permission guards compose the where parser's Statement implementations.
func guardArrayMembershipPermission(stmt Statement, column *core.Column,
	value *ast.Value, sessionVariables map[string]any,
) Statement {
	if column.IsArray && sessionVariables[core.PermissionSessionTemplateKey] == true &&
		hasWholeListMembershipSessionOperand(value) {
		return unsupportedArrayMembershipSessionFilter{}
	}

	return stmt
}

// Only the permission-template parser uses this guard: user x-hasura-* strings
// remain data. Inspect the original AST rather than the coerced values, which
// lose the distinction from an individual candidate inside a literal list.
func hasWholeListMembershipSessionOperand(value *ast.Value) bool {
	for _, child := range value.Children {
		op := canonicalComparisonOperator(child.Name)

		stringOperand := child.Value.Kind == ast.StringValue || child.Value.Kind == ast.EnumValue
		if (op == "_in" || op == "_nin") && stringOperand &&
			strings.HasPrefix(strings.ToLower(child.Value.Raw), "x-hasura-") {
			return true
		}
	}

	return false
}

// Retain the entire permission, but reject it at SQL construction. Rejecting
// during metadata parsing would drop the source rather than this permission;
// binding the marker would fix candidate count before deferred substitution.
// An error (not FALSE) also fails closed inside _not and otherwise-true _or.
type unsupportedArrayMembershipSessionFilter struct{}

func (unsupportedArrayMembershipSessionFilter) WriteCondition(
	_ *strings.Builder, _ string, _ []any, _ int,
) ([]any, int, error) {
	return nil, 0, errArrayMembershipSessionOperand
}

// writeCandidateMembership binds each complete typed candidate separately.
// Array columns compare whole arrays of possibly different lengths; JSONB
// permission candidates retain scalar casts for per-subscriber substitution.
func writeCandidateMembership(
	b *strings.Builder,
	source string,
	target comparisonTarget,
	vals []any,
	d dialect.Dialect,
	params []any,
	paramIndex int,
	negated bool,
) ([]any, int) {
	b.WriteByte('(')

	if len(vals) == 0 {
		// Retain the target expression: computed calls may have already bound
		// parameters. The identity must also hold when the target is NULL.
		target.writeSQL(b, source)

		if negated {
			b.WriteString(" IS NULL OR TRUE)")
		} else {
			b.WriteString(" IS NULL AND FALSE)")
		}

		return params, paramIndex
	}

	operator, separator := " = ", " OR "
	if negated {
		operator, separator = " != ", " AND "
	}

	for i := range vals {
		if i > 0 {
			b.WriteString(separator)
		}

		target.writeSQL(b, source)
		b.WriteString(operator)
		b.WriteString(d.TypeCast(d.Placeholder(paramIndex+i), target.sqlType))
	}

	b.WriteByte(')')

	return append(params, vals...), paramIndex + len(vals)
}

// arrayContainsFilter implements the _contains operator for array columns.
// Dispatched from containmentParser when column.IsArray is true; the JSONB
// branch produces jsonbContainsFilter instead.
type arrayContainsFilter struct {
	column  string
	sqlType string
	value   any
	dialect dialect.Dialect
}

func (f *arrayContainsFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	var col strings.Builder

	core.WriteQualifiedColumn(&col, source, f.column)

	f.dialect.WriteArrayContains(
		b,
		col.String(),
		f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.sqlType),
	)

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

func (f *arrayContainsFilter) sourceColumn() string { return f.column }

// arrayContainedInFilter implements the _contained_in operator for array columns.
// Dispatched from containmentParser when column.IsArray is true; the JSONB
// branch produces jsonbContainedInFilter instead.
type arrayContainedInFilter struct {
	column  string
	sqlType string
	value   any
	dialect dialect.Dialect
}

func (f *arrayContainedInFilter) WriteCondition(
	b *strings.Builder,
	source string,
	params []any,
	paramIndex int,
) ([]any, int, error) {
	var col strings.Builder

	core.WriteQualifiedColumn(&col, source, f.column)

	f.dialect.WriteArrayContainedIn(
		b,
		col.String(),
		f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), f.sqlType),
	)

	params = append(params, f.value)

	return params, paramIndex + 1, nil
}

func (f *arrayContainedInFilter) sourceColumn() string { return f.column }
