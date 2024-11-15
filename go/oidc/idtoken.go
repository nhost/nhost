package oidc

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/hasura-auth/go/api"
)

func getClaim[T any](token *jwt.Token, claim string) (T, error) { //nolint:ireturn
	var claimValue T
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return claimValue, ErrInvalidClaims
	}

	claimValue, ok = claims[claim].(T)
	if !ok {
		return claimValue, fmt.Errorf("%w: %s", ErrClaimNotFound, claim)
	}

	return claimValue, nil
}

type IDTokenValidatorProviders struct {
	AppleID      *IDTokenValidator
	Google       *IDTokenValidator
	FakeProvider *IDTokenValidator
}

func NewIDTokenValidatorProviders(
	ctx context.Context,
	appleClientID, googleClientID string, fakeProviderAudience string,
	parserOptions ...jwt.ParserOption,
) (*IDTokenValidatorProviders, error) {
	var appleID *IDTokenValidator
	if appleClientID != "" {
		var err error
		appleID, err = NewIDTokenValidator(ctx, api.Apple, appleClientID, parserOptions...)
		if err != nil {
			return nil, fmt.Errorf("failed to create Apple ID token validator: %w", err)
		}
	}

	var google *IDTokenValidator
	if googleClientID != "" {
		var err error
		google, err = NewIDTokenValidator(ctx, api.Google, googleClientID, parserOptions...)
		if err != nil {
			return nil, fmt.Errorf("failed to create Google ID token validator: %w", err)
		}
	}

	var fakeProvider *IDTokenValidator
	if fakeProviderAudience != "" {
		var err error
		fakeProvider, err = NewIDTokenValidator(
			ctx, api.FakeProvider, fakeProviderAudience, parserOptions...,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Fake ID token validator: %w", err)
		}
	}

	return &IDTokenValidatorProviders{
		AppleID:      appleID,
		Google:       google,
		FakeProvider: fakeProvider,
	}, nil
}

type Provider interface {
	GetJWTKeyFunc(ctx context.Context) (jwt.Keyfunc, error)
	GetIssuer() string
	GetValidMethods() string
	GetProfile(token *jwt.Token) (Profile, error)
}

type IDTokenValidator struct {
	provider      Provider
	parserOptions []jwt.ParserOption
	jwtKeyFunc    jwt.Keyfunc
}

func NewIDTokenValidator(
	ctx context.Context,
	providerName api.Provider,
	audience string,
	options ...jwt.ParserOption,
) (*IDTokenValidator, error) {
	var provider Provider
	switch providerName {
	case api.Apple:
		provider = &Apple{}
	case api.Google:
		provider = &Google{}
	case api.FakeProvider:
		provider = &FakeProvider{}
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedProvider, providerName)
	}

	keyFunc, err := provider.GetJWTKeyFunc(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get JWT key function from provider: %w", err)
	}

	return &IDTokenValidator{
		provider:   provider,
		jwtKeyFunc: keyFunc,
		parserOptions: append(
			[]jwt.ParserOption{
				jwt.WithAudience(audience),
				jwt.WithIssuer(provider.GetIssuer()),
				jwt.WithValidMethods([]string{provider.GetValidMethods()}),
				jwt.WithIssuedAt(),
				jwt.WithExpirationRequired(),
			}, options...,
		),
	}, nil
}

func (a *IDTokenValidator) Validate(
	tokenString, nonce string, options ...jwt.ParserOption,
) (*jwt.Token, error) {
	options = append(
		options,
		a.parserOptions...,
	)

	token, err := jwt.Parse(tokenString, a.jwtKeyFunc, options...)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}

	if err := validateNonce(token, nonce); err != nil {
		return nil, err
	}

	return token, nil
}

func validateNonce(token *jwt.Token, nonce string) error {
	gotNonce, err := getClaim[string](token, "nonce")
	switch {
	case errors.Is(err, ErrClaimNotFound):
		// we don't have a nonce claim, so we don't have to validate it
		return nil
	case err != nil:
		return fmt.Errorf("failed to get nonce claim from token: %w", err)
	}

	hasher := sha256.New()
	hasher.Write([]byte(nonce))
	hashBytes := hasher.Sum(nil)
	noncestr := hex.EncodeToString(hashBytes)

	if gotNonce != noncestr {
		return ErrNonceMismatch
	}

	return nil
}

type Profile struct {
	ProviderUserID string
	Email          string
	EmailVerified  bool
	Name           string
	Picture        string
}

func (a *IDTokenValidator) GetProfile(token *jwt.Token) (Profile, error) {
	return a.provider.GetProfile(token) //nolint:wrapcheck
}
