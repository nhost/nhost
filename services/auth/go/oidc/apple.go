package oidc

import (
	"context"
	"fmt"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

const (
	appleJWKURL       = "https://appleid.apple.com/auth/keys"
	appleIssuer       = "https://appleid.apple.com"
	appleValidMethods = "RS256"
)

type Apple struct{}

func (a *Apple) GetJWTKeyFunc(ctx context.Context) (jwt.Keyfunc, error) {
	k, err := keyfunc.NewDefaultCtx(ctx, []string{appleJWKURL})
	if err != nil {
		return nil, fmt.Errorf("failed to create a jwkSet from the server's URL: %w", err)
	}

	return k.Keyfunc, nil
}

func (a *Apple) GetIssuer() string {
	return appleIssuer
}

func (a *Apple) GetValidMethods() string {
	return appleValidMethods
}

func (a *Apple) GetProfile(token *jwt.Token) (Profile, error) {
	return getProfile(token)
}
