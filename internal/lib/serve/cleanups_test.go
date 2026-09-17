package serve_test

import (
	"errors"
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

var errConstruction = errors.New("construction failed")

// construct mirrors the fallible-construction pattern documented on Cleanups:
// the named error result alone decides whether the acquired hooks are released.
func construct(cleanups *serveutil.Cleanups, failure error) (err error) {
	defer func() {
		if err != nil {
			cleanups.Close()
		}
	}()

	return failure
}

func TestCleanupsConstructionFailureRunsHooksInReverseOrder(t *testing.T) {
	t.Parallel()

	var got []string

	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { got = append(got, "first") })
	cleanups.Add(func() { got = append(got, "second") })

	if err := construct(cleanups, errConstruction); !errors.Is(err, errConstruction) {
		t.Fatalf("construct() = %v; want %v", err, errConstruction)
	}

	want := []string{"second", "first"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("release order = %v; want %v", got, want)
	}
}

func TestCleanupsConstructionSuccessKeepsHooks(t *testing.T) {
	t.Parallel()

	called := false
	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { called = true })

	if err := construct(cleanups, nil); err != nil {
		t.Fatalf("construct() = %v; want nil", err)
	}

	if called {
		t.Error("a hook ran despite construction succeeding")
	}

	cleanups.Close()
}

func TestCleanupsCloseWithoutHooksIsNoOp(t *testing.T) {
	t.Parallel()

	cleanups := &serveutil.Cleanups{}
	cleanups.Close()
	cleanups.Close()
}
