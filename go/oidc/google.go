package oidc

import (
	"context"
	"errors"
	"fmt"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

const (
	googleJWKURL       = "https://www.googleapis.com/oauth2/v3/certs"
	googleIssuer       = "https://accounts.google.com"
	googleValidMethods = "RS256"
)

type Google struct{}

func (g *Google) GetJWTKeyFunc(ctx context.Context) (jwt.Keyfunc, error) {
	k, err := keyfunc.NewDefaultCtx(ctx, []string{googleJWKURL})
	if err != nil {
		return nil, fmt.Errorf("failed to create a jwkSet from the server's URL: %w", err)
	}

	return k.Keyfunc, nil
}

func (g *Google) GetIssuer() string {
	return googleIssuer
}

func (g *Google) GetValidMethods() string {
	return googleValidMethods
}

func (g *Google) GetProfile(token *jwt.Token) (Profile, error) {
	return getProfile(token)
}

func getProfile(token *jwt.Token) (Profile, error) {
	sub, err := getClaim[string](token, "sub")
	if err != nil {
		return Profile{}, fmt.Errorf("failed to get sub claim from token: %w", err)
	}

	email, err := getClaim[string](token, "email")
	if err != nil {
		return Profile{}, fmt.Errorf("failed to get email claim from token: %w", err)
	}

	emailVerified, err := getClaim[bool](token, "email_verified")
	if err != nil && !errors.Is(err, ErrClaimNotFound) {
		return Profile{}, fmt.Errorf("failed to get email_verified claim from token: %w", err)
	}

	name, err := getClaim[string](token, "name")
	if err != nil && !errors.Is(err, ErrClaimNotFound) {
		return Profile{}, fmt.Errorf("failed to get name claim from token: %w", err)
	}

	picture, err := getClaim[string](token, "picture")
	if err != nil && !errors.Is(err, ErrClaimNotFound) {
		return Profile{}, fmt.Errorf("failed to get picture claim from token: %w", err)
	}

	return Profile{
		ProviderUserID: sub,
		Email:          email,
		EmailVerified:  emailVerified,
		Name:           name,
		Picture:        picture,
	}, nil
}
