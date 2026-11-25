package transport

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/mark3labs/mcp-go/mcp"
)

// maxOAuthBodyBytes caps the size of an OAuth response we are willing to
// read: a metadata document, a token or a client registration. A larger one
// fails with ErrMessageTooLarge.
const maxOAuthBodyBytes = 1 << 20 // 1 MiB

// ErrNoToken is returned when no token is available in the token store
var ErrNoToken = errors.New("no token available")

// ErrAuthorizationServerChanged indicates that credentials or tokens belong to another issuer.
var ErrAuthorizationServerChanged = errors.New("authorization server changed")

// OAuthConfig holds the OAuth configuration for the client
type OAuthConfig struct {
	// ClientID is the OAuth client ID
	ClientID string
	// ClientURI is the URI of the client
	ClientURI string
	// ClientSecret is the OAuth client secret (for confidential clients)
	ClientSecret string
	// CredentialsIssuer is the exact metadata issuer that issued ClientID and ClientSecret.
	// Persist it with credentials; an empty value enables legacy trust on first use.
	CredentialsIssuer string
	// TokenEndpointAuthMethod is how the client authenticates at the token
	// endpoint: "client_secret_basic", "client_secret_post" or "none". Set it
	// for pre-registered credentials, or for credentials saved from an
	// earlier dynamic registration (see GetTokenEndpointAuthMethod), when the
	// authorization server supports more than one method. When empty, the
	// method returned by dynamic client registration is used, or else
	// client_secret_basic if the server's metadata lists it but not
	// client_secret_post, and client_secret_post otherwise.
	TokenEndpointAuthMethod string
	// RedirectURI is the redirect URI for the OAuth flow
	RedirectURI string
	// Scopes is the list of OAuth scopes to request
	Scopes []string
	// TokenStore is the storage for OAuth tokens
	TokenStore TokenStore
	// AuthServerMetadataURL is the URL to the OAuth server metadata
	// If empty, the client will attempt to discover it from the base URL
	AuthServerMetadataURL string
	// ProtectedResourceMetadataURL is the URL to the OAuth protected resource metadata
	// per RFC9728. If set, this URL will be used to discover the authorization server.
	// This is typically extracted from the WWW-Authenticate header's resource_metadata parameter.
	ProtectedResourceMetadataURL string
	// PKCEEnabled enables PKCE for the OAuth flow (recommended for public clients).
	// When set, GetAuthorizationURL and the authorization response methods
	// return ErrPKCERequired for an empty code challenge or code verifier.
	PKCEEnabled bool
	// SkipIssuerMetadataValidation turns off the check that authorization
	// server metadata found through protected resource metadata declares the
	// issuer it was requested for (RFC 8414 §3.3). Turning it off weakens
	// security; it is meant only for authorization servers known to publish
	// a mismatched issuer.
	SkipIssuerMetadataValidation bool
	// HTTPClient is an optional HTTP client to use for requests.
	// If nil, a default HTTP client with a 30 second timeout is used. It
	// follows token, refresh and registration requests only to the same
	// scheme, host and port, and never redirects metadata discovery from
	// https to http.
	HTTPClient *http.Client
}

// TokenStore is an interface for storing and retrieving OAuth tokens.
//
// Implementations must:
//   - Preserve Token.Issuer when persisting and restoring tokens
//   - Honor context cancellation and deadlines, returning context.Canceled
//     or context.DeadlineExceeded as appropriate
//   - Return ErrNoToken (or a sentinel error that wraps it) when no token
//     is available, rather than conflating this with other operational errors
//   - Properly propagate all other errors (database failures, I/O errors, etc.)
//   - Check ctx.Done() before performing operations and return ctx.Err() if cancelled
type TokenStore interface {
	// GetToken returns the current token.
	// Returns ErrNoToken if no token is available.
	// Returns context.Canceled or context.DeadlineExceeded if ctx is cancelled.
	// Returns other errors for operational failures (I/O, database, etc.).
	GetToken(ctx context.Context) (*Token, error)

	// SaveToken saves a token.
	// Returns context.Canceled or context.DeadlineExceeded if ctx is cancelled.
	// Returns other errors for operational failures (I/O, database, etc.).
	SaveToken(ctx context.Context, token *Token) error
}

// Token represents an OAuth token
type Token struct {
	// Issuer records trusted local provenance, not token endpoint response metadata.
	Issuer string `json:"issuer,omitempty"`
	// AccessToken is the OAuth access token
	AccessToken string `json:"access_token"`
	// TokenType is the type of token (usually "Bearer")
	TokenType string `json:"token_type"`
	// RefreshToken is the OAuth refresh token
	RefreshToken string `json:"refresh_token,omitempty"`
	// ExpiresIn is the number of seconds until the token expires
	ExpiresIn int64 `json:"expires_in,omitempty"`
	// Scope is the scope of the token
	Scope string `json:"scope,omitempty"`
	// ExpiresAt is the time when the token expires
	ExpiresAt time.Time `json:"expires_at,omitzero"`
}

// IsExpired returns true if the token is expired
func (t *Token) IsExpired() bool {
	if t.ExpiresAt.IsZero() {
		return false
	}
	return time.Now().After(t.ExpiresAt)
}

// MemoryTokenStore is a simple in-memory token store
type MemoryTokenStore struct {
	token *Token
	mu    sync.RWMutex
}

// NewMemoryTokenStore creates a new in-memory token store
func NewMemoryTokenStore() *MemoryTokenStore {
	return &MemoryTokenStore{}
}

// GetToken returns the current token.
// Returns ErrNoToken if no token is available.
// Returns context.Canceled or context.DeadlineExceeded if ctx is cancelled.
func (s *MemoryTokenStore) GetToken(ctx context.Context) (*Token, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.token == nil {
		return nil, ErrNoToken
	}
	return s.token, nil
}

// SaveToken saves a token.
// Returns context.Canceled or context.DeadlineExceeded if ctx is cancelled.
func (s *MemoryTokenStore) SaveToken(ctx context.Context, token *Token) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.token = token
	return nil
}

// AuthServerMetadata represents the OAuth 2.0 Authorization Server Metadata
// as defined in RFC 8414 (https://www.rfc-editor.org/rfc/rfc8414.html).
//
// URL-bearing fields are validated by validateAuthServerMetadataURLs to
// reject non-http(s) schemes (e.g. javascript:, data:, file:) that could
// otherwise be injected by a hostile authorization server.
//
// Signed metadata (the "signed_metadata" JWT field) is not supported.
type AuthServerMetadata struct {
	Issuer                                             string   `json:"issuer"`
	AuthorizationEndpoint                              string   `json:"authorization_endpoint"`
	TokenEndpoint                                      string   `json:"token_endpoint"`
	JwksURI                                            string   `json:"jwks_uri,omitempty"`
	RegistrationEndpoint                               string   `json:"registration_endpoint,omitempty"`
	ScopesSupported                                    []string `json:"scopes_supported,omitempty"`
	ResponseTypesSupported                             []string `json:"response_types_supported"`
	ResponseModesSupported                             []string `json:"response_modes_supported,omitempty"`
	GrantTypesSupported                                []string `json:"grant_types_supported,omitempty"`
	TokenEndpointAuthMethodsSupported                  []string `json:"token_endpoint_auth_methods_supported,omitempty"`
	TokenEndpointAuthSigningAlgValuesSupported         []string `json:"token_endpoint_auth_signing_alg_values_supported,omitempty"`
	ServiceDocumentation                               string   `json:"service_documentation,omitempty"`
	UILocalesSupported                                 []string `json:"ui_locales_supported,omitempty"`
	OpPolicyURI                                        string   `json:"op_policy_uri,omitempty"`
	OpTOSURI                                           string   `json:"op_tos_uri,omitempty"`
	RevocationEndpoint                                 string   `json:"revocation_endpoint,omitempty"`
	RevocationEndpointAuthMethodsSupported             []string `json:"revocation_endpoint_auth_methods_supported,omitempty"`
	RevocationEndpointAuthSigningAlgValuesSupported    []string `json:"revocation_endpoint_auth_signing_alg_values_supported,omitempty"`
	IntrospectionEndpoint                              string   `json:"introspection_endpoint,omitempty"`
	IntrospectionEndpointAuthMethodsSupported          []string `json:"introspection_endpoint_auth_methods_supported,omitempty"`
	IntrospectionEndpointAuthSigningAlgValuesSupported []string `json:"introspection_endpoint_auth_signing_alg_values_supported,omitempty"`
	CodeChallengeMethodsSupported                      []string `json:"code_challenge_methods_supported,omitempty"`
	// AuthorizationResponseIssParameterSupported reports whether the server
	// includes the iss parameter in authorization responses (RFC 9207).
	AuthorizationResponseIssParameterSupported bool `json:"authorization_response_iss_parameter_supported,omitempty"`

	// guessed marks metadata made up from default endpoints because the
	// server published none, so its Issuer was never confirmed.
	guessed bool
}

