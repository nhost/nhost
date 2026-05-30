package queries

import (
	"fmt"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
)

// multiplexify wraps a query-shaped SQL builder so its result is rewritten
// into the multiplexed form used by non-stream subscriptions: the original
// SQL is replaced with the multiplexed query body, and Parameters is reduced
// to only the static (non-session, non-cursor) values. The name argument is
// used to qualify wrapping errors so failures point at the right operation.
//
// Stream subscriptions go through buildSubscriptionStreamSQL instead, which
// has cursor-handling logic that doesn't fit this uniform post-processing.
func multiplexify(name string, builder core.Operation) core.Operation {
	return func(
		field *ast.Field,
		fragments ast.FragmentDefinitionList,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
		roots map[string]core.Operation,
	) (core.SQLOperation, error) {
		op, err := builder(field, fragments, variables, role, sessionVariables, roots)
		if err != nil {
			return core.SQLOperation{}, fmt.Errorf(
				"failed to build subscription %s SQL: %w", name, err,
			)
		}

		op.SQL, op.Parameters, err = multiplexed.Multiplex(op)
		if err != nil {
			return core.SQLOperation{}, fmt.Errorf(
				"failed to multiplex subscription %s SQL: %w", name, err,
			)
		}

		return op, nil
	}
}
