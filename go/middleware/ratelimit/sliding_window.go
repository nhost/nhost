package ratelimit

import (
	"math"
	"strconv"
	"time"
)

type Store interface {
	Get(key string) int
	Increment(key string, expire time.Duration) int
}

type SlidingWindow struct {
	prefix string
	window time.Duration
	limit  int
	store  Store
}

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
	return r.prefix + strconv.Itoa(int(t.UnixMilli()/r.window.Milliseconds())) + ":" + key
}

func (r *SlidingWindow) getRate(key string) float64 {
	count := r.store.Get(key)

	if count > r.limit {
		count = r.limit
	}

	return float64(count) / float64(r.window.Milliseconds())
}

func (r *SlidingWindow) Allow(key string) bool {
	now := time.Now()

	windowKey := r.windowKey(now, key)
	remainingTime := float64(
		r.window.Milliseconds(),
	) - float64(
		now.UnixMilli()%r.window.Milliseconds(),
	)

	count := r.store.Get(windowKey)

	if count >= r.limit {
		return false
	}

	prevWindowKey := r.windowKey(now.Add(-r.window), key)
	prevRate := r.getRate(prevWindowKey)

	estimatedRate := int(math.Floor(prevRate*remainingTime)) + count
	if estimatedRate >= r.limit {
		return false
	}

	newCount := r.store.Increment(windowKey, r.window*2) - 1 //nolint:mnd
	return newCount < r.limit
}