// AuthorizationTransaction is an immutable snapshot of an authorization flow
// started by GetAuthorizationURL. It binds the state, issuer, token endpoint,
// resource and client credentials to that flow. Its zero value is not valid.
//
// Keep this value in trusted server-side in-memory session storage alongside the PKCE
// verifier. It contains credentials and must not be sent to the browser. It can
// be copied between request handlers in the same process, but does not support
// serialization or persistence across process restarts.
type AuthorizationTransaction struct {
	state        string
	metadata     AuthServerMetadata
	resourceURL  string
	clientID     string
	clientSecret string
	redirectURI  string
	pkceEnabled  bool
	authMethod   string
}

// String implements fmt.Stringer without exposing transaction data.
func (AuthorizationTransaction) String() string {
	return "AuthorizationTransaction{redacted}"
}

// GoString implements fmt.GoStringer without exposing transaction data.
func (t AuthorizationTransaction) GoString() string {
	return t.String()
}

// OAuthHandler handles OAuth authentication for HTTP requests
type OAuthHandler struct {
	config           OAuthConfig
	httpClient       *http.Client
	serverMetadata   *AuthServerMetadata
	metadataFetchErr error
	// metadataOnce gates the discovery RPCs so they run once per
	// OAuthHandler, or again after a discovery that failed. It is a pointer
	// (rather than an embedded value) so SetProtectedResourceMetadataURL
	// can swap in a fresh sync.Once without racing against a concurrently
	// running Do on the previous instance. The pointer itself is protected by metadataMu; callers
	// snapshot the pointer under the lock and then invoke Do without
	// holding the lock.
	metadataOnce *sync.Once
	baseURL      string
	// metadataMu protects baseURL, serverMetadata, metadataFetchErr,
	// metadataOnce, config.ProtectedResourceMetadataURL, knownIssuer, and resourceURL.
	// It MUST NOT be held across HTTP I/O — see getServerMetadata for the
	// snapshot/publish discipline that keeps network round trips out of
	// the critical section (#871).
	metadataMu  sync.Mutex
	knownIssuer string // last successfully discovered issuer; retained across resets
	resourceURL string // RFC 8707 resource indicator; set from protected resource metadata

	// registeredAuthMethod is the token_endpoint_auth_method the
	// authorization server registered for the client during dynamic client
	// registration, if any.
	registeredAuthMethod string
	assertedIssuer       string // immutable application assertion for raw refresh tokens
	// credentialsMu protects mutable credentials, binding, registration flights and
	// publication. Lock order is credentialsMu then metadataMu; neither is held
	// during HTTP I/O. Publication may hold credentialsMu during TokenStore I/O.
	credentialsMu      sync.Mutex
	credentialsVersion uint64
	credentialsDCR     bool
	registrationName   string
	registering        *registrationFlight
	flowIssuer         string

	mu                       sync.RWMutex // Protects expectedState, flowIssuer and authorizationTransaction
	expectedState            string       // Expected state value for CSRF protection
	authorizationTransaction *AuthorizationTransaction

	// refreshMu protects refreshing, the token refresh in flight, if any.
	// Callers of this handler that find the token expired share it: a
	// refresh token may be good for a single use, so they must not each
	// send it.
	refreshMu  sync.Mutex
	refreshing *tokenRefresh
}

// tokenRefresh is a token refresh shared by the callers that wait for it.
type tokenRefresh struct {
	done  chan struct{}
	token *Token
	err   error
}

// NewOAuthHandler creates a new OAuth handler
func NewOAuthHandler(config OAuthConfig) *OAuthHandler {
	if config.TokenStore == nil {
		config.TokenStore = NewMemoryTokenStore()
	}
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: 30 * time.Second, CheckRedirect: oauthRedirectPolicy}
	}

	return &OAuthHandler{
		config:         config,
		assertedIssuer: config.CredentialsIssuer,
		httpClient:     config.HTTPClient,
	}
}

// GetAuthorizationHeader returns the Authorization header value for a request.
//
// If the stored token has expired, it refreshes it, or waits for a refresh
// another caller already started, and returns ctx's error if ctx ends first.
func (h *OAuthHandler) GetAuthorizationHeader(ctx context.Context) (string, error) {
	token, err := h.getValidToken(ctx)
	if err != nil {
		return "", err
	}

	// Per RFC 6749 §5.1, token_type is case-insensitive.
	// Normalize to "Bearer" for strict implementations. A token without a
	// type, for example one an application put in the store itself, is
	// sent as a bearer token too, as MCP authorization prescribes.
	tokenType := token.TokenType
	if tokenType == "" || strings.EqualFold(tokenType, "bearer") {
		tokenType = "Bearer"
	}

	return fmt.Sprintf("%s %s", tokenType, token.AccessToken), nil
}

// getValidToken returns a valid token, refreshing if necessary
func (h *OAuthHandler) getValidToken(ctx context.Context) (*Token, error) {
	token, err := h.config.TokenStore.GetToken(ctx)
	if err != nil && !errors.Is(err, ErrNoToken) {
		return nil, err
	}
	if err == nil && !token.IsExpired() && token.AccessToken != "" {
		if err := h.checkKnownTokenIssuer(token); err != nil {
			return nil, err
		}
		return token, nil
	}
	if err != nil || token.RefreshToken == "" {
		// We need to get a new token through the authorization flow
		return nil, ErrOAuthAuthorizationRequired
	}

	// Share one refresh among the callers that need it. With refresh token
	// rotation, which the MCP spec requires for public clients, a second
	// request with the same refresh token is rejected, and a server that
	// detects the reuse may revoke the tokens the first request got.
	refresh := h.startRefresh(ctx)
	select {
	case <-refresh.done:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	if refresh.err != nil {
		// If refresh fails, continue to authorization flow
		if errors.Is(refresh.err, ErrAuthorizationServerChanged) || errors.Is(refresh.err, ErrOAuthAuthorizationRequired) {
			return nil, refresh.err
		}
		return nil, ErrOAuthAuthorizationRequired
	}
	return refresh.token, nil
}

// refreshTimeout bounds a token refresh, which doesn't end with the context
// of the caller that started it.
const refreshTimeout = 30 * time.Second

// startRefresh returns the token refresh in flight, starting one if there is
// none.
//
// The refresh runs on its own context rather than the caller's. If it ended
// with the caller, a caller that gives up after the server has used up the
// refresh token would leave the others to send the spent token again.
func (h *OAuthHandler) startRefresh(ctx context.Context) *tokenRefresh {
	h.refreshMu.Lock()
	defer h.refreshMu.Unlock()
	if h.refreshing != nil {
		return h.refreshing
	}
	refresh := &tokenRefresh{done: make(chan struct{})}
	h.refreshing = refresh
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), refreshTimeout)
	go func() {
		defer cancel()
		refresh.token, refresh.err = h.refreshStoredToken(ctx)
		h.refreshMu.Lock()
		h.refreshing = nil
		h.refreshMu.Unlock()
		close(refresh.done)
	}()
	return refresh
}

// refreshStoredToken refreshes the stored token, unless a refresh that
// finished since the caller read the store has already replaced it.
func (h *OAuthHandler) refreshStoredToken(ctx context.Context) (*Token, error) {
	token, err := h.config.TokenStore.GetToken(ctx)
	if err != nil {
		return nil, err
	}
	if !token.IsExpired() && token.AccessToken != "" {
		if err := h.checkKnownTokenIssuer(token); err != nil {
			return nil, err
		}
		return token, nil
	}
	if token.RefreshToken == "" {
		return nil, ErrOAuthAuthorizationRequired
	}
	return h.refreshToken(ctx, token.RefreshToken, token.Issuer)
}

