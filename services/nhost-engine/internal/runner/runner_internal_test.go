package runner

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

var errBoom = errors.New("boom")

func TestSuperviseCancelsPeersOnError(t *testing.T) {
	t.Parallel()

	wantErr := errBoom

	var peerCancelled atomic.Bool

	failing := func(_ context.Context) error {
		return wantErr
	}

	peer := func(ctx context.Context) error {
		<-ctx.Done()
		peerCancelled.Store(true)

		return nil
	}

	err := Supervise(context.Background(), []Service{failing, peer})
	if !errors.Is(err, wantErr) {
		t.Errorf("Supervise err = %v; want %v", err, wantErr)
	}

	if !peerCancelled.Load() {
		t.Error("peer service was not cancelled when its sibling failed")
	}
}

func TestSuperviseRecoversPanickingService(t *testing.T) {
	t.Parallel()

	var peerCancelled atomic.Bool

	panicking := func(_ context.Context) error {
		panic("boom")
	}

	peer := func(ctx context.Context) error {
		<-ctx.Done()
		peerCancelled.Store(true)

		return nil
	}

	// A panicking service must surface as a joined error rather than crash the
	// whole engine, and its siblings must still be torn down gracefully.
	err := Supervise(context.Background(), []Service{panicking, peer})
	if !errors.Is(err, ErrServicePanic) {
		t.Errorf("Supervise err = %v; want %v", err, ErrServicePanic)
	}

	if !peerCancelled.Load() {
		t.Error("peer service was not cancelled when its sibling panicked")
	}
}

func TestSuperviseShutsDownOnContextCancel(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())

	var started atomic.Int32

	svc := func(ctx context.Context) error { //nolint:unparam // signature must match runner.Service
		started.Add(1)
		<-ctx.Done()

		return nil
	}

	done := make(chan error, 1)
	go func() { done <- Supervise(ctx, []Service{svc, svc}) }()

	// Give both services a moment to start, then trigger shutdown.
	deadline := time.After(2 * time.Second)

	for started.Load() < 2 {
		select {
		case <-deadline:
			t.Fatal("services did not start in time")
		default:
			time.Sleep(time.Millisecond)
		}
	}

	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("Supervise err = %v; want nil on clean shutdown", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Supervise did not return after context cancellation")
	}
}
