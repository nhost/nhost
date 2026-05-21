package controller

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/controller/websocket"
	"github.com/nhost/nhost/services/constellation/internal/lib/syncmap"
	"github.com/nhost/nhost/services/constellation/subscription"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/gqlerror"
	"github.com/vektah/gqlparser/v2/validator"
)

// defaultPollingInterval is the default interval for polling subscriptions.
const defaultPollingInterval = 1 * time.Second

// subscriptionState tracks an active subscription.
type subscriptionState struct {
	id            string
	handler       subscription.Handler // the handler this subscription was started on
	query         string
	operationName string
	variables     map[string]any
	lastHash      string // xxhash for change detection
	stopCh        chan struct{}
}

// webSocketHandler implements websocket.MessageHandler and bridges
// between the protocol layer and subscription system.
// It snapshots the controller state at connection time so that every
// subscription on this connection sees a consistent view.
type webSocketHandler struct {
	state           *controllerState
	adminSecret     string
	jwtAuth         middleware.JWTAuthenticator
	pollingInterval time.Duration
	devMode         bool

	logger *slog.Logger

	// Per-connection state
	session *middleware.SessionVariables
	sendCh  chan<- *websocket.Message
	subs    *syncmap.Map[string, *subscriptionState]
}

// newWebSocketHandler creates a new WebSocket message handler.
func newWebSocketHandler(
	state *controllerState,
	adminSecret string,
	jwtAuth middleware.JWTAuthenticator,
	pollingInterval time.Duration,
	devMode bool,
	sendCh chan<- *websocket.Message,
	logger *slog.Logger,
) *webSocketHandler {
	if pollingInterval == 0 {
		pollingInterval = defaultPollingInterval
	}

	return &webSocketHandler{
		state:           state,
		adminSecret:     adminSecret,
		jwtAuth:         jwtAuth,
		pollingInterval: pollingInterval,
		devMode:         devMode,
		logger:          logger,
		session:         nil,
		sendCh:          sendCh,
		subs:            syncmap.New[string, *subscriptionState](),
	}
}

// OnConnectionInit is called when client sends connection_init.
func (h *webSocketHandler) OnConnectionInit(
	ctx context.Context, payload jsontext.Value,
) error {
	// Extract headers from payload
	headers := extractHeadersFromPayload(payload)

	// Extract session from headers (admin secret + JWT validation, etc.)
	session, err := middleware.ExtractSession(h.adminSecret, h.jwtAuth, headers)
	if err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	h.session = session

	h.logger.DebugContext(ctx, "connection initialized",
		slog.String("role", h.session.Role),
	)

	return nil
}

// OnSubscribe is called when client sends subscribe. It parses and validates
// the subscription query, selects the owning subscription handler, registers
// per-subscription state, and spawns a goroutine that forwards updates back
// over the WebSocket. Any failure produces an error message on the sendCh
// rather than returning from this method.
func (h *webSocketHandler) OnSubscribe(
	ctx context.Context, id string, payload websocket.SubscribePayload,
) {
	if h.session == nil {
		h.sendError(id, "session not available")
		return
	}

	if _, exists := h.subs.Load(id); exists {
		h.sendError(id, "subscription with ID already exists")
		return
	}

	logger := h.logger.WithGroup("subscription").With("id", id)

	operation, fragments, validatedVariables, err := parseAndValidateQuery(
		h.state.validatedSchemas,
		h.state.queryCache,
		payload.Query,
		payload.OperationName,
		payload.Variables,
		h.session.Role,
	)
	if err != nil {
		h.sendSubscriptionError(id, err)
		return
	}

	dbName := getConnectorForOperation(h.state, operation)

	subHandler := h.state.subHandlers[dbName]
	if subHandler == nil {
		h.sendError(id, "no subscription handler available for database: "+dbName)
		return
	}

	h.startSubscription(
		ctx,
		id,
		payload,
		subHandler,
		operation,
		fragments,
		validatedVariables,
		logger,
	)
}

// sendSubscriptionError converts a parseAndValidateQuery error into a
// graphql-transport-ws error frame, preserving the structured form when
// available.
func (h *webSocketHandler) sendSubscriptionError(id string, err error) {
	if valErr, ok := errors.AsType[*gqlValidationError](err); ok {
		h.sendErrors(id, formatGQLErrors(valErr.errs))
		return
	}

	h.sendError(id, err.Error())
}

