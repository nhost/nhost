package oidc

import "errors"

var (
	ErrAudienceEmpty            = errors.New("audience-empty")
	ErrUnsupportedProvider      = errors.New("unsupported-provider")
	ErrInvalidClaims            = errors.New("invalid-claims")
	ErrClaimNotFound            = errors.New("claim-not-found")
	ErrNonceMismatch            = errors.New("nonce-mismatch")
	ErrNonceMissing             = errors.New("nonce-missing")
	ErrDiscoveryStatus          = errors.New("discovery-unexpected-status")
	ErrDiscoveryIssuerMismatch  = errors.New("discovery-issuer-mismatch")
	ErrDiscoveryIncomplete      = errors.New("discovery-document-incomplete")
	ErrDiscoveryInvalidEndpoint = errors.New("discovery-endpoint-invalid")
	ErrJWKSEmpty                = errors.New("jwks-empty")
	ErrBuildPanic               = errors.New("provider-metadata-build-panicked")
)