// refreshToken refreshes an OAuth token
func (h *OAuthHandler) refreshToken(ctx context.Context, refreshToken, issuer string) (*Token, error) {
	if issuer == "" {
		return nil, ErrOAuthAuthorizationRequired
	}
	metadata, err := h.getServerMetadata(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get server metadata: %w", err)
	}

	if metadata.Issuer == "" {
		return nil, errors.New("authorization server metadata missing issuer")
	}
	if metadata.Issuer != issuer {
		return nil, serverChanged()
	}
	credentials, err := h.boundCredentials(metadata)
	if err != nil {
		return nil, err
	}
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)
	// RFC 8707: Include resource parameter on refresh requests
	if resourceURL := h.getResourceURL(); resourceURL != "" {
		data.Set("resource", resourceURL)
	}

	req, err := h.newTokenRequest(ctx, metadata, credentials, data)
	if err != nil {
		return nil, fmt.Errorf("failed to create refresh token request: %w", err)
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send refresh token request: %w", err)
	}
	defer resp.Body.Close()

	// Accept any 2xx status; some authorization servers (e.g. Supabase) return
	// 201 Created for successful token responses.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body := readErrorBody(resp.Body)
		return nil, extractOAuthError(body, resp.StatusCode, "refresh token request failed")
	}

	// Read the response body for parsing
	body, err := io.ReadAll(newBoundedReader(resp.Body, maxOAuthBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to read token response body: %w", err)
	}

	// GitHub returns HTTP 200 even for errors, with error details in the JSON body
	// Check if the response contains an error field before parsing as Token
	var oauthErr OAuthError
	if err := json.Unmarshal(body, &oauthErr); err == nil && oauthErr.ErrorCode != "" {
		return nil, fmt.Errorf("refresh token request failed: %w", oauthErr)
	}

	var tokenResp Token
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	// Set expiration time
	if tokenResp.ExpiresIn > 0 {
		tokenResp.ExpiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	}

	// If no new refresh token is provided, keep the old one
	if tokenResp.RefreshToken == "" {
		tokenResp.RefreshToken = refreshToken
	}

	// Save the token
	if err := h.saveBoundToken(ctx, metadata, credentials, &tokenResp); err != nil {
		return nil, fmt.Errorf("failed to save token: %w", err)
	}

	return &tokenResp, nil
}

// RefreshToken refreshes a token with matching stored provenance. An unknown raw
// refresh token requires an explicitly configured CredentialsIssuer; a learned
// first-use binding alone is not an assertion of that token's origin.
func (h *OAuthHandler) RefreshToken(ctx context.Context, refreshToken string) (*Token, error) {
	token, err := h.config.TokenStore.GetToken(ctx)
	if err != nil && !errors.Is(err, ErrNoToken) {
		return nil, err
	}
	issuer := h.assertedIssuer
	if err == nil && token != nil && token.RefreshToken == refreshToken {
		issuer = token.Issuer
	}
	return h.refreshToken(ctx, refreshToken, issuer)
}

// GetClientID returns the client ID
func (h *OAuthHandler) GetClientID() string {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	return h.config.ClientID
}

// extractOAuthError attempts to parse an OAuth error response from the response body
func extractOAuthError(body []byte, statusCode int, context string) error {
	// Try to parse the error as an OAuth error response
	var oauthErr OAuthError
	if err := json.Unmarshal(body, &oauthErr); err == nil && oauthErr.ErrorCode != "" {
		return fmt.Errorf("%s: %w", context, oauthErr)
	}

	// If not a valid OAuth error, return the raw response
	return fmt.Errorf("%s with status %d: %s", context, statusCode, body)
}

// SetProtectedResourceMetadataURL updates the protected resource metadata URL
// and resets the cached server metadata so it will be re-discovered on the next call.
//
// This setter does not validate the URL; callers that pass values obtained
// out of band are trusted. For values parsed from a 401 WWW-Authenticate
// header, prefer HandleUnauthorizedResponse, which applies origin
// validation before storing.
func (h *OAuthHandler) SetProtectedResourceMetadataURL(u string) {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	h.metadataMu.Lock()
	defer h.metadataMu.Unlock()
	h.config.ProtectedResourceMetadataURL = u
	h.serverMetadata = nil
	h.metadataFetchErr = nil
	// Install a fresh sync.Once so the next getServerMetadata call
	// triggers re-discovery. Replacing the pointer (rather than mutating
	// the pointed-to value) keeps this safe against concurrent Do calls
	// that captured the previous instance.
	h.metadataOnce = &sync.Once{}
	h.resourceURL = ""
}

// HandleUnauthorizedResponse inspects a 401 response for RFC 9728 §5.1
// WWW-Authenticate challenges and, when one carries a resource_metadata
// parameter whose URL shares the protected resource's origin, stores it
// so subsequent metadata discovery can use it. It iterates every
// WWW-Authenticate header line (a response can carry multiple challenges
// — Basic, Bearer, etc. — each on its own line) and every
// resource_metadata parameter within each line, takes the first
// candidate that validates, and silently ignores headers that are
// absent, malformed, or advertise an unrelated origin.
//
// Origin validation rejects URLs whose scheme or host differs from the
// OAuth handler's configured base URL. This prevents a compromised or
// misconfigured resource from redirecting clients to an attacker's
// metadata endpoint.
//
// It is safe to call with a nil response.
func (h *OAuthHandler) HandleUnauthorizedResponse(resp *http.Response) {
	if resp == nil {
		return
	}
	for _, header := range resp.Header.Values("WWW-Authenticate") {
		for _, candidate := range extractResourceMetadataURLs(header) {
			if err := h.validateAdvertisedPRMURL(candidate); err != nil {
				continue
			}
			h.SetProtectedResourceMetadataURL(candidate)
			return
		}
	}
}

// validateAdvertisedPRMURL enforces that a PRM URL advertised by the
// resource (i.e. parsed from an untrusted WWW-Authenticate header) shares
// the configured base URL's scheme and host. Returns a non-nil error when
// the candidate is unparseable, carries a different scheme or host, or
// when no base URL has been configured to validate against.
//
// RFC 9728 §3.2 requires the protected resource to serve its own metadata;
// this check rejects attempts to redirect discovery to an unrelated
// origin, which would otherwise let the resource point the client at an
// attacker-controlled OAuth metadata endpoint.
func (h *OAuthHandler) validateAdvertisedPRMURL(candidate string) error {
	h.metadataMu.Lock()
	baseURL := h.baseURL
	h.metadataMu.Unlock()
	if baseURL == "" {
		return errors.New("no base URL configured for origin validation")
	}
	base, err := url.Parse(baseURL)
	if err != nil {
		return fmt.Errorf("invalid base URL %q: %w", baseURL, err)
	}
	// url.Parse accepts relative references (empty Scheme and Host)
	// without error. Reject those explicitly so two empty values do not
	// EqualFold-match each other and bypass origin validation.
	if base.Scheme == "" || base.Host == "" {
		return fmt.Errorf("base URL %q is not absolute (missing scheme or host)", baseURL)
	}
	parsed, err := url.Parse(candidate)
	if err != nil {
		return fmt.Errorf("invalid advertised PRM URL %q: %w", candidate, err)
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return fmt.Errorf("advertised PRM URL %q is not absolute (missing scheme or host)", candidate)
	}
	if !strings.EqualFold(parsed.Scheme, base.Scheme) {
		return fmt.Errorf("advertised PRM URL scheme %q does not match base %q", parsed.Scheme, base.Scheme)
	}
	if !strings.EqualFold(parsed.Host, base.Host) {
		return fmt.Errorf("advertised PRM URL host %q does not match base %q", parsed.Host, base.Host)
	}
	return nil
}

// getResourceURL returns the RFC 8707 resource indicator under metadataMu.
func (h *OAuthHandler) getResourceURL() string {
	h.metadataMu.Lock()
	defer h.metadataMu.Unlock()
	return h.resourceURL
}

// GetClientSecret returns the client secret
func (h *OAuthHandler) GetClientSecret() string {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	return h.config.ClientSecret
}

// SetBaseURL sets the base URL for the API server.
// Must be called before any calls to getServerMetadata (i.e., during initialization).
func (h *OAuthHandler) SetBaseURL(baseURL string) {
	h.metadataMu.Lock()
	defer h.metadataMu.Unlock()
	h.baseURL = baseURL
}

// GetExpectedState returns the expected state value (for testing purposes)
func (h *OAuthHandler) GetExpectedState() string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.expectedState
}