// startSubscription registers per-subscription state, kicks off the handler,
// and spawns the update-forwarding goroutine. Mirrors the cleanup contract
// of OnSubscribe so failures still send an error frame and unregister state.
func (h *webSocketHandler) startSubscription(
	ctx context.Context,
	id string,
	payload websocket.SubscribePayload,
	subHandler subscription.Handler,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	validatedVariables map[string]any,
	logger *slog.Logger,
) {
	// Keep a reference to the handler so OnComplete/OnClose stop the
	// subscription on the correct (possibly old) handler.
	sub := &subscriptionState{
		id:            id,
		handler:       subHandler,
		query:         payload.Query,
		operationName: payload.OperationName,
		variables:     validatedVariables,
		lastHash:      "",
		stopCh:        make(chan struct{}),
	}

	h.subs.Store(id, sub)

	logger.DebugContext(ctx, "starting subscription")

	req, err := subscription.NewRequest(subscription.Request{
		ID:               id,
		QueryString:      payload.Query,
		Operation:        operation,
		Fragments:        fragments,
		OperationName:    payload.OperationName,
		Role:             h.session.Role,
		Variables:        validatedVariables,
		SessionVariables: h.session.Variables,
	})
	if err != nil {
		// A missing-field error from NewRequest names the offending field
		// (no PII) and is more actionable than a generic trace id, so surface
		// it verbatim; only driver/runtime faults get sanitized.
		if errors.Is(err, subscription.ErrInvalidRequest) {
			h.sendError(id, err.Error())
		} else {
			h.sendError(id, sanitizeConnectorError(ctx, logger, h.devMode, err))
		}

		h.removeSubscription(id)

		return
	}

	updateCh, err := subHandler.Start(ctx, req, logger)
	if err != nil {
		// A query that cannot be planned is a client-actionable error and is
		// surfaced verbatim (mirroring the parse/validate path); only genuine
		// driver/runtime faults are sanitized into a trace id.
		if errors.Is(err, subscription.ErrInvalidSubscription) {
			h.sendError(id, err.Error())
		} else {
			h.sendError(id, sanitizeConnectorError(ctx, logger, h.devMode, err))
		}

		h.removeSubscription(id)

		return
	}

	go h.forwardUpdates(ctx, sub, updateCh, logger)
}

// getConnectorForOperation determines which database connector should handle the operation.
func getConnectorForOperation(
	state *controllerState,
	operation *ast.OperationDefinition,
) string {
	for _, selection := range operation.SelectionSet {
		if field, ok := selection.(*ast.Field); ok {
			if dbName, exists := state.fieldToConnector[field.Name]; exists {
				return dbName
			}
		}
	}

	// Default to first available handler
	for dbName := range state.subHandlers {
		return dbName
	}

	return ""
}

// parseAndValidateQuery parses and validates a GraphQL subscription query.
// This mirrors the logic in controller/resolve.go for queries/mutations.
func parseAndValidateQuery(
	validatedSchemas map[string]*ast.Schema,
	cache *queryCache,
	query, operationName string,
	variables map[string]any,
	role string,
) (*ast.OperationDefinition, ast.FragmentDefinitionList, map[string]any, error) {
	// Get the validated schema for this role
	validatedSchema, exists := validatedSchemas[role]
	if !exists {
		return nil, nil, nil, errors.New("no schema available for role: " + role)
	}

	// Parse and validate the query (cached by query string + role)
	parsedQuery, gqlErrs := loadQuery(cache, validatedSchema, query, role)
	if gqlErrs != nil {
		return nil, nil, nil, formatGQLErrorsAsError(gqlErrs)
	}

	// Find the operation
	var operation *ast.OperationDefinition
	if operationName == "" {
		if len(parsedQuery.Operations) == 1 {
			for _, op := range parsedQuery.Operations {
				operation = op
				break
			}
		}
	} else {
		operation = parsedQuery.Operations.ForName(operationName)
	}

	if operation == nil {
		if len(parsedQuery.Operations) > 1 {
			return nil, nil, nil, errors.New("multiple operations found, operationName is required")
		}

		return nil, nil, nil, errors.New("operation not found")
	}

	// Validate and coerce variables
	var validatedVariables map[string]any
	if len(variables) > 0 {
		var varErr error

		validatedVariables, varErr = validator.VariableValues(
			validatedSchema,
			operation,
			variables,
		)
		if varErr != nil {
			if gqlErrs, ok := errors.AsType[gqlerror.List](varErr); ok {
				return nil, nil, nil, formatGQLErrorsAsError(gqlErrs)
			}

			return nil, nil, nil, fmt.Errorf("variable validation error: %w", varErr)
		}
	} else {
		validatedVariables = variables
	}

	return operation, parsedQuery.Fragments, validatedVariables, nil
}

// gqlValidationError wraps a gqlerror.List so structured error data
// (locations, path, extensions) is preserved through the error interface.
type gqlValidationError struct {
	errs gqlerror.List
}

func (e *gqlValidationError) Error() string {
	if len(e.errs) == 0 {
		return ""
	}

	return e.errs[0].Message
}

// formatGQLErrorsAsError converts a list of GraphQL errors to a single error,
// preserving the structured error data for later extraction.
func formatGQLErrorsAsError(errs gqlerror.List) error {
	if len(errs) == 0 {
		return nil
	}

	return &gqlValidationError{errs: errs}
}

