package oidc

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

const (
	idTokenClockSkew = 30 * time.Second
	maxIDTokenLength = 16 << 10
	maxNonceLength   = 256
	maxSubjectLength = 255
)

var (
	errTokenExchange = errors.New("OIDC token exchange failed")
	errIDToken       = errors.New("invalid OIDC ID token")

	//nolint:gochecknoglobals // Fixed, asymmetric ID-token signing policy.
	supportedSigningAlgorithms = []string{
		"RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA",
	}
)

// CustomProvider handles the protocol for a single statically configured issuer.
type CustomProvider struct {
	slug      string
	config    CustomProviderConfig
	callback  *url.URL
	client    *http.Client
	discovery discoveryCache
	keys      jwksCache
}

// IdentityKey is stable across removal or recreation of the slug registration.
func (p *CustomProvider) IdentityKey(subject string) string {
	hash := sha256.Sum256([]byte(p.config.Issuer + "\x00" + subject))

	return hex.EncodeToString(hash[:])
}

// AuthorizationURL starts an authorization code flow with upstream S256 PKCE
// and a nonce. The caller binds state and verifier to the browser.
func (p *CustomProvider) AuthorizationURL(
	ctx context.Context, state, nonce, verifier string,
) (string, error) {
	doc, err := p.discover(ctx)
	if err != nil {
		return "", err
	}

	config, err := p.oauthConfig(doc)
	if err != nil {
		return "", err
	}

	options := []oauth2.AuthCodeOption{oauth2.S256ChallengeOption(verifier)}
	if !p.config.DisableNonce {
		options = append(options, oauth2.SetAuthURLParam("nonce", hashNonce(nonce)))
	}

	return config.AuthCodeURL(state, options...), nil
}

func (p *CustomProvider) oauthConfig(doc *discoveryDocument) (*oauth2.Config, error) {
	authStyle, err := doc.authStyle()
	if err != nil {
		return nil, err
	}

	return &oauth2.Config{
		ClientID:     p.config.ClientID,
		ClientSecret: p.config.ClientSecret,
		Endpoint: oauth2.Endpoint{
			AuthURL:       doc.AuthorizationEndpoint,
			DeviceAuthURL: "",
			TokenURL:      doc.TokenEndpoint,
			AuthStyle:     authStyle,
		},
		RedirectURL: p.callback.String(),
		Scopes:      p.config.Scopes,
	}, nil
}

// Exchange verifies the browser flow's ID token and retrieves UserInfo when
// the token omits email. Only a profile for the ID token's subject is accepted.
func (p *CustomProvider) Exchange(
	ctx context.Context, code, verifier, nonce string, responseIssuer *string,
) (Profile, error) {
	doc, err := p.discover(ctx)
	if err != nil {
		return Profile{}, err
	}

	if (responseIssuer == nil && doc.IssuerInAuthorizationResponse) ||
		(responseIssuer != nil && *responseIssuer != p.config.Issuer) {
		return Profile{}, fmt.Errorf("%w: authorization response issuer mismatch", errTokenExchange)
	}

	config, err := p.oauthConfig(doc)
	if err != nil {
		return Profile{}, err
	}

	ctx = context.WithValue(ctx, oauth2.HTTPClient, p.client)

	token, err := config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		// OAuth errors may include the entire response body and credentials.
		return Profile{}, errTokenExchange
	}

	raw, _ := token.Extra("id_token").(string)

	profile, err := p.verify(ctx, doc, raw, nonce, []string{p.config.ClientID})
	if err != nil {
		return Profile{}, err
	}

	if profile.Email != "" || doc.UserInfoEndpoint == "" {
		return profile, nil
	}

	return p.userInfoProfile(ctx, doc.UserInfoEndpoint, token, profile)
}

func (p *CustomProvider) userInfoProfile(
	ctx context.Context, location string, token *oauth2.Token, profile Profile,
) (Profile, error) {
	// UserInfo is useful only with an actual bearer token from the exchange.
	if token.AccessToken == "" || token.Type() != "Bearer" {
		return Profile{}, errTokenExchange
	}

	var claims struct {
		profileClaims

		Subject string `json:"sub"`
	}
	if err := p.getJSON(ctx, location, token, &claims); err != nil {
		return Profile{}, fmt.Errorf("loading OIDC UserInfo: %w", err)
	}

	if claims.Subject != profile.ProviderUserID {
		return Profile{}, fmt.Errorf("%w: UserInfo subject mismatch", errIDToken)
	}

	profile.Email = claims.Email

	profile.EmailVerified = claims.verificationStatus()
	if profile.Name == "" {
		profile.Name = claims.Name
	}

	if profile.Picture == "" {
		profile.Picture = claims.Picture
	}

	return profile, nil
}

