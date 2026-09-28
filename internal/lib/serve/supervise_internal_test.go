package serve

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const testShutdownBudget = 2 * time.Second

var (
	errBoom  = errors.New("boom")
	errOther = errors.New("other unit failed")
)

// ctxUnit adapts a function that runs until its context is cancelled into a
// unit whose stop cancels that context.
func ctxUnit(name string, fn func(ctx context.Context) error) unit {
	ctx, cancel := context.WithCancel(context.Background())

	return unit{
		name: name,
		run:  func() error { return fn(ctx) },
		stop: func(context.Context) error {
			cancel()

			return nil
		},
	}
}

func untilCancelled(ctx context.Context) error {
	<-ctx.Done()

	return nil
}

// runGroup starts the tiers, waits for any unit to return, and shuts the group
// down within budget.
func runGroup(t *testing.T, budget time.Duration, tiers ...[]unit) error {
	t.Helper()

	g := startGroup(tiers...)

	select {
	case <-g.stopped():
	case <-time.After(testShutdownBudget):
		t.Fatal("no unit returned on its own")
	}

	ctx, cancel := context.WithTimeout(context.Background(), budget)
	defer cancel()

	return g.shutdown(ctx)
}

func TestGroupReturningUnitStopsPeers(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		run     func(context.Context) error
		wantErr error
	}{
		{
			name:    "a failing unit",
			run:     func(context.Context) error { return errBoom },
			wantErr: errBoom,
		},
		{
			name:    "a unit returning cleanly",
			run:     func(context.Context) error { return nil },
			wantErr: nil,
		},
		{
			name:    "a panicking unit",
			run:     func(context.Context) error { panic("boom") },
			wantErr: ErrServicePanic,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var peerStopped atomic.Bool

			peer := ctxUnit("peer", func(ctx context.Context) error {
				<-ctx.Done()
				peerStopped.Store(true)

				return nil
			})

			err := runGroup(t, testShutdownBudget, []unit{ctxUnit("returning", tt.run), peer})

			if tt.wantErr == nil && err != nil {
				t.Errorf("shutdown err = %v; want nil", err)
			}

			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Errorf("shutdown err = %v; want %v", err, tt.wantErr)
			}

			if tt.wantErr != nil && !strings.Contains(err.Error(), "returning: ") {
				t.Errorf("shutdown err = %q; want it to name the unit", err)
			}

			if !peerStopped.Load() {
				t.Error("peer unit was not stopped when its sibling returned")
			}
		})
	}
}

func TestGroupJoinsErrorsAcrossTiers(t *testing.T) {
	t.Parallel()

	err := runGroup(
		t,
		testShutdownBudget,
		[]unit{ctxUnit("first", func(context.Context) error { return errBoom })},
		[]unit{ctxUnit("second", func(ctx context.Context) error {
			<-ctx.Done()

			return errOther
		})},
	)

	if !errors.Is(err, errBoom) || !errors.Is(err, errOther) {
		t.Errorf("shutdown err = %v; want both %v and %v", err, errBoom, errOther)
	}
}

func TestGroupReportsStopFailures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		stop    func(context.Context) error
		wantErr error
	}{
		{
			name:    "an error",
			stop:    func(context.Context) error { return errBoom },
			wantErr: errBoom,
		},
		{
			name:    "a panic",
			stop:    func(context.Context) error { panic("boom") },
			wantErr: ErrServicePanic,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			stopping := unit{
				name: "listener",
				run:  func() error { return nil },
				stop: tt.stop,
			}

			err := runGroup(t, testShutdownBudget, []unit{stopping})
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("shutdown err = %v; want %v", err, tt.wantErr)
			}

			if !strings.Contains(err.Error(), "stopping listener") {
				t.Errorf("shutdown err = %q; want it to name the unit", err)
			}
		})
	}
}

func TestGroupShutsDownTiersInOrder(t *testing.T) {
	t.Parallel()

	drainerStopped := make(chan struct{})
	allowDrainerReturn := make(chan struct{})
	dependencyStopped := make(chan struct{})

	drainer := ctxUnit("drainer", func(ctx context.Context) error {
		<-ctx.Done()
		close(drainerStopped)
		<-allowDrainerReturn

		return nil
	})
	dependency := ctxUnit("dependency", func(ctx context.Context) error {
		<-ctx.Done()
		close(dependencyStopped)

		return nil
	})

	g := startGroup([]unit{drainer}, []unit{dependency})

	done := make(chan error, 1)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), testShutdownBudget)
		defer cancel()

		done <- g.shutdown(ctx)
	}()

	select {
	case <-drainerStopped:
	case <-time.After(testShutdownBudget):
		t.Fatal("first tier was not stopped in time")
	}

	select {
	case <-dependencyStopped:
		t.Fatal("second tier was stopped before the first tier returned")
	case <-time.After(20 * time.Millisecond):
	}

	close(allowDrainerReturn)

	select {
	case <-dependencyStopped:
	case <-time.After(testShutdownBudget):
		t.Fatal("second tier was not stopped after the first tier returned")
	}

	select {
	case err := <-done:
		if err != nil {
			t.Errorf("shutdown err = %v; want nil on a clean shutdown", err)
		}
	case <-time.After(testShutdownBudget):
		t.Fatal("shutdown did not return after the ordered shutdown")
	}
}

func TestGroupAbandonsStuckTierAndStillStopsLaterTiers(t *testing.T) {
	t.Parallel()

	releaseStuck := make(chan struct{})
	defer close(releaseStuck)

	var laterStopped atomic.Bool

	stuck := ctxUnit("stuck", func(context.Context) error {
		<-releaseStuck

		return nil
	})
	finished := ctxUnit("finished", func(context.Context) error { return nil })
	later := ctxUnit("later", untilCancelled)
	stopLater := later.stop
	later.stop = func(ctx context.Context) error {
		laterStopped.Store(true)

		return stopLater(ctx)
	}

	err := runGroup(t, 20*time.Millisecond, []unit{stuck, finished}, []unit{later})
	if !errors.Is(err, ErrShutdownTimeout) {
		t.Fatalf("shutdown err = %v; want %v", err, ErrShutdownTimeout)
	}

	if msg := err.Error(); !strings.Contains(msg, "stuck still stopping") {
		t.Errorf("shutdown err = %q; want it to name only the stuck unit", msg)
	}

	// With the budget spent, the later tier is asked to stop but not waited for.
	deadline := time.Now().Add(testShutdownBudget)
	for !laterStopped.Load() {
		if time.Now().After(deadline) {
			t.Fatal("later tier was not asked to stop after the earlier tier timed out")
		}

		time.Sleep(time.Millisecond)
	}
}
