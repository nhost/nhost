package ratelimit_test

import (
	"testing"
	"time"

	"github.com/nhost/hasura-auth/go/middleware/ratelimit"
)

func count(
	t *testing.T, _ int, rl *ratelimit.SlidingWindow, key string, _ time.Time, //nolint:unparam
) int {
	t.Helper()

	count := 0
	if rl.Allow(key) {
		count++
	}

	// t.Log(idx, count, time.Since(startTime))

	return count
}

func TestSlidingWindow(t *testing.T) {
	t.Parallel()

	store := ratelimit.NewInMemoryStore()

	rl := ratelimit.NewSlidingWindow("test", 5, time.Second, store)
	now := time.Now()

	c := 0
	c += count(t, 1, rl, "key", now)
	c += count(t, 2, rl, "key", now)
	c += count(t, 3, rl, "key", now)
	c += count(t, 4, rl, "key", now)
	c += count(t, 5, rl, "key", now)
	c += count(t, 6, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 7, rl, "key", now)
	c += count(t, 7, rl, "key", now)
	c += count(t, 7, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 8, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 9, rl, "key", now)
	c += count(t, 9, rl, "key", now)
	c += count(t, 9, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 10, rl, "key", now)
	c += count(t, 10, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 11, rl, "key", now)
	c += count(t, 11, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 12, rl, "key", now)
	c += count(t, 12, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 13, rl, "key", now)
	c += count(t, 13, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 14, rl, "key", now)
	c += count(t, 14, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 15, rl, "key", now)
	c += count(t, 15, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 16, rl, "key", now)
	c += count(t, 16, rl, "key", now)
	c += count(t, 16, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 17, rl, "key", now)
	c += count(t, 17, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 18, rl, "key", now)
	c += count(t, 18, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 19, rl, "key", now)
	c += count(t, 19, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 20, rl, "key", now)
	c += count(t, 20, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 21, rl, "key", now)
	c += count(t, 21, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 22, rl, "key", now)
	c += count(t, 22, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 23, rl, "key", now)
	c += count(t, 23, rl, "key", now)
	time.Sleep(time.Second / 5)
	c += count(t, 24, rl, "key", now)
	c += count(t, 24, rl, "key", now)

	if c > 24 {
		t.Errorf("Expected at most 24, got %d", c)
	}
}
