package serve_test

import (
	"context"
	"errors"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

var errBackground = errors.New("background failed")

func TestServiceRunBackgroundNilBlocksUntilCancel(t *testing.T) {
	t.Parallel()

	svc := &serveutil.Service{}

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan error, 1)
	go func() { done <- svc.RunBackground(ctx) }()

	// With no Background hook the call must block, not return early.
	select {
	case err := <-done:
		t.Fatalf("RunBackground returned before cancellation: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("RunBackground err = %v; want nil after cancellation", err)
		}
	case <-time.After(time.Second):
		t.Fatal("RunBackground did not return after context cancellation")
	}
}

func TestServiceRunBackgroundDelegates(t *testing.T) {
	t.Parallel()

	wantErr := errBackground

	var called bool

	svc := &serveutil.Service{
		Background: func(_ context.Context) error {
			called = true

			return wantErr
		},
	}

	err := svc.RunBackground(context.Background())

	if !called {
		t.Error("RunBackground did not invoke the Background hook")
	}

	if !errors.Is(err, wantErr) {
		t.Errorf("RunBackground err = %v; want %v", err, wantErr)
	}
}

func TestServiceShutdownNilIsNoOp(t *testing.T) {
	t.Parallel()

	svc := &serveutil.Service{}

	// Must not panic when there is nothing to release.
	svc.Shutdown()
}

func TestServiceShutdownInvokesClose(t *testing.T) {
	t.Parallel()

	var closed bool

	svc := &serveutil.Service{
		Close: func() { closed = true },
	}

	svc.Shutdown()

	if !closed {
		t.Error("Shutdown did not invoke the Close hook")
	}
}
