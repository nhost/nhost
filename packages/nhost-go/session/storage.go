package session

import (
	"context"
	"encoding/json"
	"errors"
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

// ErrSessionWithoutUserID is returned by [MultiUserMemoryStorage.Set] for a
// session that names no user, since it has nothing to key the session by.
var ErrSessionWithoutUserID = errors.New("session has no user ID to store it under")

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

// Backend persists sessions keyed by user, so one interface serves both a
// single-user application (a CLI, a script) and a server holding the sessions
// of many users (Redis, a database, ...). Set keys a session by
// [StoredSession.UserID]; Get and Remove take the user ID the request selected
// with [WithUserID], or "" when it selected none.
//
// A backend that holds a single session returns and removes it for "" or for
// its own user, and reports nothing stored for any other user. A backend that
// holds many sessions reports nothing stored for "", so a request that forgot
// to name its user goes out unauthenticated rather than as someone else.
//
// Implementations must be safe for concurrent use by multiple goroutines;
// Storage delegates operations directly and does not serialize backend access.
// The context is the SDK request's, so a remote backend can honour its deadline
// and cancellation.
//
// Every operation reports failure so a caller can decide whether losing the
// session is acceptable. Get returns (nil, nil) when no session is stored,
// which is not an error; it must return a non-nil error only when the session
// could not be read, so that a backend outage is never mistaken for a signed
// out user. Remove treats an absent session as success.
type Backend interface {
	Get(ctx context.Context, userID string) (*StoredSession, error)
	Set(ctx context.Context, value StoredSession) error
	Remove(ctx context.Context, userID string) error
}

// selects reports whether a single-session backend's stored session answers a
// request for userID.
func selects(stored *StoredSession, userID string) bool {
	return stored != nil && (userID == "" || stored.UserID() == userID)
}

// MemoryStorage is an in-memory backend holding a single session, for
// single-user programs and tests. It keeps only the most recent session, so a
// server holding many users' sessions needs [MultiUserMemoryStorage] or a
// shared store instead.
type MemoryStorage struct {
	mu      sync.RWMutex
	session *StoredSession
}

func (m *MemoryStorage) Get(_ context.Context, userID string) (*StoredSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if !selects(m.session, userID) {
		return nil, nil //nolint:nilnil // (nil, nil) means "no session stored".
	}

	cp := *m.session

	return &cp, nil
}

func (m *MemoryStorage) Set(_ context.Context, value StoredSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.session = &value

	return nil
}

func (m *MemoryStorage) Remove(_ context.Context, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if selects(m.session, userID) {
		m.session = nil
	}

	return nil
}

// MultiUserMemoryStorage is an in-memory backend holding one session per user,
// for a server running as a single process. Sessions live until they are
// removed (sign-out or a rejected refresh), are lost on restart, and are not
// shared between processes: a service with several replicas needs a shared
// store, or the replicas will rotate one another's refresh tokens and sign
// users out.
type MultiUserMemoryStorage struct {
	mu       sync.RWMutex
	sessions map[string]StoredSession
}

func (m *MultiUserMemoryStorage) Get(_ context.Context, userID string) (*StoredSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stored, ok := m.sessions[userID]
	if userID == "" || !ok {
		return nil, nil //nolint:nilnil // (nil, nil) means "no session stored".
	}

	return &stored, nil
}

func (m *MultiUserMemoryStorage) Set(_ context.Context, value StoredSession) error {
	userID := value.UserID()
	if userID == "" {
		return ErrSessionWithoutUserID
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.sessions == nil {
		m.sessions = make(map[string]StoredSession)
	}

	m.sessions[userID] = value

	return nil
}

func (m *MultiUserMemoryStorage) Remove(_ context.Context, userID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.sessions, userID)

	return nil
}

// FileStorage is a JSON-file backend holding a single session, useful for CLIs
// and local scripts. A single instance is safe to share across goroutines:
// access is serialized and writes are atomic (temp file + rename), so a
// concurrent Get during a refresh's Set never observes a truncated or partial
// file.
type FileStorage struct {
	Path string
	mu   sync.RWMutex
}

func (f *FileStorage) Get(_ context.Context, userID string) (*StoredSession, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()

	stored, err := f.read()
	if err != nil || !selects(stored, userID) {
		return nil, err
	}

	return stored, nil
}

// read loads the stored session; the caller holds the lock.
func (f *FileStorage) read() (*StoredSession, error) {
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

func (f *FileStorage) Set(_ context.Context, value StoredSession) error {
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

func (f *FileStorage) Remove(_ context.Context, userID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	// Removing another user's session must leave this one alone, which takes
	// reading it first. Without a user ID there is nothing to compare, and the
	// file goes even if it is unreadable.
	if userID != "" {
		stored, err := f.read()
		if err != nil {
			return err
		}

		if !selects(stored, userID) {
			return nil
		}
	}

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

// Storage wraps a Backend, decoding tokens on Set and selecting the user from
// the request context (see [WithUserID]).
type Storage struct {
	backend   Backend
	refreshMu sync.Mutex
	// refreshCalls holds the in-flight refresh of each session, keyed by the
	// refresh token being exchanged, so concurrent requests for one user share
	// a refresh while different users refresh independently.
	refreshCalls map[string]*refreshCall
}

// NewStorage wraps a backend.
func NewStorage(backend Backend) *Storage {
	return &Storage{
		backend:      backend,
		refreshMu:    sync.Mutex{},
		refreshCalls: make(map[string]*refreshCall),
	}
}

func (s *Storage) beginRefresh(refreshToken string) (*refreshCall, bool) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	if call, ok := s.refreshCalls[refreshToken]; ok {
		return call, false
	}

	call := &refreshCall{done: make(chan struct{}), session: nil, err: nil}
	s.refreshCalls[refreshToken] = call

	return call, true
}

func (s *Storage) finishRefresh(
	refreshToken string,
	call *refreshCall,
	session *StoredSession,
	err error,
) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	call.session = session
	call.err = err

	delete(s.refreshCalls, refreshToken)

	close(call.done)
}

// removeRejected clears the session whose refresh token the auth service
// rejected. If the stored session now carries a different refresh token,
// another process refreshed it in the meantime (the auth service rotates the
// token on every refresh, so the loser of that race is always rejected), and
// that session is returned and kept rather than signing the user out.
//
// A backend read failure is reported as an error rather than as "absent", so a
// caller never concludes the user was already signed out because the store was
// unreadable.
func (s *Storage) removeRejected(
	ctx context.Context,
	rejectedRefreshToken string,
) (*StoredSession, bool, error) {
	s.refreshMu.Lock()
	defer s.refreshMu.Unlock()

	current, err := s.Get(ctx)
	if err != nil {
		return nil, false, err
	}

	if current == nil {
		return nil, false, nil
	}

	if current.RefreshToken != rejectedRefreshToken {
		return current, false, nil
	}

	if err := s.Remove(ctx); err != nil {
		return nil, true, err
	}

	return nil, true, nil
}

// Get returns the session ctx selects from the backend. It returns (nil, nil)
// when no session is stored, and a non-nil error only when the backend could
// not be read — an unreadable store is not a signed out user.
//
// The backend's error is returned unwrapped: a backend is caller-supplied, so
// its error is the caller's own and adding a layer of SDK context would only
// obscure it.
func (s *Storage) Get(ctx context.Context) (*StoredSession, error) {
	return s.backend.Get(ctx, UserIDFromContext(ctx)) //nolint:wrapcheck
}

// Set stores a raw auth Session, enriching it into a StoredSession keyed by its
// user. It returns an error if the access token cannot be decoded or the
// backend rejects the write.
func (s *Storage) Set(ctx context.Context, value auth.Session) error {
	stored, err := ToStoredSession(value)
	if err != nil {
		return err
	}

	return s.backend.Set(ctx, stored) //nolint:wrapcheck // Caller-supplied backend error.
}

// Remove clears the session ctx selects, reporting a backend failure so the
// caller can decide whether a session left on disk is acceptable.
func (s *Storage) Remove(ctx context.Context) error {
	//nolint:wrapcheck // Caller-supplied backend error.
	return s.backend.Remove(ctx, UserIDFromContext(ctx))
}
