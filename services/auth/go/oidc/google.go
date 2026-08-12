package oidc

import (
	"context"
	"fmt"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

const (
	googleJWKURL = "https://www.googleapis.com/oauth2/v3/certs"
	googleIssuer = "https://accounts.google.com"
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

func (g *Google) GetValidMethods() []string {
	return []string{"RS256"}
}

func (g *Google) GetProfile(token *jwt.Token) (Profile, error) {
	return ProfileFromToken(token)
}
