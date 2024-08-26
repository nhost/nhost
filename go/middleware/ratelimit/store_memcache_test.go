package ratelimit_test

import (
	"log/slog"
	"testing"
	"time"

	"github.com/bradfitz/gomemcache/memcache"
	"github.com/nhost/hasura-auth/go/middleware/ratelimit"
)

func TestNewMemcacheStore(t *testing.T) {
	t.Parallel()

	cl := memcache.New("localhost:11211")
	store := ratelimit.NewMemcacheStore(cl, "test", slog.Default())

	if e := store.Get("key"); e != 0 {
		t.Errorf("Expected 0, got %d", e)
	}

	if e := store.Increment("key", time.Second); e != 1 {
		t.Errorf("Expected 1, got %d", e)
	}

	if e := store.Get("key"); e != 1 {
		t.Errorf("Expected 1, got %d", e)
	}

	if e := store.Increment("key", time.Second); e != 2 {
		t.Errorf("Expected 1, got %d", e)
	}

	if e := store.Get("key"); e != 2 {
		t.Errorf("Expected 1, got %d", e)
	}

	time.Sleep(time.Second)
	if e := store.Get("key"); e != 0 {
		t.Errorf("Expected 0, got %d", e)
	}
}
