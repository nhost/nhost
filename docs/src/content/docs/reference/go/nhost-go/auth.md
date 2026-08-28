---
title: Auth
---

## Functions

### `GenerateCodeChallenge`

```go
func GenerateCodeChallenge(verifier string) string
```

GenerateCodeChallenge derives an S256 code challenge from a code verifier.

### `GenerateCodeVerifier`

```go
func GenerateCodeVerifier() string
```

GenerateCodeVerifier generates a cryptographically random PKCE code verifier
(43 base64url characters, per RFC 7636).

It panics if the system CSPRNG fails: a failed read would otherwise leave the
buffer zero-filled, yielding a fully predictable verifier and silently
defeating PKCE. A CSPRNG failure is unrecoverable, so panicking is correct.

## Types

### `AttestationFormat`

```go
type AttestationFormat string
```

AttestationFormat is one of: "packed", "tpm", "android-key", "android-safetynet", "fido-u2f", "apple", "none".

### `AuthenticationExtensionsClientOutputs`

```go
type AuthenticationExtensionsClientOutputs struct {
	Appid            *bool                       `json:"appid,omitempty"`
	CredProps        *CredentialPropertiesOutput `json:"credProps,omitempty"`
	HmacCreateSecret *bool                       `json:"hmacCreateSecret,omitempty"`
}
```

### `AuthenticatorAssertionResponse`

```go
type AuthenticatorAssertionResponse struct {
	ClientDataJSON    string  `json:"clientDataJSON"`
	AuthenticatorData string  `json:"authenticatorData"`
	Signature         string  `json:"signature"`
	UserHandle        *string `json:"userHandle,omitempty"`
}
```

### `AuthenticatorAttachment`

```go
type AuthenticatorAttachment string
```

AuthenticatorAttachment is one of: "platform", "cross-platform".

### `AuthenticatorAttestationResponse`

```go
type AuthenticatorAttestationResponse struct {
	ClientDataJSON     string    `json:"clientDataJSON"`
	Transports         *[]string `json:"transports,omitempty"`
	AuthenticatorData  *string   `json:"authenticatorData,omitempty"`
	PublicKey          *string   `json:"publicKey,omitempty"`
	PublicKeyAlgorithm *int      `json:"publicKeyAlgorithm,omitempty"`
	AttestationObject  string    `json:"attestationObject"`
}
```

### `AuthenticatorSelection`

```go
type AuthenticatorSelection struct {
	AuthenticatorAttachment *AuthenticatorAttachment     `json:"authenticatorAttachment,omitempty"`
	RequireResidentKey      *bool                        `json:"requireResidentKey,omitempty"`
	ResidentKey             *ResidentKeyRequirement      `json:"residentKey,omitempty"`
	UserVerification        *UserVerificationRequirement `json:"userVerification,omitempty"`
}
```

### `AuthenticatorTransport`

```go
type AuthenticatorTransport string
```

AuthenticatorTransport is one of: "usb", "nfc", "ble", "smart-card", "hybrid", "internal".

### `Client`

```go
type Client struct {
	BaseURL        string
	chainFunctions []fetch.ChainFunction
	httpClient     *http.Client
	fetch          fetch.FetchFunc
}
```

Client is a generated API client backed by an *http.Client and a middleware chain.

#### `NewClient`

```go
func NewClient(
	baseURL string,
	chainFunctions []fetch.ChainFunction,
	httpClient *http.Client,
) *Client
```

NewClient creates a new API client.

#### `AddSecurityKey`

```go
func (c *Client) AddSecurityKey(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[PublicKeyCredentialCreationOptions], error)
```

AddSecurityKey performs POST /user/webauthn/add.

#### `ChangeUserEmail`

```go
func (c *Client) ChangeUserEmail(
	ctx context.Context,
	body UserEmailChangeRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

ChangeUserEmail performs POST /user/email/change.

#### `ChangeUserMFA`

```go
func (c *Client) ChangeUserMFA(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[TOTPGenerateResponse], error)
```

ChangeUserMFA performs GET /mfa/totp/generate.

#### `ChangeUserPassword`

```go
func (c *Client) ChangeUserPassword(
	ctx context.Context,
	body UserPasswordRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

ChangeUserPassword performs POST /user/password.

#### `CreatePAT`

```go
func (c *Client) CreatePAT(
	ctx context.Context,
	body CreatePATRequest,
	headers http.Header,
) (*fetch.FetchResponse[CreatePATResponse], error)
```

CreatePAT performs POST /pat.

#### `DeanonymizeUser`

```go
func (c *Client) DeanonymizeUser(
	ctx context.Context,
	body UserDeanonymizeRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

DeanonymizeUser performs POST /user/deanonymize.

#### `ElevateWebAuthn`

```go
func (c *Client) ElevateWebAuthn(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[PublicKeyCredentialRequestOptions], error)
```

ElevateWebAuthn performs POST /elevate/webauthn.

#### `GetJwKs`

```go
func (c *Client) GetJwKs(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[JwkSet], error)
```

GetJwKs performs GET /.well-known/jwks.json.

#### `GetOAuthAuthorizationServer`

```go
func (c *Client) GetOAuthAuthorizationServer(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2DiscoveryResponse], error)
```

GetOAuthAuthorizationServer performs GET /.well-known/oauth-authorization-server.

#### `GetOpenIDConfiguration`

```go
func (c *Client) GetOpenIDConfiguration(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2DiscoveryResponse], error)
```

GetOpenIDConfiguration performs GET /.well-known/openid-configuration.

#### `GetProviderTokens`

```go
func (c *Client) GetProviderTokens(
	ctx context.Context,
	provider string,
	headers http.Header,
) (*fetch.FetchResponse[ProviderSession], error)
```

GetProviderTokens performs GET /signin/provider/%s/callback/tokens.

#### `GetUser`

```go
func (c *Client) GetUser(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[User], error)
```

GetUser performs GET /user.

#### `GetVersion`

```go
func (c *Client) GetVersion(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[GetVersionResponse200], error)
```

GetVersion performs GET /version.

#### `HealthCheckGet`

```go
func (c *Client) HealthCheckGet(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

HealthCheckGet performs GET /healthz.

#### `HealthCheckHead`

```go
func (c *Client) HealthCheckHead(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[json.RawMessage], error)
```

HealthCheckHead performs HEAD /healthz.

#### `LinkIDToken`

```go
func (c *Client) LinkIDToken(
	ctx context.Context,
	body LinkIDTokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

LinkIDToken performs POST /link/idtoken.

#### `Oauth2AuthorizePostURL`

```go
func (c *Client) Oauth2AuthorizePostURL() string
```

Oauth2AuthorizePostURL builds the URL for POST /oauth2/authorize without following the redirect.

#### `Oauth2AuthorizeURL`

```go
func (c *Client) Oauth2AuthorizeURL(params *Oauth2AuthorizeParams,
) string
```

Oauth2AuthorizeURL builds the URL for GET /oauth2/authorize without following the redirect.

#### `Oauth2Introspect`

```go
func (c *Client) Oauth2Introspect(
	ctx context.Context,
	body OAuth2IntrospectRequest,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2IntrospectResponse], error)
