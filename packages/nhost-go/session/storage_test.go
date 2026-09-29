package session_test

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/session"
)

func TestFileStorageRoundTrip(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "nested", "session.json")
	backend := &session.FileStorage{Path: path}
	value := session.StoredSession{
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
		DecodedToken: session.DecodedToken{Exp: 12345, Sub: "user-1"},
	}

	if err := backend.Set(t.Context(), value); err != nil {
		t.Fatalf("Set: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat session file: %v", err)
	}

	if got := info.Mode().Perm(); got != 0o600 {
		t.Errorf("session file mode = %o, want 600", got)
	}

	got, err := backend.Get(t.Context(), "")
	if err != nil || got == nil || got.AccessToken != value.AccessToken ||
		got.RefreshToken != value.RefreshToken || got.DecodedToken.Exp != value.DecodedToken.Exp ||
		got.DecodedToken.Sub != value.DecodedToken.Sub {
		t.Fatalf("Get() = %#v, %v; want %#v, nil", got, err, value)
	}

	if err := backend.Remove(t.Context(), ""); err != nil {
		t.Fatalf("Remove: %v", err)
	}

	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Fatalf("session file still exists after Remove: %v", err)
	}
}

func TestFileStorageCorruptJSONRemainsOnDisk(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "session.json")
	if err := os.WriteFile(path, []byte("{not-json"), 0o600); err != nil {
		t.Fatalf("write corrupt session: %v", err)
	}

	// A corrupt file is a read failure, not a signed out user: the caller
	// must be able to tell the difference before discarding the session.
	backend := &session.FileStorage{Path: path}

	got, err := backend.Get(t.Context(), "")
	if got != nil {
		t.Fatalf("Get() = %#v; want nil", got)
	}

	var storageErr *session.StorageError
	if !errors.As(err, &storageErr) {
		t.Fatalf("Get() error = %v; want a *session.StorageError", err)
	}

	if storageErr.Op != "read" {
		t.Errorf("StorageError.Op = %q, want \"read\"", storageErr.Op)
	}

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("corrupt session file was removed: %v", err)
	}
}

func TestFileStorageConcurrentGetSet(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	backend := &session.FileStorage{Path: filepath.Join(dir, "session.json")}
	if err := backend.Set(t.Context(), session.StoredSession{
		AccessToken:  "access-0",
		RefreshToken: "refresh-0",
		DecodedToken: session.DecodedToken{Exp: 1},
	}); err != nil {
		t.Fatalf("seed session: %v", err)
	}

	const (
		goroutines = 20
		operations = 50
	)

	start := make(chan struct{})

	var waitGroup sync.WaitGroup
	waitGroup.Add(goroutines)

	for index := range goroutines {
		go func() {
			defer waitGroup.Done()

			<-start

			for operation := range operations {
				if index%2 == 0 {
					if err := backend.Set(t.Context(), session.StoredSession{
						AccessToken:  fmt.Sprintf("access-%d-%d", index, operation),
						RefreshToken: fmt.Sprintf("refresh-%d-%d", index, operation),
						DecodedToken: session.DecodedToken{Exp: int64(operation + 1)},
					}); err != nil {
						t.Errorf("concurrent Set() = %v", err)
					}

					continue
				}

				got, err := backend.Get(t.Context(), "")
				if err != nil || got == nil || got.AccessToken == "" || got.RefreshToken == "" {
					t.Errorf("concurrent Get() = %#v, %v", got, err)
				}
			}
		}()
	}

	close(start)
	waitGroupWithin(t, &waitGroup)

	if got, err := backend.Get(t.Context(), ""); err != nil || got == nil {
		t.Fatalf("final Get() = %#v, %v", got, err)
	}

	temporaryFiles, err := filepath.Glob(filepath.Join(dir, ".session-*.tmp"))
	if err != nil {
		t.Fatalf("glob temporary files: %v", err)
	}

	if len(temporaryFiles) != 0 {
		t.Fatalf("leftover temporary files: %v", temporaryFiles)
	}
}

// TestFileStorageSetReportsWriteFailure pins the behaviour the swallowed errors
// used to hide: when the session cannot be persisted the caller is told, and
// can decide whether signing in again next time is acceptable.
func TestFileStorageSetReportsWriteFailure(t *testing.T) {
	t.Parallel()

	// A path whose parent is a regular file: MkdirAll cannot create the
	// directory, so the write fails.
	dir := t.TempDir()
	blocker := filepath.Join(dir, "blocker")

	if err := os.WriteFile(blocker, []byte("not a directory"), 0o600); err != nil {
		t.Fatalf("write blocker file: %v", err)
	}

	backend := &session.FileStorage{Path: filepath.Join(blocker, "session.json")}

	err := backend.Set(t.Context(), session.StoredSession{
		AccessToken:  "access-token",
		RefreshToken: "refresh-token",
	})
	if err == nil {
		t.Fatal("Set() = nil, want a write error")
	}

	var storageErr *session.StorageError
	if !errors.As(err, &storageErr) {
		t.Fatalf("Set() error = %v; want a *session.StorageError", err)
	}

	if storageErr.Op != "write" {
		t.Errorf("StorageError.Op = %q, want \"write\"", storageErr.Op)
	}
}

