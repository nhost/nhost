package server

import (
	"context"
	"errors"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"
)

// subscriptionsListenKey carries the JSON-RPC ID of the subscriptions/listen
// request that opened the current notification stream.
type subscriptionsListenKey struct{}

// WithSubscriptionID returns a context tagged with the JSON-RPC ID of the
// subscriptions/listen request that opened the current stream.
func WithSubscriptionID(ctx context.Context, id any) context.Context {
	return context.WithValue(ctx, subscriptionsListenKey{}, id)
}

// SubscriptionIDFromContext returns the JSON-RPC ID of the
// subscriptions/listen request that opened the current stream, or nil when the
// request is not a subscription stream.
func SubscriptionIDFromContext(ctx context.Context) any {
	return ctx.Value(subscriptionsListenKey{})
}

// SessionWithSubscriptionFilter is implemented by sessions that can record
// which notification types a client opted in to through subscriptions/listen.
//
// Protocol version 2026-07-28 makes every server-to-client notification
// opt-in: a server MUST NOT deliver a notification type the client did not
// explicitly request (SEP-2575).
//
// Implementations must be safe for concurrent use: the filter is written by
// the goroutine serving the subscriptions/listen request and read by the
// notification fan-out running on independent goroutines.
type SessionWithSubscriptionFilter interface {
	ClientSession
	// SetSubscriptionFilter records the notification types the client opted
	// in to. Passing the zero filter clears the subscription.
	SetSubscriptionFilter(filter mcp.SubscriptionFilter)
	// SubscriptionFilter returns the notification types the client opted in
	// to, and whether a subscription is currently active.
	SubscriptionFilter() (mcp.SubscriptionFilter, bool)
}

// handleSubscriptionsListen serves the subscriptions/listen RPC introduced in
// protocol version 2026-07-28 (SEP-2575).
//
// It replaces the standalone HTTP GET stream and the
// resources/subscribe and resources/unsubscribe RPCs with a single long-lived
// response stream. The server intersects the client's requested filter with
// its own capabilities, acknowledges the result, and then blocks, delivering
// notifications on the stream until the client cancels the request or
// disconnects.
func (s *MCPServer) handleSubscriptionsListen(
	ctx context.Context,
	id any,
	request mcp.SubscriptionsListenRequest,
) (*mcp.SubscriptionsListenResult, *requestError) {
	if id == nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INVALID_REQUEST,
			err:  errors.New("subscriptions/listen requires a request ID"),
		}
	}

	session := ClientSessionFromContext(ctx)
	if session == nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  errors.New("subscriptions/listen requires an active session"),
		}
	}

	allowed := s.allowedSubscriptions(request.Params.Notifications)

	// Record the filter so notification fan-out can honour the opt-in.
	if filtered, ok := session.(SessionWithSubscriptionFilter); ok {
		filtered.SetSubscriptionFilter(allowed)
		defer filtered.SetSubscriptionFilter(mcp.SubscriptionFilter{})
	}

	// Resource subscriptions are expressed through the existing per-session
	// subscription store, so notifications/resources/updated fan-out is
	// unchanged.
	if subs, ok := session.(SessionWithResourceSubscriptions); ok {
		// Track what actually took effect, and arm the cleanup before
		// subscribing: a failure partway through the list must not leave the
		// earlier URIs subscribed for the life of the session.
		var established []string
		defer func() {
			for _, uri := range established {
				subs.UnsubscribeFromResource(uri)
			}
		}()

		for _, uri := range allowed.ResourceSubscriptions {
			if errSubs, ok := session.(SessionWithResourceSubscriptionsErr); ok {
				if err := errSubs.SubscribeToResourceErr(uri); err != nil {
					return nil, &requestError{
						id:   id,
						code: mcp.INVALID_PARAMS,
						err:  fmt.Errorf("subscribing to %q: %w", uri, err),
					}
				}
				established = append(established, uri)
				continue
			}
			subs.SubscribeToResource(uri)
			established = append(established, uri)
		}
	}

	// Acknowledge the subscription so the client learns which of its requested
	// notification types were actually established. Every message on the
	// stream, including this one, is tagged with the subscription ID so the
	// client can correlate it.
	ack := mcp.JSONRPCNotification{
		JSONRPC: mcp.JSONRPC_VERSION,
		Notification: mcp.Notification{
			Method: mcp.MethodNotificationSubscriptionsAcknowledged,
			Params: mcp.NotificationParams{
				Meta:             map[string]any{mcp.MetaKeySubscriptionID: id},
				AdditionalFields: map[string]any{"notifications": allowed},
			},
		},
	}
	if err := s.sendNotificationToSpecificClient(session, ack); err != nil {
		return nil, &requestError{
			id:   id,
			code: mcp.INTERNAL_ERROR,
			err:  fmt.Errorf("sending subscriptions/acknowledged: %w", err),
		}
	}

	// Hold the stream open for as long as anything was subscribed. When the
	// filter is empty there is nothing to deliver, so close immediately.
	if !allowed.IsEmpty() {
		<-ctx.Done()
	}

	result := &mcp.SubscriptionsListenResult{}
	meta := result.EnsureResultMeta()
	meta.SetSubscriptionID(id)
	return result, nil
}

