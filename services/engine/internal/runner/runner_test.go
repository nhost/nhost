package runner_test

import (
	"context"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/services/engine/internal/runner"
)

var (
	errBoom  = errors.New("boom")
	errOther = errors.New("other service failed")
)

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

	err := runner.Supervise(context.Background(), []runner.Service{failing, peer})
	if !errors.Is(err, wantErr) {
		t.Errorf("Supervise err = %v; want %v", err, wantErr)
	}

	if !peerCancelled.Load() {
		t.Error("peer service was not cancelled when its sibling failed")
	}
}

func TestSuperviseJoinsServiceErrors(t *testing.T) {
	t.Parallel()

	var ready sync.WaitGroup
	ready.Add(2)

	failingService := func(serviceErr error) runner.Service {
		return func(_ context.Context) error {
			ready.Done()
			ready.Wait()

			return serviceErr
		}
	}

	err := runner.Supervise(context.Background(), []runner.Service{
		failingService(errBoom),
		failingService(errOther),
	})

	for _, wantErr := range []error{errBoom, errOther} {
		if !errors.Is(err, wantErr) {
			t.Errorf("runner.Supervise err = %v; want joined error to contain %v", err, wantErr)
		}
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
	err := runner.Supervise(context.Background(), []runner.Service{panicking, peer})
	if !errors.Is(err, runner.ErrServicePanic) {
		t.Errorf("Supervise err = %v; want %v", err, runner.ErrServicePanic)
	}

	if !strings.Contains(err.Error(), "TestSuperviseRecoversPanickingService") {
		t.Errorf("Supervise err = %v; want panic stack with test function", err)
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
	go func() { done <- runner.Supervise(ctx, []runner.Service{svc, svc}) }()

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

func TestSuperviseShutsDownTiersInOrder(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())

	drainerStarted := make(chan struct{})
	drainerCancelled := make(chan struct{})
	allowDrainerReturn := make(chan struct{})

	drainer := func(ctx context.Context) error { //nolint:unparam // signature must match runner.Service
		close(drainerStarted)
		<-ctx.Done()
		close(drainerCancelled)
		<-allowDrainerReturn

		return nil
	}

	dependencyStarted := make(chan struct{})
	dependencyCancelled := make(chan struct{})

	dependency := func(ctx context.Context) error { //nolint:unparam // signature must match runner.Service
		close(dependencyStarted)
		<-ctx.Done()
		close(dependencyCancelled)

		return nil
	}

	done := make(chan error, 1)
	go func() {
		done <- runner.Supervise(
			ctx,
			[]runner.Service{drainer},
			[]runner.Service{dependency},
		)
	}()

	for name, started := range map[string]<-chan struct{}{
		"drainer":    drainerStarted,
		"dependency": dependencyStarted,
	} {
		select {
		case <-started:
		case <-time.After(2 * time.Second):
			t.Fatalf("%s did not start in time", name)
		}
	}

	cancel()

	select {
	case <-drainerCancelled:
	case <-time.After(2 * time.Second):
		t.Fatal("draining tier was not cancelled in time")
	}

	select {
	case <-dependencyCancelled:
		t.Fatal("dependency tier was cancelled before draining tier returned")
	default:
	}

	close(allowDrainerReturn)

	select {
	case <-dependencyCancelled:
	case <-time.After(2 * time.Second):
		t.Fatal("dependency tier was not cancelled after draining tier returned")
	}

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("Supervise err = %v; want nil on clean shutdown", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Supervise did not return after ordered shutdown")
	}
}
