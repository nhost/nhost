package where

import (
	"fmt"
	"slices"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
)

// Permission membership distinguishes a whole PostgreSQL-array session operand
// from JSONB-valued session candidates inside a literal list. Only metadata
// parsing calls this path: user x-hasura-* strings remain ordinary JSON strings.
// Individual placeholders let multiplexing retain each candidate's JSONB cast
// rather than casting one subscriber's JSON value to an entire jsonb[].
func parseJSONBPermissionMembership(
	column *core.Column, target *comparisonTarget, operand *ast.Value,
	variables map[string]any, d dialect.Dialect, negated bool,
) (*jsonbPermissionMembershipFilter, bool, error) {
	marker := jsonbPermissionSessionName(operand)
	if marker == "" &&
		(operand.Kind != ast.ListValue || !slices.ContainsFunc(operand.Children, func(child *ast.ChildValue) bool {
			return jsonbPermissionSessionName(child.Value) != ""
		})) {
		return nil, false, nil
	}

	filter := &jsonbPermissionMembershipFilter{
		target:    comparisonTargetFor(column, target),
		wholeList: marker,
		values:    nil,
		dialect:   d,
		negated:   negated,
	}
	if marker == "" {
		vals, err := resolveTargetArrayValue(column, target, operand, variables)
		if err != nil {
			return nil, true, fmt.Errorf("resolving JSONB permission candidates: %w", err)
		}

		filter.values = vals
	}

	return filter, true, nil
}

func jsonbPermissionSessionName(value *ast.Value) string {
	switch value.Kind { //nolint:exhaustive // Only string-like metadata operands can reference a session variable.
	case ast.StringValue, ast.BlockValue, ast.EnumValue:
		if strings.HasPrefix(strings.ToLower(value.Raw), "x-hasura-") {
			return value.Raw
		}
	}

	return ""
}

type jsonbPermissionMembershipFilter struct {
	target    comparisonTarget
	wholeList string
	values    []any
	dialect   dialect.Dialect
	negated   bool
}

func (f *jsonbPermissionMembershipFilter) sourceColumn() string { return f.target.sourceColumn }

func (f *jsonbPermissionMembershipFilter) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	if f.wholeList != "" {
		f.target.writeSQL(b, source)

		if f.negated {
			b.WriteString(" != ALL(")
		} else {
			b.WriteString(" = ANY(")
		}

		b.WriteString(f.dialect.TypeCast(f.dialect.Placeholder(paramIndex), "jsonb[]"))
		b.WriteByte(')')

		return append(params, f.wholeList), paramIndex + 1, nil
	}

	vals, err := values.CoerceSQLValues("jsonb", f.values)
	if err != nil {
		return nil, 0, fmt.Errorf("coercing JSONB permission candidates: %w", err)
	}

	params, paramIndex = writeCandidateMembership(
		b,
		source,
		f.target,
		vals,
		f.dialect,
		params,
		paramIndex,
		f.negated,
	)

	return params, paramIndex, nil
}
