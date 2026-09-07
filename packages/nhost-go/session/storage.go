package session

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"github.com/nhost/nhost/packages/nhost-go/auth"
)

// Session-backend operation names reported by StorageError.Op.
const (
	OpRead   = "read"
	OpWrite  = "write"
	OpRemove = "remove"
)

// StorageError reports a failed session-backend operation. The built-in
// FileStorage returns it so callers can tell a genuine persistence failure
// (a full disk, a read-only directory) apart from "no session stored".
type StorageError struct {
	// Op is the operation that failed: OpRead, OpWrite, or OpRemove.
	Op string
	// Path is the file the operation was performed on.
	Path string
	// Err is the underlying error.
	Err error
}

func (e *StorageError) Error() string {
	return fmt.Sprintf("session storage %s %q: %v", e.Op, e.Path, e.Err)
}

func (e *StorageError) Unwrap() error { return e.Err }

// Backend persists a single StoredSession. Implement it to store sessions
// somewhere other than memory (a file, Redis, a per-request store, ...).
// Implementations must be safe for concurrent use by multiple goroutines;
// Storage delegates operations directly and does not serialize backend access.
//
// Every operation reports failure so a caller can decide whether losing the
// session is acceptable. Get returns (nil, nil) when no session is stored,
// which is not an error; it must return a non-nil error only when the session
// could not be read, so that a backend outage is never mistaken for a signed
// out user. Remove treats an absent session as success.
type Backend interface {
	Get() (*StoredSession, error)
	Set(value StoredSession) error
	Remove() error
}

// MemoryStorage is the default in-memory session backend. Because a single
// instance is process-wide, do not share one between different users in a
// server context — create a scoped backend per user.
type MemoryStorage struct {
	mu      sync.RWMutex
	session *StoredSession
}

func (m *MemoryStorage) Get() (*StoredSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.session == nil {
		return nil, nil //nolint:nilnil // (nil, nil) means "no session stored".
	}

	cp := *m.session

	return &cp, nil
}

func (m *MemoryStorage) Set(value StoredSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.session = &value

	return nil
}

func (m *MemoryStorage) Remove() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.session = nil

	return nil
}

// FileStorage is a JSON-file backed session backend, useful for CLIs and local
// scripts. A single instance is safe to share across goroutines: access is
// serialized and writes are atomic (temp file + rename), so a concurrent Get
// during a refresh's Set never observes a truncated or partial file.
type FileStorage struct {
	Path string
	mu   sync.RWMutex
}

func (f *FileStorage) Get() (*StoredSession, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	data, err := os.ReadFile(f.Path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil //nolint:nilnil // No file means no session stored.
		}

		// A permission or I/O error is not "signed out": report it so the
		// caller does not silently treat a readable session as absent.
		return nil, &StorageError{Op: OpRead, Path: f.Path, Err: err}
	}

	var s StoredSession
	if err := json.Unmarshal(data, &s); err != nil {
		// Do not delete the file on a parse error: a transient/corrupt read
		// must not permanently discard a valid session and its refresh token.
		return nil, &StorageError{Op: OpRead, Path: f.Path, Err: err}
	}

	return &s, nil
}

func (f *FileStorage) Set(value StoredSession) error {
	data, err := json.Marshal(value)
	if err != nil {
		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	dir := filepath.Dir(f.Path)
	if err := os.MkdirAll(dir, 0o750); err != nil { //nolint:mnd
		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	// Write to a temp file in the same directory then rename into place so
	// readers never see a partially written file.
	tmp, err := os.CreateTemp(dir, ".session-*.tmp")
	if err != nil {
		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	tmpName := tmp.Name()

	if err := tmp.Chmod(0o600); err != nil { //nolint:mnd
		_ = tmp.Close()
		_ = os.Remove(tmpName)

		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		_ = os.Remove(tmpName)

		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)

		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	if err := os.Rename(tmpName, f.Path); err != nil {
		_ = os.Remove(tmpName)

		return &StorageError{Op: OpWrite, Path: f.Path, Err: err}
	}

	return nil
}

func (f *FileStorage) Remove() error {
	f.mu.Lock()
	defer f.mu.Unlock()

	if err := os.Remove(f.Path); err != nil && !os.IsNotExist(err) {
		return &StorageError{Op: OpRemove, Path: f.Path, Err: err}
	}

	return nil
}

type refreshCall struct {
	done    chan struct{}
	session *StoredSession
	err     error
}

// Storage wraps a Backend, decoding tokens on Set.
type Storage struct {
	backend     Backend
	refreshMu   sync.Mutex
	refreshCall *refreshCall
}

// NewStorage wraps a backend.
func NewStorage(backend Backend) *Storage {
	return &Storage{
		backend:     backend,
		refreshMu:   sync.Mutex{},
		refreshCall: nil,
	}
}

func (s *Storage) beginRefresh() (*refreshCall, bool) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	if s.refreshCall != nil {
		return s.refreshCall, false
	}

	call := &refreshCall{done: make(chan struct{}), session: nil, err: nil}
	s.refreshCall = call

	return call, true
}

func (s *Storage) finishRefresh(call *refreshCall, session *StoredSession, err error) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	call.session = session
	call.err = err
	s.refreshCall = nil

	close(call.done)
}

// removeIfPresent clears a stored session and reports whether one was present.
// A backend read failure is reported as an error rather than as "absent", so a
// caller never concludes the user was already signed out because the store was
// unreadable.
func (s *Storage) removeIfPresent() (bool, error) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	current, err := s.backend.Get()
	if err != nil {
		return false, err //nolint:wrapcheck // Caller-supplied backend error.
	}

	if current == nil {
		return false, nil
	}

	if err := s.backend.Remove(); err != nil {
		return true, err //nolint:wrapcheck // Caller-supplied backend error.
	}

	return true, nil
}

// Get returns the current session from the backend. It returns (nil, nil) when
// no session is stored, and a non-nil error only when the backend could not be
// read — an unreadable store is not a signed out user.
//
// The backend's error is returned unwrapped: a backend is caller-supplied, so
// its error is the caller's own and adding a layer of SDK context would only
// obscure it.
func (s *Storage) Get() (*StoredSession, error) {
	return s.backend.Get() //nolint:wrapcheck
}

// Set stores a raw auth Session, enriching it into a StoredSession. It returns
// an error if the access token cannot be decoded or the backend rejects the
// write.
func (s *Storage) Set(value auth.Session) error {
	stored, err := ToStoredSession(value)
	if err != nil {
		return err
	}

	return s.backend.Set(stored) //nolint:wrapcheck // Caller-supplied backend error.
}

// Remove clears the session, reporting a backend failure so the caller can
// decide whether a session left on disk is acceptable.
func (s *Storage) Remove() error {
	return s.backend.Remove() //nolint:wrapcheck // Caller-supplied backend error.
}
