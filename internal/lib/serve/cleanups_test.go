package serve_test

import (
	"reflect"
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

func TestCleanupsCloseRunsHooksOnce(t *testing.T) {
	t.Parallel()

	calls := 0

	cleanups := &serveutil.Cleanups{}
	cleanups.Add(func() { calls++ })

	cleanups.Close()
	cleanups.Close()

	if calls != 1 {
		t.Errorf("cleanup calls = %d; want 1", calls)
	}
}

func TestCleanupsCloseWithoutHooksIsNoOp(t *testing.T) {
	t.Parallel()

	cleanups := &serveutil.Cleanups{}
	cleanups.Close()
	cleanups.Close()
}
