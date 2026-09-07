package session_test

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/session"
)

func TestFileStorageRoundTrip(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "nested", "session.json")
	backend := &session.FileStorage{Path: path}
	value := session.StoredSession{
		Session: auth.Session{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
		DecodedToken: session.DecodedToken{Exp: 12345, Sub: "user-1"},
	}

	if err := backend.Set(value); err != nil {
		t.Fatalf("Set: %v", err)
	}

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat session file: %v", err)
	}

	if got := info.Mode().Perm(); got != 0o600 {
		t.Errorf("session file mode = %o, want 600", got)
	}

	got, err := backend.Get()
	if err != nil || got == nil || got.AccessToken != value.AccessToken ||
		got.RefreshToken != value.RefreshToken || got.DecodedToken.Exp != value.DecodedToken.Exp ||
		got.DecodedToken.Sub != value.DecodedToken.Sub {
		t.Fatalf("Get() = %#v, %v; want %#v, nil", got, err, value)
	}

	if err := backend.Remove(); err != nil {
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

	got, err := backend.Get()
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
	if err := backend.Set(session.StoredSession{
		Session:      auth.Session{AccessToken: "access-0", RefreshToken: "refresh-0"},
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
					if err := backend.Set(session.StoredSession{
						Session: auth.Session{
							AccessToken:  fmt.Sprintf("access-%d-%d", index, operation),
							RefreshToken: fmt.Sprintf("refresh-%d-%d", index, operation),
						},
						DecodedToken: session.DecodedToken{Exp: int64(operation + 1)},
					}); err != nil {
						t.Errorf("concurrent Set() = %v", err)
					}

					continue
				}

				got, err := backend.Get()
				if err != nil || got == nil || got.AccessToken == "" || got.RefreshToken == "" {
					t.Errorf("concurrent Get() = %#v, %v", got, err)
				}
			}
		}()
	}

	close(start)
	waitGroupWithin(t, &waitGroup, time.Second)

	if got, err := backend.Get(); err != nil || got == nil {
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

	err := backend.Set(session.StoredSession{ //nolint:exhaustruct_v5
		Session: auth.Session{ //nolint:exhaustruct_v5
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
		},
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

	got, err := backend.Get()
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
	if err := backend.Remove(); err != nil {
		t.Fatalf("Remove() on a missing file = %v, want nil", err)
	}
}
