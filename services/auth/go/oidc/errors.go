package oidc

import "errors"

var (
	ErrAudienceEmpty       = errors.New("audience-empty")
	ErrUnsupportedProvider = errors.New("unsupported-provider")
	ErrInvalidClaims       = errors.New("invalid-claims")
	ErrClaimNotFound       = errors.New("claim-not-found")
	ErrNonceMismatch       = errors.New("nonce-mismatch")
)
