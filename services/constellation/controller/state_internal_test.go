package controller

import (
	"context"
	"log/slog"
	"runtime"
	"sync"
	"sync/atomic"
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

func TestSwapState_WaitsForInflightRequestBeforeClosingConnectors(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	closed := make(chan struct{})
	oldConn := connectormock.NewMockConnector(ctrl)
	oldConn.EXPECT().Close().Do(func() { close(closed) })

	oldState := &controllerState{
		connectors: map[string]connector.Connector{"db": oldConn},
		done:       make(chan struct{}),
	}

	c := &Controller{logger: slog.Default()}
	c.state.Store(oldState)

	state, release := c.acquireState()
	if state != oldState {
		t.Fatal("acquireState did not return the current state")
	}

	c.swapState(t.Context(), &controllerState{done: make(chan struct{})}, slog.Default())

	select {
	case <-closed:
		t.Fatal("old connectors were closed while a request still held the state")
	case <-time.After(100 * time.Millisecond):
	}

	release()

	select {
	case <-closed:
	case <-time.After(2 * time.Second):
		t.Fatal("old connectors were not closed after the request released the state")
	}
}

func TestSwapState_ClosesConnectorsWhenDrainTimesOut(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	closed := make(chan struct{})
	oldConn := connectormock.NewMockConnector(ctrl)
	oldConn.EXPECT().Close().Do(func() { close(closed) })

	oldState := &controllerState{
		connectors: map[string]connector.Connector{"db": oldConn},
		done:       make(chan struct{}),
	}

	c := &Controller{logger: slog.Default()}
	c.state.Store(oldState)

	_, release := c.acquireState()
	defer release()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	c.swapState(ctx, &controllerState{done: make(chan struct{})}, slog.Default())

	select {
	case <-closed:
	case <-time.After(2 * time.Second):
		t.Fatal("old connectors were not closed after the drain deadline passed")
	}
}

func TestShutdownState_WaitsForInflightRequestBeforeClosingConnectors(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)

	closed := make(chan struct{})
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().Close().Do(func() { close(closed) })

	state := &controllerState{
		connectors: map[string]connector.Connector{"db": conn},
		done:       make(chan struct{}),
	}

	c := &Controller{logger: slog.Default()}
	c.state.Store(state)

	_, release := c.acquireState()

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	go c.shutdownState(ctx, slog.Default())

	select {
	case <-closed:
		t.Fatal("connectors were closed on shutdown while a request still held the state")
	case <-time.After(100 * time.Millisecond):
	}

	release()

	select {
	case <-closed:
	case <-time.After(2 * time.Second):
		t.Fatal("connectors were not closed on shutdown after the request released the state")
	}
}

func TestControllerState_WaitIdle(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		inflight int64
		timeout  time.Duration
		release  bool
	}{
		{
			name:     "returns immediately when no request holds the state",
			inflight: 0,
			timeout:  time.Minute,
			release:  false,
		},
		{
			name:     "returns once the last request releases the state",
			inflight: 1,
			timeout:  time.Minute,
			release:  true,
		},
		{
			name:     "returns when the context ends with requests still in flight",
			inflight: 1,
			timeout:  50 * time.Millisecond,
			release:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			state := &controllerState{}
			state.inflight.Store(tt.inflight)

			ctx, cancel := context.WithTimeout(t.Context(), tt.timeout)
			defer cancel()

			if tt.release {
				time.AfterFunc(20*time.Millisecond, func() { state.inflight.Add(-1) })
			}

			returned := make(chan struct{})

			go func() {
				state.waitIdle(ctx)
				close(returned)
			}()

			select {
			case <-returned:
			case <-time.After(2 * time.Second):
				t.Fatal("waitIdle did not return")
			}
		})
	}
}

func TestAcquireState_ConcurrentReloadsNeverExposeClosedConnectors(t *testing.T) {
	t.Parallel()

	const (
		reloads  = 50
		requests = 8
	)

	ctrl := gomock.NewController(t)
	logger := slog.New(slog.DiscardHandler)

	states := make([]*controllerState, reloads+1)
	closed := make(map[*controllerState]*atomic.Bool, reloads+1)

	for i := range states {
		flag := &atomic.Bool{}
		conn := connectormock.NewMockConnector(ctrl)
		conn.EXPECT().Close().Do(func() { flag.Store(true) }).MaxTimes(1)

		states[i] = &controllerState{
			connectors: map[string]connector.Connector{"db": conn},
			done:       make(chan struct{}),
		}
		closed[states[i]] = flag
	}

	c := &Controller{logger: logger}
	c.state.Store(states[0])

	stop := make(chan struct{})

	var wg sync.WaitGroup

	for range requests {
		wg.Go(func() {
			for {
				select {
				case <-stop:
					return
				default:
				}

				state, release := c.acquireState()
				if closed[state].Load() {
					t.Error("request acquired a state whose connectors were closed")
				}

				runtime.Gosched()

				if closed[state].Load() {
					t.Error("connectors were closed while a request held the state")
				}

				release()
			}
		})
	}

	for _, state := range states[1:] {
		c.swapState(t.Context(), state, logger)
		runtime.Gosched()
	}

	close(stop)
	wg.Wait()

	deadline := time.Now().Add(5 * time.Second)

	for _, state := range states[:reloads] {
		for !closed[state].Load() {
			if time.Now().After(deadline) {
				t.Fatal("old state connectors were not closed after all requests finished")
			}

			time.Sleep(time.Millisecond)
		}
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
