package where

import (
	"fmt"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

type computedComparison struct {
	expression       core.ComputedExpression
	comparison       Statement
	expressionSQL    string
	sessionVariables map[string]any
}

func parseComputedComparison( //nolint:ireturn // The where parser composes Statement implementations.
	t Table,
	computed core.ComputedExpression,
	value *ast.Value,
	variables, sessionVariables map[string]any,
) (Statement, error) {
	if value.Kind != ast.ObjectValue {
		return nil, errFieldComparisonMustBeObject
	}

	c := &computedComparison{
		expression: computed, comparison: nil, expressionSQL: "",
		sessionVariables: sessionVariables,
	}
	column := &core.Column{
		SQLName: "computed", GraphqlName: "", SQLType: computed.SQLType(),
		IsArray: false, IsGenerated: false, IsIdentity: false, HasDefault: false, DefaultExpr: "",
	}
	target := &comparisonTarget{
		sourceColumn: column.SQLName,
		sqlType:      column.SQLType,
		render:       func(b *strings.Builder, _ string) { b.WriteString(c.expressionSQL) },
	}

	comparison, err := parseFieldComparisonValue(column, target, value, variables, t.Dialect())
	if err != nil {
		return nil, fmt.Errorf("parsing computed predicate: %w", err)
	}

	if comparison == nil {
		return nil, nil //nolint:nilnil // Empty comparison does not need a computed call or its session params.
	}

	c.comparison = comparison

	return c, nil
}

func (c *computedComparison) WriteCondition(
	b *strings.Builder, source string, params []any, paramIndex int,
) ([]any, int, error) {
	var expression strings.Builder

	params, paramIndex, err := c.expression.WriteExpression(
		&expression, source, c.sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed predicate expression: %w", err)
	}

	c.expressionSQL = expression.String()

	params, paramIndex, err = c.comparison.WriteCondition(b, source, params, paramIndex)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed predicate comparison: %w", err)
	}

	return params, paramIndex, nil
}
