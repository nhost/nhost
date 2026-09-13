package serve_test

import (
	"reflect"
	"sync"
	"sync/atomic"
	"testing"

	serveutil "github.com/nhost/nhost/internal/lib/serve"
)

func TestCleanupsCloseRunsInReverseOrder(t *testing.T) {
	t.Parallel()

	var got []string

	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { got = append(got, "first") })
	cleanups.Add(func() { got = append(got, "second") })
	cleanups.Add(func() { got = append(got, "third") })

	cleanups.Close()

	want := []string{"third", "second", "first"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Close order = %v; want %v", got, want)
	}
}

func TestCleanupsConcurrentCloseRunsHooksOnce(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32

	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { calls.Add(1) })

	const callers = 32

	var wg sync.WaitGroup
	wg.Add(callers)

	for range callers {
		go func() {
			defer wg.Done()

			cleanups.Close()
		}()
	}

	wg.Wait()

	if got := calls.Load(); got != 1 {
		t.Errorf("cleanup calls = %d; want 1", got)
	}
}

func TestCleanupsConcurrentAddAndCloseRunsEveryHook(t *testing.T) {
	t.Parallel()

	const iterations = 1000

	for range iterations {
		var calls atomic.Int32

		cleanups := &serveutil.Cleanups{}
		cleanups.Add(func() { calls.Add(1) })

		start := make(chan struct{})

		var wg sync.WaitGroup
		wg.Add(2)

		go func() {
			defer wg.Done()

			<-start
			cleanups.Add(func() { calls.Add(1) })
		}()
		go func() {
			defer wg.Done()

			<-start
			cleanups.Close()
		}()

		close(start)
		wg.Wait()
		cleanups.Close()

		if got := calls.Load(); got != 2 {
			t.Fatalf("cleanup calls = %d; want 2", got)
		}
	}
}

func TestCleanupsAddAfterCloseRunsImmediately(t *testing.T) {
	t.Parallel()

	cleanups := &serveutil.Cleanups{}
	cleanups.Close()

	called := false
	cleanups.Add(func() { called = true })

	if !called {
		t.Error("cleanup added after Close was not run immediately")
	}
}

func TestCleanupsReleaseRunsHooksInReverseOrderWhenNotKept(t *testing.T) {
	t.Parallel()

	var got []string

	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { got = append(got, "first") })
	cleanups.Add(func() { got = append(got, "second") })

	func() {
		keep := false
		defer cleanups.Release(&keep)
	}()

	want := []string{"second", "first"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Release order = %v; want %v", got, want)
	}
}

func TestCleanupsReleaseKeepsHooks(t *testing.T) {
	t.Parallel()

	called := false
	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { called = true })

	func() {
		keep := false
		defer cleanups.Release(&keep)

		keep = true
	}()

	if called {
		t.Error("Release ran a hook marked to keep")
	}

	cleanups.Close()
}

func TestCleanupsCloseWithoutHooksIsNoOp(t *testing.T) {
	t.Parallel()

	cleanups := &serveutil.Cleanups{}
	cleanups.Close()
	cleanups.Close()
}
