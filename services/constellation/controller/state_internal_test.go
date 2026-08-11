package controller

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/connector"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/metadata"
	metadatamock "github.com/nhost/nhost/services/constellation/metadata/mock"
	"github.com/nhost/nhost/services/constellation/subscription"
	subscriptionmock "github.com/nhost/nhost/services/constellation/subscription/mock"
	"go.uber.org/mock/gomock"
)

// --- controllerState tests ------------------------------------------------

func TestControllerState_Shutdown(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	h1 := subscriptionmock.NewMockHandler(ctrl)
	h1.EXPECT().Shutdown(gomock.Any())

	h2 := subscriptionmock.NewMockHandler(ctrl)
	h2.EXPECT().Shutdown(gomock.Any())

	state := &controllerState{
		subHandlers: map[string]subscription.Handler{
			"db1": h1,
			"db2": h2,
		},
		done: make(chan struct{}),
	}

	state.shutdown(context.Background())
}

func TestControllerState_Shutdown_NilHandler(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	h := subscriptionmock.NewMockHandler(ctrl)
	h.EXPECT().Shutdown(gomock.Any())

	state := &controllerState{
		subHandlers: map[string]subscription.Handler{
			"db1": nil,
			"db2": h,
		},
		done: make(chan struct{}),
	}

	// Should not panic on nil handler.
	state.shutdown(context.Background())
}

func TestControllerState_CloseConnectors(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	conn1 := connectormock.NewMockConnector(ctrl)
	conn1.EXPECT().Close()

	conn2 := connectormock.NewMockConnector(ctrl)
	conn2.EXPECT().Close()

	state := &controllerState{
		connectors: map[string]connector.Connector{
			"db1": conn1,
			"db2": conn2,
		},
	}

	state.closeConnectors()
}

// --- swapState tests ------------------------------------------------------

func TestSwapState(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	oldHandler := subscriptionmock.NewMockHandler(ctrl)
	shutdownDone := make(chan struct{})
	oldHandler.EXPECT().Shutdown(gomock.Any()).Do(func(_ context.Context) {
		close(shutdownDone)
	})

	oldConn := connectormock.NewMockConnector(ctrl)
	oldConn.EXPECT().Close()

	oldState := &controllerState{
		subHandlers: map[string]subscription.Handler{"db": oldHandler},
		connectors:  map[string]connector.Connector{"db": oldConn},
		done:        make(chan struct{}),
	}

	newState := &controllerState{
		done: make(chan struct{}),
	}

	c := &Controller{
		logger: slog.Default(),
	}
	c.state.Store(oldState)

	c.swapState(t.Context(), newState, slog.Default())

	if c.state.Load() != newState {
		t.Error("state should have been swapped")
	}

	// Wait for background goroutine to call Shutdown.
	select {
	case <-shutdownDone:
	case <-time.After(2 * time.Second):
		t.Fatal("old handler Shutdown was not called in time")
	}
}

// --- Run tests ------------------------------------------------------------

func TestRun_FileSource_ShutdownOnCancel(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	handler := subscriptionmock.NewMockHandler(ctrl)
	handler.EXPECT().Shutdown(gomock.Any())

	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().Close()

	state := &controllerState{
		subHandlers: map[string]subscription.Handler{"db": handler},
		connectors:  map[string]connector.Connector{"db": conn},
		done:        make(chan struct{}),
	}

	// Simulate a file source whose Watch channel is already closed.
	source := metadatamock.NewMockSource(ctrl)
	ch := make(chan metadata.Update)
	close(ch)
	source.EXPECT().Watch(gomock.Any()).Return(ch)

	c := &Controller{
		source: source,
		logger: slog.Default(),
	}

	// Pre-store state so shutdownState tears it down.
	c.state.Store(state)

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		c.Run(ctx, slog.Default())
		close(done)
	}()

	cancel()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after context cancellation")
	}
}