// OnComplete is called when client sends complete.
func (h *webSocketHandler) OnComplete(ctx context.Context, id string) {
	sub := h.removeSubscription(id)
	if sub != nil {
		sub.handler.Stop(ctx, id)

		logger := h.logger.WithGroup("subscription").With("id", id)
		logger.DebugContext(ctx, "subscription completed")
	}
}

// OnClose is called when the connection closes.
func (h *webSocketHandler) OnClose(ctx context.Context) {
	// Stop all subscriptions on their respective handlers
	h.subs.Range(func(id string, sub *subscriptionState) bool {
		close(sub.stopCh)
		sub.handler.Stop(ctx, id)

		return true
	})

	h.subs.Clear()

	h.logger.DebugContext(ctx, "connection closed, all subscriptions stopped")
}

// removeSubscription removes a subscription and closes its stop channel.
func (h *webSocketHandler) removeSubscription(id string) *subscriptionState {
	sub, exists := h.subs.Delete(id)
	if exists {
		close(sub.stopCh)
	}

	return sub
}

// forwardUpdates reads from the update channel and sends WebSocket messages.
func (h *webSocketHandler) forwardUpdates(
	ctx context.Context,
	sub *subscriptionState,
	updateCh <-chan subscription.Update,
	logger *slog.Logger,
) {
	for {
		select {
		case <-sub.stopCh:
			logger.DebugContext(ctx, "subscription stopped, stopping update forwarding")
			return
		case <-ctx.Done():
			logger.DebugContext(ctx, "context cancelled, stopping update forwarding")
			return
		case update, ok := <-updateCh:
			if !ok {
				// Channel closed
				logger.DebugContext(ctx, "update channel closed")
				return
			}

			if update.Error != nil {
				// Mirror startSubscription's classification: a plan failure
				// (wrapped with subscription.ErrInvalidSubscription) is a
				// client-actionable error and is surfaced verbatim; only
				// driver/runtime faults are sanitized into a trace id. Live
				// query subscriptions only build SQL inside the polling
				// goroutine, so this is the sole place the sentinel reaches
				// the protocol layer for them.
				if errors.Is(update.Error, subscription.ErrInvalidSubscription) {
					h.sendError(update.SubscriptionID, update.Error.Error())
				} else {
					h.sendError(
						update.SubscriptionID,
						sanitizeConnectorError(ctx, logger, h.devMode, update.Error),
					)
				}

				continue
			}

			h.sendNext(update.SubscriptionID, update.Data, nil)
		}
	}
}

// sendNext sends a next message to the client.
func (h *webSocketHandler) sendNext(id string, data any, errors any) {
	select {
	case h.sendCh <- websocket.NewNextMessage(id, data, errors):
	default:
	}
}

// sendErrors sends a structured error message to the client preserving
// locations, path, and extensions from GraphQL validation errors.
func (h *webSocketHandler) sendErrors(id string, errs []map[string]any) {
	select {
	case h.sendCh <- websocket.NewErrorMessage(id, errs):
	default:
	}
}

// sendError sends an error message to the client.
func (h *webSocketHandler) sendError(id string, errMsg string) {
	select {
	case h.sendCh <- websocket.NewErrorMessage(id, []map[string]any{{"message": errMsg}}):
	default:
	}
}

// connectionInitPayload is the payload for connection_init messages.
type connectionInitPayload struct {
	Headers map[string]string `json:"headers,omitempty"`
}

func toHeaders(m map[string]string) http.Header {
	headers := http.Header{}
	for k, v := range m {
		headers.Set(k, v)
	}

	return headers
}

func toHeadersFromAny(m map[string]any) http.Header {
	headers := http.Header{}
	for k, v := range m {
		if strVal, ok := v.(string); ok {
			headers.Set(k, strVal)
		}
	}

	return headers
}

// extractHeadersFromPayload extracts headers from the connection_init payload.
// It handles both nested format { headers: { ... } } and flat format { "x-hasura-...": ... }.
func extractHeadersFromPayload(payload jsontext.Value) http.Header {
	if payload == nil {
		return nil
	}

	// First try nested format: { headers: { ... } }
	var nested connectionInitPayload
	if err := json.Unmarshal(payload, &nested); err == nil && len(nested.Headers) > 0 {
		return toHeaders(nested.Headers)
	}

	// Try flat format: { "x-hasura-admin-secret": "...", ... }
	var flat map[string]string
	if err := json.Unmarshal(payload, &flat); err == nil {
		return toHeaders(flat)
	}

	// If flat string map fails, try map[string]any and convert string values
	var flexPayload map[string]any
	if err := json.Unmarshal(payload, &flexPayload); err != nil {
		return nil
	}

	return toHeadersFromAny(flexPayload)
}
