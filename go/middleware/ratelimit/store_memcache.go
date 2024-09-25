package ratelimit

import (
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/bradfitz/gomemcache/memcache"
)

type MemcacheStore struct {
	client *memcache.Client
	prefix string
	logger *slog.Logger
}

func NewMemcacheStore(
	client *memcache.Client,
	prefix string,
	logger *slog.Logger,
) *MemcacheStore {
	return &MemcacheStore{
		client: client,
		prefix: prefix,
		logger: logger,
	}
}

func (m *MemcacheStore) key(key string) string {
	return m.prefix + key
}

func (m *MemcacheStore) Get(key string) int {
	item, err := m.client.Get(m.key(key))
	if err != nil {
		return 0
	}
	v, err := strconv.Atoi(string(item.Value))
	if err != nil {
		return 0
	}

	return v
}

func (m *MemcacheStore) Increment(key string, expire time.Duration) int {
	newValue, err := m.client.Increment(m.key(key), uint64(1))
	switch {
	case errors.Is(err, memcache.ErrCacheMiss):
		err = m.client.Set(&memcache.Item{ //nolint:exhaustruct
			Key:        m.key(key),
			Value:      []byte{49}, // "1"
			Expiration: int32(expire.Seconds()),
		})
		if err != nil {
			m.logger.Error("error setting key", slog.String("error", err.Error()))
			return 0
		}
		return 1
	case err != nil:
		m.logger.Error("error incrementing key", slog.String("error", err.Error()))
		return 0
	}
	return int(newValue) //nolint:gosec
}
