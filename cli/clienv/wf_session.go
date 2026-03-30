package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
)

// Credentials holds the stored authentication credentials for the CLI.
// RefreshToken is used for PAT-based login (standard refresh token endpoint).
// OAuth2RefreshToken is used for OAuth2 PKCE login (OAuth2 token endpoint).
type Credentials struct {
	RefreshToken       string `json:"refreshToken,omitempty"`
	OAuth2RefreshToken string `json:"oauth2RefreshToken,omitempty"`
}

var errMissingRefreshToken = errors.New(
	"credentials file is missing a refresh token; please run 'nhost login' to re-authenticate",
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
	creds, err := ce.loadCredentials(ctx)
	if err != nil {
		return "", err
	}

	if creds.RefreshToken != "" {
		return ce.loadRefreshTokenSession(ctx, creds)
	}

	return ce.loadOAuth2Session(ctx, creds)
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

	return resp.JSON200, nil
}

func (ce *CliEnv) loadRefreshTokenSession(
	ctx context.Context,
	creds Credentials,
) (string, error) {
	cl, err := ce.NewAuthClient()
	if err != nil {
		return "", err
	}

	session, err := ce.refreshToken(ctx, cl, creds)
	if err != nil {
		return "", err
	}

	if session == nil {
		creds, err = ce.Login(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to login: %w", err)
		}

		if creds.RefreshToken == "" {
			return ce.loadOAuth2Session(ctx, creds)
		}

		session, err = ce.refreshToken(ctx, cl, creds)
		if err != nil {
			return "", err
		}

		if session == nil {
			return "", fmt.Errorf( //nolint:err113
				"failed to refresh token after re-login",
			)
		}
	}

	if session.RefreshToken != creds.RefreshToken {
		creds.RefreshToken = session.RefreshToken
		if err := saveCredentials(ce, creds); err != nil {
			return "", fmt.Errorf("failed to persist new refresh token: %w", err)
		}
	}

	return session.AccessToken, nil
}

func (ce *CliEnv) loadOAuth2Session(
	ctx context.Context,
	creds Credentials,
) (string, error) {
	metadata, err := ce.FetchOAuth2Metadata(ctx)
	if err != nil {
		return "", err
	}

	src := auth.NewRotatingTokenSource(
		ctx, metadata.TokenEndpoint, ce.OAuth2ClientID(), creds.OAuth2RefreshToken,
	)

	token, err := src.Token()
	if err != nil {
		creds, err = ce.Login(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to login: %w", err)
		}

		src = auth.NewRotatingTokenSource(
			ctx, metadata.TokenEndpoint, ce.OAuth2ClientID(), creds.OAuth2RefreshToken,
		)

		token, err = src.Token()
		if err != nil {
			return "", fmt.Errorf("failed to refresh access token: %w", err)
		}
	}

	if src.GetRefreshToken() != creds.OAuth2RefreshToken {
		creds.OAuth2RefreshToken = src.GetRefreshToken()
		if err := saveCredentials(ce, creds); err != nil {
			return "", fmt.Errorf("failed to persist new refresh token: %w", err)
		}
	}

	return token.AccessToken, nil
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
