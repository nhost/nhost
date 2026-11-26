package oidc

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/MicahParks/jwkset"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/sync/semaphore"
)

const (
	jwksLifetime   = 15 * time.Minute
	maxSigningKeys = 32
)

var errInvalidJWKS = errors.New("invalid OIDC key set")

type jwksCache struct {
	gate       *semaphore.Weighted
	keys       map[string]jwkset.JWK
	expiresAt  time.Time
	retryAfter time.Time
}

func (p *CustomProvider) signingKey(
	ctx context.Context, doc *discoveryDocument, token *jwt.Token,
) (any, error) {
	kid, present := token.Header["kid"]

	keyID, ok := kid.(string)
	if present && (!ok || keyID == "") {
		return nil, errInvalidJWKS
	}

	cache := &p.keys
	if err := cache.gate.Acquire(ctx, 1); err != nil {
		return nil, fmt.Errorf("waiting for OIDC signing keys: %w", err)
	}
	defer cache.gate.Release(1)

	now := time.Now()
	key, found := cache.find(keyID)

	// Refresh expired sets and allow a new kid to trigger a rate-limited
	// refresh. Concurrent misses reuse the same fetch or cooldown.
	if (now.After(cache.expiresAt) || !found) && !now.Before(cache.retryAfter) {
		keys, err := p.fetchKeys(ctx, doc.JWKSURI)
		cache.retryAfter = time.Now().Add(upstreamRetryDelay)

		if err != nil {
			return nil, err
		}

		cache.keys = keys
		cache.expiresAt = time.Now().Add(jwksLifetime)
		key, found = cache.find(keyID)
	}

	if !found || !time.Now().Before(cache.expiresAt) {
		return nil, fmt.Errorf("%w: no current signing key", errInvalidJWKS)
	}

	if alg := key.Marshal().ALG; alg != "" && alg.String() != token.Method.Alg() {
		return nil, fmt.Errorf("%w: key algorithm does not match token", errInvalidJWKS)
	}

	return key.Key(), nil
}

func (c *jwksCache) find(keyID string) (jwkset.JWK, bool) {
	if keyID == "" {
		if len(c.keys) == 1 {
			for _, key := range c.keys {
				return key, true
			}
		}

		return jwkset.JWK{}, false
	}

	key, found := c.keys[keyID]

	return key, found
}

func (p *CustomProvider) fetchKeys(
	ctx context.Context,
	location string,
) (map[string]jwkset.JWK, error) {
	var set jwkset.JWKSMarshal
	if err := p.getMetadata(ctx, location, &set); err != nil {
		return nil, fmt.Errorf("loading OIDC signing keys: %w", err)
	}

	keys := make(map[string]jwkset.JWK)
	for _, key := range set.Keys {
		if !canVerify(key) {
			continue
		}

		// Use the public key parameters in the discovered set. There is
		// no secondary certificate URL or token-directed network lookup.
		key.X5U = ""

		var validateOptions jwkset.JWKValidateOptions

		parsed, err := jwkset.NewJWKFromMarshal(
			key, jwkset.JWKMarshalOptions{Private: false}, validateOptions,
		)
		if err != nil {
			// JWKS entries are candidates: an unsupported or malformed key
			// must not prevent verification with another usable signing key.
			continue
		}

		if _, ok := keys[key.KID]; ok || len(keys) == maxSigningKeys {
			return nil, fmt.Errorf("%w: duplicate kid or too many signing keys", errInvalidJWKS)
		}

		keys[key.KID] = parsed
	}

	if len(keys) == 0 {
		return nil, fmt.Errorf("%w: no public signing keys", errInvalidJWKS)
	}

	return keys, nil
}

func canVerify(key jwkset.JWKMarshal) bool {
	keyTypeSupported := key.KTY == jwkset.KtyRSA || key.KTY == jwkset.KtyEC ||
		(key.KTY == jwkset.KtyOKP && key.CRV == jwkset.CrvEd25519)

	return keyTypeSupported && (key.USE == "" || key.USE == jwkset.UseSig) &&
		(len(key.KEYOPS) == 0 || slices.Contains(key.KEYOPS, jwkset.KeyOpsVerify))
}