// SetExpectedState sets the expected state value.
//
// This can be useful if you cannot maintain an OAuthHandler
// instance throughout the authentication flow; for example, if
// the initialization and callback steps are handled in different
// requests.
//
// In such cases, this should be called with the state value generated
// during the initial authentication request (e.g. by GenerateState)
// and included in the authorization URL.
//
// State alone supports the legacy ProcessAuthorizationResponse flow. For
// ProcessAuthorizationCallback, save GetAuthorizationTransaction after creating
// the authorization URL and restore it with SetAuthorizationTransaction on the
// callback handler instead. Restoring state alone cannot establish the original
// issuer or token endpoint. Changing state discards any existing transaction.
func (h *OAuthHandler) SetExpectedState(expectedState string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.expectedState != expectedState {
		h.authorizationTransaction = nil
	}
	h.expectedState = expectedState
	h.flowIssuer = ""
}

// GetAuthorizationTransaction returns a copy of the pending authorization
// transaction and whether one exists. Call it after GetAuthorizationURL and
// before redirecting the user. A handler holds only one pending transaction;
// starting another flow replaces it. Coordinate URL creation and session storage
// in the caller when starting flows concurrently on the same handler.
func (h *OAuthHandler) GetAuthorizationTransaction() (AuthorizationTransaction, bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.authorizationTransaction == nil || h.expectedState == "" {
		return AuthorizationTransaction{}, false
	}
	return *h.authorizationTransaction, true
}

