package jwt

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// Sentinel errors for token validation and key parsing.
var (
	ErrTokenKidMismatch     = errors.New("token kid does not match expected")
	ErrUnexpectedClaimsType = errors.New("unexpected claims type")
	ErrPEMDecode            = errors.New("failed to decode PEM block")
	ErrNotRSAPublicKey      = errors.New("key is not an RSA public key")

	errMissingExpiration = errors.New("missing expiration claim")
)

// jwksProvider is the minimal contract this package needs from a JWKS-backed
// key source: resolve a verification key for a parsed JWT. It is the
// consumer-defined interface that hides the network I/O and background refresh
// goroutine performed by the upstream JWKS client behind a testable seam.
type jwksProvider interface {
	Keyfunc(token *jwt.Token) (any, error)
}

// secretValidator validates JWT tokens for a single Secret configuration.
type secretValidator struct {
	keyFunc    jwt.Keyfunc
	opts       []jwt.ParserOption
	headerCfg  jwtconfig.HeaderConfig
	jwksCancel context.CancelFunc // non-nil if using JWK URL, cancels refresh goroutine
}

// jwksProviderConstructor builds a jwksProvider for one or more JWKS URLs.
// Threaded through newAuthenticator so tests can substitute a fake without
// spinning up a live JWKS server.
type jwksProviderConstructor func(ctx context.Context, urls []string) (jwksProvider, error)

func newSecretValidator(
	ctx context.Context,
	secret jwtconfig.Secret,
	logger *slog.Logger,
	newJWKS jwksProviderConstructor,
) (*secretValidator, error) {
	sv := &secretValidator{
		keyFunc:    nil,
		opts:       nil,
		headerCfg:  secret.EffectiveHeaderConfig(),
		jwksCancel: nil,
	}

	if secret.JWKURL != "" {
		if err := sv.initJWKS(ctx, secret, newJWKS); err != nil {
			return nil, err
		}
	} else {
		if err := sv.initStatic(secret, logger); err != nil {
			return nil, err
		}
	}

	sv.opts = buildParserOptions(secret)

	return sv, nil
}

func (sv *secretValidator) initJWKS(
	ctx context.Context, secret jwtconfig.Secret, newJWKS jwksProviderConstructor,
) error {
	// Create a child context for the JWKS refresh goroutine.
	jwksCtx, cancel := context.WithCancel(ctx)

	kf, err := newJWKS(jwksCtx, []string{secret.JWKURL})
	if err != nil {
		cancel()

		return fmt.Errorf("failed to create JWKS keyfunc for %s: %w", secret.JWKURL, err)
	}

	sv.jwksCancel = cancel
	sv.keyFunc = kf.Keyfunc

	return nil
}

func (sv *secretValidator) initStatic(secret jwtconfig.Secret, logger *slog.Logger) error {
	switch secret.Type {
	case jwtconfig.AlgorithmHS256, jwtconfig.AlgorithmHS384, jwtconfig.AlgorithmHS512:
		key := decodeHMACKey(secret.Key, logger)
		sv.keyFunc = func(_ *jwt.Token) (any, error) {
			return key, nil
		}

	case jwtconfig.AlgorithmRS256, jwtconfig.AlgorithmRS384, jwtconfig.AlgorithmRS512:
		pubKey, err := parseRSAPublicKey(secret.Key)
		if err != nil {
			return fmt.Errorf("failed to parse RSA public key: %w", err)
		}

		kid := secret.Kid
		sv.keyFunc = func(t *jwt.Token) (any, error) {
			if kid != "" {
				tokenKid, _ := t.Header["kid"].(string)
				if tokenKid != kid {
					return nil, fmt.Errorf(
						"%w: got %q, expected %q",
						ErrTokenKidMismatch, tokenKid, kid,
					)
				}
			}

			return pubKey, nil
		}

	default:
		return fmt.Errorf("%w: %s", jwtconfig.ErrUnsupportedAlgorithm, secret.Type)
	}

	return nil
}

