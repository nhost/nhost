package serve_test

import (
	"context"
	"errors"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

var (
	errBackground = errors.New("background failed")
	errShutdown   = errors.New("shutdown failed")
)

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

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	done := make(chan error, 1)
	go func() { done <- svc.RunBackground(ctx) }()

	select {
	case err := <-done:
		if !called {
			t.Error("RunBackground did not invoke the Background hook")
		}

		if !errors.Is(err, wantErr) {
			t.Errorf("RunBackground err = %v; want %v", err, wantErr)
		}
	case <-time.After(time.Second):
		cancel()
		t.Fatal("RunBackground did not delegate before the deadline")
	}
}

func TestServiceRunBackgroundPassesCallerContext(t *testing.T) {
	t.Parallel()

	type ctxKey struct{}

	ctx, cancel := context.WithCancel(
		context.WithValue(context.Background(), ctxKey{}, "sentinel"),
	)
	defer cancel()

	var gotValue any

	svc := &serveutil.Service{
		Background: func(ctx context.Context) error {
			gotValue = ctx.Value(ctxKey{})
			<-ctx.Done()

			return ctx.Err()
		},
	}

	done := make(chan error, 1)
	go func() { done <- svc.RunBackground(ctx) }()

	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, context.Canceled) {
			t.Errorf("RunBackground err = %v; want context.Canceled", err)
		}
	case <-time.After(time.Second):
		t.Fatal("RunBackground did not receive caller cancellation")
	}

	if gotValue != "sentinel" {
		t.Errorf("Background received ctx value %v; want %q", gotValue, "sentinel")
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

func TestServiceShutdownMayRunBeforeBackgroundReturns(t *testing.T) {
	t.Parallel()

	started := make(chan struct{})
	allowReturn := make(chan struct{})
	backgroundDone := make(chan error, 1)
	closeCalled := make(chan struct{})

	svc := &serveutil.Service{
		Background: func(_ context.Context) error {
			close(started)
			<-allowReturn

			return nil
		},
		Close: func() { close(closeCalled) },
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()

	go func() {
		backgroundDone <- svc.RunBackground(ctx)
	}()

	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal("Background did not start before the deadline")
	}

	svc.Shutdown()

	select {
	case <-closeCalled:
	default:
		t.Fatal("Shutdown did not invoke Close while Background was running")
	}

	select {
	case err := <-backgroundDone:
		t.Fatalf("Background returned before the test released it: %v", err)
	default:
	}

	close(allowReturn)

	select {
	case err := <-backgroundDone:
		if err != nil {
			t.Errorf("RunBackground err = %v; want nil", err)
		}
	case <-time.After(time.Second):
		t.Fatal("Background did not return after being released")
	}
}
