package agents

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	_ "github.com/lib/pq" // postgres driver registration for sql.Open("postgres", ...)
)

const defaultTestDSN = "postgres://postgres:postgres@localhost:5432/local?sslmode=disable"

// openTestDB returns a *sql.DB pointing at the dev-env postgres, or calls
// t.Skip if it cannot connect. Honors POSTGRES_CONNECTION env override.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	dsn := os.Getenv("POSTGRES_CONNECTION")
	if dsn == "" {
		dsn = defaultTestDSN
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Skipf("cannot open postgres (%s): %v", dsn, err)
	}

	if err := db.PingContext(context.Background()); err != nil {
		_ = db.Close()

		t.Skipf("cannot reach postgres (%s): %v", dsn, err)
	}

	t.Cleanup(func() { _ = db.Close() })

	return db
}

func TestSessionLockKey(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		a    string
		b    string
	}{
		{name: "differs by suffix", a: "session-1", b: "session-2"},
		{name: "differs by prefix", a: "a-session", b: "b-session"},
		{
			name: "uuid-like",
			a:    "11111111-1111-1111-1111-111111111111",
			b:    "22222222-2222-2222-2222-222222222222",
		},
		{name: "empty vs short", a: "", b: "x"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got, want := sessionLockKey(tc.a), sessionLockKey(tc.a); got != want {
				t.Fatalf("sessionLockKey(%q) not deterministic: %d vs %d", tc.a, got, want)
			}

			if sessionLockKey(tc.a) == sessionLockKey(tc.b) {
				t.Fatalf("sessionLockKey collision: %q and %q produced same key", tc.a, tc.b)
			}
		})
	}
}

func TestTryLockSessionAcquireReleaseReacquire(t *testing.T) {
	t.Parallel()

	db := openTestDB(t)
	s := &Service{db: db}

	sessionID := t.Name()

	release, err := s.tryLockSession(context.Background(), sessionID)
	if err != nil {
		t.Fatalf("first acquire should succeed, got %v", err)
	}

	if _, err := s.tryLockSession(
		context.Background(),
		sessionID,
	); !errors.Is(
		err,
		errSessionBusy,
	) {
		t.Fatalf("second acquire should be busy, got %v", err)
	}

	release()

	release2, err := s.tryLockSession(context.Background(), sessionID)
	if err != nil {
		t.Fatalf("re-acquire after release should succeed, got %v", err)
	}

	release2()
}

func TestTryLockSessionIgnoresCallerCancellationUntilRelease(t *testing.T) {
	t.Parallel()

	db := openTestDB(t)
	s := &Service{db: db}

	sessionID := t.Name()
	ctx, cancel := context.WithCancel(context.Background())

	release, err := s.tryLockSession(ctx, sessionID)
	if err != nil {
		t.Fatalf("acquire should succeed, got %v", err)
	}

	cancel()
	assertSessionLockHeld(t, s, sessionID, 250*time.Millisecond)
	release()

	release2, err := s.tryLockSession(context.Background(), sessionID)
	if err != nil {
		t.Fatalf("re-acquire after explicit release should succeed, got %v", err)
	}

	release2()
}

func assertSessionLockHeld(t *testing.T, s *Service, sessionID string, wait time.Duration) {
	t.Helper()

	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	deadline := time.NewTimer(wait)
	defer deadline.Stop()

	for {
		select {
		case <-deadline.C:
			return
		case <-ticker.C:
			release, err := s.tryLockSession(context.Background(), sessionID)
			if err == nil {
				release()
				t.Fatal("session lock was released before explicit release")
			}

			if !errors.Is(err, errSessionBusy) {
				t.Fatalf("second acquire should be busy while lock is held, got %v", err)
			}
		}
	}
}

func TestTryLockSessionDifferentSessionsDoNotConflict(t *testing.T) {
	t.Parallel()

	db := openTestDB(t)
	s := &Service{db: db}

	r1, err := s.tryLockSession(context.Background(), t.Name()+"-a")
	if err != nil {
		t.Fatalf("acquire A should succeed, got %v", err)
	}
	defer r1()

	r2, err := s.tryLockSession(context.Background(), t.Name()+"-b")
	if err != nil {
		t.Fatalf("acquire B should succeed while A held, got %v", err)
	}
	defer r2()
}

func TestTryLockSessionConcurrentAcquireOnlyOneWins(t *testing.T) {
	t.Parallel()

	db := openTestDB(t)
	s := &Service{db: db}

	sessionID := t.Name()

	const goroutines = 20

	var (
		wg      sync.WaitGroup
		winners atomic.Int32
		start   = make(chan struct{})
	)

	releaseFns := make(chan func(), goroutines)

	wg.Add(goroutines)

	for range goroutines {
		go func() {
			defer wg.Done()

			<-start

			release, err := s.tryLockSession(context.Background(), sessionID)
			if err == nil {
				winners.Add(1)

				releaseFns <- release
			} else if !errors.Is(err, errSessionBusy) {
				t.Errorf("unexpected error: %v", err)
			}
		}()
	}

	close(start)
	wg.Wait()
	close(releaseFns)

	if got := winners.Load(); got != 1 {
		t.Fatalf("expected exactly 1 winner, got %d", got)
	}

	for release := range releaseFns {
		release()
	}

	release, err := s.tryLockSession(context.Background(), sessionID)
	if err != nil {
		t.Fatalf("acquire after all winners release should succeed, got %v", err)
	}

	release()
}
