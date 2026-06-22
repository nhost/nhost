package subscription

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/vektah/gqlparser/v2/ast"

	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/core"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/multiplexed"
	sub "github.com/nhost/nhost/services/constellation/subscription"
)

// MultiplexedResult is an alias for [core.MultiplexedResult]. The canonical
// type lives in core so SQL drivers can satisfy the Driver interface without
// taking a dependency on this package.
type MultiplexedResult = core.MultiplexedResult

// ErrOperationNotProvided reports that a subscription request was missing the
// pre-parsed GraphQL operation that downstream stream detection requires.
var ErrOperationNotProvided = errors.New("operation not provided in request")

// QueryExecutor defines the interface for executing multiplexed subscription queries.
//
//go:generate mockgen -package mock -destination mock/query_executor.go . QueryExecutor
type QueryExecutor interface {
	// ExecuteMultiplexedQuery executes a pre-built multiplexed subscription query.
	ExecuteMultiplexedQuery(
		ctx context.Context,
		op core.SQLOperation,
		subscriptionIDs []string,
		sessionVarArrays map[string][]any,
		logger *slog.Logger,
	) ([]MultiplexedResult, error)

	// ExecuteMultiplexedQueryWithCursor executes a pre-built multiplexed subscription query
	// with cursor values for stream subscriptions.
	ExecuteMultiplexedQueryWithCursor(
		ctx context.Context,
		op core.SQLOperation,
		subscriptionIDs []string,
		sessionVarArrays map[string][]any,
		cursorValues map[string]any,
		logger *slog.Logger,
	) ([]MultiplexedResult, error)
}

// QueryBuilder builds SQL operations from a GraphQL operation definition.
// It abstracts the dependency on the queries package's Roots type.
//
//go:generate mockgen -package mock -destination mock/query_builder.go . QueryBuilder
type QueryBuilder interface {
	// BuildQuery converts a pre-parsed GraphQL operation into one or more
	// SQL operations for the given role. session variables are passed by
	// name only (values supplied at execution time) so the produced SQL is
	// stable for a given query+role+variables tuple.
	BuildQuery(
		operation *ast.OperationDefinition,
		fragments ast.FragmentDefinitionList,
		variables map[string]any,
		role string,
		sessionVariables map[string]any,
	) ([]core.SQLOperation, error)

	// IsStreamSubscription reports whether the given root field corresponds
	// to a _stream subscription. Implementations must answer without
	// building SQL so the handler can route live-query subscriptions on
	// the hot path without paying the cost of BuildQuery.
	IsStreamSubscription(field *ast.Field) bool
}

// Handler implements subscription.Handler for SQL connectors.
// It uses cohort-based multiplexing to batch subscriptions with the same
// query template and role together for efficient execution.
//
// The handler routes subscriptions to the appropriate manager:
// - streamCohortManager for stream subscriptions (queries with _stream fields)
// - cohortManager for regular (live query) subscriptions.
type Handler struct {
	cohortMgr       *cohortManager
	streamCohortMgr *streamCohortManager
	roots           QueryBuilder
}

// NewHandler creates a new SQL subscription handler.
func NewHandler(
	executor QueryExecutor,
	roots QueryBuilder,
	pollingInterval time.Duration,
	logger *slog.Logger,
) *Handler {
	return &Handler{
		cohortMgr:       newCohortManager(executor, roots, pollingInterval, logger),
		streamCohortMgr: newStreamCohortManager(executor, roots, pollingInterval, logger),
		roots:           roots,
	}
}

// Start registers a subscription and begins sending updates.
// Updates are sent to the returned channel until Stop is called
// or the context is cancelled.
func (h *Handler) Start(
	ctx context.Context,
	req sub.Request,
	logger *slog.Logger,
) (<-chan sub.Update, error) {
	// Determine if this is a stream subscription by parsing the query
	isStream, cursorValues, cursorColumns, err := h.detectStreamSubscription(req)
	if err != nil {
		return nil, err
	}

	if isStream {
		logger.DebugContext(
			ctx, "routing to stream cohort manager",
			slog.String("subscription_id", req.ID),
			slog.Any("cursor_values", cursorValues),
		)

		return h.streamCohortMgr.addSubscription(ctx, req, cursorValues, cursorColumns, logger)
	}

	return h.cohortMgr.addSubscription(ctx, req, logger)
}

// Stop terminates a subscription by ID. Stream and live subscriptions are
// partitioned at Start time and never cross managers, so at most one of these
// calls finds the subscription; the other is a cheap O(1) miss on the index.
func (h *Handler) Stop(ctx context.Context, subscriptionID string) {
	h.cohortMgr.removeSubscription(ctx, subscriptionID)
	h.streamCohortMgr.removeSubscription(ctx, subscriptionID)
}

// Shutdown gracefully stops all subscriptions.
func (h *Handler) Shutdown(ctx context.Context) {
	h.cohortMgr.shutdown(ctx)
	h.streamCohortMgr.shutdown(ctx)
}

// detectStreamSubscription uses the pre-parsed operation to determine if it's a stream subscription.
// If it is, it also extracts the initial cursor values and cursor column names.
//
// Stream detection itself is an O(1) name lookup via QueryBuilder.IsStreamSubscription,
// so live-query subscriptions return without building any SQL. Only the stream path
// pays the BuildQuery cost — and it does so to harvest cursor metadata, not the SQL.
func (h *Handler) detectStreamSubscription(
	req sub.Request,
) (bool, map[string]any, []string, error) {
	if req.Operation == nil {
		return false, nil, nil, ErrOperationNotProvided
	}

	streamField := firstStreamField(req.Operation, h.roots)
	if streamField == nil {
		return false, nil, nil, nil
	}

	templateSessionVars := make(map[string]any)
	for varName := range req.SessionVariables {
		templateSessionVars[varName] = core.SessionVarValue{Name: varName}
	}

	operations, err := h.roots.BuildQuery(
		req.Operation,
		req.Fragments,
		req.Variables,
		req.Role,
		templateSessionVars,
	)
	if err != nil {
		return false, nil, nil, fmt.Errorf(
			"%w: failed to build query: %w",
			sub.ErrInvalidSubscription,
			err,
		)
	}

	if len(operations) == 0 {
		return false, nil, nil, fmt.Errorf(
			"%w: no operations generated from subscription",
			sub.ErrInvalidSubscription,
		)
	}

	op := operations[0]

	if len(op.StreamCursors) == 0 {
		return false, nil, nil, nil
	}

	cursorValues := multiplexed.ExtractInitialCursorValues(op.StreamCursors)

	cursorColumns := make([]string, len(op.StreamCursors))
	for i, c := range op.StreamCursors {
		cursorColumns[i] = c.GraphQLName
	}

	return true, cursorValues, cursorColumns, nil
}

// firstStreamField returns the first root field of op that QueryBuilder
// reports as a _stream subscription, or nil if none are. Used to short-circuit
// detection for live-query subscriptions without invoking BuildQuery.
func firstStreamField(op *ast.OperationDefinition, qb QueryBuilder) *ast.Field {
	for _, selection := range op.SelectionSet {
		field, ok := selection.(*ast.Field)
		if !ok {
			continue
		}

		if qb.IsStreamSubscription(field) {
			return field
		}
	}

	return nil
}
