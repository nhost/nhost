package agents

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

const sessionLockAcquireTimeout = 10 * time.Second

var errSessionBusy = errors.New("session is busy")

// sessionLockKey derives a 64-bit advisory lock key from sessionID using the
// first 8 bytes of SHA-256. The bigint form of pg_try_advisory_xact_lock has
// a 64-bit key space, so cross-session collisions are vanishingly unlikely
// (hashtext, by contrast, is int4 and prone to birthday collisions).
func sessionLockKey(sessionID string) int64 {
	sum := sha256.Sum256([]byte(sessionID))

	// bit-pattern reinterpretation; sign is irrelevant for the lock key.
	return int64(binary.BigEndian.Uint64(sum[0:8])) //nolint:gosec
}

// tryLockSession takes a Postgres advisory lock keyed on sessionID via
// pg_try_advisory_xact_lock. The lock is held for the lifetime of an
// underlying transaction; the returned release func rolls that transaction
// back (releasing the lock and returning the connection to the pool) and must
// be called exactly once.
//
// Returns errSessionBusy (non-blocking) when another caller holds the lock.
// Serializes per-session work across all replicas.
//
// The lock transaction is deliberately detached from ctx cancellation: callers
// persist streamed messages after client disconnects, so allowing database/sql
// to auto-rollback on request cancellation would release the serialization lock
// before that detached persistence completes. Only the acquisition query is
// bounded by a timeout; once acquired, release controls the transaction lifetime.
//
// NOTE: while held, this pins one *sql.DB connection for the lifetime of the
// calling HTTP handler (an SSE stream is many LLM turns + tool calls — tens
// of seconds). Idle sessions hold nothing; the cost scales with concurrent
// in-flight requests, not total sessions. Pool limits in cmd/serve.openPostgres
// must be sized so that peak concurrent streaming requests stay well below
// Postgres's max_connections.
func (s *Service) tryLockSession(ctx context.Context, sessionID string) (func(), error) {
	lockCtx := context.WithoutCancel(ctx)

	tx, err := s.db.BeginTx(lockCtx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin tx for session lock: %w", err)
	}

	var acquired bool

	queryCtx, cancel := context.WithTimeout(lockCtx, sessionLockAcquireTimeout)
	defer cancel()

	if err := tx.QueryRowContext(
		queryCtx,
		"SELECT pg_try_advisory_xact_lock($1)",
		sessionLockKey(sessionID),
	).Scan(&acquired); err != nil {
		_ = tx.Rollback()

		return nil, fmt.Errorf("advisory lock query: %w", err)
	}

	if !acquired {
		_ = tx.Rollback()

		return nil, errSessionBusy
	}

	return func() { _ = tx.Rollback() }, nil
}

// acquireSessionLockOrRespond wraps tryLockSession and writes the appropriate
// HTTP response on failure. Returns (release, true) on success.
func (s *Service) acquireSessionLockOrRespond(
	c *gin.Context,
	logger *slog.Logger,
	sessionID string,
) (func(), bool) {
	lockSession := s.tryLockSession
	if s.lockSession != nil {
		lockSession = s.lockSession
	}

	release, err := lockSession(c.Request.Context(), sessionID)
	if err == nil {
		return release, true
	}

	if errors.Is(err, errSessionBusy) {
		c.JSON(http.StatusConflict, gin.H{"error": "session is busy"})
		return nil, false
	}

	logger.ErrorContext(
		c.Request.Context(), "failed to acquire session lock",
		slog.String("session_id", sessionID), slog.String("error", err.Error()),
	)
	c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})

	return nil, false
}