// SetAuthorizationTransaction restores a saved transaction and its expected
// state without discovering metadata. For callbacks handled by another request,
// retrieve the transaction and PKCE verifier from trusted server-side storage,
// consume that session record atomically once, then restore the transaction on
// the new handler and call ProcessAuthorizationCallback. The handler consumes
// its local copy on a state-valid response; it cannot prevent another handler
// from restoring the same saved value. TokenStore and HTTPClient come from the
// receiving handler. Its current issuer and client credentials must still match
// the saved transaction before the code can be exchanged.
func (h *OAuthHandler) SetAuthorizationTransaction(transaction AuthorizationTransaction) error {
	if transaction.state == "" {
		return errors.New("authorization transaction has no state")
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	h.expectedState = transaction.state
	h.flowIssuer = transaction.metadata.Issuer
	h.authorizationTransaction = &transaction
	return nil
}

// OAuthError represents a standard OAuth 2.0 error response
type OAuthError struct {
	ErrorCode        string `json:"error"`
	ErrorDescription string `json:"error_description,omitempty"`
	ErrorURI         string `json:"error_uri,omitempty"`
}

// Error implements the error interface
func (e OAuthError) Error() string {
	if e.ErrorDescription != "" {
		return fmt.Sprintf("OAuth error: %s - %s", e.ErrorCode, e.ErrorDescription)
	}
	return fmt.Sprintf("OAuth error: %s", e.ErrorCode)
}

// OAuthProtectedResource represents the response from /.well-known/oauth-protected-resource
type OAuthProtectedResource struct {
	AuthorizationServers []string `json:"authorization_servers"`
	Resource             string   `json:"resource"`
	ResourceName         string   `json:"resource_name,omitempty"`
}

// metadataDiscoveryResult bundles the outputs of a single OAuth server
// metadata discovery attempt so that fetchServerMetadata can return them
// to getServerMetadata for publication under metadataMu, instead of
// mutating shared state directly while holding the lock across HTTP I/O.
type metadataDiscoveryResult struct {
	metadata    *AuthServerMetadata
	resourceURL string
}

// getServerMetadata fetches the OAuth server metadata.
//
// Discovery is gated by metadataOnce so the network round trips happen
// once per OAuthHandler, or again after a discovery that failed. metadataMu
// is taken only to snapshot configuration inputs before the fetch and to
// publish the result afterwards; it is intentionally NOT held while HTTP
// requests are in flight so that concurrent callers of other
// metadataMu-guarded methods (e.g. SetProtectedResourceMetadataURL,
// getResourceURL, validateAdvertisedPRMURL) are not blocked on network I/O.
// See #871.
func (h *OAuthHandler) getServerMetadata(ctx context.Context) (*AuthServerMetadata, error) {
	// Snapshot (and lazily initialize) the current sync.Once under the
	// lock. Using a pointer means SetProtectedResourceMetadataURL can
	// install a fresh once without racing with a Do already in flight on
	// the previous instance.
	h.metadataMu.Lock()
	if h.metadataOnce == nil {
		h.metadataOnce = &sync.Once{}
	}
	once := h.metadataOnce
	h.metadataMu.Unlock()

	once.Do(func() {
		result, err := h.fetchServerMetadata(ctx)
		h.metadataMu.Lock()
		defer h.metadataMu.Unlock()
		// If SetProtectedResourceMetadataURL swapped in a fresh sync.Once
		// while the fetch was in flight, the configuration that produced
		// `result` is now stale. Discard the result instead of letting it
		// clobber the newer state; the next getServerMetadata call will
		// drive re-discovery through the new once.
		if h.metadataOnce != once {
			return
		}
		// A failed discovery is reported to the callers waiting on it, but
		// not kept: it may come from the first caller's context ending or
		// from a network error, so the next call discovers again. Each
		// discovery reports its own failure, not one left by the last.
		h.metadataFetchErr = nil
		defer func() {
			if h.metadataFetchErr != nil {
				h.metadataOnce = &sync.Once{}
			}
		}()
		if err != nil {
			h.metadataFetchErr = err
			return
		}
		// Only overwrite serverMetadata on a positive result. Preserving the
		// existing value on a no-op fetch (nil metadata, nil error) matches
		// the prior behavior where fetchMetadataFromURL silently returned on
		// non-200 responses without touching shared state.
		if result.metadata != nil {
			h.serverMetadata = result.metadata
			h.knownIssuer = result.metadata.Issuer
			h.metadataFetchErr = nil
		}
		if result.resourceURL != "" {
			h.resourceURL = result.resourceURL
		}
		// Discovery completed without producing metadata or an error (e.g. a
		// non-2xx response handled by fetchMetadataFromURL). Record an explicit
		// error — including the discovery target — so callers receive an
		// error instead of a nil *AuthServerMetadata, which they would
		// dereference and panic on. Skip when serverMetadata is already
		// populated: a no-op re-discovery preserves the prior value.
		if h.serverMetadata == nil && h.metadataFetchErr == nil {
			if h.config.AuthServerMetadataURL != "" {
				h.metadataFetchErr = fmt.Errorf("authorization server metadata unavailable: discovery at %q returned no metadata", h.config.AuthServerMetadataURL)
			} else {
				h.metadataFetchErr = errors.New("authorization server metadata unavailable: auto-discovery from the server base URL returned no metadata")
			}
		}
	})

	h.metadataMu.Lock()
	defer h.metadataMu.Unlock()
	if h.metadataFetchErr != nil {
		return nil, h.metadataFetchErr
	}
	// Defensive backstop: a concurrent SetProtectedResourceMetadataURL may have
	// reset state after our once ran. Never return (nil, nil) — every caller
	// dereferences the returned metadata.
	if h.serverMetadata == nil {
		return nil, errors.New("authorization server metadata unavailable")
	}
	return h.serverMetadata, nil
}

// fetchServerMetadata performs OAuth server metadata discovery without
// holding metadataMu, so concurrent callers reading other state guarded
// by the mutex are not blocked on network I/O. Configuration inputs are
// snapshotted under the lock before the first request is issued; the
// caller (getServerMetadata) is responsible for publishing the returned
// result back into the handler under metadataMu.
func (h *OAuthHandler) fetchServerMetadata(ctx context.Context) (metadataDiscoveryResult, error) {
	// Snapshot config and base URL under the lock; release before any HTTP I/O.
	h.metadataMu.Lock()
	authServerMetadataURL := h.config.AuthServerMetadataURL
	protectedResourceMetadataURL := h.config.ProtectedResourceMetadataURL
	validateIssuer := !h.config.SkipIssuerMetadataValidation
	baseURL, baseURLErr := h.extractBaseURL()
	h.metadataMu.Unlock()

	// If AuthServerMetadataURL is explicitly provided, use it directly
	if authServerMetadataURL != "" {
		metadata, err := h.fetchMetadataFromURL(ctx, authServerMetadataURL)
		if err != nil {
			return metadataDiscoveryResult{}, err
		}
		return metadataDiscoveryResult{metadata: metadata}, nil
	}

	// Always extract base URL for fallback scenarios
	if baseURLErr != nil {
		return metadataDiscoveryResult{}, fmt.Errorf("failed to extract base URL: %w", baseURLErr)
	}

	// Determine the protected resource metadata URL with priority:
	// 1. Explicit config (ProtectedResourceMetadataURL from RFC9728 WWW-Authenticate header)
	// 2. Constructed from base URL
	var protectedResourceURL string
	explicitMetadataURL := protectedResourceMetadataURL != ""
	if explicitMetadataURL {
		protectedResourceURL = protectedResourceMetadataURL
	} else {
		var err error
		protectedResourceURL, err = buildWellKnownURL(baseURL, "oauth-protected-resource")
		if err != nil {
			return metadataDiscoveryResult{}, fmt.Errorf("failed to build protected resource URL: %w", err)
		}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, protectedResourceURL, nil)
	if err != nil {
		return metadataDiscoveryResult{}, fmt.Errorf("failed to create protected resource request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	// Advertise the latest protocol version this client supports. Metadata
	// discovery happens before the MCP initialize handshake, so no negotiated
	// version is available yet; servers that don't recognise it can fall back
	// per the MCP spec.
	req.Header.Set("MCP-Protocol-Version", mcp.LATEST_PROTOCOL_VERSION)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return metadataDiscoveryResult{}, fmt.Errorf("failed to send protected resource request: %w", err)
	}
	defer resp.Body.Close()

	// If we can't get the protected resource metadata, try OAuth Authorization Server discovery.
	// However, if the resource_metadata URL was explicitly provided (via RFC 9728), don't
	// fall back to baseURL-derived discovery — the server specifically indicated where to
	// find metadata, so falling back would mask the signal.
	if resp.StatusCode != http.StatusOK {
		if explicitMetadataURL {
			return metadataDiscoveryResult{}, fmt.Errorf("protected resource metadata discovery failed for explicit URL %q: status %d", protectedResourceURL, resp.StatusCode)
		}
		for _, u := range authorizationServerMetadataURLs(baseURL) {
			// Intermediate fetch errors are intentionally discarded so the caller
			// can fall through to the next candidate URL, mirroring the prior
			// behavior where metadataFetchErr was cleared on the first success.
			if metadata, _ := h.fetchMetadataFromURL(ctx, u); metadata != nil {
				return metadataDiscoveryResult{metadata: metadata}, nil
			}
		}
		// If that also fails, fall back to default endpoints
		metadata, err := h.getDefaultEndpoints(baseURL)
		if err != nil {
			return metadataDiscoveryResult{}, fmt.Errorf("failed to get default endpoints: %w", err)
		}
		return metadataDiscoveryResult{metadata: metadata}, nil
	}

	// Parse the protected resource metadata
	var protectedResource OAuthProtectedResource
	if err := json.NewDecoder(newBoundedReader(resp.Body, maxOAuthBodyBytes)).Decode(&protectedResource); err != nil {
		return metadataDiscoveryResult{}, fmt.Errorf("failed to decode protected resource response: %w", err)
	}

	// RFC 9728 §3.3/§7.3: the resource identifier a protected resource
	// metadata document declares must match the protected resource the
	// client addressed — otherwise the document MUST NOT be used. Without
	// the check, a malicious MCP server could declare another server as its
	// resource and have tokens minted for that victim: the RFC 8707
	// resource parameter taken from the metadata names the victim, so the
	// authorization server mints a token for the victim's API while the
	// attacker's server receives it.
	//
	// Both discovery paths enforce the binding, at different strictness.
	// A PRM URL advertised via WWW-Authenticate is untrusted input that may
	// not share an origin with the protected resource, so its document must
	// declare a resource identifier exactly equal to the base URL, and a
	// document that omits the resource field is rejected outright: with no
	// explicit identifier there is no binding at all. The well-known path is
	// constructed from the base URL, but the document it serves is still
	// server-controlled, so a declared resource must at least bind to the
	// addressed resource — same scheme and host, and a path equal to or a
	// segment-aware prefix of the addressed path (see resourceBindsToURL) —
	// so servers mounted at /mcp that declare their origin as the resource
	// keep working while a resource naming another server is rejected.
	if explicitMetadataURL {
		if protectedResource.Resource == "" {
			return metadataDiscoveryResult{}, fmt.Errorf(
				"advertised protected resource metadata from %q omits required resource field",
				protectedResourceURL,
			)
		}
		if !resourceIdentifiersEqual(protectedResource.Resource, baseURL) {
			return metadataDiscoveryResult{}, fmt.Errorf(
				"advertised protected resource metadata declares resource %q which does not match base URL %q",
				protectedResource.Resource, baseURL,
			)
		}
	} else if protectedResource.Resource != "" && !resourceBindsToURL(protectedResource.Resource, baseURL) {
		return metadataDiscoveryResult{}, fmt.Errorf(
			"protected resource metadata from %q declares resource %q which does not match base URL %q",
			protectedResourceURL, protectedResource.Resource, baseURL,
		)
	}

	// RFC 8707: Capture the resource identifier for use in authorization requests.
	// If not provided in metadata, fall back to base URL per RFC 8707 Section 2:
	// "The client SHOULD use the base URI of the API as the resource parameter value
	// unless specific knowledge of the resource dictates otherwise."
	resourceURL := protectedResource.Resource
	if resourceURL == "" {
		resourceURL = baseURL
	}

	// If no authorization servers are specified, fall back to default endpoints
	if len(protectedResource.AuthorizationServers) == 0 {
		metadata, err := h.getDefaultEndpoints(baseURL)
		if err != nil {
			return metadataDiscoveryResult{}, fmt.Errorf("failed to get default endpoints: %w", err)
		}
		return metadataDiscoveryResult{metadata: metadata, resourceURL: resourceURL}, nil
	}

	// Use the first authorization server
	authServerURL := protectedResource.AuthorizationServers[0]

	// Try the MCP-specified discovery URLs in order (RFC 8414 with path
	// insertion, plus OpenID Connect Discovery variants).
	for _, u := range authorizationServerMetadataURLs(authServerURL) {
		// Intermediate fetch errors are intentionally discarded so the caller
		// can fall through to the next candidate URL.
		metadata, _ := h.fetchMetadataFromURL(ctx, u)
		if metadata == nil {
			continue
		}
		// RFC 8414 §3.3 / OpenID Connect Discovery §4.3: the issuer in the
		// document must be identical to the issuer the well-known URL was
		// built from, or the metadata must not be used. Otherwise a server
		// could send the client to one authorization server's endpoints
		// under another's name. Only a final trailing slash is ignored, as
		// in the official Go SDK: both spellings name the same server.
		if validateIssuer && strings.TrimSuffix(metadata.Issuer, "/") != strings.TrimSuffix(authServerURL, "/") {
			return metadataDiscoveryResult{}, fmt.Errorf(
				"authorization server metadata from %q declares issuer %q, not %q",
				u, metadata.Issuer, authServerURL,
			)
		}
		return metadataDiscoveryResult{metadata: metadata, resourceURL: resourceURL}, nil
	}

	// If both discovery methods fail, use default endpoints based on the authorization server URL
	metadata, err := h.getDefaultEndpoints(authServerURL)
	if err != nil {
		return metadataDiscoveryResult{}, fmt.Errorf("failed to get default endpoints: %w", err)
	}
	return metadataDiscoveryResult{metadata: metadata, resourceURL: resourceURL}, nil
}

// buildWellKnownURL constructs a well-known discovery URL by inserting the
// given suffix between the authority and path of baseURL (RFC 8414 §3 /
// RFC 9728 path-insertion semantics).
func buildWellKnownURL(baseURL string, suffix string) (string, error) {
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse base URL: %w", err)
	}

	if parsedURL.Scheme == "" || parsedURL.Host == "" {
		return "", fmt.Errorf("invalid base URL: missing scheme or host in %q", baseURL)
	}

	path := strings.TrimSuffix(parsedURL.EscapedPath(), "/")
	root := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
	if path == "" || path == "/" {
		return root + "/.well-known/" + suffix, nil
	}

	return root + "/.well-known/" + suffix + path, nil
}

// resourceComponentsEqual reports whether two parsed resource identifiers
// agree on every component an RFC 9728 §3.3 binding check compares outside
// the path: scheme and host case-insensitively per RFC 3986 §3.1 / §3.2.2,
// and query, fragment, and userinfo, which are significant.
func resourceComponentsEqual(a, b *url.URL) bool {
	if !strings.EqualFold(a.Scheme, b.Scheme) {
		return false
	}
	if !strings.EqualFold(a.Host, b.Host) {
		return false
	}
	if a.RawQuery != b.RawQuery {
		return false
	}
	if a.Fragment != b.Fragment {
		return false
	}
	return a.User.String() == b.User.String()
}

// resourceIdentifiersEqual reports whether two OAuth protected resource
// identifiers refer to the same resource for the purposes of RFC 9728 §3.3
// equality checks. Scheme and host are compared case-insensitively per
// RFC 3986 §3.1 / §3.2.2, and a single trailing slash on either path is
// ignored because real-world OAuth deployments routinely emit the
// resource with or without it for the same URL; rejecting that variant
// would produce false positives on legitimate servers. Query, fragment,
// and userinfo components are significant. Unparseable inputs fall back
// to exact string equality.
func resourceIdentifiersEqual(a, b string) bool {
	ua, errA := url.Parse(a)
	ub, errB := url.Parse(b)
	if errA != nil || errB != nil {
		return a == b
	}
	if !resourceComponentsEqual(ua, ub) {
		return false
	}
	// Use EscapedPath rather than Path so percent-encoded reserved
	// characters stay distinct from their decoded forms (e.g. "a%2Fb"
	// must not compare equal to "a/b"), preserving RFC 3986 segment
	// semantics.
	return strings.TrimSuffix(ua.EscapedPath(), "/") == strings.TrimSuffix(ub.EscapedPath(), "/")
}

// resourceBindsToURL reports whether the resource identifier declared in a
// protected resource metadata document fetched from the RFC 9728 §3.3
// well-known path binds to the addressed URL (the client's base URL): the
// two must agree on scheme and host (case-insensitively) and on query,
// fragment, and userinfo, and the declared resource's path must equal or
// be a path-prefix of the addressed path at a segment boundary — "/a"
// binds "/a" and "/a/b" but not "/ab" — with a single trailing slash on
// either path ignored, as in resourceIdentifiersEqual.
//
// The prefix rule is deliberately looser than the exact equality required
// of a PRM URL advertised via WWW-Authenticate: the well-known URL is
// constructed from the base URL, so the document is bound to the
// resource's origin by construction, but real deployments commonly mount
// their MCP endpoint at a path (e.g. https://host/mcp) while declaring the
// bare origin (https://host) as their resource.
//
// Unparseable inputs fall back to exact string equality, as in
// resourceIdentifiersEqual.
func resourceBindsToURL(resource, addressed string) bool {
	ur, errR := url.Parse(resource)
	ub, errB := url.Parse(addressed)
	if errR != nil || errB != nil {
		return resource == addressed
	}
	if !resourceComponentsEqual(ur, ub) {
		return false
	}
	// Use EscapedPath rather than Path for the same RFC 3986 segment
	// semantics as resourceIdentifiersEqual.
	resourcePath := strings.TrimSuffix(ur.EscapedPath(), "/")
	addressedPath := strings.TrimSuffix(ub.EscapedPath(), "/")
	if resourcePath == addressedPath {
		return true
	}
	// Segment-aware prefix: the resource path must end on a segment
	// boundary of the addressed path, so "/a" must not bind "/ab". An
	// empty resource path (a bare origin) binds any path on that origin.
	return strings.HasPrefix(addressedPath, resourcePath+"/")
}

// fetchMetadataFromURL fetches and parses OAuth server metadata from a URL.
// Returns (nil, nil) when the server responds with a non-200 status so the
// caller can fall through to the next candidate URL. Network, decode, and
// validation failures are returned to the caller.
//
// This function performs HTTP I/O and must not be called while holding
// metadataMu (see #871).
func (h *OAuthHandler) fetchMetadataFromURL(ctx context.Context, metadataURL string) (*AuthServerMetadata, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, metadataURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create metadata request: %w", err)
	}

	req.Header.Set("Accept", "application/json")
	// Advertise the latest protocol version this client supports. Metadata
	// discovery happens before the MCP initialize handshake, so no negotiated
	// version is available yet; servers that don't recognise it can fall back
	// per the MCP spec.
	req.Header.Set("MCP-Protocol-Version", mcp.LATEST_PROTOCOL_VERSION)

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send metadata request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil
	}

	var metadata AuthServerMetadata
	dec := json.NewDecoder(newBoundedReader(resp.Body, maxOAuthBodyBytes))
	if err := dec.Decode(&metadata); err != nil {
		return nil, fmt.Errorf("failed to decode metadata response: %w", err)
	}

	if err := validateAuthServerMetadataURLs(&metadata); err != nil {
		return nil, fmt.Errorf("invalid authorization server metadata from %s: %w", metadataURL, err)
	}

	return &metadata, nil
}

