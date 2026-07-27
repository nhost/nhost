package oidc

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

var errUpstreamDown = errors.New("upstream down")

func TestLazyMemoDetachesBuildFromCallerContext(t *testing.T) {
	t.Parallel()

	memo := newLazyMemo(func(ctx context.Context) (string, error) {
		if err := ctx.Err(); err != nil {
			return "", fmt.Errorf("build context: %w", err)
		}

		return "built", nil
	})

	ctx, cancel := context.WithCancel(t.Context())
	cancel()

	// A caller whose context is already cancelled must neither fail the
	// build nor poison the shared negative cache for subsequent callers.
	got, err := memo.get(ctx)
	if err != nil {
		t.Fatalf("expected the build to succeed on a detached context, got: %v", err)
	}

	if got != "built" {
		t.Fatalf("unexpected value: %q", got)
	}

	if _, err := memo.get(t.Context()); err != nil {
		t.Fatalf("expected the memoized value for a subsequent caller, got: %v", err)
	}
}

func TestLazyMemoWaiterRespectsItsOwnContext(t *testing.T) {
	t.Parallel()

	release := make(chan struct{})
	started := make(chan struct{})

	memo := newLazyMemo(func(_ context.Context) (string, error) {
		close(started)
		<-release

		return "built", nil
	})

	builderDone := make(chan struct{})

	go func() {
		defer close(builderDone)

		if _, err := memo.get(context.Background()); err != nil {
			t.Errorf("unexpected build error: %v", err)
		}
	}()

	<-started

	// A second caller arriving mid-build must not park behind it once its own
	// request is gone: a blackholing IdP would otherwise accumulate one
	// goroutine per inbound request for the whole build window.
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()

	returned := make(chan error, 1)

	go func() {
		_, err := memo.get(cancelled)
		returned <- err
	}()

	select {
	case err := <-returned:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("expected context.Canceled, got: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("a cancelled waiter parked on the in-flight build")
	}

	close(release)
	<-builderDone
}

func TestLazyMemoBuildsOnceForConcurrentCallers(t *testing.T) {
	t.Parallel()

	var builds atomic.Int64

	release := make(chan struct{})
	memo := newLazyMemo(func(_ context.Context) (string, error) {
		builds.Add(1)
		<-release

		return "built", nil
	})

	const callers = 8

	var wg sync.WaitGroup

	wg.Add(callers)

	for range callers {
		go func() {
			defer wg.Done()

			if _, err := memo.get(context.Background()); err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		}()
	}

	// Let every caller reach the memo before the single build completes.
	time.Sleep(50 * time.Millisecond)
	close(release)
	wg.Wait()

	if got := builds.Load(); got != 1 {
		t.Fatalf("expected exactly one build for %d callers, got %d", callers, got)
	}
}

func TestLazyMemoNegativeCachesBuildFailures(t *testing.T) {
	t.Parallel()

	calls := 0
	memo := newLazyMemo(func(_ context.Context) (string, error) {
		calls++
		return "", errUpstreamDown
	})

	if _, err := memo.get(t.Context()); !errors.Is(err, errUpstreamDown) {
		t.Fatalf("expected the build error, got: %v", err)
	}

	// Within the backoff window the cached error is served without a rebuild.
	if _, err := memo.get(t.Context()); !errors.Is(err, errUpstreamDown) {
		t.Fatalf("expected the cached error, got: %v", err)
	}

	if calls != 1 {
		t.Fatalf("expected a single build attempt, got %d", calls)
	}
}

// TestLazyMemoSurvivesPanickingBuild pins the single-flight bookkeeping
// against a build that panics: the slot must be released, the panic must
// land in the negative cache like any other failure, and a later get must be
// able to build successfully instead of parking forever on a channel nobody
// closed.
func TestLazyMemoSurvivesPanickingBuild(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32

	memo := newLazyMemo(func(_ context.Context) (string, error) {
		if calls.Add(1) == 1 {
			panic("jwks parser exploded")
		}

		return "built", nil
	})

	_, err := memo.get(t.Context())
	if !errors.Is(err, ErrBuildPanic) {
		t.Fatalf("expected ErrBuildPanic, got: %v", err)
	}

	// The panic is negative-cached with the usual backoff, so clear it the
	// same way the other failure tests do before retrying.
	memo.mu.Lock()
	memo.nextRetry = time.Time{}
	memo.mu.Unlock()

	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()

	value, err := memo.get(ctx)
	if err != nil {
		t.Fatalf("expected the retry to build, got: %v", err)
	}

	if value != "built" {
		t.Errorf("expected %q, got %q", "built", value)
	}
}
