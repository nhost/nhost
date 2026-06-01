// Package jwt validates JWT bearer tokens against one or more configured
// secrets and extracts Hasura-compatible session variables from the verified
// claims. It supports HMAC and RSA algorithms, multiple secrets with
// fall-through validation, and JWKS URLs for rotated key sets.
//
// Authenticator is the entry point: each request runs through every
// configured secretValidator until one verifies the token; the matching
// claimsExtractor then materialises the role and the x-hasura-* session
// variables. controller/middleware uses the result to populate the request
// session.
//
// The operator-facing configuration types (Secret, Algorithm, HeaderConfig,
// ParseConfig, …) live in the sibling [jwtconfig] subpackage so this package's
// surface remains focused on authentication.
package jwt

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// ErrNoSecrets is returned by [NewAuthenticator] when the supplied
// [jwtconfig.Config] contains no secrets. JWT authentication requires at least
// one secret, so this is a fatal configuration error: callers should surface
// it and refuse to start rather than falling back to an unauthenticated mode.
// It is exported so callers can recognise this specific cause with [errors.Is]
// and report an actionable "configure a JWT secret" message.
var ErrNoSecrets = errors.New("no secrets configured")

// SessionResult is the resolved Hasura role and session variables extracted
// from a successfully validated JWT.
type SessionResult struct {
	// Role is the value of the x-hasura-default-role claim, or the value of
	// the X-Hasura-Role header when a role override is supplied and present
	// in x-hasura-allowed-roles.
	Role string
	// Variables holds every x-hasura-* claim from the JWT (keys lowercased,
	// non-prefixed claims filtered out). Always includes "x-hasura-role".
	Variables map[string]any
}

// Authenticator validates JWT tokens using one or more secret configurations.
//
// Each request runs through every configured secret until one extracts and
// verifies a token; the matching claims extractor then materialises the role
// and session variables. Construct with [NewAuthenticator]; callers MUST
// invoke [Authenticator.Close] when finished so JWKS background refresh
// goroutines and their HTTP clients can shut down cleanly.
type Authenticator struct {
	validators []*secretValidator
	extractors []claimsExtractor
	logger     *slog.Logger
}

// NewAuthenticator constructs an [Authenticator] from the supplied config.
//
// Returns [ErrNoSecrets] when cfg.Secrets is empty: at least one secret is
// required, and an empty configuration is treated as a fatal error rather than
// a request to disable authentication. Any other error indicates a
// misconfigured secret (invalid algorithm, malformed PEM, unreachable JWKS
// URL, etc.) and is likewise fatal.
func NewAuthenticator(
	ctx context.Context,
	cfg jwtconfig.Config,
	logger *slog.Logger,
) (*Authenticator, error) {
	return newAuthenticator(ctx, cfg, logger, defaultJWKSProvider)
}

// defaultJWKSProvider adapts keyfunc.NewDefaultCtx to the unexported
// jwksProvider boundary used by secretValidator. The interface return is
// deliberate: this function is the production binding of the
// jwksProviderConstructor seam.
func defaultJWKSProvider( //nolint:ireturn,nolintlint // production binding of the jwksProviderConstructor seam
	ctx context.Context,
	urls []string,
) (jwksProvider, error) {
	kf, err := keyfunc.NewDefaultCtx(ctx, urls)
	if err != nil {
		return nil, fmt.Errorf("creating default JWKS keyfunc: %w", err)
	}

	return kf, nil
}

