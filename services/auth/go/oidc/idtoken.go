package oidc

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Identifiers for the providers supporting id-token sign-in, matching the
// Provider implementations in this package.
//
// They live here rather than in the generated api package because oidc is
// the leaf: providers imports oidc, so oidc can never import providers, and
// these are the values oidc dispatches on. They used to be generated from
// the OpenAPI IdTokenProvider enum, but relaxing that enum to a pattern (so
// it admits "c:<slug>") collapsed the type to an alias for string and
// removed the generated constants along with it.
//
// apple and google are the built-in values accepted at the HTTP layer; fake
// is deliberately absent from the spec, so it is only reachable from unit
// tests that bypass HTTP validation. These literals are duplicated in
// providers/names.go and in the openapi.yaml patterns; providers/names_test.go
// asserts the copies agree.
const (
	IDTokenProviderApple  = "apple"
	IDTokenProviderGoogle = "google"
	IDTokenProviderFake   = "fake"
)

// idTokenLeeway is the clock-skew tolerance applied to every id_token time
// claim (iat, nbf, exp). With zero leeway an IdP whose clock runs a second
// ahead of ours makes every token it has just minted fail with
// ErrTokenUsedBeforeIssued, which reaches the user as a bare
// invalid-request — a real failure mode now that the IdP can be any
// operator-run Keycloak/Authentik/Zitadel rather than Apple or Google. 30s is
// small enough that it does not meaningfully extend the life of an expired
// token.
const idTokenLeeway = 30 * time.Second

func GetClaim[T any](token *jwt.Token, claim string) (T, error) { //nolint:ireturn,nolintlint
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
	// Custom maps provider IDs ("c:<slug>") of OIDC-type custom providers to
	// their lazily built validators. OAuth2-type custom providers never
	// appear here — they have no id_token to validate.
	//
	// Populated by NewIDTokenValidatorProviders and read concurrently by
	// request handlers: it must not be mutated once the server is serving.
	Custom map[string]*LazyIDTokenValidator
}

// NewIDTokenValidatorProviders builds the aggregate of id_token validators.
// custom maps provider IDs ("c:<slug>") to lazily built validators and is
// read by request handlers, so it must be complete before the server starts
// serving; passing it here rather than assigning the field afterwards is
// what makes that a construction-time property.
func NewIDTokenValidatorProviders(
	ctx context.Context,
	appleAudiences, googleAudiences, fakeProviderAudiences []string,
	custom map[string]*LazyIDTokenValidator,
	parserOptions ...jwt.ParserOption,
) (*IDTokenValidatorProviders, error) {
	var appleID *IDTokenValidator

	if len(appleAudiences) > 0 {
		var err error

		appleID, err = NewIDTokenValidator(
			ctx,
			IDTokenProviderApple,
			appleAudiences,
			parserOptions...,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Apple ID token validator: %w", err)
		}
	}

	var google *IDTokenValidator

	if len(googleAudiences) > 0 {
		var err error

		google, err = NewIDTokenValidator(
			ctx,
			IDTokenProviderGoogle,
			googleAudiences,
			parserOptions...,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Google ID token validator: %w", err)
		}
	}

	var fakeProvider *IDTokenValidator

	if len(fakeProviderAudiences) > 0 {
		var err error

		fakeProvider, err = NewIDTokenValidator(
			ctx, IDTokenProviderFake, fakeProviderAudiences, parserOptions...,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create Fake ID token validator: %w", err)
		}
	}

	return &IDTokenValidatorProviders{
		AppleID:      appleID,
		Google:       google,
		FakeProvider: fakeProvider,
		Custom:       custom,
	}, nil
}

type Provider interface {
	GetJWTKeyFunc(ctx context.Context) (jwt.Keyfunc, error)
	GetIssuer() string
	GetValidMethods() []string
	GetProfile(token *jwt.Token) (Profile, error)
}

type IDTokenValidator struct {
	provider      Provider
	parserOptions []jwt.ParserOption
	jwtKeyFunc    jwt.Keyfunc
}

func NewIDTokenValidator(
	ctx context.Context,
	providerName string,
	audiences []string,
	options ...jwt.ParserOption,
) (*IDTokenValidator, error) {
	var provider Provider

	switch providerName {
	case IDTokenProviderApple:
		provider = &Apple{}
	case IDTokenProviderGoogle:
		provider = &Google{}
	case IDTokenProviderFake:
		provider = &FakeProvider{}
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedProvider, providerName)
	}

	return NewIDTokenValidatorForProvider(ctx, provider, audiences, options...)
}

// NewIDTokenValidatorForProvider builds a validator for an arbitrary
// Provider implementation. It fetches the provider's JWKS eagerly — for
// providers whose key material requires network discovery, wrap the call in
// a LazyIDTokenValidator so construction happens on first use.
func NewIDTokenValidatorForProvider(
	ctx context.Context,
	provider Provider,
	audiences []string,
	options ...jwt.ParserOption,
) (*IDTokenValidator, error) {
	keyFunc, err := provider.GetJWTKeyFunc(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get JWT key function from provider: %w", err)
	}

	return &IDTokenValidator{
		provider:   provider,
		jwtKeyFunc: keyFunc,
		parserOptions: append(
			[]jwt.ParserOption{
				jwt.WithAudience(audiences...),
				jwt.WithIssuer(provider.GetIssuer()),
				jwt.WithValidMethods(provider.GetValidMethods()),
				jwt.WithIssuedAt(),
				jwt.WithExpirationRequired(),
				jwt.WithLeeway(idTokenLeeway),
			}, options...,
		),
	}, nil
}

