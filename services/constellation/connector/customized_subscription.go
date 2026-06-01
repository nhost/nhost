package connector

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"log/slog"
	"time"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/subscription"
	"github.com/vektah/gqlparser/v2/ast"
)

// subscriptionCapable mirrors the controller's optional subscription interface
// so a customizedConnector can detect whether its wrapped connector serves
// subscriptions and, if so, forward the capability.
type subscriptionCapable interface {
	NewSubscriptionHandler(
		pollingInterval time.Duration,
		logger *slog.Logger,
	) subscription.Handler
}

// NewSubscriptionHandler forwards the wrapped connector's subscription
// capability, decorating the returned handler so subscription operations are
// reversed to native names and streamed updates are reshaped back into
// customized form. It returns nil when the wrapped connector does not serve
// subscriptions (e.g. remote schemas), which buildState treats as "no handler".
func (c *customizedConnector) NewSubscriptionHandler( //nolint:ireturn,nolintlint
	pollingInterval time.Duration,
	logger *slog.Logger,
) subscription.Handler {
	inner, ok := c.inner.(subscriptionCapable)
	if !ok {
		return nil
	}

	return &customizedSubscriptionHandler{
		inner:      inner.NewSubscriptionHandler(pollingInterval, logger),
		customizer: c.customizer,
	}
}

// customizedSubscriptionHandler decorates a subscription.Handler with the same
// customization the connector applies to queries: the incoming operation is
// reversed to the connector's native schema before Start, and every streamed
// update's data is reshaped back into customized form (namespace re-wrapped,
// __typename re-mapped).
type customizedSubscriptionHandler struct {
	inner      subscription.Handler
	customizer *customization.Customizer
}

func (h *customizedSubscriptionHandler) Start(
	ctx context.Context,
	req subscription.Request,
	logger *slog.Logger,
) (<-chan subscription.Update, error) {
	// Keep the customized operation for reshaping updates; run the native one.
	customizedOp, customizedFragments := req.Operation, req.Fragments

	nativeOp, nativeFragments := h.customizer.ReverseOperation(req.Operation, req.Fragments)

	nativeReq := req
	nativeReq.Operation = nativeOp
	nativeReq.Fragments = nativeFragments

	innerCh, err := h.inner.Start(ctx, nativeReq, logger)
	if err != nil {
		return nil, fmt.Errorf("starting customized subscription: %w", err)
	}

	out := make(chan subscription.Update, 1)
	go h.forward(innerCh, out, customizedOp, customizedFragments, logger)

	return out, nil
}

func (h *customizedSubscriptionHandler) Stop(ctx context.Context, subscriptionID string) {
	h.inner.Stop(ctx, subscriptionID)
}

func (h *customizedSubscriptionHandler) Shutdown(ctx context.Context) {
	h.inner.Shutdown(ctx)
}

// forward reshapes each update from the inner handler and relays it. It ranges
// the inner channel (which the inner handler closes on Stop/Shutdown/teardown)
// and uses a non-blocking, drop-oldest send so it never blocks if the consumer
// has stopped reading — mirroring the cohort's buffered(1) latest-wins
// semantics and keeping the goroutine leak-free.
func (h *customizedSubscriptionHandler) forward(
	in <-chan subscription.Update,
	out chan subscription.Update,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
	logger *slog.Logger,
) {
	defer close(out)

	for update := range in {
		if update.Error == nil && len(update.Data) > 0 {
			reshaped, err := h.reshape(update.Data, operation, fragments)
			if err != nil {
				logger.Error("reshaping customized subscription update", slog.Any("error", err))

				update = subscription.NewUpdateError(update.SubscriptionID, err)
			} else {
				update = subscription.NewUpdateData(update.SubscriptionID, reshaped)
			}
		}

		sendLatest(out, update)
	}
}

// reshape re-shapes a native update payload into customized form: it decodes
// the data object, re-wraps the namespace and re-maps __typename via the
// customizer, and re-encodes.
func (h *customizedSubscriptionHandler) reshape(
	data jsontext.Value,
	operation *ast.OperationDefinition,
	fragments ast.FragmentDefinitionList,
) (jsontext.Value, error) {
	var native map[string]any
	if err := json.Unmarshal(data, &native); err != nil {
		return nil, fmt.Errorf("decoding subscription data: %w", err)
	}

	reshaped := h.customizer.ForwardResult(native, operation, fragments)

	encoded, err := json.Marshal(reshaped)
	if err != nil {
		return nil, fmt.Errorf("encoding reshaped subscription data: %w", err)
	}

	return encoded, nil
}

// sendLatest performs a non-blocking, drop-oldest send so a slow or departed
// consumer never blocks the forwarding goroutine.
func sendLatest(out chan subscription.Update, update subscription.Update) {
	select {
	case out <- update:
		return
	default:
	}

	// Buffer full: discard the stale update and enqueue the latest.
	select {
	case <-out:
	default:
	}

	select {
	case out <- update:
	default:
	}
}
