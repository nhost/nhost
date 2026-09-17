package serve_test

import (
	"context"
	"errors"
	"syscall"
	"testing"
	"time"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

const signalWaitTimeout = 2 * time.Second

// waitCancelled fails the test unless ctx is cancelled before the timeout.
func waitCancelled(ctx context.Context, t *testing.T, what string) {
	t.Helper()

	select {
	case <-ctx.Done():
		if !errors.Is(ctx.Err(), context.Canceled) {
			t.Errorf("ctx.Err() after %s = %v; want context.Canceled", what, ctx.Err())
		}
	case <-time.After(signalWaitTimeout):
		t.Fatalf("context was not cancelled within %v of %s", signalWaitTimeout, what)
	}
}

// TestSignalContextCancelsOnTerminationSignal sends the real signal to this
// process, so it fails loudly if SignalContext ever stops registering one of
// them: the default disposition kills the test binary outright.
//
// The subtests must stay sequential, and must run before any parallel test in
// this package resumes, because the signal reaches every context registered so
// far. Go already guarantees that ordering for tests that do not call
// t.Parallel.
//
//nolint:paralleltest // Sequential by design; see above.
func TestSignalContextCancelsOnTerminationSignal(t *testing.T) {
	//nolint:paralleltest // Sequential by design; see the test function's comment.
	for _, tc := range []struct {
		name string
		sig  syscall.Signal
	}{
		// SignalContext registers os.Interrupt, which is SIGINT on unix.
		{name: "SIGINT", sig: syscall.SIGINT},
		{name: "SIGTERM", sig: syscall.SIGTERM},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := serveutil.SignalContext(context.Background())

			select {
			case <-ctx.Done():
				t.Fatal("context was cancelled before any signal was delivered")
			default:
			}

			if err := syscall.Kill(syscall.Getpid(), tc.sig); err != nil {
				t.Fatalf("sending %v to self: %v", tc.sig, err)
			}

			waitCancelled(ctx, t, tc.name)
		})
	}
}

func TestSignalContextPropagatesParentCancellation(t *testing.T) {
	t.Parallel()

	parent, cancelParent := context.WithCancel(context.Background())

	ctx := serveutil.SignalContext(parent)

	select {
	case <-ctx.Done():
		t.Fatal("context was cancelled before the parent was")
	default:
	}

	cancelParent()

	waitCancelled(ctx, t, "parent cancellation")
}