// TestFileStorageGetAbsentIsNotAnError keeps "no session stored" distinct from
// "the session could not be read": only the latter is an error.
func TestFileStorageGetAbsentIsNotAnError(t *testing.T) {
	t.Parallel()

	backend := &session.FileStorage{Path: filepath.Join(t.TempDir(), "session.json")}

	got, err := backend.Get(t.Context(), "")
	if err != nil {
		t.Fatalf("Get() on a missing file = %v, want nil", err)
	}

	if got != nil {
		t.Fatalf("Get() = %#v, want nil", got)
	}
}

// TestFileStorageRemoveAbsentIsNotAnError documents that clearing an already
// absent session succeeds, so sign-out is idempotent.
func TestFileStorageRemoveAbsentIsNotAnError(t *testing.T) {
	t.Parallel()

	backend := &session.FileStorage{Path: filepath.Join(t.TempDir(), "session.json")}
	if err := backend.Remove(t.Context(), ""); err != nil {
		t.Fatalf("Remove() on a missing file = %v, want nil", err)
	}
}

func sessionOf(userID, refreshToken string) session.StoredSession {
	return session.StoredSession{
		RefreshToken: refreshToken,
		DecodedToken: session.DecodedToken{Sub: userID},
	}
}

// TestSingleSessionBackendsSelectByUser pins what makes one Backend interface
// safe for a single-user program: its one session answers a request that names
// no user or its own user, and nothing else. Sharing such a backend between
// users can sign one out, never hand them another's session.
func TestSingleSessionBackendsSelectByUser(t *testing.T) {
	t.Parallel()

	backends := map[string]func(t *testing.T) session.Backend{
		"memory": func(*testing.T) session.Backend { return &session.MemoryStorage{} },
		"file": func(t *testing.T) session.Backend {
			t.Helper()

			return &session.FileStorage{Path: filepath.Join(t.TempDir(), "session.json")}
		},
	}

	for name, newBackend := range backends {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			backend := newBackend(t)
			if err := backend.Set(t.Context(), sessionOf("user-1", "refresh-1")); err != nil {
				t.Fatalf("set: %v", err)
			}

			for _, userID := range []string{"", "user-1"} {
				got, err := backend.Get(t.Context(), userID)
				if err != nil || got == nil || got.RefreshToken != "refresh-1" {
					t.Fatalf("Get(%q) = (%#v, %v), want the stored session", userID, got, err)
				}
			}

			if got, err := backend.Get(t.Context(), "user-2"); err != nil || got != nil {
				t.Fatalf("Get(user-2) = (%#v, %v), want (nil, nil)", got, err)
			}

			if err := backend.Remove(t.Context(), "user-2"); err != nil {
				t.Fatalf("Remove(user-2): %v", err)
			}

			if got, err := backend.Get(t.Context(), ""); err != nil || got == nil {
				t.Fatalf("another user's Remove cleared the session: (%#v, %v)", got, err)
			}

			if err := backend.Remove(t.Context(), "user-1"); err != nil {
				t.Fatalf("Remove(user-1): %v", err)
			}

			if got, err := backend.Get(t.Context(), ""); err != nil || got != nil {
				t.Fatalf("session after Remove = (%#v, %v), want (nil, nil)", got, err)
			}
		})
	}
}

func TestMultiUserMemoryStorage(t *testing.T) {
	t.Parallel()

	backend := &session.MultiUserMemoryStorage{}

	for _, userID := range []string{"user-1", "user-2"} {
		if err := backend.Set(t.Context(), sessionOf(userID, "refresh-"+userID)); err != nil {
			t.Fatalf("set %s: %v", userID, err)
		}
	}

	// A request that names no user must not get anyone's session.
	if got, err := backend.Get(t.Context(), ""); err != nil || got != nil {
		t.Fatalf(`Get("") = (%#v, %v), want (nil, nil)`, got, err)
	}

	for _, userID := range []string{"user-1", "user-2"} {
		got, err := backend.Get(t.Context(), userID)
		if err != nil || got == nil || got.RefreshToken != "refresh-"+userID {
			t.Fatalf("Get(%s) = (%#v, %v), want its own session", userID, got, err)
		}
	}

	if err := backend.Remove(t.Context(), "user-1"); err != nil {
		t.Fatalf("remove: %v", err)
	}

	if got, err := backend.Get(t.Context(), "user-1"); err != nil || got != nil {
		t.Fatalf("removed session = (%#v, %v), want (nil, nil)", got, err)
	}

	if got, err := backend.Get(t.Context(), "user-2"); err != nil || got == nil {
		t.Fatalf("removing user-1 affected user-2: (%#v, %v)", got, err)
	}

	err := backend.Set(t.Context(), session.StoredSession{RefreshToken: "orphan"})
	if !errors.Is(err, session.ErrSessionWithoutUserID) {
		t.Fatalf("Set without a user = %v, want ErrSessionWithoutUserID", err)
	}
}

func TestStoredSessionUserID(t *testing.T) {
	t.Parallel()

	fromToken := sessionOf("token-subject", "r")
	if got := fromToken.UserID(); got != "token-subject" {
		t.Fatalf("UserID() = %q, want the token subject", got)
	}

	fromUser := sessionOf("token-subject", "r")
	fromUser.User = &auth.User{ID: "user-id"}

	if got := fromUser.UserID(); got != "user-id" {
		t.Fatalf("UserID() = %q, want the session user's ID", got)
	}
}
