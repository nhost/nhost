package ratelimit_test

import (
	"log/slog"
	"strconv"
	"testing"
	"time"

	"github.com/bradfitz/gomemcache/memcache"
	"github.com/nhost/nhost/services/auth/go/middleware/ratelimit"
)

// unreachableMemcache is a port nothing listens on, so every operation fails.
const unreachableMemcache = "127.0.0.1:1"

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

// uniquePrefix keeps runs from colliding in a memcache shared across runs.
func uniquePrefix(t *testing.T) string {
	t.Helper()

	return t.Name() + strconv.FormatInt(time.Now().UnixNano(), 10) + ":"
}

// Requires the memcached from `make dev-env-up`.
func TestNewMemcacheStore(t *testing.T) {
	t.Parallel()

	cl := memcache.New("localhost:11211")
	prefix := uniquePrefix(t)
	store := ratelimit.NewMemcacheStore(cl, prefix, discardLogger())

	if e := store.Get("key"); e != 0 {
		t.Errorf("Expected 0, got %d", e)
	}

	if e := store.Increment(t.Context(), "key", time.Second); e != 1 {
		t.Errorf("Expected 1, got %d", e)
	}

	if e := store.Get("key"); e != 1 {
		t.Errorf("Expected 1, got %d", e)
	}

	if e := store.Increment(t.Context(), "key", time.Second); e != 2 {
		t.Errorf("Expected 2, got %d", e)
	}

	if e := store.Get("key"); e != 2 {
		t.Errorf("Expected 2, got %d", e)
	}

	// A second store has its own local fallback, so reading the counter written
	// above can only work through memcache. Without this the test would pass on
	// the fallback alone and stop covering memcache at all.
	shared := ratelimit.NewMemcacheStore(cl, prefix, discardLogger())
	if e := shared.Get("key"); e != 2 {
		t.Errorf("Expected 2 from a second store sharing memcache, got %d", e)
	}

	time.Sleep(time.Second)

	if e := store.Get("key"); e != 0 {
		t.Errorf("Expected 0, got %d", e)
	}
}

func TestMemcacheStoreFallsBackWhenUnavailable(t *testing.T) {
	t.Parallel()

	store := ratelimit.NewMemcacheStore(
		memcache.New(unreachableMemcache), uniquePrefix(t), discardLogger(),
	)

	// A count of zero here would be indistinguishable from an untouched key,
	// which is what used to disable rate limiting during a memcache outage.
	if e := store.Increment(t.Context(), "key", time.Minute); e != 1 {
		t.Errorf("Expected 1 from the local fallback, got %d", e)
	}

	if e := store.Increment(t.Context(), "key", time.Minute); e != 2 {
		t.Errorf("Expected 2 from the local fallback, got %d", e)
	}

	if e := store.Get("key"); e != 2 {
		t.Errorf("Expected 2 from the local fallback, got %d", e)
	}
}

// The regression this exists for: an unreachable memcache used to let every
// request through, so a client could keep requesting verification emails long
// past the configured limit.
func TestSlidingWindowEnforcesLimitWhenMemcacheUnavailable(t *testing.T) {
	t.Parallel()

	const limit = 3

	store := ratelimit.NewMemcacheStore(
		memcache.New(unreachableMemcache), uniquePrefix(t), discardLogger(),
	)
	rl := ratelimit.NewSlidingWindow("test", limit, time.Minute, store)

	allowed := 0

	for range limit * 4 {
		if rl.Allow(t.Context(), "key") {
			allowed++
		}
	}

	if allowed != limit {
		t.Errorf("Expected %d requests allowed with memcache down, got %d", limit, allowed)
	}
}
