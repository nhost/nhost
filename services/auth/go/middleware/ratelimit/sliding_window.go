package ratelimit

import (
	"context"
	"math"
	"strconv"
	"time"
)

type Store interface {
	Get(key string) int
	Increment(ctx context.Context, key string, expire time.Duration) int
}

type SlidingWindow struct {
	prefix string
	window time.Duration
	limit  int
	store  Store
}

// NewSlidingWindow creates a new sliding window based on
// https://github.com/ElvinEfendi/lua-resty-global-throttle/blob/main/lib/resty/global_throttle/sliding_window.lua
func NewSlidingWindow(
	prefix string,
	limit int,
	window time.Duration,
	store Store,
) *SlidingWindow {
	return &SlidingWindow{
		prefix: prefix,
		window: window,
		limit:  limit,
		store:  store,
	}
}

func (r *SlidingWindow) windowKey(t time.Time, key string) string {
	return r.prefix + strconv.FormatInt(t.UnixMilli()/r.window.Milliseconds(), 10) + ":" + key
}

func (r *SlidingWindow) getRate(key string) float64 {
	count := min(r.store.Get(key), r.limit)
	return float64(count) / float64(r.window.Milliseconds())
}

// Allow reports whether a request for key is allowed. When it is not, it also
// returns how long until a request would be allowed again.
func (r *SlidingWindow) Allow(ctx context.Context, key string) (bool, time.Duration) {
	return r.allowAt(ctx, key, time.Now())
}

func (r *SlidingWindow) allowAt(
	ctx context.Context,
	key string,
	now time.Time,
) (bool, time.Duration) {
	windowKey := r.windowKey(now, key)
	remainingTime := float64(r.window.Milliseconds() - now.UnixMilli()%r.window.Milliseconds())

	count := r.store.Get(windowKey)
	if count >= r.limit {
		return false, r.untilNextWindow(remainingTime)
	}

	prevWindowKey := r.windowKey(now.Add(-r.window), key)
	prevRate := r.getRate(prevWindowKey)

	estimatedRate := int(math.Floor(prevRate*remainingTime)) + count
	if estimatedRate >= r.limit {
		// The previous window's share shrinks as remainingTime goes down, so the
		// request is allowed once prevRate*remainingTime < limit-count.
		threshold := float64(r.limit-count) / prevRate

		return false, time.Duration(math.Floor(remainingTime-threshold)+1) * time.Millisecond
	}

	if r.store.Increment(ctx, windowKey, r.window*2) > r.limit { //nolint:mnd
		return false, r.untilNextWindow(remainingTime)
	}

	return true, 0
}

// untilNextWindow returns the wait until just after the current window ends.
func (r *SlidingWindow) untilNextWindow(remainingTime float64) time.Duration {
	return time.Duration(remainingTime)*time.Millisecond + time.Millisecond
}
