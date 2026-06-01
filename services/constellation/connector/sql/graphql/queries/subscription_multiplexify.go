package queries

import (
	"fmt"
	"maps"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
)

const subscriptionTemplateSessionArgumentKey = "\x00nhost.subscription.template.session_argument"

type subscriptionTemplateSessionArgument struct{}

// markSubscriptionTemplateSessionArgument returns a shallow copy of
// sessionVariables tagged so function session_argument placeholders use a
// multiplexed whole-session marker instead of eagerly marshaling the template
// values that cohortManager supplies while building cached subscription SQL.
func markSubscriptionTemplateSessionArgument(sessionVariables map[string]any) map[string]any {
	marked := make(map[string]any, len(sessionVariables)+1)
	maps.Copy(marked, sessionVariables)

	marked[subscriptionTemplateSessionArgumentKey] = subscriptionTemplateSessionArgument{}

	return marked
}

// isSubscriptionTemplateSessionArgument reports whether sessionVariables came
// from a non-stream subscription template build that must keep a function's
// whole-session argument dynamic across subscribers in a cohort.
func isSubscriptionTemplateSessionArgument(sessionVariables map[string]any) bool {
	_, ok := sessionVariables[subscriptionTemplateSessionArgumentKey].(subscriptionTemplateSessionArgument)

	return ok
}

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
		op, err := builder(
			field,
			fragments,
			variables,
			role,
			markSubscriptionTemplateSessionArgument(sessionVariables),
			roots,
		)
		if err != nil {
			return core.SQLOperation{}, fmt.Errorf(
				"failed to build subscription %s SQL: %w", name, err,
			)
		}

		op.SQL, op.Parameters = multiplexed.Multiplex(op)

		return op, nil
	}
}
