package client

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"sync"

	"github.com/mark3labs/mcp-go/mcp"
)

// Protocol version 2026-07-28 replaced the standalone notification stream and
// the resources/subscribe and resources/unsubscribe RPCs with a single
// subscriptions/listen request (SEP-2575).
//
// The client opts in to specific notification types; the server acknowledges
// what it established, tags every notification it delivers with the
// subscription ID, and holds the response stream open until the client
// cancels the request.

// subscriptionState tracks the client's pending and active subscription.
//
// generation identifies the Listen call that currently owns the stream. A
// later call supersedes an earlier one, and only the owner may clear the
// state, so a returning call cannot tear down a stream that replaced it.
type subscriptionState struct {
	mu                    sync.Mutex
	filter                mcp.SubscriptionFilter
	resourceSubscriptions []string
	cancel                context.CancelFunc
	generation            uint64
}

// Listen opens a subscriptions/listen stream for the given notification
// types and blocks until the context is cancelled or the server closes the
// stream.
//
// Notifications are delivered to the handlers registered with
// [Client.OnNotification], exactly as they were on earlier protocol versions.
//
// Listen is only available on connections using protocol version 2026-07-28 or
// later. On a legacy connection it returns an error: notifications arrive on
// the transport's own stream there, with no opt-in required.
func (c *Client) Listen(ctx context.Context, filter mcp.SubscriptionFilter) error {
	if !c.isModern() {
		return fmt.Errorf(
			"subscriptions/listen requires protocol version %s or later; "+
				"on this connection notifications are delivered without opting in",
			mcp.ProtocolVersion20260728)
	}

	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	c.subscriptions.mu.Lock()
	filter.ResourceSubscriptions = slices.Clone(filter.ResourceSubscriptions)
	for _, uri := range c.subscriptions.resourceSubscriptions {
		if !slices.Contains(filter.ResourceSubscriptions, uri) {
			filter.ResourceSubscriptions = append(filter.ResourceSubscriptions, uri)
		}
	}
	// Retain a filter of our own. The request below is serialized by the
	// transport after the mutex is released, so the outgoing slice must not
	// share a backing array with the one Unsubscribe mutates in place.
	c.subscriptions.filter = filter
	c.subscriptions.filter.ResourceSubscriptions = slices.Clone(filter.ResourceSubscriptions)
	if previous := c.subscriptions.cancel; previous != nil {
		previous()
	}
	c.subscriptions.cancel = cancel
	c.subscriptions.generation++
	generation := c.subscriptions.generation
	c.subscriptions.mu.Unlock()

	defer func() {
		c.subscriptions.mu.Lock()
		// Clear the stream only if this call still owns it. A concurrent
		// Listen may have superseded us, and its stream must survive our
		// return. The filter is left in place so that URIs accumulated
		// through Subscribe remain available to a subsequent Listen.
		if c.subscriptions.generation == generation {
			c.subscriptions.cancel = nil
		}
		c.subscriptions.mu.Unlock()
	}()

	params := mcp.SubscriptionsListenParams{Notifications: filter}
	response, err := c.sendRequest(ctx, string(mcp.MethodSubscriptionsListen), params, nil)
	if err != nil {
		return err
	}

	var result mcp.SubscriptionsListenResult
	if err := json.Unmarshal(*response, &result); err != nil {
		return fmt.Errorf("failed to unmarshal subscriptions/listen result: %w", err)
	}
	return nil
}

// ListenAsync opens a subscriptions/listen stream in the background and
// returns a function that closes it.
//
// It is the convenient form of [Client.Listen] for callers that only want the
// notifications to start flowing. Errors from the stream are reported to
// onError, which may be nil.
func (c *Client) ListenAsync(
	ctx context.Context,
	filter mcp.SubscriptionFilter,
	onError func(error),
) (stop func(), err error) {
	if !c.isModern() {
		return nil, fmt.Errorf(
			"subscriptions/listen requires protocol version %s or later",
			mcp.ProtocolVersion20260728)
	}

	ctx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})

	go func() {
		err := c.Listen(ctx, filter)
		// The stream has stopped before reporting its error. Closing done first
		// also allows the error handler to call the returned stop function.
		close(done)
		if err != nil && ctx.Err() == nil && onError != nil {
			onError(err)
		}
	}()

	return func() {
		cancel()
		<-done
	}, nil
}

// Subscribe subscribes to updates for a resource.
//
// Protocol version 2026-07-28 removed the resources/subscribe RPC: resource
// subscriptions are declared in the filter of a subscriptions/listen request
// (SEP-2575). On a modern connection this method records the URI so that the
// next [Client.Listen] call includes it; it does not open the stream itself.
//
// Deprecated: use [Client.Listen] with a filter naming the resources of
// interest.
func (c *Client) Subscribe(
	ctx context.Context,
	request mcp.SubscribeRequest,
) error {
	if c.isModern() {
		c.subscriptions.mu.Lock()
		defer c.subscriptions.mu.Unlock()
		if !slices.Contains(c.subscriptions.resourceSubscriptions, request.Params.URI) {
			c.subscriptions.resourceSubscriptions = append(
				c.subscriptions.resourceSubscriptions, request.Params.URI)
		}
		return nil
	}
	_, err := c.sendRequest(ctx, string(mcp.MethodResourcesSubscribe), request.Params, outboundHeader(request.Header, request.Method))
	return err
}

// Unsubscribe removes a resource update subscription.
//
// Protocol version 2026-07-28 removed the resources/unsubscribe RPC. On a
// modern connection this method drops the URI from the filter used by the next
// [Client.Listen] call.
//
// Deprecated: close the [Client.Listen] stream, or reopen it with a narrower
// filter.
func (c *Client) Unsubscribe(
	ctx context.Context,
	request mcp.UnsubscribeRequest,
) error {
	if c.isModern() {
		c.subscriptions.mu.Lock()
		defer c.subscriptions.mu.Unlock()
		// Delete copy-on-write. slices.DeleteFunc shifts elements within
		// the existing backing array, which an in-flight Listen may still
		// be serializing, so drop the URI from a clone instead.
		c.subscriptions.resourceSubscriptions = slices.DeleteFunc(
			slices.Clone(c.subscriptions.resourceSubscriptions),
			func(uri string) bool { return uri == request.Params.URI },
		)
		c.subscriptions.filter.ResourceSubscriptions = slices.DeleteFunc(
			slices.Clone(c.subscriptions.filter.ResourceSubscriptions),
			func(uri string) bool { return uri == request.Params.URI },
		)
		return nil
	}
	_, err := c.sendRequest(ctx, string(mcp.MethodResourcesUnsubscribe), request.Params, outboundHeader(request.Header, request.Method))
	return err
}

// PendingSubscriptionFilter returns the filter that the next [Client.Listen]
// call would use, accumulated from [Client.Subscribe] calls.
func (c *Client) PendingSubscriptionFilter() mcp.SubscriptionFilter {
	c.subscriptions.mu.Lock()
	defer c.subscriptions.mu.Unlock()
	filter := c.subscriptions.filter
	filter.ResourceSubscriptions = slices.Clone(filter.ResourceSubscriptions)
	for _, uri := range c.subscriptions.resourceSubscriptions {
		if !slices.Contains(filter.ResourceSubscriptions, uri) {
			filter.ResourceSubscriptions = append(filter.ResourceSubscriptions, uri)
		}
	}
	return filter
}