// LazyIDTokenValidator defers construction of an IDTokenValidator — which
// requires network I/O (discovery, JWKS) — to first use. Success is
// memoized for the process lifetime; failures are negative-cached with
// exponential backoff.
type LazyIDTokenValidator struct {
	memo *lazyMemo[*IDTokenValidator]
}

// NewLazyIDTokenValidator wraps build, which is invoked on first Get and
// retried (with backoff) until it succeeds once.
func NewLazyIDTokenValidator(
	build func(ctx context.Context) (*IDTokenValidator, error),
) *LazyIDTokenValidator {
	return &LazyIDTokenValidator{memo: newLazyMemo(build)}
}

// Get returns the memoized validator, building it on first use.
func (l *LazyIDTokenValidator) Get(ctx context.Context) (*IDTokenValidator, error) {
	return l.memo.get(ctx)
}

func (a *IDTokenValidator) Validate(
	tokenString, nonce string, options ...jwt.ParserOption,
) (*jwt.Token, error) {
	return a.validate(tokenString, nonce, false, options...)
}

// ValidateWithRequiredNonce is Validate, except that an id_token without a
// nonce claim is rejected. Custom providers use it on the browser flow,
// where the authorization request always carries a nonce, so a token missing
// the claim cannot be bound to the request that initiated it.
func (a *IDTokenValidator) ValidateWithRequiredNonce(
	tokenString, nonce string, options ...jwt.ParserOption,
) (*jwt.Token, error) {
	return a.validate(tokenString, nonce, true, options...)
}

func (a *IDTokenValidator) validate(
	tokenString, nonce string, requireNonce bool, options ...jwt.ParserOption,
) (*jwt.Token, error) {
	options = append(
		options,
		a.parserOptions...,
	)

	token, err := jwt.Parse(tokenString, a.jwtKeyFunc, options...)
	if err != nil {
		return nil, fmt.Errorf("failed to validate token: %w", err)
	}

	if err := validateNonce(token, nonce, requireNonce); err != nil {
		return nil, err
	}

	return token, nil
}

// HashNonce returns the hex-encoded SHA-256 of the raw nonce — the encoding
// id_token nonce claims are compared against, and therefore the value the
// authorization request must carry as its nonce parameter.
func HashNonce(nonce string) string {
	sum := sha256.Sum256([]byte(nonce))
	return hex.EncodeToString(sum[:])
}

func validateNonce(token *jwt.Token, nonce string, required bool) error {
	gotNonce, err := GetClaim[string](token, "nonce")
	switch {
	case errors.Is(err, ErrClaimNotFound):
		if required {
			return ErrNonceMissing
		}
		// we don't have a nonce claim, so we don't have to validate it
		return nil
	case err != nil:
		return fmt.Errorf("failed to get nonce claim from token: %w", err)
	}

	if subtle.ConstantTimeCompare([]byte(gotNonce), []byte(HashNonce(nonce))) != 1 {
		return ErrNonceMismatch
	}

	return nil
}

// EmailVerificationStatus expresses whether the upstream OAuth/OIDC provider
// has attested that the user owns the email address returned on the profile.
//
// The zero value is EmailVerificationStatusUnknown, which means the adapter
// had no explicit signal from the provider. Unknown is treated as unverified
// for security-sensitive decisions (account linking, session issuance); use
// IsVerified to branch on it.
//
// Adapters MUST NOT infer verification from the presence of an email. Only
// set Verified when the provider exposes an explicit signal (an
// email_verified claim, a confirmed_at timestamp, or equivalent).
type EmailVerificationStatus int

const (
	EmailVerificationStatusUnknown EmailVerificationStatus = iota
	EmailVerificationStatusVerified
	EmailVerificationStatusUnverified
)

// IsVerified returns true only when the provider explicitly attested that the
// email is verified. Unknown and Unverified both return false.
func (s EmailVerificationStatus) IsVerified() bool {
	return s == EmailVerificationStatusVerified
}

// EmailVerificationFromBool maps a provider-supplied boolean to the matching
// verification status. Use it when the adapter has an explicit signal and
// just needs to translate its shape.
func EmailVerificationFromBool(verified bool) EmailVerificationStatus {
	if verified {
		return EmailVerificationStatusVerified
	}

	return EmailVerificationStatusUnverified
}

type Profile struct {
	ProviderUserID string
	Email          string
	EmailVerified  EmailVerificationStatus
	Name           string
	Picture        string
}

func (a *IDTokenValidator) GetProfile(token *jwt.Token) (Profile, error) {
	return a.provider.GetProfile(token) //nolint:wrapcheck
}