func (sv *secretValidator) parseAndValidate(tokenStr string) (map[string]any, time.Time, error) {
	token, err := jwt.Parse(tokenStr, sv.keyFunc, sv.opts...)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("jwt validation failed: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, time.Time{}, ErrUnexpectedClaimsType
	}

	expiresAt, err := claims.GetExpirationTime()
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("jwt expiration claim: %w", err)
	}

	if expiresAt == nil {
		return nil, time.Time{}, errMissingExpiration
	}

	return claims, expiresAt.Time, nil
}

// close shuts down any background goroutines (e.g. JWKS refresh).
func (sv *secretValidator) close() {
	if sv.jwksCancel != nil {
		sv.jwksCancel()
	}
}

// decodeHMACKey tries base64 decoding first, falls back to raw bytes.
// The base64 error is intentionally swallowed: this implements the documented
// "key is base64 OR raw bytes" contract. The opposite failure mode — a raw
// secret that happens to look like base64 being silently decoded — is
// observable at DEBUG: operators chasing an inscrutable "signature invalid"
// error can confirm which interpretation was used at startup. Only key lengths
// are logged, never key material.
func decodeHMACKey(key string, logger *slog.Logger) []byte {
	decoded, err := base64.StdEncoding.DecodeString(key)
	if err == nil {
		if logger != nil {
			logger.Debug(
				"jwt hmac key interpreted as base64",
				slog.Int("encoded_len", len(key)),
				slog.Int("decoded_len", len(decoded)),
			)
		}

		return decoded
	}

	if logger != nil {
		logger.Debug(
			"jwt hmac key interpreted as raw bytes",
			slog.Int("key_len", len(key)),
		)
	}

	return []byte(key)
}

// parseRSAPublicKey parses a PEM-encoded RSA public key.
func parseRSAPublicKey(key string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(key))
	if block == nil {
		return nil, ErrPEMDecode
	}

	// Try PKIX first (most common for public keys).
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err == nil {
		rsaPub, ok := pub.(*rsa.PublicKey)
		if !ok {
			return nil, ErrNotRSAPublicKey
		}

		return rsaPub, nil
	}

	// Try PKCS1 as fallback.
	rsaPub, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse RSA public key: %w", err)
	}

	return rsaPub, nil
}

// jwksAllowedMethods returns the signing-algorithm allowlist pinned at the
// parser layer for JWKS-backed secrets. A JWKS secret has no configured
// algorithm (Type is empty by construction — jwtconfig rejects Type/Key with
// JWKURL), so the allowlist is derived from the
// asymmetric families the static-key path already accepts (RS*). It
// deliberately excludes every symmetric (HS*) algorithm and "none": a JWKS
// endpoint only ever serves asymmetric public keys, so pinning the RSA family
// eliminates reliance on the JWT library's type-assertion and
// none-magic-constant guards regardless of what a remote JWKS serves. EC*/PS*
// are intentionally omitted because the static-key path does not support them
// either; add them here (and to the static path) only if a deployment is
// expected to use them.
func jwksAllowedMethods() []string {
	return []string{
		string(jwtconfig.AlgorithmRS256),
		string(jwtconfig.AlgorithmRS384),
		string(jwtconfig.AlgorithmRS512),
	}
}

func buildParserOptions(secret jwtconfig.Secret) []jwt.ParserOption {
	opts := []jwt.ParserOption{
		jwt.WithExpirationRequired(),
	}

	if secret.JWKURL == "" {
		opts = append(opts, jwt.WithValidMethods([]string{string(secret.Type)}))
	} else {
		opts = append(opts, jwt.WithValidMethods(jwksAllowedMethods()))
	}

	if secret.Issuer != "" {
		opts = append(opts, jwt.WithIssuer(secret.Issuer))
	}

	if len(secret.Audience) > 0 {
		for _, aud := range secret.Audience {
			opts = append(opts, jwt.WithAudience(aud))
		}
	}

	if secret.AllowedSkew != nil {
		skew := min(*secret.AllowedSkew, math.MaxInt64)
		// bounded above by math.MaxInt64 on the previous line
		opts = append(opts, jwt.WithLeeway(time.Duration(skew)*time.Second)) //nolint:gosec
	}

	return opts
}
