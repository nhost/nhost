package ratelimit

import (
	"sync"
	"time"
)

type InMemoryStoreValue struct {
	v    int
	time time.Time
}

type InMemoryStore struct {
	data map[string]InMemoryStoreValue
	mx   sync.Mutex
}

func NewInMemoryStore() *InMemoryStore {
	return &InMemoryStore{
		data: make(map[string]InMemoryStoreValue),
		mx:   sync.Mutex{},
	}
}

func (i *InMemoryStore) deleteExpired() {
	for k, v := range i.data {
		if time.Now().After(v.time) {
			delete(i.data, k)
		}
	}
}

func (i *InMemoryStore) get(key string) int {
	if v, ok := i.data[key]; ok {
		return v.v
	}
	return 0
}

func (i *InMemoryStore) Get(key string) int {
	i.mx.Lock()
	defer i.mx.Unlock()

	i.deleteExpired()

	return i.get(key)
}

func (i *InMemoryStore) Increment(key string, expire time.Duration) int {
	i.mx.Lock()
	defer i.mx.Unlock()

	i.deleteExpired()

	current := i.get(key)
	i.data[key] = InMemoryStoreValue{
		v:    current + 1,
		time: time.Now().Add(expire),
	}

	return i.data[key].v
}