```

Oauth2Introspect performs POST /oauth2/introspect.

#### `Oauth2Jwks`

```go
func (c *Client) Oauth2Jwks(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2jwksResponse], error)
```

Oauth2Jwks performs GET /oauth2/jwks.

#### `Oauth2LoginGet`

```go
func (c *Client) Oauth2LoginGet(
	ctx context.Context,
	params *Oauth2LoginGetParams,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2LoginResponse], error)
```

Oauth2LoginGet performs GET /oauth2/login.

#### `Oauth2LoginPost`

```go
func (c *Client) Oauth2LoginPost(
	ctx context.Context,
	body OAuth2LoginRequest,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2LoginCompleteResponse], error)
```

Oauth2LoginPost performs POST /oauth2/login.

#### `Oauth2Revoke`

```go
func (c *Client) Oauth2Revoke(
	ctx context.Context,
	body OAuth2RevokeRequest,
	headers http.Header,
) (*fetch.FetchResponse[json.RawMessage], error)
```

Oauth2Revoke performs POST /oauth2/revoke.

#### `Oauth2Token`

```go
func (c *Client) Oauth2Token(
	ctx context.Context,
	body OAuth2TokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2TokenResponse], error)
```

Oauth2Token performs POST /oauth2/token.

#### `Oauth2UserinfoGet`

```go
func (c *Client) Oauth2UserinfoGet(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2UserinfoResponse], error)
```

Oauth2UserinfoGet performs GET /oauth2/userinfo.

#### `Oauth2UserinfoPost`

```go
func (c *Client) Oauth2UserinfoPost(
	ctx context.Context,
	headers http.Header,
) (*fetch.FetchResponse[OAuth2UserinfoResponse], error)
```

Oauth2UserinfoPost performs POST /oauth2/userinfo.

#### `PushChainFunction`

```go
func (c *Client) PushChainFunction(cf fetch.ChainFunction)
```

PushChainFunction appends a middleware chain function and rebuilds the pipeline.

#### `RefreshProviderToken`

```go
func (c *Client) RefreshProviderToken(
	ctx context.Context,
	provider string,
	body RefreshProviderTokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[ProviderSession], error)
```

RefreshProviderToken performs POST /token/provider/%s.

#### `RefreshToken`

```go
func (c *Client) RefreshToken(
	ctx context.Context,
	body RefreshTokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[Session], error)
