package source

import (
	"context"
	"testing"
	"time"
)

// TestListenAndReload_StopsPromptlyOnContextCancel covers the reconnect/backoff
// loop itself (the headline cross-replica sync mechanism): pointed at an
// unreachable database it can never establish a LISTEN, so it is always either
// failing to connect or sitting in its reconnect backoff — never parked in
// WaitForNotification. Cancelling ctx must unwind it promptly (well inside the
// reconnect backoff) and leak neither the goroutine nor its pgx connection.
func TestListenAndReload_StopsPromptlyOnContextCancel(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())

	done := make(chan struct{})
	go func() {
		defer close(done)
		// 127.0.0.1:1 refuses immediately; even if a connect were in flight,
		// pgx.Connect honours ctx, so cancel aborts it either way.
		ListenAndReload(ctx, "postgres://127.0.0.1:1/cstl", &recordingReloader{}, discardLogger())
	}()

	// Let the loop spin at least once and settle into its reconnect backoff.
	time.Sleep(50 * time.Millisecond)
	cancel()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("ListenAndReload did not return within 3s of ctx cancel (leaked goroutine)")
	}
}

// TestListenAndReload_ReturnsImmediatelyWhenAlreadyCancelled asserts the loop
// guard: an already-cancelled context never opens a connection.
func TestListenAndReload_ReturnsImmediatelyWhenAlreadyCancelled(t *testing.T) {
	t.Parallel()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	done := make(chan struct{})
	go func() {
		defer close(done)

		ListenAndReload(ctx, "postgres://127.0.0.1:1/cstl", &recordingReloader{}, discardLogger())
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("ListenAndReload did not return for an already-cancelled ctx")
	}
}