func TestRun_WithSource_ShutdownOnClose(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	handler := subscriptionmock.NewMockHandler(ctrl)
	handler.EXPECT().Shutdown(gomock.Any())

	state := &controllerState{
		subHandlers: map[string]subscription.Handler{"db": handler},
		connectors:  map[string]connector.Connector{},
		done:        make(chan struct{}),
	}

	ch := make(chan metadata.Update)
	source := metadatamock.NewMockSource(ctrl)
	source.EXPECT().Watch(gomock.Any()).Return(ch)

	c := &Controller{
		source: source,
		logger: slog.Default(),
	}
	c.state.Store(state)

	done := make(chan struct{})
	go func() {
		c.Run(context.Background(), slog.Default())
		close(done)
	}()

	// Close the source — Run should return.
	close(ch)

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after source closed")
	}
}

// TestRun_SuccessfulReloadSwapsStateAndClosesOldConnectors exercises the
// happy-path metadata-reload branch of Run end-to-end: a successful update
// drains through the Watch channel, buildState produces a fresh state, the
// pointer is swapped, the old state's done channel is closed, and the old
// connectors are closed in the background. The error branch is covered by
// TestRun_ReloadErrorKeepsCurrentState in controller_test.go; the swap
// mechanics on their own are covered by TestSwapState. This test bridges
// them by going through Run itself.
func TestRun_SuccessfulReloadSwapsStateAndClosesOldConnectors(t *testing.T) {
	t.Parallel()

	gomockCtrl := gomock.NewController(t)

	// Old state: one subscription handler + one connector we expect to be
	// shut down + closed when the reload swap happens.
	oldHandler := subscriptionmock.NewMockHandler(gomockCtrl)
	oldShutdown := make(chan struct{})
	oldHandler.EXPECT().Shutdown(gomock.Any()).Do(func(_ context.Context) {
		close(oldShutdown)
	})

	oldConn := connectormock.NewMockConnector(gomockCtrl)
	oldClose := make(chan struct{})
	oldConn.EXPECT().Close().Do(func() {
		close(oldClose)
	})

	oldState := &controllerState{
		validatedSchemas:           nil,
		connectors:                 map[string]connector.Connector{"db": oldConn},
		fieldToConnector:           nil,
		metadata:                   nil,
		remoteRelationshipResolver: nil,
		queryPlanner:               nil,
		subHandlers:                map[string]subscription.Handler{"db": oldHandler},
		queryCache:                 nil,
		done:                       make(chan struct{}),
	}

	// Source: deliver one successful update with empty metadata, then block.
	// Empty metadata builds a no-op state — buildState succeeds with no
	// connectors and no subscription handlers, which is all we need to
	// observe the swap.
	updates := make(chan metadata.Update, 1)
	updates <- metadata.Update{
		Metadata: &metadata.Metadata{Databases: nil, RemoteSchemas: nil},
		Err:      nil,
	}

	source := metadatamock.NewMockSource(gomockCtrl)
	source.EXPECT().Watch(gomock.Any()).Return(updates)

	c := &Controller{
		adminSecret:     "",
		jwtAuth:         nil,
		pollingInterval: 0,
		logger:          slog.Default(),
		source:          source,
	}
	c.state.Store(oldState)

	// Final state-shutdown of whatever state is current at Run exit. We don't
	// know in advance whether it'll be the old state (no swap happened) or
	// the new state (swap happened) — the test asserts on the swap below, so
	// we set up the second state to allow either. Since the swap *should*
	// occur, the post-swap state has nil subHandlers + nil connectors and
	// requires no extra mocks for shutdownState.

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		c.Run(ctx, slog.Default())
		close(done)
	}()

	// Wait for the background goroutine to invoke Shutdown and Close on the
	// old state's mocks. swapState runs them asynchronously after Swap, so a
	// bounded wait is the safe assertion.
	select {
	case <-oldShutdown:
	case <-time.After(2 * time.Second):
		t.Fatal("old state Shutdown was not invoked after successful reload")
	}

	select {
	case <-oldClose:
	case <-time.After(2 * time.Second):
		t.Fatal("old connector Close was not invoked after successful reload")
	}

	// The state pointer must reference a different state object.
	if c.state.Load() == oldState {
		t.Fatal("controller state was not swapped after successful reload")
	}

	// The old state's done channel must be closed (signals snapshotted
	// WebSocket connections to drop).
	select {
	case <-oldState.done:
	default:
		t.Fatal("old state done channel was not closed on reload")
	}

	cancel()
	// Close the update channel so the Run goroutine's range loop terminates;
	// cancelling the context alone doesn't stop the mock Watch channel.
	close(updates)

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Run did not return after context cancel")
	}
}
