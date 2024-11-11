package oidc

import (
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

const (
	appleJWKURL       = "https://appleid.apple.com/auth/keys"
	appleIssuer       = "https://appleid.apple.com"
	appleValidMethods = "RS256"
)

type Apple struct{}

func (a *Apple) GetJWKURL() string {
	return appleJWKURL
}

func (a *Apple) GetIssuer() string {
	return appleIssuer
}

func (a *Apple) GetValidMethods() string {
	return appleValidMethods
}

func (a *Apple) GetProfile(token *jwt.Token) (Profile, error) {
	sub, err := getClaim[string](token, "sub")
	if err != nil {
		return Profile{}, fmt.Errorf("failed to get sub claim from token: %w", err)
	}

	email, err := getClaim[string](token, "email")
	if err != nil {
		return Profile{}, fmt.Errorf("failed to get email claim from token: %w", err)
	}

	return Profile{
		ProviderUserID: sub,
		Email:          email,
		EmailVerified:  true,
		Name:           "",
		Picture:        "",
	}, nil
}
