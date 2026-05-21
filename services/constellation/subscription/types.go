// Package subscription is the seam between the WebSocket protocol layer
// (controller/websocket) and the per-connector execution strategies that
// actually deliver subscription updates (e.g. connector/sql/subscription's
// cohort-based polling). It exists so the controller can depend on a stable
// interface instead of a concrete connector — letting future strategies
// (CDC, message-bus, etc.) plug in without touching the protocol code, and
// avoiding an import cycle between controller and connector.
//
// The package intentionally contains no behaviour: only the data shapes
// (Request, Update) and the lifecycle interface (Handler) that every
// connector implements.
package subscription

import (
	"context"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"log/slog"

	"github.com/vektah/gqlparser/v2/ast"
)

// Update represents a data update for a subscription. Exactly one of Data and
// Error is set on any given Update; a non-nil Error is non-terminal — the
// channel returned by Handler.Start stays open and may deliver further updates
// (or another error) until one of the close triggers documented on
// Handler.Start fires.
//
// An Error returned this way may also carry ErrInvalidSubscription when a plan
// failure is only detected after Start has returned (live-query connectors
// build SQL lazily inside their polling goroutine and discover unplannable
// queries on the first poll). Callers should classify with errors.Is on
// Error and surface ErrInvalidSubscription-wrapped errors verbatim — only
// unwrapped driver/runtime faults must be sanitized.
//
// Construct an Update via NewUpdateData or NewUpdateError so the one-of
// invariant is established at the call site; the fields stay exported only so
// the consumer (controller/websocket) can read them.
type Update struct {
	SubscriptionID string
	// Data is the raw JSON payload from the query result. jsontext.Value is
	// used (over json.RawMessage) so connectors can hand off bytes produced
	// by encoding/json/v2 without an intermediate copy.
	Data jsontext.Value
	// Error is set if an error occurred during query execution.
	Error error
}

// NewUpdateData builds a data Update for the given subscription, leaving Error
// nil. Use this for successful query results; pair with NewUpdateError for the
// failure path so the "exactly one of Data/Error" invariant holds by
// construction.
func NewUpdateData(subscriptionID string, data jsontext.Value) Update {
	return Update{
		SubscriptionID: subscriptionID,
		Data:           data,
		Error:          nil,
	}
}

// NewUpdateError builds an error Update for the given subscription, leaving
// Data nil. A non-nil Error is non-terminal — see the Update doc comment.
func NewUpdateError(subscriptionID string, err error) Update {
	return Update{
		SubscriptionID: subscriptionID,
		Data:           nil,
		Error:          err,
	}
}

// Request contains the information needed to start a subscription.
//
// Prefer constructing a Request via NewRequest to surface missing required
// fields at the call site rather than deep inside a connector.
type Request struct {
	ID string
	// QueryString is the original GraphQL query string (used for cohort key hashing).
	QueryString string
	// Operation is the parsed GraphQL operation (already validated by controller).
	Operation *ast.OperationDefinition
	// Fragments are the parsed GraphQL fragments (already validated by controller).
	Fragments     ast.FragmentDefinitionList
	OperationName string
	// Role is the role for permission evaluation.
	Role string
	// Variables are the validated GraphQL variables ($limit, $offset, etc.).
	Variables map[string]any
	// SessionVariables are the x-hasura-* variables from the connection.
	SessionVariables map[string]any
}

// ErrInvalidRequest is returned by NewRequest when required fields are missing.
var ErrInvalidRequest = errors.New("invalid subscription request")

// ErrInvalidSubscription marks a Handler.Start failure that is caused by the
// shape of the client's subscription (the query cannot be planned or produces
// no executable operation) rather than by a driver/runtime fault. Connectors
// must wrap such errors with this sentinel (via fmt.Errorf("...: %w", ...)) so
// the protocol layer can surface the actionable message to the client instead
// of collapsing it into an opaque internal-error response. Genuine
// driver/runtime failures must NOT be wrapped with it and stay sanitized.
var ErrInvalidSubscription = errors.New("invalid subscription")

// NewRequest validates that the fields required for any connector to execute
// the subscription are present: ID, QueryString, Operation and Role.
// Fragments, OperationName, Variables, and SessionVariables are optional and
// may be zero. Callers initialise the Request by name so the type system
// prevents accidental field swaps among the string fields.
func NewRequest(req Request) (Request, error) {
	switch {
	case req.ID == "":
		return Request{}, fmt.Errorf(
			"%w: ID is required",
			ErrInvalidRequest,
		)
	case req.QueryString == "":
		return Request{}, fmt.Errorf(
			"%w: QueryString is required",
			ErrInvalidRequest,
		)
	case req.Operation == nil:
		return Request{}, fmt.Errorf(
			"%w: Operation is required",
			ErrInvalidRequest,
		)
	case req.Role == "":
		return Request{}, fmt.Errorf(
			"%w: Role is required",
			ErrInvalidRequest,
		)
	}

	return req, nil
}

// Handler manages subscriptions for a connector.
// Implementations can use different strategies (polling, CDC, etc.)
// for delivering subscription updates.
//
//go:generate mockgen -package mock -destination mock/handler.go . Handler
type Handler interface {
	// Start registers a subscription and begins sending updates on the
	// returned channel. The channel is closed exactly once, when any of
	// the following occurs:
	//   - Stop is called for this subscription's ID,
	//   - Shutdown is called on the Handler,
	//   - the implementation tears the subscription down internally
	//     (e.g. an empty-cohort cleanup or other terminal condition).
	// The ctx passed to Start is not one of those triggers: cancelling it
	// does not close the channel — callers that want to stop receiving on
	// ctx cancellation must select on both ctx.Done() and the channel and
	// invoke Stop themselves.
	//
	// A failure caused by the client's subscription shape (a query that
	// cannot be planned or yields no executable operation) must be returned
	// wrapped with ErrInvalidSubscription so the caller can surface the
	// actionable message; driver/runtime faults must be returned unwrapped so
	// the caller can sanitize them. Implementations that defer planning to a
	// background poll (e.g. SQL live-query cohorts) must wrap the same
	// failures the same way when they reach Update.Error — see Update for
	// the channel-side classification contract.
	Start(ctx context.Context, req Request, logger *slog.Logger) (<-chan Update, error)

	// Stop terminates a subscription by ID.
	// This closes the update channel returned by Start.
	// The context is used only for logging (trace IDs, request metadata);
	// cancelling it does not influence cleanup, which always runs to completion.
	Stop(ctx context.Context, subscriptionID string)

	// Shutdown gracefully stops all subscriptions.
	Shutdown(ctx context.Context)
}
