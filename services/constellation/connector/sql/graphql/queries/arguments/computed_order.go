package arguments

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
)

type computedOrderTerm struct {
	expression       core.ComputedExpression
	source           string
	sessionVariables map[string]any
}

func (term *computedOrderTerm) writeExpr(
	b *strings.Builder, params []any, paramIndex int,
) ([]any, int, error) {
	params, paramIndex, err := term.expression.WriteExpression(
		b, term.source, term.sessionVariables, params, paramIndex,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("writing computed order expression: %w", err)
	}

	return params, paramIndex, nil
}