// validateAuthServerMetadataURLs ensures every URL-bearing field in m uses an
// http or https scheme. This prevents a hostile authorization server from
// advertising values like "javascript:..." or "file:..." that could be
// reflected into a browser or the local file system by downstream consumers.
// Empty optional fields are permitted.
func validateAuthServerMetadataURLs(m *AuthServerMetadata) error {
	fields := []struct {
		name  string
		value string
	}{
		{"issuer", m.Issuer},
		{"authorization_endpoint", m.AuthorizationEndpoint},
		{"token_endpoint", m.TokenEndpoint},
		{"jwks_uri", m.JwksURI},
		{"registration_endpoint", m.RegistrationEndpoint},
		{"service_documentation", m.ServiceDocumentation},
		{"op_policy_uri", m.OpPolicyURI},
		{"op_tos_uri", m.OpTOSURI},
		{"revocation_endpoint", m.RevocationEndpoint},
		{"introspection_endpoint", m.IntrospectionEndpoint},
	}
	for _, f := range fields {
		if f.value == "" {
			continue
		}
		u, err := url.Parse(f.value)
		if err != nil {
			return fmt.Errorf("%s: %w", f.name, err)
		}
		scheme := strings.ToLower(u.Scheme)
		if scheme != "http" && scheme != "https" {
			return fmt.Errorf("%s has disallowed scheme %q", f.name, u.Scheme)
		}
		if u.Host == "" {
			return fmt.Errorf("%s is missing host", f.name)
		}
	}
	return nil
}

// authorizationServerMetadataURLs returns the ordered list of discovery URLs to
// try for a given issuer URL, following the MCP authorization spec. This
// implements RFC 8414 §3 path-insertion semantics (the well-known segment is
// inserted between the authority and the issuer path, not appended), plus
// OpenID Connect Discovery 1.0 fallbacks.
func authorizationServerMetadataURLs(issuerURL string) []string {
	u, err := url.Parse(issuerURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil
	}
	u.RawQuery = ""
	u.Fragment = ""

	originalPath := strings.Trim(u.Path, "/")

	var urls []string
	if originalPath == "" {
		u.Path = "/.well-known/oauth-authorization-server"
		urls = append(urls, u.String())
		u.Path = "/.well-known/openid-configuration"
		urls = append(urls, u.String())
		return urls
	}
	u.Path = "/.well-known/oauth-authorization-server/" + originalPath
	urls = append(urls, u.String())
	u.Path = "/.well-known/openid-configuration/" + originalPath
	urls = append(urls, u.String())
	u.Path = "/" + originalPath + "/.well-known/openid-configuration"
	urls = append(urls, u.String())
	return urls
}

// extractBaseURL extracts the base URL from the first request
func (h *OAuthHandler) extractBaseURL() (string, error) {
	// If we have a base URL from a previous request, use it
	if h.baseURL != "" {
		return h.baseURL, nil
	}

	// Otherwise, we need to infer it from the redirect URI
	if h.config.RedirectURI == "" {
		return "", fmt.Errorf("no base URL available and no redirect URI provided")
	}

	// Parse the redirect URI to extract the authority
	parsedURL, err := url.Parse(h.config.RedirectURI)
	if err != nil {
		return "", fmt.Errorf("failed to parse redirect URI: %w", err)
	}

	// Use the scheme and host from the redirect URI
	baseURL := fmt.Sprintf("%s://%s", parsedURL.Scheme, parsedURL.Host)
	return baseURL, nil
}

// GetServerMetadata is a public wrapper for getServerMetadata
func (h *OAuthHandler) GetServerMetadata(ctx context.Context) (*AuthServerMetadata, error) {
	return h.getServerMetadata(ctx)
}

