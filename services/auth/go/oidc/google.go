package oidc

import (
	"context"
	"fmt"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/golang-jwt/jwt/v5"
)

// Google's issuer and JWKS URI. Exported because the browser flow needs them
// too: the built-in google provider is an OIDC preset over a discovery
// document pinned in providers, and pointing it here keeps one copy of each.
const (
	GoogleJWKSURI = "https://www.googleapis.com/oauth2/v3/certs"
	GoogleIssuer  = "https://accounts.google.com"
)

type Google struct{}

func (g *Google) GetJWTKeyFunc(ctx context.Context) (jwt.Keyfunc, error) {
	k, err := keyfunc.NewDefaultCtx(ctx, []string{GoogleJWKSURI})
	if err != nil {
		return nil, fmt.Errorf("failed to create a jwkSet from the server's URL: %w", err)
	}

	return k.Keyfunc, nil
}

func (g *Google) GetIssuer() string {
	return GoogleIssuer
}

func (g *Google) GetValidMethods() []string {
	return []string{"RS256"}
}

func (g *Google) GetProfile(token *jwt.Token) (Profile, error) {
	return ProfileFromToken(token)
}
