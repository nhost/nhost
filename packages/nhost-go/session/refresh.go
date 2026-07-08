package session

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/nhost/nhost/packages/nhost-go/auth"
	"github.com/nhost/nhost/packages/nhost-go/fetch"
)

const unauthorized = 401

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

	if marginSeconds == 0 {
		return session, true, false
	}

	now := time.Now().Unix()
	if exp-now > int64(marginSeconds) {
		return session, false, false
	}

	return session, true, exp < now
}

func refreshOnce(
	ctx context.Context,
	authClient *auth.Client,
	storage *Storage,
	marginSeconds int,
) (*StoredSession, error) {
	session, needs, _ := storage.needsRefresh(marginSeconds)
	if session == nil {
		return nil, nil //nolint:nilnil
	}

	if !needs {
		return session, nil
	}

	storage.refreshMu.Lock()
	defer storage.refreshMu.Unlock()

	session, needs, sessionExpired := storage.needsRefresh(marginSeconds)
	if session == nil {
		return nil, nil //nolint:nilnil
	}

	if !needs {
		return session, nil
	}

	resp, err := authClient.RefreshToken(
		ctx,
		auth.RefreshTokenRequest{RefreshToken: session.RefreshToken},
		nil,
	)
	if err != nil {
		if !sessionExpired {
			return session, nil
		}

		return nil, err //nolint:wrapcheck
	}

	if err := storage.Set(resp.Body); err != nil {
		return nil, err
	}

	out, _ := storage.Get()

	return out, nil
}

// RefreshSession refreshes the session if it is close to expiry. It retries
// once on transient failure; clears the stored session and returns (nil, nil)
// if the refresh token is rejected with 401.
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

	slog.Warn("error refreshing session, retrying", "error", err)

	session, err = refreshOnce(ctx, authClient, storage, marginSeconds)
	if err == nil {
		return session, nil
	}

	var fetchErr *fetch.FetchError
	if errors.As(err, &fetchErr) && fetchErr.Status == unauthorized {
		slog.Error("session probably expired")
		storage.Remove()
	}

	return nil, nil //nolint:nilnil
}