// getDefaultEndpoints returns default OAuth endpoints based on the base URL
func (h *OAuthHandler) getDefaultEndpoints(baseURL string) (*AuthServerMetadata, error) {
	// Parse the base URL to extract the authority
	parsedURL, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse base URL: %w", err)
	}

	// Validate that the URL has a scheme and host
	if parsedURL.Scheme == "" || parsedURL.Host == "" {
		return nil, fmt.Errorf("invalid base URL: missing scheme or host in %q", baseURL)
	}
	authBaseURL := (&url.URL{Scheme: parsedURL.Scheme, Host: parsedURL.Host}).String()

	return &AuthServerMetadata{
		Issuer:                authBaseURL,
		AuthorizationEndpoint: authBaseURL + "/authorize",
		TokenEndpoint:         authBaseURL + "/token",
		RegistrationEndpoint:  authBaseURL + "/register",
		guessed:               true,
	}, nil
}

// RegisterClient performs dynamic client registration
func (h *OAuthHandler) RegisterClient(ctx context.Context, clientName string) error {
	metadata, err := h.getServerMetadata(ctx)
	if err != nil {
		return fmt.Errorf("failed to get server metadata: %w", err)
	}

	return h.registerClient(ctx, metadata, clientName, false)
}

func (h *OAuthHandler) performRegistration(ctx context.Context, metadata *AuthServerMetadata, clientName string, version uint64) error {
	if metadata.Issuer == "" {
		return errors.New("authorization server metadata missing issuer")
	}

	if metadata.RegistrationEndpoint == "" {
		return errors.New("server does not support dynamic client registration")
	}

	// Prepare registration request
	regRequest := map[string]any{
		"client_name":                clientName,
		"redirect_uris":              []string{h.config.RedirectURI},
		"application_type":           applicationType(h.config.RedirectURI),
		"token_endpoint_auth_method": "none", // For public clients
		"grant_types":                []string{"authorization_code", "refresh_token"},
		"response_types":             []string{"code"},
		"scope":                      strings.Join(h.config.Scopes, " "),
	}

	if h.config.ClientURI != "" {
		regRequest["client_uri"] = h.config.ClientURI
	}

	// Add client_secret if this is a confidential client
	if h.GetClientSecret() != "" {
		regRequest["token_endpoint_auth_method"] = "client_secret_post"
	}

	// RFC 8707: Include resource parameter in client registration
	if resourceURL := h.getResourceURL(); resourceURL != "" {
		regRequest["resource"] = resourceURL
	}

	reqBody, err := json.Marshal(regRequest)
	if err != nil {
		return fmt.Errorf("failed to marshal registration request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		metadata.RegistrationEndpoint,
		bytes.NewReader(reqBody),
	)
	if err != nil {
		return fmt.Errorf("failed to create registration request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send registration request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		body := readErrorBody(resp.Body)
		return extractOAuthError(body, resp.StatusCode, "registration request failed")
	}

	var regResponse struct {
		ClientID                string `json:"client_id"`
		ClientSecret            string `json:"client_secret,omitempty"`
		TokenEndpointAuthMethod string `json:"token_endpoint_auth_method,omitempty"`
	}

	if err := json.NewDecoder(newBoundedReader(resp.Body, maxOAuthBodyBytes)).Decode(&regResponse); err != nil {
		return fmt.Errorf("failed to decode registration response: %w", err)
	}

	if regResponse.ClientID == "" {
		return errors.New("registration response missing client_id")
	}
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	if h.credentialsVersion != version || !h.metadataCurrent(metadata) {
		return serverChanged()
	}
	h.config.ClientID = regResponse.ClientID
	h.config.ClientSecret = regResponse.ClientSecret
	h.config.CredentialsIssuer = metadata.Issuer
	h.registeredAuthMethod = regResponse.TokenEndpointAuthMethod
	h.credentialsDCR = true
	h.registrationName = clientName
	h.credentialsVersion++

	return nil
}

// ErrInvalidState is returned when the state parameter doesn't match the expected value
var ErrInvalidState = errors.New("invalid state parameter, possible CSRF attack")

// ErrIssuerMismatch is returned when the iss parameter of an authorization
// response doesn't identify the authorization server the client is using
// (RFC 9207).
var ErrIssuerMismatch = errors.New("authorization response issuer mismatch, possible mix-up attack")

// ErrPKCERequired is returned when PKCE is enabled but the code challenge or
// code verifier passed in is empty.
var ErrPKCERequired = errors.New("PKCE is enabled but the code challenge or verifier is empty")

// ProcessAuthorizationResponse processes the authorization response and exchanges the code for a token.
// It doesn't check the response's iss parameter; ProcessAuthorizationCallback does.
func (h *OAuthHandler) ProcessAuthorizationResponse(ctx context.Context, code, state, codeVerifier string) error {
	return h.processAuthorizationResponse(ctx, code, state, codeVerifier, nil)
}

// ProcessAuthorizationCallback processes the authorization response the
// authorization server redirected to the client's redirect URI with, given
// the redirect's query parameters, and exchanges the code for a token.
//
// Besides the state, it checks the iss parameter against the issuer in the
// authorization server's metadata, as RFC 9207 and the MCP authorization
// spec require, and it returns an error the authorization server sent in
// place of a code as an [OAuthError], but only once the response has passed
// those checks.
// The issuer and token exchange use the transaction saved by GetAuthorizationURL
// or restored by SetAuthorizationTransaction. Current discovery and credential
// binding may invalidate the flow, but cannot redirect its code exchange.
// SetExpectedState alone is insufficient for this method.
func (h *OAuthHandler) ProcessAuthorizationCallback(ctx context.Context, query url.Values, codeVerifier string) error {
	// RFC 6749 §3.1: response parameters must not be repeated. A second iss
	// or code could otherwise pass the checks while another one is used.
	for _, name := range []string{"code", "state", "iss", "error"} {
		if len(query[name]) > 1 {
			return fmt.Errorf("authorization response repeats the %s parameter", name)
		}
	}
	return h.processAuthorizationResponse(ctx, query.Get("code"), query.Get("state"), codeVerifier,
		func(metadata *AuthServerMetadata) error {
			if err := checkAuthorizationResponseIssuer(query, metadata); err != nil {
				return err
			}
			if code := query.Get("error"); code != "" {
				return fmt.Errorf("authorization request failed: %w", OAuthError{
					ErrorCode:        code,
					ErrorDescription: query.Get("error_description"),
					ErrorURI:         query.Get("error_uri"),
				})
			}
			if query.Get("code") == "" {
				return errors.New("authorization response has no code")
			}
			return nil
		})
}

// checkAuthorizationResponseIssuer applies RFC 9207 §2.4 to the query
// parameters of an authorization response: an iss parameter must be
// identical to the issuer in the authorization server's metadata, and a
// server that advertises the parameter must send it. The comparison is
// exact; normalizing either value could let a look-alike issuer through.
// An empty iss counts as absent (RFC 6749 §3.1). Without metadata from the
// server there is no issuer to compare against, so nothing is checked.
func checkAuthorizationResponseIssuer(query url.Values, metadata *AuthServerMetadata) error {
	if metadata.guessed {
		return nil
	}
	iss := query.Get("iss")
	if iss == "" {
		if metadata.AuthorizationResponseIssParameterSupported {
			return fmt.Errorf("%w: the authorization server sends iss, but the response has none", ErrIssuerMismatch)
		}
		return nil
	}
	if iss != metadata.Issuer {
		return fmt.Errorf("%w: got %q, expected %q", ErrIssuerMismatch, iss, metadata.Issuer)
	}
	return nil
}

// processAuthorizationResponse implements ProcessAuthorizationResponse. When
// checkResponse isn't nil, it vets the response against the authorization
// server's metadata after the state check and before the code is exchanged.
func (h *OAuthHandler) processAuthorizationResponse(ctx context.Context, code, state, codeVerifier string, checkResponse func(*AuthServerMetadata) error) error {
	// Validate the state parameter to prevent CSRF attacks
	h.mu.Lock()
	expectedState := h.expectedState
	flowIssuer := h.flowIssuer
	if expectedState == "" {
		h.mu.Unlock()
		return errors.New("no expected state found, authorization flow may not have been initiated properly")
	}

	if state != expectedState {
		h.mu.Unlock()
		return ErrInvalidState
	}

	transaction := h.authorizationTransaction
	// Consume the state and its transaction together before processing the response.
	h.expectedState = ""
	h.authorizationTransaction = nil
	h.mu.Unlock()

	if transaction == nil && checkResponse != nil {
		return errors.New("no authorization transaction found; restore it with SetAuthorizationTransaction")
	}
	if checkResponse != nil {
		if err := checkResponse(&transaction.metadata); err != nil {
			return err
		}
	}

	// Discovery may invalidate a pending transaction, but must never change
	// the issuer, endpoint or credentials used for its code exchange.
	metadata, err := h.getServerMetadata(ctx)
	if err != nil {
		return fmt.Errorf("failed to get server metadata: %w", err)
	}
	if flowIssuer != "" && flowIssuer != metadata.Issuer {
		return serverChanged()
	}
	if transaction != nil && transaction.metadata.Issuer != metadata.Issuer {
		return serverChanged()
	}
	credentials, err := h.boundCredentials(metadata)
	if err != nil {
		return err
	}
	if transaction == nil {
		// Preserve state-only reconstruction for the legacy response API.
		transaction = &AuthorizationTransaction{
			metadata: *metadata, resourceURL: h.getResourceURL(),
			clientID: credentials.id, clientSecret: credentials.secret,
			redirectURI: h.config.RedirectURI, pkceEnabled: h.config.PKCEEnabled,
			authMethod: h.tokenEndpointAuthMethod(metadata, credentials),
		}
	} else if transaction.clientID != credentials.id || transaction.clientSecret != credentials.secret {
		return serverChanged()
	}
	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", transaction.redirectURI)

	if transaction.pkceEnabled {
		if codeVerifier == "" {
			return ErrPKCERequired
		}
		data.Set("code_verifier", codeVerifier)
	}

	// RFC 8707: Include resource parameter in token exchange
	if resourceURL := transaction.resourceURL; resourceURL != "" {
		data.Set("resource", resourceURL)
	}

	req, err := newTokenRequest(ctx, transaction.metadata.TokenEndpoint, data,
		transaction.clientID, transaction.clientSecret, transaction.authMethod)
	if err != nil {
		return fmt.Errorf("failed to create token request: %w", err)
	}

	resp, err := h.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send token request: %w", err)
	}
	defer resp.Body.Close()

	// Accept any 2xx status; some authorization servers (e.g. Supabase) return
	// 201 Created for successful token responses.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body := readErrorBody(resp.Body)
		return extractOAuthError(body, resp.StatusCode, "token request failed")
	}

	// Read the response body for parsing
	body, err := io.ReadAll(newBoundedReader(resp.Body, maxOAuthBodyBytes))
	if err != nil {
		return fmt.Errorf("failed to read token response body: %w", err)
	}

	// GitHub returns HTTP 200 even for errors, with error details in the JSON body
	// Check if the response contains an error field before parsing as Token
	var oauthErr OAuthError
	if err := json.Unmarshal(body, &oauthErr); err == nil && oauthErr.ErrorCode != "" {
		return fmt.Errorf("token request failed: %w", oauthErr)
	}

	var tokenResp Token
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return fmt.Errorf("failed to decode token response: %w", err)
	}

	// Set expiration time
	if tokenResp.ExpiresIn > 0 {
		tokenResp.ExpiresAt = time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second)
	}

	// Save the token
	if err := h.saveBoundToken(ctx, metadata, credentials, &tokenResp); err != nil {
		return fmt.Errorf("failed to save token: %w", err)
	}

	return nil
}

