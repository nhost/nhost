---
title: Auth
---

Nhost Auth: generated REST client and models plus hand-written PKCE helpers.

## Functions

### `generate_code_challenge`

```rust
fn generate_code_challenge(verifier: &str) -> String
```

Derives an S256 code challenge from a code verifier.

### `generate_code_verifier`

```rust
fn generate_code_verifier() -> String
```

Generates a cryptographically random PKCE code verifier (43 base64url
characters, per RFC 7636).

### `generate_pkce_pair`

```rust
fn generate_pkce_pair() -> PkcePair
```

Generates a PKCE code verifier and its S256 challenge.

## Structs

### `AuthenticationExtensionsClientOutputs`

```rust
struct AuthenticationExtensionsClientOutputs
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `appid` | `Option<bool>` |  |
| `cred_props` | `Option<CredentialPropertiesOutput>` |  |
| `hmac_create_secret` | `Option<bool>` |  |

### `AuthenticatorAssertionResponse`

```rust
struct AuthenticatorAssertionResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_data_json` | `String` |  |
| `authenticator_data` | `String` |  |
| `signature` | `String` |  |
| `user_handle` | `Option<String>` |  |

### `AuthenticatorAttestationResponse`

```rust
struct AuthenticatorAttestationResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_data_json` | `String` |  |
| `transports` | `Option<Vec<String>>` |  |
| `authenticator_data` | `Option<String>` |  |
| `public_key` | `Option<String>` |  |
| `public_key_algorithm` | `Option<i64>` |  |
| `attestation_object` | `String` |  |

### `AuthenticatorSelection`

```rust
struct AuthenticatorSelection
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `authenticator_attachment` | `Option<AuthenticatorAttachment>` |  |
| `require_resident_key` | `Option<bool>` |  |
| `resident_key` | `Option<ResidentKeyRequirement>` |  |
| `user_verification` | `Option<UserVerificationRequirement>` |  |

### `Client`

```rust
struct Client
```

Generated API client backed by a reqwest::Client and a middleware chain.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `base_url` | `String` |  |

#### Methods

##### `new`

```rust
fn new(base_url: String, chain_functions: Vec<ChainFunction>, reqwest: Client) -> Self
```

Creates a new API client.

##### `push_chain_function`

```rust
fn push_chain_function(&mut self, cf: ChainFunction)
```

Appends a middleware chain function and rebuilds the pipeline.

##### `get_jw_ks`

```rust
async fn get_jw_ks(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<JwkSet>, Error>
```

Performs GET /.well-known/jwks.json.

##### `elevate_webauthn`

```rust
async fn elevate_webauthn(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<PublicKeyCredentialRequestOptions>, Error>
```

Performs POST /elevate/webauthn.

##### `verify_elevate_webauthn`

