package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; see sql.go for the rationale.

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
)

// Execute translates a GraphQL operation into SQL and executes it,
// returning the combined operation results keyed by root field alias.
func (c *Connector) Execute(
	ctx context.Context,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
	logger *slog.Logger,
) (map[string]any, error) {
	operations, err := c.roots.BuildQuery(operation, fragments, variables, role, sessionVariables)
	if err != nil {
		return nil, fmt.Errorf("failed to build query: %w", err)
	}

	results, err := c.driver.ExecuteOperations(ctx, operations, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to execute operations: %w", err)
	}

	return results, nil
}

// ValidateOperation builds the SQL for the operation and discards it, surfacing
// any query-validation failure (e.g. a distinct_on / order_by mismatch or a
// negative limit/offset) without touching the database. BuildQuery is the same
// pure, side-effect-free step Execute runs first, so the controller can use
// this to validate every connector in a multi-connector request before any of
// them executes — matching Hasura, which rejects the whole request on a
// validation failure rather than returning partial data or running sibling
// mutations.
func (c *Connector) ValidateOperation(
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	variables map[string]any,
	role string,
	sessionVariables map[string]any,
) error {
	if _, err := c.roots.BuildQuery(
		operation, fragments, variables, role, sessionVariables,
	); err != nil {
		return fmt.Errorf("failed to build query: %w", err)
	}

	return nil
}

// ExecuteMultiplexedQuery executes a pre-built multiplexed subscription query.
// The op should be built using roots.BuildSubscription() which produces ready-to-use SQL.
// This is a thin convenience wrapper over [Connector.ExecuteMultiplexedQueryWithCursor]
// for non-stream subscriptions; both methods exist because the
// subscription.QueryExecutor interface requires both.
func (c *Connector) ExecuteMultiplexedQuery(
	ctx context.Context,
	op core.SQLOperation,
	subscriptionIDs []string,
	sessionVarArrays map[string][]any,
	logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	return c.ExecuteMultiplexedQueryWithCursor(
		ctx,
		op,
		subscriptionIDs,
		sessionVarArrays,
		nil,
		logger,
	)
}

// ExecuteMultiplexedQueryWithCursor executes a pre-built multiplexed subscription query
// with cursor values for stream subscriptions.
// The cursorValues map contains column name -> current cursor value for each subscriber.
// For stream subscriptions, use multiplexed.ExtractInitialCursorValues(op.StreamCursors) to get initial values.
func (c *Connector) ExecuteMultiplexedQueryWithCursor(
	ctx context.Context,
	op core.SQLOperation,
	subscriptionIDs []string,
	sessionVarArrays map[string][]any,
	cursorValues map[string]any,
	logger *slog.Logger,
) ([]core.MultiplexedResult, error) {
	if len(subscriptionIDs) == 0 {
		return nil, nil
	}

	params := multiplexed.PrepareParams(
		subscriptionIDs, sessionVarArrays, cursorValues,
	)
	params = append(params, op.Parameters...)

	logger.DebugContext(
		ctx, "executing multiplexed query",
		"sql", op.SQL,
		"subscription_count", len(subscriptionIDs),
		"has_cursor", len(cursorValues) > 0,
	)

	results, err := c.driver.ExecuteMultiplexedOperation(ctx, op.SQL, params, logger)
	if err != nil {
		return nil, fmt.Errorf("failed to execute multiplexed query: %w", err)
	}

	return results, nil
}
