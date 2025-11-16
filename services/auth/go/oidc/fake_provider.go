package oidc

import (
	"context"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

const (
	fakeProviderIssuer       = "fake.issuer"
	fakeProviderValidMethods = "HS256"
	fakeProviderKey          = "5152fa850c02dc222631cca898ed1485821a70912a6e3649c49076912daa3b62182ba013315915d64f40cddfbb8b58eb5bd11ba225336a6af45bbae07ca873f3" //nolint:lll
)

type FakeProvider struct{}

func (f *FakeProvider) GetJWTKeyFunc(_ context.Context) (jwt.Keyfunc, error) {
	return func(_ *jwt.Token) (interface{}, error) {
		return []byte(fakeProviderKey), nil
	}, nil
}

func (f *FakeProvider) GetIssuer() string {
	return fakeProviderIssuer
}

func (f *FakeProvider) GetValidMethods() string {
	return fakeProviderValidMethods
}

func (f *FakeProvider) GetProfile(token *jwt.Token) (Profile, error) {
	return getProfile(token)
}

func (f *FakeProvider) GenerateTestIDToken(claims jwt.Claims) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	ss, err := token.SignedString([]byte(fakeProviderKey))
	if err != nil {
		return "", fmt.Errorf("error signing token: %w", err)
	}

	return ss, nil
}
