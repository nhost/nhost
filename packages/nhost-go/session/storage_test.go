package session_test

import (
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

	backend.Set(value)

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat session file: %v", err)
	}

	if got := info.Mode().Perm(); got != 0o600 {
		t.Errorf("session file mode = %o, want 600", got)
	}

	got, ok := backend.Get()
	if !ok || got.AccessToken != value.AccessToken ||
		got.RefreshToken != value.RefreshToken || got.DecodedToken.Exp != value.DecodedToken.Exp ||
		got.DecodedToken.Sub != value.DecodedToken.Sub {
		t.Fatalf("Get() = %#v, %v; want %#v, true", got, ok, value)
	}

	backend.Remove()

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

	backend := &session.FileStorage{Path: path}
	if got, ok := backend.Get(); ok || got != nil {
		t.Fatalf("Get() = %#v, %v; want nil, false", got, ok)
	}

	if _, err := os.Stat(path); err != nil {
		t.Fatalf("corrupt session file was removed: %v", err)
	}
}

func TestFileStorageConcurrentGetSet(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	backend := &session.FileStorage{Path: filepath.Join(dir, "session.json")}
	backend.Set(session.StoredSession{
		Session:      auth.Session{AccessToken: "access-0", RefreshToken: "refresh-0"},
		DecodedToken: session.DecodedToken{Exp: 1},
	})

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
					backend.Set(session.StoredSession{
						Session: auth.Session{
							AccessToken:  fmt.Sprintf("access-%d-%d", index, operation),
							RefreshToken: fmt.Sprintf("refresh-%d-%d", index, operation),
						},
						DecodedToken: session.DecodedToken{Exp: int64(operation + 1)},
					})

					continue
				}

				got, ok := backend.Get()
				if !ok || got == nil || got.AccessToken == "" || got.RefreshToken == "" {
					t.Errorf("concurrent Get() = %#v, %v", got, ok)
				}
			}
		}()
	}

	close(start)
	waitGroupWithin(t, &waitGroup, time.Second)

	if got, ok := backend.Get(); !ok || got == nil {
		t.Fatalf("final Get() = %#v, %v", got, ok)
	}

	temporaryFiles, err := filepath.Glob(filepath.Join(dir, ".session-*.tmp"))
	if err != nil {
		t.Fatalf("glob temporary files: %v", err)
	}

	if len(temporaryFiles) != 0 {
		t.Fatalf("leftover temporary files: %v", temporaryFiles)
	}
}

func TestDetectStorageReturnsIndependentBackends(t *testing.T) {
	t.Parallel()

	first := session.DetectStorage()
	second := session.DetectStorage()
	value := session.StoredSession{
		Session:      auth.Session{AccessToken: "access", RefreshToken: "refresh"},
		DecodedToken: session.DecodedToken{Exp: 12345},
	}

	first.Set(value)

	if got, ok := first.Get(); !ok || got == nil || got.AccessToken != value.AccessToken {
		t.Fatalf("first backend Get() = %#v, %v", got, ok)
	}

	if got, ok := second.Get(); ok || got != nil {
		t.Fatalf("second backend shares state: %#v, %v", got, ok)
	}

	second.Set(value)
	first.Remove()

	if _, ok := first.Get(); ok {
		t.Fatal("first backend still contains removed session")
	}

	if got, ok := second.Get(); !ok || got == nil {
		t.Fatalf("second backend was affected by first.Remove(): %#v, %v", got, ok)
	}
}
