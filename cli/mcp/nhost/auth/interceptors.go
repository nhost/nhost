package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/nhost/cli/nhostclient"
	"golang.org/x/oauth2"
)

var ErrSigninIn = errors.New("error during sign in")

func WithRefreshToken(
	tokenEndpoint string,
	clientID string,
	refreshToken string,
) func(ctx context.Context, req *http.Request) error {
	src := nhostclient.NewRotatingTokenSource(tokenEndpoint, clientID, refreshToken)
	tokenSource := oauth2.ReuseTokenSource(nil, src)

	return func(_ context.Context, req *http.Request) error {
		t, err := tokenSource.Token()
		if err != nil {
			return fmt.Errorf("failed to refresh access token: %w", err)
		}

		req.Header.Add("Authorization", "Bearer "+t.AccessToken)

		return nil
	}
}

func WithPAT(
	url string,
	pat string,
) (func(ctx context.Context, req *http.Request) error, error) {
	authc, err := NewClientWithResponses(url)
	if err != nil {
		return nil, fmt.Errorf("couldn't not create auth client: %w", err)
	}

	session := &struct {
		AccessToken string
		ExpiresAt   time.Time
	}{
		AccessToken: "",
		ExpiresAt:   time.Time{},
	}

	return func(ctx context.Context, req *http.Request) error {
		if time.Now().Add(time.Minute).After(session.ExpiresAt) {
			resp, err := authc.PostSigninPatWithResponse(
				ctx,
				SignInPATRequest{
					PersonalAccessToken: pat,
				},
			)
			if err != nil {
				return fmt.Errorf("failed to sign in with PAT: %w", err)
			}

			if resp.StatusCode() != http.StatusOK {
				return fmt.Errorf("%w: %s\n%s", ErrSigninIn, resp.Status(), resp.Body)
			}

			session.AccessToken = resp.JSON200.Session.AccessToken
			session.ExpiresAt = time.Now().Add(
				time.Second * time.Duration(resp.JSON200.Session.AccessTokenExpiresIn))
		}

		req.Header.Add("Authorization", "Bearer "+session.AccessToken)

		return nil
	}, nil
}

func WithAdminSecret(
	adminSecret string,
) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Add("X-Hasura-Admin-Secret", adminSecret)
		return nil
	}
}

func WithRole(
	role string,
) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Add("X-Hasura-Role", role)
		return nil
	}
}

func WithUserID(
	userID string,
) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Add("X-Hasura-User-Id", userID)
		return nil
	}
}
