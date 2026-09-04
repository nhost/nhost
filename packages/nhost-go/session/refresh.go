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

// needsRefresh reports (session, needsRefresh, sessionExpired) for the current
// stored session given a margin (seconds before expiry to refresh).
func (s *Storage) needsRefresh(marginSeconds int) (*StoredSession, bool, bool) {
	session, ok := s.Get()
	if !ok {
		return nil, false, false
	}

	exp := session.DecodedToken.Exp
	if exp == 0 {
		return session, true, true
	}

	now := time.Now().Unix()
	if marginSeconds == 0 {
		return session, true, exp < now
	}

	if exp-now > int64(marginSeconds) {
		return session, false, false
	}

	return session, true, exp < now
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
	session, needs, sessionExpired := storage.needsRefresh(marginSeconds)
	if session == nil {
		return nil, nil //nolint:nilnil
	}

	if !needs {
		return session, nil
	}

	if ctx.Value(refreshContextKey{}) == storage {
		return sessionOnRefreshError(session, sessionExpired), errRefreshReentrant
	}

	call, leader := storage.beginRefresh()
	if !leader {
		select {
		case <-call.done:
			return call.session, call.err
		case <-ctx.Done():
			session, _, sessionExpired = storage.needsRefresh(marginSeconds)

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
		storage.finishRefresh(call, result, refreshErr)
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
	session, needs, sessionExpired := storage.needsRefresh(marginSeconds)
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
		return sessionOnRefreshError(session, sessionExpired), fmt.Errorf(
			"refreshing session token: %w", err,
		)
	}

	if err := storage.Set(refreshed); err != nil {
		return sessionOnRefreshError(session, sessionExpired), fmt.Errorf(
			"storing refreshed session: %w", err,
		)
	}

	out, _ := storage.Get()

	return out, nil
}

// RefreshSession refreshes the session if it is close to expiry and collapses
// concurrent attempts into one request. A marginSeconds value of zero forces a
// refresh. It retries once on failure. If the refresh token is rejected with
// 401 it clears the stored session and returns (nil, nil). Any other final
// error is returned; if the access token is still valid, the existing session
// is returned with that error so callers may keep using it while handling the
// refresh failure.
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

	var apiErr *transport.APIError
	if errors.As(err, &apiErr) && apiErr.Status == unauthorized {
		if storage.removeIfPresent() {
			slog.Debug("refresh token rejected; clearing session", "error", err)
		}

		return nil, nil //nolint:nilnil
	}

	return session, err
}
