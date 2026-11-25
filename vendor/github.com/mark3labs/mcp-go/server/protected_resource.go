package server

import (
	"encoding/json"
	"net/http"
	"net/url"
	"path"
	"slices"
	"strings"
)

// WellKnownProtectedResourcePath is the base well-known URL path for
// OAuth 2.0 Protected Resource Metadata as defined in RFC 9728.
const WellKnownProtectedResourcePath = "/.well-known/oauth-protected-resource"

// ProtectedResourceMetadataConfig holds OAuth 2.0 Protected Resource Metadata
// as defined in RFC 9728 (https://datatracker.ietf.org/doc/html/rfc9728).
//
// The MCP authorization spec
// (https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
// references this metadata for server discovery: clients fetch it from
// /.well-known/oauth-protected-resource to learn which authorization servers,
// scopes, and bearer methods the resource supports.
//
// Resource is REQUIRED. AuthorizationServers is RECOMMENDED. All other fields
// are optional and will be omitted from the JSON response when empty.
type ProtectedResourceMetadataConfig struct {
	// Resource is the protected resource's identifier URI. Required.
	Resource string `json:"resource"`

	// AuthorizationServers lists the OAuth authorization server issuer
	// identifiers that may be used to obtain access tokens for this resource.
	AuthorizationServers []string `json:"authorization_servers,omitempty"`

	// ScopesSupported lists OAuth scope values used in authorization requests
	// to access this resource.
	ScopesSupported []string `json:"scopes_supported,omitempty"`

	// BearerMethodsSupported lists supported methods for presenting an OAuth
	// 2.0 bearer token to the resource (e.g. "header", "body", "query").
	BearerMethodsSupported []string `json:"bearer_methods_supported,omitempty"`

	// ResourceName is a human-readable name for the protected resource.
	ResourceName string `json:"resource_name,omitempty"`

	// ResourceDocumentation is a URL of human-readable documentation for
	// developers using this resource.
	ResourceDocumentation string `json:"resource_documentation,omitempty"`

	// ResourcePolicyURI is a URL of the resource's privacy policy.
	ResourcePolicyURI string `json:"resource_policy_uri,omitempty"`

	// ResourceTosURI is a URL of the resource's terms of service.
	ResourceTosURI string `json:"resource_tos_uri,omitempty"`

	// JWKSURI is the URL of the resource's JWK Set document used to validate
	// signed responses from the resource.
	JWKSURI string `json:"jwks_uri,omitempty"`

	// ResourceSigningAlgValuesSupported lists JWS algorithms supported for
	// signing resource responses.
	ResourceSigningAlgValuesSupported []string `json:"resource_signing_alg_values_supported,omitempty"`

	// TLSClientCertificateBoundAccessTokens indicates support for mTLS-bound
	// access tokens (RFC 8705). Pointer so that "false" can be expressed
	// explicitly and "unset" omits the field.
	TLSClientCertificateBoundAccessTokens *bool `json:"tls_client_certificate_bound_access_tokens,omitempty"`

	// AuthorizationDetailsTypesSupported lists supported authorization_details
	// type values (RFC 9396).
	AuthorizationDetailsTypesSupported []string `json:"authorization_details_types_supported,omitempty"`

	// DPoPSigningAlgValuesSupported lists JWS algorithms supported for DPoP
	// proof JWTs.
	DPoPSigningAlgValuesSupported []string `json:"dpop_signing_alg_values_supported,omitempty"`

	// DPoPBoundAccessTokensRequired indicates whether DPoP-bound tokens are
	// required by this resource. Pointer so "false" can be encoded explicitly.
	DPoPBoundAccessTokensRequired *bool `json:"dpop_bound_access_tokens_required,omitempty"`
}

