package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/nhost/internal/lib/nhostclient/auth"
)

// Credentials holds the stored authentication credentials for the CLI.
type Credentials struct {
	RefreshToken string `json:"refreshToken"`
}

var errMissingRefreshToken = errors.New(
	"credentials file is missing a refresh token; please run 'nhost login' to re-authenticate",
)

func (ce *CliEnv) loadCredentials(
	ctx context.Context,
) (Credentials, error) {
	var creds Credentials

	err := UnmarshalFile(ce.Path.AuthFile(), &creds, json.Unmarshal)
	if err != nil || creds.RefreshToken == "" {
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
	if ce.pat != "" {
		accessToken, err := ce.signInWithPAT(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to sign in with PAT: %w", err)
		}

		return accessToken, nil
	}

	creds, err := ce.loadCredentials(ctx)
	if err != nil {
		return "", err
	}

	authClient, err := ce.NewAuthClient()
	if err != nil {
		return "", fmt.Errorf("failed to create auth client: %w", err)
	}

	metadataResp, err := authClient.GetOAuthAuthorizationServerWithResponse(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	if metadataResp.JSON200 == nil {
		return "", fmt.Errorf( //nolint:err113
			"OAuth2 metadata endpoint returned status %d",
			metadataResp.StatusCode(),
		)
	}

	src := auth.NewRotatingTokenSource(
		metadataResp.JSON200.TokenEndpoint, ce.OAuth2ClientID(), creds.RefreshToken,
	)

	token, err := src.Token(ctx)
	if err != nil {
		creds, err = ce.Login(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to login: %w", err)
		}

		src = auth.NewRotatingTokenSource(
			metadataResp.JSON200.TokenEndpoint, ce.OAuth2ClientID(), creds.RefreshToken,
		)

		token, err = src.Token(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to refresh access token: %w", err)
		}
	}

	if src.RefreshToken != creds.RefreshToken {
		creds.RefreshToken = src.RefreshToken
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

	if creds.RefreshToken == "" {
		return Credentials{}, errMissingRefreshToken
	}

	return creds, nil
}
