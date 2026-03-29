package clienv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/nhost/nhost/cli/nhostclient"
	"github.com/nhost/nhost/cli/nhostclient/credentials"
)

var errMissingRefreshToken = errors.New(
	"credentials file is missing a refresh token; please run 'nhost login' to re-authenticate",
)

func (ce *CliEnv) loadCredentials(
	ctx context.Context,
) (credentials.Credentials, error) {
	var creds credentials.Credentials

	err := UnmarshalFile(ce.Path.AuthFile(), &creds, json.Unmarshal)
	if err != nil || creds.RefreshToken == "" {
		creds, err = ce.Login(ctx)
		if err != nil {
			return credentials.Credentials{}, fmt.Errorf("failed to login: %w", err)
		}
	}

	return creds, nil
}

func (ce *CliEnv) LoadSession(
	ctx context.Context,
) (string, error) {
	if ce.pat != "" {
		accessToken, err := signInWithPAT(ctx, ce.AuthURL(), ce.pat)
		if err != nil {
			return "", fmt.Errorf("failed to sign in with PAT: %w", err)
		}

		return accessToken, nil
	}

	creds, err := ce.loadCredentials(ctx)
	if err != nil {
		return "", err
	}

	metadata, err := FetchOAuth2Metadata(ctx, ce.OAuth2Issuer())
	if err != nil {
		return "", fmt.Errorf("failed to fetch OAuth2 metadata: %w", err)
	}

	src := nhostclient.NewRotatingTokenSource(
		metadata.TokenEndpoint, ce.OAuth2ClientID(), creds.RefreshToken,
	)

	token, err := src.Token()
	if err != nil {
		creds, err = ce.Login(ctx)
		if err != nil {
			return "", fmt.Errorf("failed to login: %w", err)
		}

		src = nhostclient.NewRotatingTokenSource(
			metadata.TokenEndpoint, ce.OAuth2ClientID(), creds.RefreshToken,
		)

		token, err = src.Token()
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

func (ce *CliEnv) Credentials() (credentials.Credentials, error) {
	var creds credentials.Credentials
	if err := UnmarshalFile(ce.Path.AuthFile(), &creds, json.Unmarshal); err != nil {
		return credentials.Credentials{}, err
	}

	if creds.RefreshToken == "" {
		return credentials.Credentials{}, errMissingRefreshToken
	}

	return creds, nil
}