```rust
async fn verify_elevate_webauthn(&self, body: SignInWebauthnVerifyRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /elevate/webauthn/verify.

##### `health_check_get`

```rust
async fn health_check_get(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs GET /healthz.

##### `health_check_head`

```rust
async fn health_check_head(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<Value>, Error>
```

Performs HEAD /healthz.

##### `link_id_token`

```rust
async fn link_id_token(&self, body: LinkIdTokenRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /link/idtoken.

##### `change_user_mfa`

```rust
async fn change_user_mfa(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<TotpGenerateResponse>, Error>
```

Performs GET /mfa/totp/generate.

##### `create_pat`

```rust
async fn create_pat(&self, body: CreatePatRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<CreatePatResponse>, Error>
```

Performs POST /pat.

##### `sign_in_anonymous`

```rust
async fn sign_in_anonymous(&self, body: Option<SignInAnonymousRequest>, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signin/anonymous.

##### `sign_in_email_password`

```rust
async fn sign_in_email_password(&self, body: SignInEmailPasswordRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SignInEmailPasswordResponse>, Error>
```

Performs POST /signin/email-password.

##### `sign_in_id_token`

```rust
async fn sign_in_id_token(&self, body: SignInIdTokenRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signin/idtoken.

##### `verify_sign_in_mfa_totp`

```rust
async fn verify_sign_in_mfa_totp(&self, body: SignInMfaTotpRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signin/mfa/totp.

##### `sign_in_otp_email`

```rust
async fn sign_in_otp_email(&self, body: SignInOtpEmailRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signin/otp/email.

##### `verify_sign_in_otp_email`

```rust
async fn verify_sign_in_otp_email(&self, body: SignInOtpEmailVerifyRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SignInOtpEmailVerifyResponse>, Error>
```

Performs POST /signin/otp/email/verify.

##### `sign_in_passwordless_email`

```rust
async fn sign_in_passwordless_email(&self, body: SignInPasswordlessEmailRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signin/passwordless/email.

##### `sign_in_passwordless_sms`

```rust
async fn sign_in_passwordless_sms(&self, body: SignInPasswordlessSmsRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signin/passwordless/sms.

##### `verify_sign_in_passwordless_sms`

```rust
async fn verify_sign_in_passwordless_sms(&self, body: SignInPasswordlessSmsOtpRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SignInPasswordlessSmsOtpResponse>, Error>
```

Performs POST /signin/passwordless/sms/otp.

##### `sign_in_pat`

```rust
async fn sign_in_pat(&self, body: SignInPatRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signin/pat.

##### `sign_in_provider_url`

```rust
fn sign_in_provider_url(&self, provider: &str, params: Option<&SignInProviderParams>) -> String
```

Builds the URL for GET /signin/provider/{provider} without following the redirect.

##### `get_provider_tokens`

```rust
async fn get_provider_tokens(&self, provider: &str, headers: Option<HeaderMap>) -> Result<FetchResponse<ProviderSession>, Error>
```

Performs GET /signin/provider/{provider}/callback/tokens.

##### `sign_in_webauthn`

```rust
async fn sign_in_webauthn(&self, body: Option<SignInWebauthnRequest>, headers: Option<HeaderMap>) -> Result<FetchResponse<PublicKeyCredentialRequestOptions>, Error>
```

Performs POST /signin/webauthn.

##### `verify_sign_in_webauthn`

```rust
async fn verify_sign_in_webauthn(&self, body: SignInWebauthnVerifyRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signin/webauthn/verify.

##### `sign_out`

```rust
async fn sign_out(&self, body: SignOutRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signout.

##### `sign_up_email_password`

```rust
async fn sign_up_email_password(&self, body: SignUpEmailPasswordRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signup/email-password.

##### `sign_up_webauthn`

```rust
async fn sign_up_webauthn(&self, body: SignUpWebauthnRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<PublicKeyCredentialCreationOptions>, Error>
```

Performs POST /signup/webauthn.

##### `verify_sign_up_webauthn`

```rust
async fn verify_sign_up_webauthn(&self, body: SignUpWebauthnVerifyRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signup/webauthn/verify.

##### `sign_up_passwordless_email`

```rust
async fn sign_up_passwordless_email(&self, body: SignUpPasswordlessEmailRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signup/passwordless/email.

##### `sign_up_otp_email`

```rust
async fn sign_up_otp_email(&self, body: SignUpOtpEmailRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signup/otp/email.

##### `sign_up_passwordless_sms`

```rust
async fn sign_up_passwordless_sms(&self, body: SignUpPasswordlessSmsRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /signup/passwordless/sms.

##### `sign_up_id_token`

```rust
async fn sign_up_id_token(&self, body: SignUpIdTokenRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /signup/idtoken.

##### `sign_up_provider_url`

```rust
fn sign_up_provider_url(&self, provider: &str, params: Option<&SignUpProviderParams>) -> String
```

Builds the URL for GET /signup/provider/{provider} without following the redirect.

##### `refresh_token`

```rust
async fn refresh_token(&self, body: RefreshTokenRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<Session>, Error>
```

Performs POST /token.

##### `refresh_provider_token`

```rust
async fn refresh_provider_token(&self, provider: &str, body: RefreshProviderTokenRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<ProviderSession>, Error>
```

Performs POST /token/provider/{provider}.

##### `verify_token`

```rust
async fn verify_token(&self, body: Option<VerifyTokenRequest>, headers: Option<HeaderMap>) -> Result<FetchResponse<String>, Error>
```

Performs POST /token/verify.

##### `get_user`

```rust
async fn get_user(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<User>, Error>
```

Performs GET /user.

##### `deanonymize_user`

```rust
async fn deanonymize_user(&self, body: UserDeanonymizeRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /user/deanonymize.

##### `change_user_email`

```rust
async fn change_user_email(&self, body: UserEmailChangeRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /user/email/change.

##### `send_verification_email`

```rust
async fn send_verification_email(&self, body: UserEmailSendVerificationEmailRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /user/email/send-verification-email.

##### `verify_change_user_mfa`

```rust
async fn verify_change_user_mfa(&self, body: UserMfaRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /user/mfa.

##### `change_user_password`

```rust
async fn change_user_password(&self, body: UserPasswordRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /user/password.

##### `send_password_reset_email`

```rust
async fn send_password_reset_email(&self, body: UserPasswordResetRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OkResponse>, Error>
```

Performs POST /user/password/reset.

##### `add_security_key`

```rust
async fn add_security_key(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<PublicKeyCredentialCreationOptions>, Error>
```

Performs POST /user/webauthn/add.

##### `verify_add_security_key`

```rust
async fn verify_add_security_key(&self, body: VerifyAddSecurityKeyRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<VerifyAddSecurityKeyResponse>, Error>
```

Performs POST /user/webauthn/verify.

##### `token_exchange`

```rust
async fn token_exchange(&self, body: TokenExchangeRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<SessionPayload>, Error>
```

Performs POST /token/exchange.

##### `verify_ticket_url`

```rust
fn verify_ticket_url(&self, params: Option<&VerifyTicketParams>) -> String
```

Builds the URL for GET /verify without following the redirect.

##### `get_version`

```rust
async fn get_version(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<GetVersionResponse200>, Error>
```

Performs GET /version.

##### `get_open_id_configuration`

```rust
async fn get_open_id_configuration(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2DiscoveryResponse>, Error>
```

Performs GET /.well-known/openid-configuration.

##### `get_o_auth_authorization_server`

```rust
async fn get_o_auth_authorization_server(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2DiscoveryResponse>, Error>
```

Performs GET /.well-known/oauth-authorization-server.

##### `oauth2_authorize_url`

```rust
fn oauth2_authorize_url(&self, params: Option<&Oauth2AuthorizeParams>) -> String
```

Builds the URL for GET /oauth2/authorize without following the redirect.

##### `oauth2_authorize_post_url`

```rust
fn oauth2_authorize_post_url(&self) -> String
```

Builds the URL for POST /oauth2/authorize without following the redirect.

##### `oauth2_token`

```rust
async fn oauth2_token(&self, body: OAuth2TokenRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2TokenResponse>, Error>
```

Performs POST /oauth2/token.

##### `oauth2_userinfo_get`

```rust
async fn oauth2_userinfo_get(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2UserinfoResponse>, Error>
```

Performs GET /oauth2/userinfo.

##### `oauth2_userinfo_post`

```rust
async fn oauth2_userinfo_post(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2UserinfoResponse>, Error>
```

Performs POST /oauth2/userinfo.

##### `oauth2_jwks`

```rust
async fn oauth2_jwks(&self, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2jwksResponse>, Error>
```

Performs GET /oauth2/jwks.

##### `oauth2_revoke`

```rust
async fn oauth2_revoke(&self, body: OAuth2RevokeRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<Value>, Error>
```

Performs POST /oauth2/revoke.

##### `oauth2_introspect`

```rust
async fn oauth2_introspect(&self, body: OAuth2IntrospectRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2IntrospectResponse>, Error>
```

Performs POST /oauth2/introspect.

##### `oauth2_login_get`

```rust
async fn oauth2_login_get(&self, params: Option<Oauth2LoginGetParams>, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2LoginResponse>, Error>
```

Performs GET /oauth2/login.

##### `oauth2_login_post`

```rust
async fn oauth2_login_post(&self, body: OAuth2LoginRequest, headers: Option<HeaderMap>) -> Result<FetchResponse<OAuth2LoginCompleteResponse>, Error>
```

Performs POST /oauth2/login.

### `CreatePatRequest`

```rust
struct CreatePatRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `expires_at` | `String` |  |
| `metadata` | `Option<Value>` |  |

### `CreatePatResponse`

```rust
struct CreatePatResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `personal_access_token` | `String` |  |

### `CredentialAssertionResponse`

```rust
struct CredentialAssertionResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `type_` | `String` |  |
| `raw_id` | `String` |  |
| `client_extension_results` | `Option<AuthenticationExtensionsClientOutputs>` |  |
| `authenticator_attachment` | `Option<String>` |  |
| `response` | `AuthenticatorAssertionResponse` |  |

### `CredentialCreationResponse`

```rust
struct CredentialCreationResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `type_` | `String` |  |
| `raw_id` | `String` |  |
| `client_extension_results` | `Option<AuthenticationExtensionsClientOutputs>` |  |
| `authenticator_attachment` | `Option<String>` |  |
| `response` | `AuthenticatorAttestationResponse` |  |

### `CredentialParameter`

```rust
struct CredentialParameter
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `type_` | `CredentialType` |  |
| `alg` | `i64` |  |

### `CredentialPropertiesOutput`

```rust
struct CredentialPropertiesOutput
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `rk` | `Option<bool>` |  |

### `ErrorResponse`

```rust
struct ErrorResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `status` | `i64` |  |
| `message` | `String` |  |
| `error` | `ErrorResponseError` |  |

### `GetVersionResponse200`

```rust
struct GetVersionResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `version` | `String` |  |

### `Jwk`

```rust
struct Jwk
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `alg` | `String` |  |
| `e` | `String` |  |
| `kid` | `String` |  |
| `kty` | `String` |  |
| `n` | `String` |  |
| `use_` | `String` |  |

### `JwkSet`

```rust
struct JwkSet
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `keys` | `Vec<Jwk>` |  |

### `LinkIdTokenRequest`

```rust
struct LinkIdTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `IdTokenProvider` |  |
| `id_token` | `String` |  |
| `nonce` | `Option<String>` |  |

### `MfaChallengePayload`

```rust
struct MfaChallengePayload
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket` | `String` |  |

### `Oauth2AuthorizeParams`

```rust
struct Oauth2AuthorizeParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_id` | `String` |  |
| `redirect_uri` | `String` |  |
| `response_type` | `String` |  |
| `scope` | `Option<String>` |  |
| `state` | `Option<String>` |  |
| `nonce` | `Option<String>` |  |
| `code_challenge` | `Option<String>` |  |
| `code_challenge_method` | `Option<GetCodeChallengeMethod>` |  |
| `resource` | `Option<String>` |  |
| `prompt` | `Option<String>` |  |

#### Trait implementations

- `Default`

### `Oauth2AuthorizePostBody`

```rust
struct Oauth2AuthorizePostBody
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_id` | `String` |  |
| `redirect_uri` | `String` |  |
| `response_type` | `String` |  |
| `scope` | `Option<String>` |  |
| `state` | `Option<String>` |  |
| `nonce` | `Option<String>` |  |
| `code_challenge` | `Option<String>` |  |
| `code_challenge_method` | `Option<String>` |  |
| `resource` | `Option<String>` |  |
| `prompt` | `Option<String>` |  |

### `OAuth2DiscoveryResponse`

```rust
struct OAuth2DiscoveryResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `issuer` | `String` |  |
| `authorization_endpoint` | `String` |  |
| `token_endpoint` | `String` |  |
| `userinfo_endpoint` | `Option<String>` |  |
| `jwks_uri` | `String` |  |
| `revocation_endpoint` | `Option<String>` |  |
| `introspection_endpoint` | `Option<String>` |  |
| `scopes_supported` | `Option<Vec<String>>` |  |
| `response_types_supported` | `Vec<String>` |  |
| `grant_types_supported` | `Option<Vec<String>>` |  |
| `subject_types_supported` | `Option<Vec<String>>` |  |
| `id_token_signing_alg_values_supported` | `Option<Vec<String>>` |  |
| `token_endpoint_auth_methods_supported` | `Option<Vec<String>>` |  |
| `code_challenge_methods_supported` | `Option<Vec<String>>` |  |
| `claims_supported` | `Option<Vec<String>>` |  |
| `request_parameter_supported` | `Option<bool>` |  |
| `authorization_response_iss_parameter_supported` | `Option<bool>` |  |
| `client_id_metadata_document_supported` | `Option<bool>` |  |

### `OAuth2ErrorResponse`

```rust
struct OAuth2ErrorResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `error` | `String` |  |
| `error_description` | `Option<String>` |  |

### `OAuth2IntrospectRequest`

```rust
struct OAuth2IntrospectRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `token` | `String` |  |
| `token_type_hint` | `Option<OAuth2IntrospectRequestTokenTypeHint>` |  |
| `client_id` | `Option<String>` |  |
| `client_secret` | `Option<String>` |  |

### `OAuth2IntrospectResponse`

```rust
struct OAuth2IntrospectResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `active` | `bool` |  |
| `scope` | `Option<String>` |  |
| `client_id` | `Option<String>` |  |
| `sub` | `Option<String>` |  |
| `exp` | `Option<i64>` |  |
| `iat` | `Option<i64>` |  |
| `iss` | `Option<String>` |  |
| `token_type` | `Option<String>` |  |

### `OAuth2jwksResponse`

```rust
struct OAuth2jwksResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `keys` | `Vec<Jwk>` |  |

### `OAuth2LoginCompleteResponse`

```rust
struct OAuth2LoginCompleteResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `redirect_uri` | `String` |  |

### `Oauth2LoginGetParams`

```rust
struct Oauth2LoginGetParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `request_id` | `String` |  |

#### Trait implementations

- `Default`

### `OAuth2LoginRequest`

```rust
struct OAuth2LoginRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `request_id` | `String` |  |

### `OAuth2LoginResponse`

```rust
struct OAuth2LoginResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `request_id` | `String` |  |
| `client_id` | `String` |  |
| `scopes` | `Vec<String>` |  |
| `redirect_uri` | `String` |  |

### `OAuth2RevokeRequest`

```rust
struct OAuth2RevokeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `token` | `String` |  |
| `token_type_hint` | `Option<OAuth2RevokeRequestTokenTypeHint>` |  |
| `client_id` | `Option<String>` |  |
| `client_secret` | `Option<String>` |  |

### `OAuth2TokenRequest`

```rust
struct OAuth2TokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `grant_type` | `OAuth2TokenRequestGrantType` |  |
| `code` | `Option<String>` |  |
| `redirect_uri` | `Option<String>` |  |
| `client_id` | `Option<String>` |  |
| `client_secret` | `Option<String>` |  |
| `code_verifier` | `Option<String>` |  |
| `refresh_token` | `Option<String>` |  |
| `resource` | `Option<String>` |  |

### `OAuth2TokenResponse`

```rust
struct OAuth2TokenResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | `String` |  |
| `token_type` | `String` |  |
| `expires_in` | `i64` |  |
| `refresh_token` | `Option<String>` |  |
| `id_token` | `Option<String>` |  |
| `scope` | `Option<String>` |  |

### `OAuth2UserinfoResponse`

```rust
struct OAuth2UserinfoResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `sub` | `String` |  |
| `name` | `Option<String>` |  |
| `email` | `Option<String>` |  |
| `email_verified` | `Option<bool>` |  |
| `picture` | `Option<String>` |  |
| `locale` | `Option<String>` |  |
| `phone_number` | `Option<String>` |  |
| `phone_number_verified` | `Option<bool>` |  |

### `OptionsRedirectTo`

```rust
struct OptionsRedirectTo
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `redirect_to` | `Option<String>` |  |

### `PkcePair`

```rust
struct PkcePair
```

A PKCE code verifier and its derived S256 challenge.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `verifier` | `String` |  |
| `challenge` | `String` |  |

### `ProviderSession`

```rust
struct ProviderSession
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | `String` |  |
| `expires_in` | `i64` |  |
| `expires_at` | `String` |  |
| `refresh_token` | `Option<String>` |  |

### `ProviderSpecificParams`

```rust
struct ProviderSpecificParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `connection` | `Option<String>` |  |
| `organization` | `Option<String>` |  |

### `PublicKeyCredentialCreationOptions`

```rust
struct PublicKeyCredentialCreationOptions
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `rp` | `RelyingPartyEntity` |  |
| `user` | `UserEntity` |  |
| `challenge` | `String` |  |
| `pub_key_cred_params` | `Vec<CredentialParameter>` |  |
| `timeout` | `Option<i64>` |  |
| `exclude_credentials` | `Option<Vec<PublicKeyCredentialDescriptor>>` |  |
| `authenticator_selection` | `Option<AuthenticatorSelection>` |  |
| `hints` | `Option<Vec<PublicKeyCredentialHints>>` |  |
| `attestation` | `Option<ConveyancePreference>` |  |
| `attestation_formats` | `Option<Vec<AttestationFormat>>` |  |
| `extensions` | `Option<Value>` |  |

### `PublicKeyCredentialDescriptor`

```rust
struct PublicKeyCredentialDescriptor
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `type_` | `CredentialType` |  |
| `id` | `String` |  |
| `transports` | `Option<Vec<AuthenticatorTransport>>` |  |

### `PublicKeyCredentialRequestOptions`

```rust
struct PublicKeyCredentialRequestOptions
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `challenge` | `String` |  |
| `timeout` | `Option<i64>` |  |
| `rp_id` | `Option<String>` |  |
| `allow_credentials` | `Option<Vec<PublicKeyCredentialDescriptor>>` |  |
| `user_verification` | `Option<UserVerificationRequirement>` |  |
| `hints` | `Option<Vec<PublicKeyCredentialHints>>` |  |
| `extensions` | `Option<Value>` |  |

### `RefreshProviderTokenRequest`

```rust
struct RefreshProviderTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `refresh_token` | `String` |  |

### `RefreshTokenRequest`

```rust
struct RefreshTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `refresh_token` | `String` |  |

### `RelyingPartyEntity`

```rust
struct RelyingPartyEntity
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `String` |  |
| `id` | `String` |  |

### `Session`

```rust
struct Session
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | `String` |  |
| `access_token_expires_in` | `i64` |  |
| `refresh_token_id` | `String` |  |
| `refresh_token` | `String` |  |
| `user` | `Option<User>` |  |

### `SessionPayload`

```rust
struct SessionPayload
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` |  |

### `SignInAnonymousRequest`

```rust
struct SignInAnonymousRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `display_name` | `Option<String>` |  |
| `locale` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |

### `SignInEmailPasswordRequest`

```rust
struct SignInEmailPasswordRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `password` | `String` |  |

### `SignInEmailPasswordResponse`

```rust
struct SignInEmailPasswordResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` |  |
| `mfa` | `Option<MfaChallengePayload>` |  |

### `SignInIdTokenRequest`

```rust
struct SignInIdTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `IdTokenProvider` |  |
| `id_token` | `String` |  |
| `nonce` | `Option<String>` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignInMfaTotpRequest`

```rust
struct SignInMfaTotpRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket` | `String` |  |
| `otp` | `String` |  |

### `SignInOtpEmailRequest`

```rust
struct SignInOtpEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignInOtpEmailVerifyRequest`

```rust
struct SignInOtpEmailVerifyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `otp` | `String` |  |
| `email` | `String` |  |

### `SignInOtpEmailVerifyResponse`

```rust
struct SignInOtpEmailVerifyResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` |  |

### `SignInPasswordlessEmailRequest`

```rust
struct SignInPasswordlessEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` |  |

### `SignInPasswordlessSmsOtpRequest`

```rust
struct SignInPasswordlessSmsOtpRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` |  |
| `otp` | `String` |  |

### `SignInPasswordlessSmsOtpResponse`

```rust
struct SignInPasswordlessSmsOtpResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` |  |
| `mfa` | `Option<MfaChallengePayload>` |  |

### `SignInPasswordlessSmsRequest`

```rust
struct SignInPasswordlessSmsRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignInPatRequest`

```rust
struct SignInPatRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `personal_access_token` | `String` |  |

### `SignInProviderParams`

```rust
struct SignInProviderParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `allowed_roles` | `Option<Vec<String>>` |  |
| `default_role` | `Option<String>` |  |
| `display_name` | `Option<String>` |  |
| `locale` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |
| `redirect_to` | `Option<String>` |  |
| `connect` | `Option<String>` |  |
| `state` | `Option<String>` |  |
| `provider_specific_params` | `Option<ProviderSpecificParams>` |  |
| `code_challenge` | `Option<String>` |  |

#### Trait implementations

- `Default`

### `SignInWebauthnRequest`

```rust
struct SignInWebauthnRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `Option<String>` |  |

### `SignInWebauthnVerifyRequest`

```rust
struct SignInWebauthnVerifyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `Option<String>` |  |
| `credential` | `CredentialAssertionResponse` |  |

### `SignOutRequest`

```rust
struct SignOutRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `refresh_token` | `Option<String>` |  |
| `all` | `Option<bool>` |  |

### `SignUpEmailPasswordRequest`

```rust
struct SignUpEmailPasswordRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `password` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` |  |

### `SignUpIdTokenRequest`

```rust
struct SignUpIdTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `IdTokenProvider` |  |
| `id_token` | `String` |  |
| `nonce` | `Option<String>` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignUpOptions`

```rust
struct SignUpOptions
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `allowed_roles` | `Option<Vec<String>>` |  |
| `default_role` | `Option<String>` |  |
| `display_name` | `Option<String>` |  |
| `locale` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |
| `redirect_to` | `Option<String>` |  |

### `SignUpOtpEmailRequest`

```rust
struct SignUpOtpEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignUpPasswordlessEmailRequest`

```rust
struct SignUpPasswordlessEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` |  |

### `SignUpPasswordlessSmsRequest`

```rust
struct SignUpPasswordlessSmsRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignUpProviderParams`

```rust
struct SignUpProviderParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `allowed_roles` | `Option<Vec<String>>` |  |
| `default_role` | `Option<String>` |  |
| `display_name` | `Option<String>` |  |
| `locale` | `Option<String>` |  |
| `metadata` | `Option<Value>` |  |
| `redirect_to` | `Option<String>` |  |
| `state` | `Option<String>` |  |
| `provider_specific_params` | `Option<ProviderSpecificParams>` |  |
| `code_challenge` | `Option<String>` |  |

#### Trait implementations

- `Default`

### `SignUpWebauthnRequest`

```rust
struct SignUpWebauthnRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<SignUpOptions>` |  |

### `SignUpWebauthnVerifyRequest`

```rust
struct SignUpWebauthnVerifyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `credential` | `CredentialCreationResponse` |  |
| `options` | `Option<SignUpOptions>` |  |
| `nickname` | `Option<String>` |  |
| `code_challenge` | `Option<String>` |  |

### `TokenExchangeRequest`

```rust
struct TokenExchangeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `code` | `String` |  |
| `code_verifier` | `String` |  |

### `TotpGenerateResponse`

```rust
struct TotpGenerateResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `image_url` | `String` |  |
| `totp_secret` | `String` |  |

### `User`

```rust
struct User
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `avatar_url` | `String` |  |
| `created_at` | `String` |  |
| `default_role` | `String` |  |
| `display_name` | `String` |  |
| `email` | `Option<String>` |  |
| `email_verified` | `bool` |  |
| `id` | `String` |  |
| `is_anonymous` | `bool` |  |
| `locale` | `String` |  |
| `metadata` | `Option<Value>` |  |
| `phone_number` | `Option<String>` |  |
| `phone_number_verified` | `bool` |  |
| `roles` | `Vec<String>` |  |
| `active_mfa_type` | `Option<String>` |  |

### `UserDeanonymizeRequest`

```rust
struct UserDeanonymizeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `sign_in_method` | `UserDeanonymizeRequestSignInMethod` |  |
| `email` | `String` |  |
| `password` | `Option<String>` |  |
| `connection` | `Option<String>` |  |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` |  |

### `UserEmailChangeRequest`

```rust
struct UserEmailChangeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `new_email` | `String` |  |
| `options` | `Option<OptionsRedirectTo>` |  |
| `code_challenge` | `Option<String>` |  |

### `UserEmailSendVerificationEmailRequest`

```rust
struct UserEmailSendVerificationEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<OptionsRedirectTo>` |  |
| `code_challenge` | `Option<String>` |  |

### `UserEntity`

```rust
struct UserEntity
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `String` |  |
| `display_name` | `String` |  |
| `id` | `String` |  |

### `UserMfaRequest`

```rust
struct UserMfaRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `code` | `String` |  |
| `active_mfa_type` | `Option<UserMfaRequestActiveMfaType>` |  |

### `UserPasswordRequest`

```rust
struct UserPasswordRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `new_password` | `String` |  |
| `ticket` | `Option<String>` |  |

### `UserPasswordResetRequest`

```rust
struct UserPasswordResetRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` |  |
| `options` | `Option<OptionsRedirectTo>` |  |
| `code_challenge` | `Option<String>` |  |

### `VerifyAddSecurityKeyRequest`

```rust
struct VerifyAddSecurityKeyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `credential` | `CredentialCreationResponse` |  |
| `nickname` | `Option<String>` |  |

### `VerifyAddSecurityKeyResponse`

```rust
struct VerifyAddSecurityKeyResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` |  |
| `nickname` | `Option<String>` |  |

### `VerifyTicketParams`

```rust
struct VerifyTicketParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket` | `TicketQuery` |  |
| `type_` | `Option<TicketTypeQuery>` |  |
| `redirect_to` | `RedirectToQuery` |  |
| `code_challenge` | `Option<String>` |  |

#### Trait implementations

- `Default`

### `VerifyTokenRequest`

```rust
struct VerifyTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `token` | `Option<String>` |  |

## Type Aliases

### `AttestationFormat`

```rust
type AttestationFormat = String
```

One of: "packed", "tpm", "android-key", "android-safetynet", "fido-u2f", "apple", "none".

### `AuthenticatorAttachment`

```rust
type AuthenticatorAttachment = String
```

One of: "platform", "cross-platform".

### `AuthenticatorTransport`

```rust
type AuthenticatorTransport = String
```

One of: "usb", "nfc", "ble", "smart-card", "hybrid", "internal".

### `ConveyancePreference`

```rust
type ConveyancePreference = String
```

One of: "none", "indirect", "direct", "enterprise".

### `CredentialType`

```rust
type CredentialType = String
```

One of: "public-key".

### `ErrorResponseError`

```rust
type ErrorResponseError = String
```

One of: "default-role-must-be-in-allowed-roles", "disabled-endpoint", "disabled-user", "user-already-exists", "email-already-verified", "forbidden-anonymous", "internal-server-error", "invalid-email-password", "invalid-request", "locale-not-allowed", "password-too-short", "password-in-hibp-database", "redirectTo-not-allowed", "role-not-allowed", "signup-disabled", "unverified-user", "user-not-anonymous", "invalid-pat", "invalid-refresh-token", "invalid-ticket", "disabled-mfa-totp", "no-totp-secret", "invalid-totp", "mfa-type-not-found", "totp-already-active", "invalid-state", "oauth-token-echange-failed", "oauth-profile-fetch-failed", "oauth-provider-error", "invalid-otp", "otp-too-many-attempts", "cannot-send-sms", "provider-account-already-linked".

### `GetCodeChallengeMethod`

```rust
type GetCodeChallengeMethod = String
```

One of: "S256".

### `IdTokenProvider`

```rust
type IdTokenProvider = String
```

One of: "apple", "google".

### `OAuth2IntrospectRequestTokenTypeHint`

```rust
type OAuth2IntrospectRequestTokenTypeHint = String
```

One of: "access_token", "refresh_token".

### `OAuth2RevokeRequestTokenTypeHint`

```rust
type OAuth2RevokeRequestTokenTypeHint = String
```

One of: "access_token", "refresh_token".

### `OAuth2TokenRequestGrantType`

```rust
type OAuth2TokenRequestGrantType = String
```

One of: "authorization_code", "refresh_token".

### `OkResponse`

```rust
type OkResponse = String
```

One of: "OK".

### `PublicKeyCredentialHints`

```rust
type PublicKeyCredentialHints = String
```

One of: "security-key", "client-device", "hybrid".

### `RedirectToQuery`

```rust
type RedirectToQuery = String
```

### `ResidentKeyRequirement`

```rust
type ResidentKeyRequirement = String
```

One of: "discouraged", "preferred", "required".

### `SignInProvider`

```rust
type SignInProvider = String
```

One of: "apple", "github", "google", "linkedin", "discord", "spotify", "twitch", "gitlab", "bitbucket", "workos", "azuread", "entraid", "strava", "facebook", "windowslive", "twitter".

### `TicketQuery`

```rust
type TicketQuery = String
```

### `TicketTypeQuery`

```rust
type TicketTypeQuery = String
```

One of: "emailVerify", "emailConfirmChange", "signinPasswordless", "passwordReset".

### `UrlEncodedBase64`

```rust
type UrlEncodedBase64 = String
```

### `UserDeanonymizeRequestSignInMethod`

```rust
type UserDeanonymizeRequestSignInMethod = String
```

One of: "email-password", "passwordless".

### `UserMfaRequestActiveMfaType`

```rust
type UserMfaRequestActiveMfaType = String
```

One of: "totp", "".

### `UserVerificationRequirement`

```rust
type UserVerificationRequirement = String
```

One of: "required", "preferred", "discouraged".