// VerifyNative accepts a signed ID token issued to a configured native
// audience. The application supplies the original nonce, whose SHA-256 hex
// digest must be present in the token.
func (p *CustomProvider) VerifyNative(ctx context.Context, raw, nonce string) (Profile, error) {
	if !p.validTokenInput(raw, nonce) {
		return Profile{}, errIDToken
	}

	doc, err := p.discover(ctx)
	if err != nil {
		return Profile{}, err
	}

	return p.verify(ctx, doc, raw, nonce, p.config.Audiences)
}

func hashNonce(nonce string) string {
	hash := sha256.Sum256([]byte(nonce))

	return hex.EncodeToString(hash[:])
}

func (p *CustomProvider) validTokenInput(raw, nonce string) bool {
	return len(raw) > 0 && len(raw) <= maxIDTokenLength &&
		(p.config.DisableNonce || (nonce != "" && len(nonce) <= maxNonceLength))
}

type profileClaims struct {
	Email         string `json:"email"`
	EmailVerified *bool  `json:"email_verified"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
}

func (c profileClaims) verificationStatus() EmailVerificationStatus {
	if c.EmailVerified == nil {
		return EmailVerificationStatusUnknown
	}

	return EmailVerificationFromBool(*c.EmailVerified)
}

type idTokenClaims struct {
	jwt.RegisteredClaims
	profileClaims

	Nonce           string `json:"nonce"`
	AuthorizedParty string `json:"azp"`
}

func (p *CustomProvider) verify(
	ctx context.Context, doc *discoveryDocument, raw, nonce string, audiences []string,
) (Profile, error) {
	if !p.validTokenInput(raw, nonce) {
		return Profile{}, errIDToken
	}

	var expectedNonce string
	if !p.config.DisableNonce {
		expectedNonce = hashNonce(nonce)
	}

	var claims idTokenClaims

	keyFunc := func(token *jwt.Token) (any, error) {
		// Avoid refreshing keys for another issuer or nonce.
		if expectedNonce != "" &&
			subtle.ConstantTimeCompare([]byte(claims.Nonce), []byte(expectedNonce)) != 1 {
			return nil, ErrNonceMismatch
		}

		if err := validateIDTokenClaims(&claims, p.config.Issuer, audiences); err != nil {
			return nil, err
		}

		return p.signingKey(ctx, doc, token)
	}

	_, err := jwt.ParseWithClaims(
		raw, &claims, keyFunc,
		jwt.WithValidMethods(supportedSigningAlgorithms),
		jwt.WithIssuer(p.config.Issuer),
		jwt.WithAudience(audiences...),
		jwt.WithIssuedAt(),
		jwt.WithLeeway(idTokenClockSkew),
		jwt.WithExpirationRequired(),
		jwt.WithStrictDecoding(),
	)
	if err != nil {
		return Profile{}, fmt.Errorf("%w: %w", errIDToken, err)
	}

	return Profile{
		ProviderUserID: claims.Subject,
		Email:          claims.Email,
		EmailVerified:  claims.verificationStatus(),
		Name:           claims.Name,
		Picture:        claims.Picture,
	}, nil
}

func validateIDTokenClaims(claims *idTokenClaims, issuer string, audiences []string) error {
	if claims.Issuer != issuer || claims.Subject == "" || len(claims.Subject) > maxSubjectLength ||
		len(claims.Audience) == 0 ||
		claims.IssuedAt == nil || claims.ExpiresAt == nil ||
		!claims.ExpiresAt.After(claims.IssuedAt.Time) {
		return errIDToken
	}

	for _, audience := range claims.Audience {
		if !slices.Contains(audiences, audience) {
			return fmt.Errorf("%w: untrusted audience", errIDToken)
		}
	}

	if len(claims.Audience) > 1 && claims.AuthorizedParty == "" {
		return fmt.Errorf("%w: missing authorized party", errIDToken)
	}

	if claims.AuthorizedParty != "" && !slices.Contains(claims.Audience, claims.AuthorizedParty) {
		return fmt.Errorf("%w: untrusted authorized party", errIDToken)
	}

	return nil
}
