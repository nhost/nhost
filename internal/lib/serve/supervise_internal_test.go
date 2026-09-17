package serve

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestSuperviseTimesOutStuckTierAndCancelsLaterTiers(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	stuckStarted := make(chan struct{})
	releaseStuck := make(chan struct{})

	var laterTierCancelled atomic.Bool

	stuck := func(context.Context) error { //nolint:unparam // signature must match SupervisedService
		close(stuckStarted)
		<-releaseStuck

		return nil
	}
	laterTier := func(ctx context.Context) error { //nolint:unparam // signature must match SupervisedService
		<-ctx.Done()
		laterTierCancelled.Store(true)

		return nil
	}

	done := make(chan error, 1)
	go func() {
		done <- Supervise(ctx, 20*time.Millisecond, []SupervisedService{stuck}, []SupervisedService{laterTier})
	}()

	<-stuckStarted
	cancel()

	select {
	case err := <-done:
		if !errors.Is(err, errShutdownTimeout) {
			t.Fatalf("supervise err = %v; want %v", err, errShutdownTimeout)
		}
	case <-time.After(time.Second):
		t.Fatal("supervise did not return after the tier shutdown timeout")
	}

	if !laterTierCancelled.Load() {
		t.Error("later tier was not cancelled after the earlier tier timed out")
	}

	close(releaseStuck)
}
