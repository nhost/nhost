package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
	"golang.org/x/oauth2"
)

// Credentials holds the stored authentication credentials for the CLI.
// RefreshToken is used for PAT-based login (standard refresh token endpoint).
// OAuth2RefreshToken is used for OAuth2 PKCE login (OAuth2 token endpoint).
type Credentials struct {
	RefreshToken       string `json:"refreshToken,omitempty"`
	OAuth2RefreshToken string `json:"oauth2RefreshToken,omitempty"`
}

var (
	errMissingRefreshToken = errors.New(
		"credentials file is missing a refresh token; please run 'nhost login' to re-authenticate",
	)
	errRefreshFailed = errors.New("failed to refresh access token")
)

func (ce *CliEnv) loadCredentials(
	ctx context.Context,
) (Credentials, error) {
	var creds Credentials

	err := UnmarshalFile(ce.Path.AuthFile(), &creds, json.Unmarshal)
	if err != nil || (creds.RefreshToken == "" && creds.OAuth2RefreshToken == "") {
		creds, err = ce.Login(ctx)
		if err != nil {
			return Credentials{}, fmt.Errorf("failed to login: %w", err)
		}
	}

	return creds, nil
}

func (ce *CliEnv) LoadSession(
	ctx context.Context,
) (string, error) {
	if _, err := ce.loadCredentials(ctx); err != nil {
		return "", err
	}

	token, err := ce.refreshSession(ctx)
	if errors.Is(err, errRefreshFailed) {
		if _, err := ce.Login(ctx); err != nil {
			return "", fmt.Errorf("failed to login: %w", err)
		}

		token, err = ce.refreshSession(ctx)
	}

	if err != nil {
		return "", err
	}

	return token.AccessToken, nil
}

// Refresh tokens are single-use, so the credentials are read, refreshed and
// saved under the lock: CLI processes never refresh with the same token.
func (ce *CliEnv) refreshSession(ctx context.Context) (*oauth2.Token, error) {
	var token *oauth2.Token

	err := ce.withCredentialsLock(func() error {
		creds, err := ce.Credentials()
		if err != nil {
			return err
		}

		if creds.OAuth2RefreshToken != "" {
			token, err = ce.refreshOAuth2Session(ctx, &creds)
		} else {
			token, err = ce.refreshPATSession(ctx, &creds)
		}

		if err != nil {
			return err
		}

		if err := saveCredentials(ce, creds); err != nil {
			return fmt.Errorf("failed to persist new refresh token: %w", err)
		}

		return nil
	})

	return token, err
}

func (ce *CliEnv) refreshToken(
	ctx context.Context,
	cl auth.ClientWithResponsesInterface,
	creds Credentials,
) (*auth.Session, error) {
	resp, err := cl.RefreshTokenWithResponse(ctx, auth.RefreshTokenJSONRequestBody{
		RefreshToken: creds.RefreshToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}

	if resp.StatusCode() == http.StatusUnauthorized {
		return nil, fmt.Errorf(
			"%w: error during token refresh: %s\n%s",
			errRefreshFailed,
			resp.Status(),
			resp.Body,
		)
	}

	if resp.StatusCode() != http.StatusOK {
		return nil, fmt.Errorf( //nolint:err113
			"error during token refresh: %s\n%s",
			resp.Status(),
			resp.Body,
		)
	}

	return resp.JSON200, nil
}

func (ce *CliEnv) refreshPATSession(
	ctx context.Context,
	creds *Credentials,
) (*oauth2.Token, error) {
	cl, err := ce.NewAuthClient()
	if err != nil {
		return nil, err
	}

	session, err := ce.refreshToken(ctx, cl, *creds)
	if err != nil {
		return nil, err
	}

	if session.RefreshToken != "" {
		creds.RefreshToken = session.RefreshToken
	}

	return &oauth2.Token{ //nolint:exhaustruct
		AccessToken: session.AccessToken,
		Expiry: time.Now().Add(
			time.Duration(session.AccessTokenExpiresIn) * time.Second,
		),
	}, nil
}

func (ce *CliEnv) refreshOAuth2Session(
	ctx context.Context,
	creds *Credentials,
) (*oauth2.Token, error) {
	metadata, err := ce.FetchOAuth2Metadata(ctx)
	if err != nil {
		return nil, err
	}

	src := auth.NewRotatingTokenSource(
		ctx, metadata.TokenEndpoint, ce.OAuth2ClientID(), creds.OAuth2RefreshToken,
	)

	token, err := src.Token()
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errRefreshFailed, err)
	}

	creds.OAuth2RefreshToken = src.GetRefreshToken()

	return token, nil
}

func (ce *CliEnv) Credentials() (Credentials, error) {
	var creds Credentials
	if err := UnmarshalFile(ce.Path.AuthFile(), &creds, json.Unmarshal); err != nil {
		return Credentials{}, err
	}

	if creds.RefreshToken == "" && creds.OAuth2RefreshToken == "" {
		return Credentials{}, errMissingRefreshToken
	}

	return creds, nil
}