// ProtectedResourceMetadataPath returns the well-known URL path that should
// serve Protected Resource Metadata for the given resource identifier per
// RFC 9728 §3.1.
//
// For a resource with no path component (e.g. "https://mcp.example.com" or
// "https://mcp.example.com/") this returns "/.well-known/oauth-protected-resource".
//
// For a path-qualified resource (e.g. "https://mcp.example.com/mcp") the
// resource path is appended after the well-known segment, producing
// "/.well-known/oauth-protected-resource/mcp".
//
// If resource is empty, cannot be parsed as a URL, or is not an absolute URI
// (i.e. lacks a scheme and host), the bare well-known path is returned. RFC
// 9728 resource identifiers are absolute URIs, so a bare host like
// "mcp.example.com" or a path-only value like "/mcp" is not a valid resource
// and must not contribute a path suffix.
func ProtectedResourceMetadataPath(resource string) string {
	if resource == "" {
		return WellKnownProtectedResourcePath
	}
	u, err := url.Parse(resource)
	if err != nil || !u.IsAbs() || u.Host == "" {
		return WellKnownProtectedResourcePath
	}
	p := strings.Trim(u.EscapedPath(), "/")
	if p == "" {
		return WellKnownProtectedResourcePath
	}
	return path.Join(WellKnownProtectedResourcePath, p)
}

// matchProtectedResourceMetadataPath compares escaped paths segment by segment,
// like http.ServeMux, so an encoded slash is not treated as a path separator.
func matchProtectedResourceMetadataPath(requestPath, metadataPath string) bool {
	if requestPath == metadataPath {
		return true
	}
	return slices.EqualFunc(strings.Split(requestPath, "/"), strings.Split(metadataPath, "/"),
		func(requestSegment, metadataSegment string) bool {
			requestSegment, requestErr := url.PathUnescape(requestSegment)
			metadataSegment, metadataErr := url.PathUnescape(metadataSegment)
			return requestErr == nil && metadataErr == nil && requestSegment == metadataSegment
		})
}

// NewProtectedResourceMetadataHandler returns an http.Handler that serves
// the given OAuth 2.0 Protected Resource Metadata as JSON.
//
// The handler responds with:
//   - 200 OK and the metadata JSON for GET requests.
//   - 204 No Content for OPTIONS (CORS preflight).
//   - 405 Method Not Allowed (with Allow header) for any other method.
//
// Permissive CORS headers (Access-Control-Allow-Origin: *) are included so
// browser-based MCP clients can discover the resource cross-origin, and
// Cache-Control: no-store is set per the MCP authorization spec guidance to
// avoid stale metadata during rotation.
//
// Use this handler directly for custom routing setups:
//
//	mux := http.NewServeMux()
//	mux.Handle("/mcp", mcpHandler)
//	mux.Handle("/.well-known/oauth-protected-resource",
//	    server.NewProtectedResourceMetadataHandler(server.ProtectedResourceMetadataConfig{
//	        Resource:             "https://my-server.com",
//	        AuthorizationServers: []string{"https://auth.example.com"},
//	        ScopesSupported:      []string{"mcp:read", "mcp:write"},
//	    }))
//
// For path-qualified resources prefer using ProtectedResourceMetadataPath to
// derive the correct mount path:
//
//	mux.Handle(server.ProtectedResourceMetadataPath(cfg.Resource),
//	    server.NewProtectedResourceMetadataHandler(cfg))
func NewProtectedResourceMetadataHandler(config ProtectedResourceMetadataConfig) http.Handler {
	// Pre-marshal at construction time so each request is just a copy.
	// This struct only contains JSON-friendly types so Marshal cannot fail
	// in practice; the lazy fallback below preserves correctness regardless.
	body, marshalErr := json.Marshal(config)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		switch r.Method {
		case http.MethodOptions:
			w.WriteHeader(http.StatusNoContent)
			return
		case http.MethodGet, http.MethodHead:
			// proceed below
		default:
			w.Header().Set("Allow", "GET, HEAD, OPTIONS")
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if marshalErr != nil {
			http.Error(w, "failed to marshal protected resource metadata", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		if r.Method == http.MethodHead {
			return
		}
		_, _ = w.Write(body)
	})
}