func newAuthenticator(
	ctx context.Context,
	cfg jwtconfig.Config,
	logger *slog.Logger,
	newJWKS jwksProviderConstructor,
) (*Authenticator, error) {
	if len(cfg.Secrets) == 0 {
		return nil, ErrNoSecrets
	}

	validators := make([]*secretValidator, len(cfg.Secrets))
	extractors := make([]claimsExtractor, len(cfg.Secrets))

	for i, secret := range cfg.Secrets {
		if err := secret.Validate(); err != nil {
			return nil, fmt.Errorf("invalid jwt secret %d: %w", i, err)
		}

		sv, err := newSecretValidator(ctx, secret, logger, newJWKS)
		if err != nil {
			return nil, fmt.Errorf("failed to create validator for secret %d: %w", i, err)
		}

		validators[i] = sv
		extractors[i] = newClaimsExtractor(
			secret.EffectiveClaimsNamespace(),
			secret.ClaimsNamespacePath,
			secret.EffectiveClaimsFormat(),
			secret.ClaimsMap,
		)
	}

	return &Authenticator{
		validators: validators,
		extractors: extractors,
		logger:     logger,
	}, nil
}

// Authenticate validates a JWT extracted from the provided headers against
// each configured secret in turn. roleOverride is the value of the
// X-Hasura-Role header (may be empty); when non-empty it must appear in the
// token's x-hasura-allowed-roles claim or authentication fails.
//
// The three-state return is part of the contract callers (notably the
// session middleware) rely on:
//   - (*SessionResult, nil): a token was found and successfully validated.
//   - (nil, error):          a token was present but invalid (bad signature,
//     expired, missing required Hasura claims, role override not in
//     allowed-roles, etc.). The caller should treat this as an authentication
//     failure and respond with HTTP 401.
//   - (nil, nil):            no token was found in any configured location
//     (Authorization header, configured cookie, or custom header). The caller
//     should treat this as an anonymous request and fall through to its
//     non-authenticated path (typically the public role).
//
// The (nil, nil) result is intentional — callers must distinguish "no token"
// from "invalid token" to choose between anonymous access and 401.
func (a *Authenticator) Authenticate(
	headers http.Header, roleOverride string,
) (*SessionResult, error) {
	var lastErr error

	sawToken := false

	for i, sv := range a.validators {
		token := extractToken(headers, sv.headerCfg)
		if token == "" {
			continue
		}

		sawToken = true

		// A token was extracted by this secret. Signature/claim-time
		// validation failures fall through to the next configured secret:
		// Hasura accepts a token if ANY configured secret verifies it (the
		// HASURA_GRAPHQL_JWT_SECRETS multi-IdP / key-rotation contract), so a
		// token signed for a later secret must not be rejected just because an
		// earlier secret reads the same header location.
		claims, err := sv.parseAndValidate(token)
		if err != nil {
			a.logger.Debug(
				"jwt validation failed",
				slog.Int("secret_index", i),
				slog.String("error", err.Error()),
			)

			lastErr = err

			continue
		}

		// The token verified against this secret. Claims-shape failures
		// (missing namespace, malformed Hasura claims, role override not in
		// allowed-roles, …) are hard failures for the verified token and are
		// NOT retried against other secrets: a verified-but-malformed token is
		// an authentication error, not a "try the next key" signal.
		hasuraClaims, err := a.extractors[i].extractClaims(claims)
		if err != nil {
			return nil, fmt.Errorf("failed to extract hasura claims: %w", err)
		}

		role, variables, err := buildSessionVariables(hasuraClaims, roleOverride)
		if err != nil {
			return nil, fmt.Errorf("failed to build session variables: %w", err)
		}

		return &SessionResult{
			Role:      role,
			Variables: variables,
		}, nil
	}

	if sawToken {
		// At least one secret extracted a token but none verified it.
		return nil, fmt.Errorf("jwt authentication failed: %w", lastErr)
	}

	return nil, nil //nolint:nilnil // no token: caller falls through to anonymous, not an error
}

// Close shuts down each configured secret validator, stopping any JWKS
// background refresh goroutines and releasing their HTTP clients. Safe to
// call more than once. Callers should invoke Close when the authenticator is
// no longer needed (typically via `defer auth.Close()` in the caller that
// owns it).
func (a *Authenticator) Close() {
	for _, sv := range a.validators {
		sv.close()
	}
}