```

RefreshToken performs POST /token.

#### `SendPasswordResetEmail`

```go
func (c *Client) SendPasswordResetEmail(
	ctx context.Context,
	body UserPasswordResetRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SendPasswordResetEmail performs POST /user/password/reset.

#### `SendVerificationEmail`

```go
func (c *Client) SendVerificationEmail(
	ctx context.Context,
	body UserEmailSendVerificationEmailRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SendVerificationEmail performs POST /user/email/send-verification-email.

#### `SignInAnonymous`

```go
func (c *Client) SignInAnonymous(
	ctx context.Context,
	body *SignInAnonymousRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

SignInAnonymous performs POST /signin/anonymous.

#### `SignInEmailPassword`

```go
func (c *Client) SignInEmailPassword(
	ctx context.Context,
	body SignInEmailPasswordRequest,
	headers http.Header,
) (*fetch.FetchResponse[SignInEmailPasswordResponse], error)
```

SignInEmailPassword performs POST /signin/email-password.

#### `SignInIDToken`

```go
func (c *Client) SignInIDToken(
	ctx context.Context,
	body SignInIDTokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

SignInIDToken performs POST /signin/idtoken.

#### `SignInOTPEmail`

```go
func (c *Client) SignInOTPEmail(
	ctx context.Context,
	body SignInOTPEmailRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignInOTPEmail performs POST /signin/otp/email.

#### `SignInPAT`

```go
func (c *Client) SignInPAT(
	ctx context.Context,
	body SignInPATRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

SignInPAT performs POST /signin/pat.

#### `SignInPasswordlessEmail`

```go
func (c *Client) SignInPasswordlessEmail(
	ctx context.Context,
	body SignInPasswordlessEmailRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignInPasswordlessEmail performs POST /signin/passwordless/email.

#### `SignInPasswordlessSMS`

```go
func (c *Client) SignInPasswordlessSMS(
	ctx context.Context,
	body SignInPasswordlessSMSRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignInPasswordlessSMS performs POST /signin/passwordless/sms.

#### `SignInProviderURL`

```go
func (c *Client) SignInProviderURL(provider string, params *SignInProviderParams,
) string
```

SignInProviderURL builds the URL for GET /signin/provider/%s without following the redirect.

#### `SignInWebAuthn`

```go
func (c *Client) SignInWebAuthn(
	ctx context.Context,
	body *SignInWebAuthnRequest,
	headers http.Header,
) (*fetch.FetchResponse[PublicKeyCredentialRequestOptions], error)
```

SignInWebAuthn performs POST /signin/webauthn.

#### `SignOut`

```go
func (c *Client) SignOut(
	ctx context.Context,
	body SignOutRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignOut performs POST /signout.

#### `SignUpEmailPassword`

```go
func (c *Client) SignUpEmailPassword(
	ctx context.Context,
	body SignUpEmailPasswordRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

SignUpEmailPassword performs POST /signup/email-password.

#### `SignUpIDToken`

```go
func (c *Client) SignUpIDToken(
	ctx context.Context,
	body SignUpIDTokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

SignUpIDToken performs POST /signup/idtoken.

#### `SignUpOTPEmail`

```go
func (c *Client) SignUpOTPEmail(
	ctx context.Context,
	body SignUpOTPEmailRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignUpOTPEmail performs POST /signup/otp/email.

#### `SignUpPasswordlessEmail`

```go
func (c *Client) SignUpPasswordlessEmail(
	ctx context.Context,
	body SignUpPasswordlessEmailRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignUpPasswordlessEmail performs POST /signup/passwordless/email.

#### `SignUpPasswordlessSMS`

```go
func (c *Client) SignUpPasswordlessSMS(
	ctx context.Context,
	body SignUpPasswordlessSMSRequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

SignUpPasswordlessSMS performs POST /signup/passwordless/sms.

#### `SignUpProviderURL`

```go
func (c *Client) SignUpProviderURL(provider string, params *SignUpProviderParams,
) string
```

SignUpProviderURL builds the URL for GET /signup/provider/%s without following the redirect.

#### `SignUpWebAuthn`

```go
func (c *Client) SignUpWebAuthn(
	ctx context.Context,
	body SignUpWebAuthnRequest,
	headers http.Header,
) (*fetch.FetchResponse[PublicKeyCredentialCreationOptions], error)
```

SignUpWebAuthn performs POST /signup/webauthn.

#### `TokenExchange`

```go
func (c *Client) TokenExchange(
	ctx context.Context,
	body TokenExchangeRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

TokenExchange performs POST /token/exchange.

#### `VerifyAddSecurityKey`

```go
func (c *Client) VerifyAddSecurityKey(
	ctx context.Context,
	body VerifyAddSecurityKeyRequest,
	headers http.Header,
) (*fetch.FetchResponse[VerifyAddSecurityKeyResponse], error)
```

VerifyAddSecurityKey performs POST /user/webauthn/verify.

#### `VerifyChangeUserMFA`

```go
func (c *Client) VerifyChangeUserMFA(
	ctx context.Context,
	body UserMFARequest,
	headers http.Header,
) (*fetch.FetchResponse[OKResponse], error)
```

VerifyChangeUserMFA performs POST /user/mfa.

#### `VerifyElevateWebAuthn`

```go
func (c *Client) VerifyElevateWebAuthn(
	ctx context.Context,
	body SignInWebAuthnVerifyRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

VerifyElevateWebAuthn performs POST /elevate/webauthn/verify.

#### `VerifySignInMFATOTP`

```go
func (c *Client) VerifySignInMFATOTP(
	ctx context.Context,
	body SignInMFATOTPRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

VerifySignInMFATOTP performs POST /signin/mfa/totp.

#### `VerifySignInOTPEmail`

```go
func (c *Client) VerifySignInOTPEmail(
	ctx context.Context,
	body SignInOTPEmailVerifyRequest,
	headers http.Header,
) (*fetch.FetchResponse[SignInOTPEmailVerifyResponse], error)
```

VerifySignInOTPEmail performs POST /signin/otp/email/verify.

#### `VerifySignInPasswordlessSMS`

```go
func (c *Client) VerifySignInPasswordlessSMS(
	ctx context.Context,
	body SignInPasswordlessSMSOTPRequest,
	headers http.Header,
) (*fetch.FetchResponse[SignInPasswordlessSMSOTPResponse], error)
```

VerifySignInPasswordlessSMS performs POST /signin/passwordless/sms/otp.

#### `VerifySignInWebAuthn`

```go
func (c *Client) VerifySignInWebAuthn(
	ctx context.Context,
	body SignInWebAuthnVerifyRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

VerifySignInWebAuthn performs POST /signin/webauthn/verify.

#### `VerifySignUpWebAuthn`

```go
func (c *Client) VerifySignUpWebAuthn(
	ctx context.Context,
	body SignUpWebAuthnVerifyRequest,
	headers http.Header,
) (*fetch.FetchResponse[SessionPayload], error)
```

VerifySignUpWebAuthn performs POST /signup/webauthn/verify.

#### `VerifyTicketURL`

```go
func (c *Client) VerifyTicketURL(params *VerifyTicketParams,
) string
```

VerifyTicketURL builds the URL for GET /verify without following the redirect.

#### `VerifyToken`

```go
func (c *Client) VerifyToken(
	ctx context.Context,
	body *VerifyTokenRequest,
	headers http.Header,
) (*fetch.FetchResponse[string], error)
```

VerifyToken performs POST /token/verify.

### `ConveyancePreference`

```go
type ConveyancePreference string
```

ConveyancePreference is one of: "none", "indirect", "direct", "enterprise".

### `CreatePATRequest`

```go
type CreatePATRequest struct {
	ExpiresAt string          `json:"expiresAt"`
	Metadata  *map[string]any `json:"metadata,omitempty"`
}
```

### `CreatePATResponse`

```go
type CreatePATResponse struct {
	ID                  string `json:"id"`
	PersonalAccessToken string `json:"personalAccessToken"`
}
```

### `CredentialAssertionResponse`

```go
type CredentialAssertionResponse struct {
	ID                      string                                 `json:"id"`
	Type                    string                                 `json:"type"`
	RawID                   string                                 `json:"rawId"`
	ClientExtensionResults  *AuthenticationExtensionsClientOutputs `json:"clientExtensionResults,omitempty"`
	AuthenticatorAttachment *string                                `json:"authenticatorAttachment,omitempty"`
	Response                AuthenticatorAssertionResponse         `json:"response"`
}
```

### `CredentialCreationResponse`

```go
type CredentialCreationResponse struct {
	ID                      string                                 `json:"id"`
	Type                    string                                 `json:"type"`
	RawID                   string                                 `json:"rawId"`
	ClientExtensionResults  *AuthenticationExtensionsClientOutputs `json:"clientExtensionResults,omitempty"`
	AuthenticatorAttachment *string                                `json:"authenticatorAttachment,omitempty"`
	Response                AuthenticatorAttestationResponse       `json:"response"`
}
```

### `CredentialParameter`

```go
type CredentialParameter struct {
	Type CredentialType `json:"type"`
	Alg  int            `json:"alg"`
}
```

### `CredentialPropertiesOutput`

```go
type CredentialPropertiesOutput struct {
	Rk *bool `json:"rk,omitempty"`
}
```

### `CredentialType`

```go
type CredentialType string
```

CredentialType is one of: "public-key".

### `ErrorResponse`

```go
type ErrorResponse struct {
	Status  int                `json:"status"`
	Message string             `json:"message"`
	Error   ErrorResponseError `json:"error"`
}
```

### `ErrorResponseError`

```go
type ErrorResponseError string
```

ErrorResponseError is one of: "default-role-must-be-in-allowed-roles", "disabled-endpoint", "disabled-user", "user-already-exists", "email-already-verified", "forbidden-anonymous", "internal-server-error", "invalid-email-password", "invalid-request", "locale-not-allowed", "password-too-short", "password-in-hibp-database", "redirectTo-not-allowed", "role-not-allowed", "signup-disabled", "unverified-user", "user-not-anonymous", "invalid-pat", "invalid-refresh-token", "invalid-ticket", "disabled-mfa-totp", "no-totp-secret", "invalid-totp", "mfa-type-not-found", "totp-already-active", "invalid-state", "oauth-token-echange-failed", "oauth-profile-fetch-failed", "oauth-provider-error", "invalid-otp", "otp-too-many-attempts", "cannot-send-sms", "provider-account-already-linked".

### `GetCodeChallengeMethod`

```go
type GetCodeChallengeMethod string
```

GetCodeChallengeMethod is one of: "S256".

### `GetVersionResponse200`

```go
type GetVersionResponse200 struct {
	Version string `json:"version"`
}
```

### `IDTokenProvider`

```go
type IDTokenProvider string
```

IDTokenProvider is one of: "apple", "google".

### `Jwk`

```go
type Jwk struct {
	Alg string `json:"alg"`
	E   string `json:"e"`
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	N   string `json:"n"`
	Use string `json:"use"`
}
```

### `JwkSet`

```go
type JwkSet struct {
	Keys []Jwk `json:"keys"`
}
```

### `LinkIDTokenRequest`

```go
type LinkIDTokenRequest struct {
	Provider IDTokenProvider `json:"provider"`
	IDToken  string          `json:"idToken"`
	Nonce    *string         `json:"nonce,omitempty"`
}
```

### `MFAChallengePayload`

```go
type MFAChallengePayload struct {
	Ticket string `json:"ticket"`
}
```

### `OAuth2DiscoveryResponse`

```go
type OAuth2DiscoveryResponse struct {
	Issuer                                     string    `json:"issuer"`
	AuthorizationEndpoint                      string    `json:"authorization_endpoint"`
	TokenEndpoint                              string    `json:"token_endpoint"`
	UserinfoEndpoint                           *string   `json:"userinfo_endpoint,omitempty"`
	JwksURI                                    string    `json:"jwks_uri"`
	RevocationEndpoint                         *string   `json:"revocation_endpoint,omitempty"`
	IntrospectionEndpoint                      *string   `json:"introspection_endpoint,omitempty"`
	ScopesSupported                            *[]string `json:"scopes_supported,omitempty"`
	ResponseTypesSupported                     []string  `json:"response_types_supported"`
	GrantTypesSupported                        *[]string `json:"grant_types_supported,omitempty"`
	SubjectTypesSupported                      *[]string `json:"subject_types_supported,omitempty"`
	IDTokenSigningAlgValuesSupported           *[]string `json:"id_token_signing_alg_values_supported,omitempty"`
	TokenEndpointAuthMethodsSupported          *[]string `json:"token_endpoint_auth_methods_supported,omitempty"`
	CodeChallengeMethodsSupported              *[]string `json:"code_challenge_methods_supported,omitempty"`
	ClaimsSupported                            *[]string `json:"claims_supported,omitempty"`
	RequestParameterSupported                  *bool     `json:"request_parameter_supported,omitempty"`
	AuthorizationResponseIssParameterSupported *bool     `json:"authorization_response_iss_parameter_supported,omitempty"`
	ClientIDMetadataDocumentSupported          *bool     `json:"client_id_metadata_document_supported,omitempty"`
}
```

### `OAuth2ErrorResponse`

```go
type OAuth2ErrorResponse struct {
	Error            string  `json:"error"`
	ErrorDescription *string `json:"error_description,omitempty"`
}
```

### `OAuth2IntrospectRequest`

```go
type OAuth2IntrospectRequest struct {
	Token         string                                `json:"token"`
	TokenTypeHint *OAuth2IntrospectRequestTokenTypeHint `json:"token_type_hint,omitempty"`
	ClientID      *string                               `json:"client_id,omitempty"`
	ClientSecret  *string                               `json:"client_secret,omitempty"`
}
```

### `OAuth2IntrospectRequestTokenTypeHint`

```go
type OAuth2IntrospectRequestTokenTypeHint string
```

OAuth2IntrospectRequestTokenTypeHint is one of: "access_token", "refresh_token".

### `OAuth2IntrospectResponse`

```go
type OAuth2IntrospectResponse struct {
	Active    bool    `json:"active"`
	Scope     *string `json:"scope,omitempty"`
	ClientID  *string `json:"client_id,omitempty"`
	Sub       *string `json:"sub,omitempty"`
	Exp       *int    `json:"exp,omitempty"`
	Iat       *int    `json:"iat,omitempty"`
	Iss       *string `json:"iss,omitempty"`
	TokenType *string `json:"token_type,omitempty"`
}
```

### `OAuth2LoginCompleteResponse`

```go
type OAuth2LoginCompleteResponse struct {
	RedirectURI string `json:"redirectUri"`
}
```

### `OAuth2LoginRequest`

```go
type OAuth2LoginRequest struct {
	RequestID string `json:"requestId"`
}
```

### `OAuth2LoginResponse`

```go
type OAuth2LoginResponse struct {
	RequestID   string   `json:"requestId"`
	ClientID    string   `json:"clientId"`
	Scopes      []string `json:"scopes"`
	RedirectURI string   `json:"redirectUri"`
}
```

### `OAuth2RevokeRequest`

```go
type OAuth2RevokeRequest struct {
	Token         string                            `json:"token"`
	TokenTypeHint *OAuth2RevokeRequestTokenTypeHint `json:"token_type_hint,omitempty"`
	ClientID      *string                           `json:"client_id,omitempty"`
	ClientSecret  *string                           `json:"client_secret,omitempty"`
}
```

### `OAuth2RevokeRequestTokenTypeHint`

```go
type OAuth2RevokeRequestTokenTypeHint string
```

OAuth2RevokeRequestTokenTypeHint is one of: "access_token", "refresh_token".

### `OAuth2TokenRequest`

```go
type OAuth2TokenRequest struct {
	GrantType    OAuth2TokenRequestGrantType `json:"grant_type"`
	Code         *string                     `json:"code,omitempty"`
	RedirectURI  *string                     `json:"redirect_uri,omitempty"`
	ClientID     *string                     `json:"client_id,omitempty"`
	ClientSecret *string                     `json:"client_secret,omitempty"`
	CodeVerifier *string                     `json:"code_verifier,omitempty"`
	RefreshToken *string                     `json:"refresh_token,omitempty"`
	Resource     *string                     `json:"resource,omitempty"`
}
```

### `OAuth2TokenRequestGrantType`

```go
type OAuth2TokenRequestGrantType string
```

OAuth2TokenRequestGrantType is one of: "authorization_code", "refresh_token".

### `OAuth2TokenResponse`

```go
type OAuth2TokenResponse struct {
	AccessToken  string  `json:"access_token"`
	TokenType    string  `json:"token_type"`
	ExpiresIn    int     `json:"expires_in"`
	RefreshToken *string `json:"refresh_token,omitempty"`
	IDToken      *string `json:"id_token,omitempty"`
	Scope        *string `json:"scope,omitempty"`
}
```

### `OAuth2UserinfoResponse`

```go
type OAuth2UserinfoResponse struct {
	Sub                 string  `json:"sub"`
	Name                *string `json:"name,omitempty"`
	Email               *string `json:"email,omitempty"`
	EmailVerified       *bool   `json:"email_verified,omitempty"`
	Picture             *string `json:"picture,omitempty"`
	Locale              *string `json:"locale,omitempty"`
	PhoneNumber         *string `json:"phone_number,omitempty"`
	PhoneNumberVerified *bool   `json:"phone_number_verified,omitempty"`
}
```

### `OAuth2jwksResponse`

```go
type OAuth2jwksResponse struct {
	Keys []Jwk `json:"keys"`
}
```

### `OKResponse`

```go
type OKResponse string
```

OKResponse is one of: "OK".

### `Oauth2AuthorizeParams`

```go
type Oauth2AuthorizeParams struct {
	ClientID            string                  `json:"client_id"`
	RedirectURI         string                  `json:"redirect_uri"`
	ResponseType        string                  `json:"response_type"`
	Scope               *string                 `json:"scope,omitempty"`
	State               *string                 `json:"state,omitempty"`
	Nonce               *string                 `json:"nonce,omitempty"`
	CodeChallenge       *string                 `json:"code_challenge,omitempty"`
	CodeChallengeMethod *GetCodeChallengeMethod `json:"code_challenge_method,omitempty"`
	Resource            *string                 `json:"resource,omitempty"`
	Prompt              *string                 `json:"prompt,omitempty"`
}
```

#### `toQuery`

```go
func (p *Oauth2AuthorizeParams) toQuery() url.Values
```

### `Oauth2AuthorizePostBody`

```go
type Oauth2AuthorizePostBody struct {
	ClientID            string  `json:"client_id"`
	RedirectURI         string  `json:"redirect_uri"`
	ResponseType        string  `json:"response_type"`
	Scope               *string `json:"scope,omitempty"`
	State               *string `json:"state,omitempty"`
	Nonce               *string `json:"nonce,omitempty"`
	CodeChallenge       *string `json:"code_challenge,omitempty"`
	CodeChallengeMethod *string `json:"code_challenge_method,omitempty"`
	Resource            *string `json:"resource,omitempty"`
	Prompt              *string `json:"prompt,omitempty"`
}
```

### `Oauth2LoginGetParams`

```go
type Oauth2LoginGetParams struct {
	RequestID string `json:"request_id"`
}
```

#### `toQuery`

```go
func (p *Oauth2LoginGetParams) toQuery() url.Values
```

### `OptionsRedirectTo`

```go
type OptionsRedirectTo struct {
	RedirectTo *string `json:"redirectTo,omitempty"`
}
```

### `PKCEPair`

```go
type PKCEPair struct {
	Verifier  string
	Challenge string
}
```

PKCEPair is a PKCE code verifier and its derived S256 challenge.

#### `GeneratePKCEPair`

```go
func GeneratePKCEPair() PKCEPair
```

GeneratePKCEPair generates a PKCE code verifier and its S256 challenge.

### `ProviderSession`

```go
type ProviderSession struct {
	AccessToken  string  `json:"accessToken"`
	ExpiresIn    int     `json:"expiresIn"`
	ExpiresAt    string  `json:"expiresAt"`
	RefreshToken *string `json:"refreshToken,omitempty"`
}
```

### `ProviderSpecificParams`

```go
type ProviderSpecificParams struct {
	Connection   *string `json:"connection,omitempty"`
	Organization *string `json:"organization,omitempty"`
}
```

### `PublicKeyCredentialCreationOptions`

```go
type PublicKeyCredentialCreationOptions struct {
	Rp                     RelyingPartyEntity               `json:"rp"`
	User                   UserEntity                       `json:"user"`
	Challenge              string                           `json:"challenge"`
	PubKeyCredParams       []CredentialParameter            `json:"pubKeyCredParams"`
	Timeout                *int                             `json:"timeout,omitempty"`
	ExcludeCredentials     *[]PublicKeyCredentialDescriptor `json:"excludeCredentials,omitempty"`
	AuthenticatorSelection *AuthenticatorSelection          `json:"authenticatorSelection,omitempty"`
	Hints                  *[]PublicKeyCredentialHints      `json:"hints,omitempty"`
	Attestation            *ConveyancePreference            `json:"attestation,omitempty"`
	AttestationFormats     *[]AttestationFormat             `json:"attestationFormats,omitempty"`
	Extensions             *map[string]any                  `json:"extensions,omitempty"`
}
```

### `PublicKeyCredentialDescriptor`

```go
type PublicKeyCredentialDescriptor struct {
	Type       CredentialType            `json:"type"`
	ID         string                    `json:"id"`
	Transports *[]AuthenticatorTransport `json:"transports,omitempty"`
}
```

### `PublicKeyCredentialHints`

```go
type PublicKeyCredentialHints string
```

PublicKeyCredentialHints is one of: "security-key", "client-device", "hybrid".

### `PublicKeyCredentialRequestOptions`

```go
type PublicKeyCredentialRequestOptions struct {
	Challenge        string                           `json:"challenge"`
	Timeout          *int                             `json:"timeout,omitempty"`
	RpID             *string                          `json:"rpId,omitempty"`
	AllowCredentials *[]PublicKeyCredentialDescriptor `json:"allowCredentials,omitempty"`
	UserVerification *UserVerificationRequirement     `json:"userVerification,omitempty"`
	Hints            *[]PublicKeyCredentialHints      `json:"hints,omitempty"`
	Extensions       *map[string]any                  `json:"extensions,omitempty"`
}
```

### `RedirectToQuery`

```go
type RedirectToQuery = string
```

### `RefreshProviderTokenRequest`

```go
type RefreshProviderTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}
```

### `RefreshTokenRequest`

```go
type RefreshTokenRequest struct {
	RefreshToken string `json:"refreshToken"`
}
```

### `RelyingPartyEntity`

```go
type RelyingPartyEntity struct {
	Name string `json:"name"`
	ID   string `json:"id"`
}
```

### `ResidentKeyRequirement`

```go
type ResidentKeyRequirement string
```

ResidentKeyRequirement is one of: "discouraged", "preferred", "required".

### `Session`

```go
type Session struct {
	AccessToken          string `json:"accessToken"`
	AccessTokenExpiresIn int    `json:"accessTokenExpiresIn"`
	RefreshTokenID       string `json:"refreshTokenId"`
	RefreshToken         string `json:"refreshToken"`
	User                 *User  `json:"user,omitempty"`
}
```

### `SessionPayload`

```go
type SessionPayload struct {
	Session *Session `json:"session,omitempty"`
}
```

### `SignInAnonymousRequest`

```go
type SignInAnonymousRequest struct {
	DisplayName *string         `json:"displayName,omitempty"`
	Locale      *string         `json:"locale,omitempty"`
	Metadata    *map[string]any `json:"metadata,omitempty"`
}
```

### `SignInEmailPasswordRequest`

```go
type SignInEmailPasswordRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}
```

### `SignInEmailPasswordResponse`

```go
type SignInEmailPasswordResponse struct {
	Session *Session             `json:"session,omitempty"`
	MFA     *MFAChallengePayload `json:"mfa,omitempty"`
}
```

### `SignInIDTokenRequest`

```go
type SignInIDTokenRequest struct {
	Provider IDTokenProvider `json:"provider"`
	IDToken  string          `json:"idToken"`
	Nonce    *string         `json:"nonce,omitempty"`
	Options  *SignUpOptions  `json:"options,omitempty"`
}
```

### `SignInMFATOTPRequest`

```go
type SignInMFATOTPRequest struct {
	Ticket string `json:"ticket"`
	OTP    string `json:"otp"`
}
```

### `SignInOTPEmailRequest`

```go
type SignInOTPEmailRequest struct {
	Email   string         `json:"email"`
	Options *SignUpOptions `json:"options,omitempty"`
}
```

### `SignInOTPEmailVerifyRequest`

```go
type SignInOTPEmailVerifyRequest struct {
	OTP   string `json:"otp"`
	Email string `json:"email"`
}
```

### `SignInOTPEmailVerifyResponse`

```go
type SignInOTPEmailVerifyResponse struct {
	Session *Session `json:"session,omitempty"`
}
```

### `SignInPATRequest`

```go
type SignInPATRequest struct {
	PersonalAccessToken string `json:"personalAccessToken"`
}
```

### `SignInPasswordlessEmailRequest`

```go
type SignInPasswordlessEmailRequest struct {
	Email         string         `json:"email"`
	Options       *SignUpOptions `json:"options,omitempty"`
	CodeChallenge *string        `json:"codeChallenge,omitempty"`
}
```

### `SignInPasswordlessSMSOTPRequest`

```go
type SignInPasswordlessSMSOTPRequest struct {
	PhoneNumber string `json:"phoneNumber"`
	OTP         string `json:"otp"`
}
```

### `SignInPasswordlessSMSOTPResponse`

```go
type SignInPasswordlessSMSOTPResponse struct {
	Session *Session             `json:"session,omitempty"`
	MFA     *MFAChallengePayload `json:"mfa,omitempty"`
}
```

### `SignInPasswordlessSMSRequest`

```go
type SignInPasswordlessSMSRequest struct {
	PhoneNumber string         `json:"phoneNumber"`
	Options     *SignUpOptions `json:"options,omitempty"`
}
```

### `SignInProvider`

```go
type SignInProvider string
```

SignInProvider is one of: "apple", "github", "google", "linkedin", "discord", "spotify", "twitch", "gitlab", "bitbucket", "workos", "azuread", "entraid", "strava", "facebook", "windowslive", "twitter".

### `SignInProviderParams`

```go
type SignInProviderParams struct {
	AllowedRoles           *[]string               `json:"allowedRoles,omitempty"`
	DefaultRole            *string                 `json:"defaultRole,omitempty"`
	DisplayName            *string                 `json:"displayName,omitempty"`
	Locale                 *string                 `json:"locale,omitempty"`
	Metadata               *map[string]any         `json:"metadata,omitempty"`
	RedirectTo             *string                 `json:"redirectTo,omitempty"`
	Connect                *string                 `json:"connect,omitempty"`
	State                  *string                 `json:"state,omitempty"`
	ProviderSpecificParams *ProviderSpecificParams `json:"providerSpecificParams,omitempty"`
	CodeChallenge          *string                 `json:"codeChallenge,omitempty"`
}
```

#### `toQuery`

```go
func (p *SignInProviderParams) toQuery() url.Values
```

### `SignInWebAuthnRequest`

```go
type SignInWebAuthnRequest struct {
	Email *string `json:"email,omitempty"`
}
```

### `SignInWebAuthnVerifyRequest`

```go
type SignInWebAuthnVerifyRequest struct {
	Email      *string                     `json:"email,omitempty"`
	Credential CredentialAssertionResponse `json:"credential"`
}
```

### `SignOutRequest`

```go
type SignOutRequest struct {
	RefreshToken *string `json:"refreshToken,omitempty"`
	All          *bool   `json:"all,omitempty"`
}
```

### `SignUpEmailPasswordRequest`

```go
type SignUpEmailPasswordRequest struct {
	Email         string         `json:"email"`
	Password      string         `json:"password"`
	Options       *SignUpOptions `json:"options,omitempty"`
	CodeChallenge *string        `json:"codeChallenge,omitempty"`
}
```

### `SignUpIDTokenRequest`

```go
type SignUpIDTokenRequest struct {
	Provider IDTokenProvider `json:"provider"`
	IDToken  string          `json:"idToken"`
	Nonce    *string         `json:"nonce,omitempty"`
	Options  *SignUpOptions  `json:"options,omitempty"`
}
```

### `SignUpOTPEmailRequest`

```go
type SignUpOTPEmailRequest struct {
	Email   string         `json:"email"`
	Options *SignUpOptions `json:"options,omitempty"`
}
```

### `SignUpOptions`

```go
type SignUpOptions struct {
	AllowedRoles *[]string       `json:"allowedRoles,omitempty"`
	DefaultRole  *string         `json:"defaultRole,omitempty"`
	DisplayName  *string         `json:"displayName,omitempty"`
	Locale       *string         `json:"locale,omitempty"`
	Metadata     *map[string]any `json:"metadata,omitempty"`
	RedirectTo   *string         `json:"redirectTo,omitempty"`
}
```

### `SignUpPasswordlessEmailRequest`

```go
type SignUpPasswordlessEmailRequest struct {
	Email         string         `json:"email"`
	Options       *SignUpOptions `json:"options,omitempty"`
	CodeChallenge *string        `json:"codeChallenge,omitempty"`
}
```

### `SignUpPasswordlessSMSRequest`

```go
type SignUpPasswordlessSMSRequest struct {
	PhoneNumber string         `json:"phoneNumber"`
	Options     *SignUpOptions `json:"options,omitempty"`
}
```

### `SignUpProviderParams`

```go
type SignUpProviderParams struct {
	AllowedRoles           *[]string               `json:"allowedRoles,omitempty"`
	DefaultRole            *string                 `json:"defaultRole,omitempty"`
	DisplayName            *string                 `json:"displayName,omitempty"`
	Locale                 *string                 `json:"locale,omitempty"`
	Metadata               *map[string]any         `json:"metadata,omitempty"`
	RedirectTo             *string                 `json:"redirectTo,omitempty"`
	State                  *string                 `json:"state,omitempty"`
	ProviderSpecificParams *ProviderSpecificParams `json:"providerSpecificParams,omitempty"`
	CodeChallenge          *string                 `json:"codeChallenge,omitempty"`
}
```

#### `toQuery`

```go
func (p *SignUpProviderParams) toQuery() url.Values
```

### `SignUpWebAuthnRequest`

```go
type SignUpWebAuthnRequest struct {
	Email   string         `json:"email"`
	Options *SignUpOptions `json:"options,omitempty"`
}
```

### `SignUpWebAuthnVerifyRequest`

```go
type SignUpWebAuthnVerifyRequest struct {
	Credential    CredentialCreationResponse `json:"credential"`
	Options       *SignUpOptions             `json:"options,omitempty"`
	Nickname      *string                    `json:"nickname,omitempty"`
	CodeChallenge *string                    `json:"codeChallenge,omitempty"`
}
```

### `TOTPGenerateResponse`

```go
type TOTPGenerateResponse struct {
	ImageURL   string `json:"imageUrl"`
	TOTPSecret string `json:"totpSecret"`
}
```

### `TicketQuery`

```go
type TicketQuery = string
```

### `TicketTypeQuery`

```go
type TicketTypeQuery string
```

TicketTypeQuery is one of: "emailVerify", "emailConfirmChange", "signinPasswordless", "passwordReset".

### `TokenExchangeRequest`

```go
type TokenExchangeRequest struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"codeVerifier"`
}
```

### `URLEncodedBase64`

```go
type URLEncodedBase64 = string
```

### `User`

```go
type User struct {
	AvatarURL           string          `json:"avatarUrl"`
	CreatedAt           string          `json:"createdAt"`
	DefaultRole         string          `json:"defaultRole"`
	DisplayName         string          `json:"displayName"`
	Email               *string         `json:"email,omitempty"`
	EmailVerified       bool            `json:"emailVerified"`
	ID                  string          `json:"id"`
	IsAnonymous         bool            `json:"isAnonymous"`
	Locale              string          `json:"locale"`
	Metadata            *map[string]any `json:"metadata"`
	PhoneNumber         *string         `json:"phoneNumber,omitempty"`
	PhoneNumberVerified bool            `json:"phoneNumberVerified"`
	Roles               []string        `json:"roles"`
	ActiveMFAType       *string         `json:"activeMfaType,omitempty"`
}
```

### `UserDeanonymizeRequest`

```go
type UserDeanonymizeRequest struct {
	SignInMethod  UserDeanonymizeRequestSignInMethod `json:"signInMethod"`
	Email         string                             `json:"email"`
	Password      *string                            `json:"password,omitempty"`
	Connection    *string                            `json:"connection,omitempty"`
	Options       *SignUpOptions                     `json:"options,omitempty"`
	CodeChallenge *string                            `json:"codeChallenge,omitempty"`
}
```

### `UserDeanonymizeRequestSignInMethod`

```go
type UserDeanonymizeRequestSignInMethod string
```

UserDeanonymizeRequestSignInMethod is one of: "email-password", "passwordless".

### `UserEmailChangeRequest`

```go
type UserEmailChangeRequest struct {
	NewEmail      string             `json:"newEmail"`
	Options       *OptionsRedirectTo `json:"options,omitempty"`
	CodeChallenge *string            `json:"codeChallenge,omitempty"`
}
```

### `UserEmailSendVerificationEmailRequest`

```go
type UserEmailSendVerificationEmailRequest struct {
	Email         string             `json:"email"`
	Options       *OptionsRedirectTo `json:"options,omitempty"`
	CodeChallenge *string            `json:"codeChallenge,omitempty"`
}
```

### `UserEntity`

```go
type UserEntity struct {
	Name        string `json:"name"`
	DisplayName string `json:"displayName"`
	ID          string `json:"id"`
}
```

### `UserMFARequest`

```go
type UserMFARequest struct {
	Code          string                       `json:"code"`
	ActiveMFAType *UserMFARequestActiveMFAType `json:"activeMfaType,omitempty"`
}
```

### `UserMFARequestActiveMFAType`

```go
type UserMFARequestActiveMFAType string
```

UserMFARequestActiveMFAType is one of: "totp", "".

### `UserPasswordRequest`

```go
type UserPasswordRequest struct {
	NewPassword string  `json:"newPassword"`
	Ticket      *string `json:"ticket,omitempty"`
}
```

### `UserPasswordResetRequest`

```go
type UserPasswordResetRequest struct {
	Email         string             `json:"email"`
	Options       *OptionsRedirectTo `json:"options,omitempty"`
	CodeChallenge *string            `json:"codeChallenge,omitempty"`
}
```

### `UserVerificationRequirement`

```go
type UserVerificationRequirement string
```

UserVerificationRequirement is one of: "required", "preferred", "discouraged".

### `VerifyAddSecurityKeyRequest`

```go
type VerifyAddSecurityKeyRequest struct {
	Credential CredentialCreationResponse `json:"credential"`
	Nickname   *string                    `json:"nickname,omitempty"`
}
```

### `VerifyAddSecurityKeyResponse`

```go
type VerifyAddSecurityKeyResponse struct {
	ID       string  `json:"id"`
	Nickname *string `json:"nickname,omitempty"`
}
```

### `VerifyTicketParams`

```go
type VerifyTicketParams struct {
	Ticket        TicketQuery      `json:"ticket"`
	Type          *TicketTypeQuery `json:"type,omitempty"`
	RedirectTo    RedirectToQuery  `json:"redirectTo"`
	CodeChallenge *string          `json:"codeChallenge,omitempty"`
}
```

#### `toQuery`

```go
func (p *VerifyTicketParams) toQuery() url.Values
```

### `VerifyTokenRequest`

```go
type VerifyTokenRequest struct {
	Token *string `json:"token,omitempty"`
}
```

