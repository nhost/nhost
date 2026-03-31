package nhostclient

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"golang.org/x/oauth2"
)

// WithOAuth2RefreshToken returns an HTTP request interceptor that automatically
// refreshes and injects an OAuth2 access token using a rotating refresh token.
func WithOAuth2RefreshToken(
	src *auth.RotatingTokenSource,
) func(ctx context.Context, req *http.Request) error {
	tokenSource := oauth2.ReuseTokenSource(nil, src)

	return func(_ context.Context, req *http.Request) error {
		t, err := tokenSource.Token()
		if err != nil {
			return fmt.Errorf("failed to refresh access token: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+t.AccessToken)

		return nil
	}
}

// RefreshTokenInterceptor authenticates HTTP requests using the standard
// refresh token endpoint, caching the session and refreshing it when it
// nears expiry. It tracks refresh token rotation so callers can persist
// the latest token via GetRefreshToken.
type RefreshTokenInterceptor struct {
	cl auth.ClientWithResponsesInterface

	mu          sync.Mutex
	accessToken string
	currentRT   string
	expiresAt   time.Time
}

// NewRefreshTokenInterceptor creates a RefreshTokenInterceptor.
func NewRefreshTokenInterceptor(
	cl auth.ClientWithResponsesInterface,
	refreshToken string,
) *RefreshTokenInterceptor {
	return &RefreshTokenInterceptor{
		cl:          cl,
		mu:          sync.Mutex{},
		accessToken: "",
		currentRT:   refreshToken,
		expiresAt:   time.Time{},
	}
}

// GetRefreshToken returns the current refresh token in a thread-safe manner.
func (i *RefreshTokenInterceptor) GetRefreshToken() string {
	i.mu.Lock()
	defer i.mu.Unlock()

	return i.currentRT
}

// Intercept is the HTTP request interceptor that injects the access token.
func (i *RefreshTokenInterceptor) Intercept(
	ctx context.Context,
	req *http.Request,
) error {
	i.mu.Lock()
	defer i.mu.Unlock()

	if time.Now().Add(time.Minute).After(i.expiresAt) {
		resp, err := i.cl.RefreshTokenWithResponse(
			ctx,
			auth.RefreshTokenJSONRequestBody{
				RefreshToken: i.currentRT,
			},
		)
		if err != nil {
			return fmt.Errorf("failed to refresh token: %w", err)
		}

		if resp.StatusCode() != http.StatusOK {
			return fmt.Errorf( //nolint:err113
				"error during token refresh: %s\n%s",
				resp.Status(),
				resp.Body,
			)
		}

		i.accessToken = resp.JSON200.AccessToken
		i.expiresAt = time.Now().Add(
			time.Second * time.Duration(resp.JSON200.AccessTokenExpiresIn))

		if resp.JSON200.RefreshToken != "" {
			i.currentRT = resp.JSON200.RefreshToken
		}
	}

	req.Header.Set("Authorization", "Bearer "+i.accessToken)

	return nil
}

// WithPAT returns an HTTP request interceptor that authenticates using a
// Personal Access Token, caching the session and refreshing it when it
// nears expiry.
func WithPAT(
	cl auth.ClientWithResponsesInterface,
	pat string,
) func(ctx context.Context, req *http.Request) error {
	var (
		mu          sync.Mutex
		accessToken string
		expiresAt   time.Time
	)

	return func(ctx context.Context, req *http.Request) error {
		mu.Lock()
		defer mu.Unlock()

		if time.Now().Add(time.Minute).After(expiresAt) {
			resp, err := cl.SignInPATWithResponse(
				ctx,
				auth.SignInPATJSONRequestBody{
					PersonalAccessToken: pat,
				},
			)
			if err != nil {
				return fmt.Errorf("failed to sign in with PAT: %w", err)
			}

			if resp.StatusCode() != http.StatusOK {
				return fmt.Errorf( //nolint:err113
					"error during sign in: %s\n%s",
					resp.Status(),
					resp.Body,
				)
			}

			accessToken = resp.JSON200.Session.AccessToken
			expiresAt = time.Now().Add(
				time.Second * time.Duration(resp.JSON200.Session.AccessTokenExpiresIn))
		}

		req.Header.Set("Authorization", "Bearer "+accessToken)

		return nil
	}
}

// WithAdminSecret returns an HTTP request interceptor that injects
// the Hasura admin secret header.
func WithAdminSecret(
	adminSecret string,
) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Set("X-Hasura-Admin-Secret", adminSecret)
		return nil
	}
}

// WithRole returns an HTTP request interceptor that injects the
// Hasura role header.
func WithRole(
	role string,
) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Set("X-Hasura-Role", role)
		return nil
	}
}

// WithUserID returns an HTTP request interceptor that injects the
// Hasura user ID header.
func WithUserID(
	userID string,
) func(ctx context.Context, req *http.Request) error {
	return func(_ context.Context, req *http.Request) error {
		req.Header.Set("X-Hasura-User-Id", userID)
		return nil
	}
}
