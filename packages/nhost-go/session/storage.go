package session

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"github.com/nhost/nhost/packages/nhost-go/auth"
)

// Backend persists a single StoredSession. Implement it to store sessions
// somewhere other than memory (a file, Redis, a per-request store, ...).
type Backend interface {
	Get() (*StoredSession, bool)
	Set(value StoredSession)
	Remove()
}

// MemoryStorage is the default in-memory session backend. Because a single
// instance is process-wide, do not share one between different users in a
// server context — create a scoped backend per user.
type MemoryStorage struct {
	mu      sync.RWMutex
	session *StoredSession
}

func (m *MemoryStorage) Get() (*StoredSession, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.session == nil {
		return nil, false
	}

	cp := *m.session

	return &cp, true
}

func (m *MemoryStorage) Set(value StoredSession) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.session = &value
}

func (m *MemoryStorage) Remove() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.session = nil
}

// FileStorage is a JSON-file backed session backend, useful for CLIs and local
// scripts. A single instance is safe to share across goroutines: access is
// serialized and writes are atomic (temp file + rename), so a concurrent Get
// during a refresh's Set never observes a truncated or partial file.
type FileStorage struct {
	Path string
	mu   sync.RWMutex
}

func (f *FileStorage) Get() (*StoredSession, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	data, err := os.ReadFile(f.Path)
	if err != nil {
		return nil, false
	}

	var s StoredSession
	if err := json.Unmarshal(data, &s); err != nil {
		// Do not delete the file on a parse error: a transient/corrupt read
		// must not permanently discard a valid session and its refresh token.
		return nil, false
	}

	return &s, true
}

func (f *FileStorage) Set(value StoredSession) {
	data, err := json.Marshal(value)
	if err != nil {
		return
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	dir := filepath.Dir(f.Path)
	_ = os.MkdirAll(dir, 0o750) //nolint:mnd

	// Write to a temp file in the same directory then rename into place so
	// readers never see a partially written file.
	tmp, err := os.CreateTemp(dir, ".session-*.tmp")
	if err != nil {
		return
	}

	tmpName := tmp.Name()

	if err := tmp.Chmod(0o600); err != nil { //nolint:mnd
		_ = tmp.Close()
		_ = os.Remove(tmpName)

		return
	}

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmpName)

		return
	}

	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)

		return
	}

	if err := os.Rename(tmpName, f.Path); err != nil {
		_ = os.Remove(tmpName)
	}
}

func (f *FileStorage) Remove() {
	f.mu.Lock()
	defer f.mu.Unlock()

	_ = os.Remove(f.Path)
}

// DetectStorage returns the default backend for the current environment.
func DetectStorage() Backend { //nolint:ireturn
	return &MemoryStorage{mu: sync.RWMutex{}, session: nil}
}

// ChangeCallback is notified on every session change.
type ChangeCallback func(session *StoredSession)

// Storage wraps a Backend, decoding tokens on Set and notifying subscribers on
// every change.
type Storage struct {
	backend     Backend
	mu          sync.Mutex
	refreshMu   sync.Mutex
	subscribers map[int]ChangeCallback
	nextID      int
}

// NewStorage wraps a backend.
func NewStorage(backend Backend) *Storage {
	return &Storage{
		backend:     backend,
		mu:          sync.Mutex{},
		refreshMu:   sync.Mutex{},
		subscribers: map[int]ChangeCallback{},
		nextID:      0,
	}
}

// Get returns the current session from the backend, or (nil, false).
func (s *Storage) Get() (*StoredSession, bool) {
	return s.backend.Get()
}

// Set stores a raw auth Session, enriching it into a StoredSession, and
// notifies subscribers. It returns an error if the access token cannot be
// decoded.
func (s *Storage) Set(value auth.Session) error {
	stored, err := ToStoredSession(value)
	if err != nil {
		return err
	}

	s.backend.Set(stored)
	s.notify(&stored)

	return nil
}

// Remove clears the session and notifies subscribers.
func (s *Storage) Remove() {
	s.backend.Remove()
	s.notify(nil)
}

// OnChange subscribes to session changes; the returned func unsubscribes.
func (s *Storage) OnChange(cb ChangeCallback) func() {
	s.mu.Lock()
	defer s.mu.Unlock()

	id := s.nextID
	s.nextID++
	s.subscribers[id] = cb

	return func() {
		s.mu.Lock()
		defer s.mu.Unlock()

		delete(s.subscribers, id)
	}
}

func (s *Storage) notify(session *StoredSession) {
	s.mu.Lock()

	subs := make([]ChangeCallback, 0, len(s.subscribers))
	for _, cb := range s.subscribers {
		subs = append(subs, cb)
	}
	s.mu.Unlock()

	for _, cb := range subs {
		cb(session)
	}
}
