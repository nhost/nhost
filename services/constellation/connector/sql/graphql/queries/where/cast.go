package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/values"
	"github.com/nhost/nhost/services/constellation/connector/sql/pgtypes"
)

//nolint:ireturn // Operator dispatch returns the shared Statement abstraction.
func parseComparisonCast(
	column *core.Column, target *comparisonTarget, value *ast.Value,
	variables map[string]any, d dialect.Dialect, tables ...Table,
) (Statement, error) {
	base := comparisonTargetFor(column, target)
	if pgtypes.IsSpatial(base.sqlType) {
		return parseSpatialCast(column, target, value, variables, d, tables...)
	}

	if base.sqlType != "jsonb" || !d.SupportsJSONB() {
		return nil, fmt.Errorf("%w: _cast", errUnknownWhereOperator)
	}

	resolved, err := values.ResolveVariable(value, variables)
	if err != nil {
		return nil, fmt.Errorf("resolving jsonb _cast: %w", err)
	}

	if resolved.Kind != ast.ObjectValue {
		return nil, errSpatialCastMustBeObject
	}

	conditions := make([]Statement, 0, len(resolved.Children))
	for _, child := range resolved.Children {
		if child.Name != "String" {
			return nil, fmt.Errorf("%w: %s", errSpatialCastTargetInvalid, child.Name)
		}

		cast := &comparisonTarget{
			sourceColumn: base.sourceColumn, sqlType: "text",
			render: func(b *strings.Builder, source string) {
				b.WriteString(d.TypeCast("("+base.sqlExpression(source)+")", "text"))
			},
		}

		condition, err := parseFieldComparisonValue(
			column,
			cast,
			child.Value,
			variables,
			d,
			tables...)
		if err != nil {
			return nil, fmt.Errorf("parsing jsonb _cast.String: %w", err)
		}

		if condition != nil {
			conditions = append(conditions, condition)
		}
	}

	switch len(conditions) {
	case 0:
		return nil, nil //nolint:nilnil // Empty operator object imposes no predicate.
	case 1:
		return conditions[0], nil
	default:
		return &andFilter{conditions: conditions}, nil
	}
}
