package ratelimit

import (
	"context"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/bradfitz/gomemcache/memcache"
)

// MemcacheStore keeps the counters in memcache so every replica shares one
// window.
//
// Memcache failures used to surface as a zero count, which the sliding window
// could not tell apart from a key nobody had touched yet: an unreachable
// memcache silently switched rate limiting off across the fleet rather than
// weakening it, and the only trace was a log line. Failures now fall back to
// process-local counters, so an outage costs accuracy -- the memcache and
// process-local counters are independent, so a window spanning a failure or
// recovery can admit up to the limit from each: worst case 2 x limit per
// replica, or 2 x limit x replicas overall -- instead of removing the limit
// altogether.
//
// Failing closed was the other option and is worse: every limited route
// (/signin, /signup, /user/email/*, /oauth2/*) would start answering 429, so a
// cache blip would become an auth outage.
type MemcacheStore struct {
	client   *memcache.Client
	prefix   string
	logger   *slog.Logger
	fallback *InMemoryStore
}

func NewMemcacheStore(
	client *memcache.Client,
	prefix string,
	logger *slog.Logger,
) *MemcacheStore {
	return &MemcacheStore{
		client:   client,
		prefix:   prefix,
		logger:   logger,
		fallback: NewInMemoryStore(),
	}
}

func (m *MemcacheStore) key(key string) string {
	return m.prefix + key
}

func (m *MemcacheStore) Get(key string) int {
	item, err := m.client.Get(m.key(key))

	switch {
	case errors.Is(err, memcache.ErrCacheMiss):
		// Nothing counted in this window yet, which is not a failure.
		return 0
	case err != nil:
		m.logger.Error(
			"error reading key, falling back to local rate limit counters",
			slog.String("error", err.Error()),
		)

		return m.fallback.Get(key)
	}

	v, err := strconv.Atoi(string(item.Value))
	if err != nil {
		m.logger.Error(
			"error parsing key, falling back to local rate limit counters",
			slog.String("error", err.Error()),
		)

		return m.fallback.Get(key)
	}

	return v
}

func (m *MemcacheStore) Increment(ctx context.Context, key string, expire time.Duration) int {
	newValue, err := m.client.Increment(m.key(key), uint64(1))
	switch {
	case errors.Is(err, memcache.ErrCacheMiss):
		err = m.client.Set(&memcache.Item{ //nolint:exhaustruct
			Key:        m.key(key),
			Value:      []byte("1"),
			Expiration: int32(expire.Seconds()),
		})
		if err != nil {
			m.logger.ErrorContext(ctx,
				"error setting key, falling back to local rate limit counters",
				slog.String("error", err.Error()),
			)

			return m.fallback.Increment(ctx, key, expire)
		}

		return 1
	case err != nil:
		m.logger.ErrorContext(ctx,
			"error incrementing key, falling back to local rate limit counters",
			slog.String("error", err.Error()),
		)

		return m.fallback.Increment(ctx, key, expire)
	}

	return int(newValue) //nolint:gosec
}