// registerListenSession makes a session serving a subscriptions/listen stream
// reachable by the notifications the server broadcasts. It is for transports
// that serve each modern request with an ephemeral session they never
// register, such as Streamable HTTP. It fires no session hooks, because the
// session is not a client session in its own right.
func (s *MCPServer) registerListenSession(session ClientSession) {
	s.listenSessions.Store(session, struct{}{})
}

// unregisterListenSession undoes registerListenSession.
func (s *MCPServer) unregisterListenSession(session ClientSession) {
	s.listenSessions.Delete(session)
}

// allowedSubscriptions intersects the notification types a client asked for
// with the capabilities this server actually advertises. The server MUST NOT
// establish a subscription it cannot serve.
func (s *MCPServer) allowedSubscriptions(want mcp.SubscriptionFilter) mcp.SubscriptionFilter {
	s.capabilitiesMu.RLock()
	defer s.capabilitiesMu.RUnlock()

	var allowed mcp.SubscriptionFilter
	if want.ToolsListChanged && s.capabilities.tools != nil && s.capabilities.tools.listChanged {
		allowed.ToolsListChanged = true
	}
	if want.PromptsListChanged && s.capabilities.prompts != nil && s.capabilities.prompts.listChanged {
		allowed.PromptsListChanged = true
	}
	if want.ResourcesListChanged && s.capabilities.resources != nil && s.capabilities.resources.listChanged {
		allowed.ResourcesListChanged = true
	}
	if len(want.ResourceSubscriptions) > 0 && s.capabilities.resources != nil && s.capabilities.resources.subscribe {
		allowed.ResourceSubscriptions = append([]string(nil), want.ResourceSubscriptions...)
	}
	return allowed
}

// subscriptionAllowsNotification reports whether a session that opted in
// through subscriptions/listen should receive the given notification method.
//
// Sessions that never opened a subscription stream are unaffected: they are
// legacy sessions, where notifications are not opt-in.
func subscriptionAllowsNotification(session ClientSession, method string) bool {
	filtered, ok := session.(SessionWithSubscriptionFilter)
	if !ok {
		return true
	}
	filter, active := filtered.SubscriptionFilter()
	if !active {
		return true
	}
	switch method {
	case mcp.MethodNotificationToolsListChanged:
		return filter.ToolsListChanged
	case mcp.MethodNotificationPromptsListChanged:
		return filter.PromptsListChanged
	case mcp.MethodNotificationResourcesListChanged:
		return filter.ResourcesListChanged
	default:
		// Opt-in is absolute: a server MUST NOT deliver a notification type
		// the client did not request. Anything outside the filter's
		// vocabulary - a custom broadcast, or an extension's notifications -
		// therefore stays off the subscription stream. An extension that
		// defines its own notifications negotiates them through its own
		// capability and needs its own delivery path.
		//
		// notifications/resources/updated is unaffected: it is fanned out per
		// subscribed URI through SessionWithResourceSubscriptions rather than
		// broadcast.
		return false
	}
}