// Client authentication methods at the token endpoint (RFC 6749 §2.3.1,
// RFC 7591 §2).
const (
	clientSecretBasic = "client_secret_basic"
	clientSecretPost  = "client_secret_post"
	clientAuthNone    = "none"
)

func isClientAuthMethod(method string) bool {
	return method == clientSecretBasic || method == clientSecretPost || method == clientAuthNone
}

// GetTokenEndpointAuthMethod returns the client authentication method set in
// OAuthConfig.TokenEndpointAuthMethod or, failing that, the one the
// authorization server returned from dynamic client registration. Save it
// along with the client ID and secret to reuse registered credentials.
func (h *OAuthHandler) GetTokenEndpointAuthMethod() string {
	h.credentialsMu.Lock()
	defer h.credentialsMu.Unlock()
	return h.authMethodLocked()
}

func (h *OAuthHandler) authMethodLocked() string {
	if isClientAuthMethod(h.config.TokenEndpointAuthMethod) {
		return h.config.TokenEndpointAuthMethod
	}
	if isClientAuthMethod(h.registeredAuthMethod) {
		return h.registeredAuthMethod
	}
	return ""
}

// tokenEndpointAuthMethod picks how the client authenticates at the token
// endpoint: the method configured or registered for it, or else HTTP Basic
// when that is the only one of the two secret-based methods the server's
// metadata lists. A server that says nothing keeps getting the secret in the
// request body, as before.
func (h *OAuthHandler) tokenEndpointAuthMethod(metadata *AuthServerMetadata, credentials credentialSnapshot) string {
	if credentials.secret == "" {
		return clientAuthNone
	}
	if method := credentials.method; method != "" {
		return method
	}
	supported := metadata.TokenEndpointAuthMethodsSupported
	if slices.Contains(supported, clientSecretBasic) && !slices.Contains(supported, clientSecretPost) {
		return clientSecretBasic
	}
	return clientSecretPost
}

// newTokenRequest builds a token endpoint request carrying data and the
// client's credentials.
func (h *OAuthHandler) newTokenRequest(ctx context.Context, metadata *AuthServerMetadata, credentials credentialSnapshot, data url.Values) (*http.Request, error) {
	return newTokenRequest(ctx, metadata.TokenEndpoint, data,
		credentials.id, credentials.secret, h.tokenEndpointAuthMethod(metadata, credentials))
}

func newTokenRequest(ctx context.Context, tokenEndpoint string, data url.Values, clientID, clientSecret, method string) (*http.Request, error) {
	basic := method == clientSecretBasic
	if !basic {
		data.Set("client_id", clientID)
		if method == clientSecretPost {
			data.Set("client_secret", clientSecret)
		}
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		tokenEndpoint,
		strings.NewReader(data.Encode()),
	)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	if basic {
		// RFC 6749 §2.3.1: the client ID and secret are form-encoded before
		// they are used as the Basic user name and password.
		req.SetBasicAuth(url.QueryEscape(clientID), url.QueryEscape(clientSecret))
	}
	return req, nil
}

// GetAuthorizationURL returns the URL for the authorization endpoint and saves
// an immutable transaction for callback validation and code exchange. A later
// issuer or credential change invalidates the flow rather than redirecting its code.
func (h *OAuthHandler) GetAuthorizationURL(ctx context.Context, state, codeChallenge string) (string, error) {
	if h.config.PKCEEnabled && codeChallenge == "" {
		return "", ErrPKCERequired
	}

	metadata, err := h.getServerMetadata(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get server metadata: %w", err)
	}

	credentials, err := h.authorizationCredentials(ctx, metadata)
	if err != nil {
		return "", err
	}
	// Follow the same lock order as discovery resets and token publication.
	h.credentialsMu.Lock()
	h.metadataMu.Lock()
	if h.credentialsVersion != credentials.version || h.serverMetadata != metadata {
		h.metadataMu.Unlock()
		h.credentialsMu.Unlock()
		return "", serverChanged()
	}
	transaction := AuthorizationTransaction{
		state: state,
		metadata: AuthServerMetadata{
			Issuer: metadata.Issuer, TokenEndpoint: metadata.TokenEndpoint,
			AuthorizationResponseIssParameterSupported: metadata.AuthorizationResponseIssParameterSupported,
			guessed: metadata.guessed,
		},
		resourceURL: h.resourceURL, clientID: credentials.id,
		clientSecret: credentials.secret, redirectURI: h.config.RedirectURI,
		pkceEnabled: h.config.PKCEEnabled, authMethod: h.tokenEndpointAuthMethod(metadata, credentials),
	}
	authorizationEndpoint := metadata.AuthorizationEndpoint
	h.metadataMu.Unlock()
	h.mu.Lock()
	h.expectedState = state
	h.flowIssuer = metadata.Issuer
	h.authorizationTransaction = &transaction
	h.mu.Unlock()
	h.credentialsMu.Unlock()

	params := url.Values{}
	params.Set("response_type", "code")
	params.Set("client_id", transaction.clientID)
	params.Set("redirect_uri", transaction.redirectURI)
	params.Set("state", state)

	if len(h.config.Scopes) > 0 {
		params.Set("scope", strings.Join(h.config.Scopes, " "))
	}

	if transaction.pkceEnabled {
		params.Set("code_challenge", codeChallenge)
		params.Set("code_challenge_method", "S256")
	}

	// RFC 8707: Include resource parameter in authorization URL
	if resourceURL := transaction.resourceURL; resourceURL != "" {
		params.Set("resource", resourceURL)
	}

	return authorizationEndpoint + "?" + params.Encode(), nil
}
