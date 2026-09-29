package session

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/transport"
)

const unauthorized = 401

var errRefreshReentrant = errors.New("session refresh is already in progress on this call path")

type refreshContextKey struct{}

// refreshAttemptError records which refresh token a failed refresh exchanged,
// so a rejection clears that session and not one another process has since
// stored in its place.
type refreshAttemptError struct {
	refreshToken string
	err          error
}

func (e *refreshAttemptError) Error() string { return e.err.Error() }

func (e *refreshAttemptError) Unwrap() error { return e.err }

// needsRefresh reports (session, needsRefresh, sessionExpired) for the current
// stored session given a margin (seconds before expiry to refresh). A backend
// read failure is returned rather than reported as "no session", so an
// unreadable store never silently looks like a signed out user.
func (s *Storage) needsRefresh(
	ctx context.Context,
	marginSeconds int,
) (*StoredSession, bool, bool, error) {
	session, err := s.Get(ctx)
	if err != nil {
		return nil, false, false, err
	}

	if session == nil {
		return nil, false, false, nil
	}

	exp := session.DecodedToken.Exp
	if exp == 0 {
		return session, true, true, nil
	}

	now := time.Now().Unix()
	if marginSeconds == 0 {
		return session, true, exp < now, nil
	}

	if exp-now > int64(marginSeconds) {
		return session, false, false, nil
	}

	return session, true, exp < now, nil
}

func sessionOnRefreshError(session *StoredSession, expired bool) *StoredSession {
	if expired {
		return nil
	}

	return session
}

func refreshOnce(
	ctx context.Context,
	authClient *auth.Client,
	storage *Storage,
	marginSeconds int,
) (*StoredSession, error) {
	session, needs, sessionExpired, err := storage.needsRefresh(ctx, marginSeconds)
	if err != nil {
		return nil, fmt.Errorf("reading stored session: %w", err)
	}

	if session == nil {
		return nil, nil //nolint:nilnil
	}

	if !needs {
		return session, nil
	}

	if ctx.Value(refreshContextKey{}) == storage {
		return sessionOnRefreshError(session, sessionExpired), errRefreshReentrant
	}

	call, leader := storage.beginRefresh(session.RefreshToken)
	if !leader {
		select {
		case <-call.done:
			return call.session, call.err
		case <-ctx.Done():
			// A read failure here leaves session nil, which yields no session
			// below; the context error is the one worth reporting.
			session, _, sessionExpired, _ = storage.needsRefresh(ctx, marginSeconds)

			return sessionOnRefreshError(session, sessionExpired), fmt.Errorf(
				"waiting for in-progress session refresh: %w", ctx.Err(),
			)
		}
	}

	var (
		result     *StoredSession
		refreshErr error
	)

	defer func() {
		storage.finishRefresh(session.RefreshToken, call, result, refreshErr)
	}()

	result, refreshErr = performRefresh(ctx, authClient, storage, marginSeconds)

	return result, refreshErr
}

func performRefresh(
	ctx context.Context,
	authClient *auth.Client,
	storage *Storage,
	marginSeconds int,
) (*StoredSession, error) {
	// Another refresh may have completed between the first check and this call
	// becoming the in-flight leader.
	session, needs, sessionExpired, err := storage.needsRefresh(ctx, marginSeconds)
	if err != nil {
		return nil, fmt.Errorf("reading stored session: %w", err)
	}

	if session == nil {
		return nil, nil //nolint:nilnil
	}

	if !needs {
		return session, nil
	}

	refreshCtx := context.WithValue(ctx, refreshContextKey{}, storage)

	refreshed, _, err := authClient.RefreshToken(
		refreshCtx,
		auth.RefreshTokenRequest{RefreshToken: session.RefreshToken},
		nil,
	)
	if err != nil {
		return sessionOnRefreshError(session, sessionExpired), &refreshAttemptError{
			refreshToken: session.RefreshToken,
			err:          fmt.Errorf("refreshing session token: %w", err),
		}
	}

	if err := storage.Set(ctx, refreshed); err != nil {
		return sessionOnRefreshError(session, sessionExpired), fmt.Errorf(
			"storing refreshed session: %w", err,
		)
	}

	out, err := storage.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("reading refreshed session: %w", err)
	}

	return out, nil
}

// RefreshSession refreshes the session ctx selects (see [WithUserID]) if it is
// close to expiry, collapsing concurrent attempts on the same session into one
// request. A marginSeconds value of zero forces a refresh. It retries once on
// failure. If the refresh token is rejected with 401 it clears the stored
// session and returns (nil, nil) — unless the store by then holds a session with
// a different refresh token, which another process refreshed first, in which
// case that session is returned. Any other final error is returned; if the
// access token is still valid, the existing session is returned with that error
// so callers may keep using it while handling the refresh failure.
//
// The supplied authClient must be bare: its HTTP transport must not include
// session-refresh middleware. A reentrancy guard prevents a misconfigured
// client from deadlocking, but callers should not rely on that fallback.
func RefreshSession(
	ctx context.Context,
	authClient *auth.Client,
	storage *Storage,
	marginSeconds int,
) (*StoredSession, error) {
	session, err := refreshOnce(ctx, authClient, storage, marginSeconds)
	if err == nil {
		return session, nil
	}

	slog.Debug("error refreshing session, retrying", "error", err)

	session, err = refreshOnce(ctx, authClient, storage, marginSeconds)
	if err == nil {
		return session, nil
	}

	apiErr, isAPIErr := errors.AsType[*transport.APIError](err)
	attempt, isAttempt := errors.AsType[*refreshAttemptError](err)

	if isAPIErr && isAttempt && apiErr.Status == unauthorized {
		current, removed, removeErr := storage.removeRejected(ctx, attempt.refreshToken)
		if removed {
			slog.Debug("refresh token rejected; clearing session", "error", err)
		}

		// The refresh token was rejected, so the stored session is unusable.
		// If it could not be cleared, say so rather than reporting a clean
		// sign-out while a dead session stays behind.
		if removeErr != nil {
			return nil, fmt.Errorf("clearing rejected session: %w", removeErr)
		}

		if current != nil {
			slog.Debug("refresh token rejected, but the session was refreshed elsewhere")

			return current, nil
		}

		return nil, nil //nolint:nilnil
	}

	return session, err
}
