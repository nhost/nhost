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

Map of extension outputs from the client

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `appid` | `Option<bool>` | Application identifier extension output |
| `cred_props` | `Option<CredentialPropertiesOutput>` | Credential properties extension output |
| `hmac_create_secret` | `Option<bool>` | HMAC secret extension output |

### `AuthenticatorAssertionResponse`

```rust
struct AuthenticatorAssertionResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_data_json` | `String` | Base64url encoded client data JSON |
| `authenticator_data` | `String` | Base64url encoded authenticator data |
| `signature` | `String` | Base64url encoded assertion signature |
| `user_handle` | `Option<String>` | Base64url encoded user handle |

### `AuthenticatorAttestationResponse`

```rust
struct AuthenticatorAttestationResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_data_json` | `UrlEncodedBase64` | Base64url\-encoded binary data |
| `transports` | `Option<Vec<String>>` | The authenticator transports |
| `authenticator_data` | `Option<UrlEncodedBase64>` | Base64url\-encoded binary data |
| `public_key` | `Option<UrlEncodedBase64>` | Base64url\-encoded binary data |
| `public_key_algorithm` | `Option<i64>` | The public key algorithm identifier |
| `attestation_object` | `UrlEncodedBase64` | Base64url\-encoded binary data |

### `AuthenticatorSelection`

```rust
struct AuthenticatorSelection
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `authenticator_attachment` | `Option<AuthenticatorAttachment>` | The authenticator attachment modality |
| `require_resident_key` | `Option<bool>` | Whether the authenticator must create a client\-side\-resident public key credential source |
| `resident_key` | `Option<ResidentKeyRequirement>` | The resident key requirement |
| `user_verification` | `Option<UserVerificationRequirement>` | A requirement for user verification for the operation |

### `Client`

```rust
struct Client
```

Generated API client, backed by a reqwest-middleware chain.

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `base_url` | `String` |  |

#### Methods

##### `new`

```rust
fn new(base_url: impl Into<String>, reqwest: reqwest::Client, middleware: Vec<Arc<dyn reqwest_middleware::Middleware>>) -> Self
```

Creates a new API client for `base_url` from a base client and an
ordered middleware stack (the first entry runs first on the way out).

Most applications get their clients from `Nhost::builder` instead; use
this together with `Nhost::from_clients` to assemble the pipeline
yourself.

##### `with_session_capture`

```rust
fn with_session_capture(self, sessions: SessionStorage) -> Self
```

Captures a session from every successful response that carries one into
`sessions`. This replaces the JS SDK's response-sniffing middleware,
which cannot work on wasm; only the auth service returns sessions.

##### `with_role`

```rust
fn with_role(&self, role: impl Into<String>) -> Self
```

Returns a copy of this client that sends `x-hasura-role: <role>` on every
request.

##### `with_headers`

```rust
fn with_headers(&self, headers: HashMap<String, String>) -> Self
```

Returns a copy of this client that sends extra headers on every request.

##### `get_jw_ks`

```rust
async fn get_jw_ks(&self) -> Result<Response<JwkSet>, Error>
```

Get public keys for JWT verification in JWK Set format

Retrieve the JSON Web Key Set (JWKS) containing public keys used to verify JWT signatures. This endpoint is used by clients to validate access tokens.

Performs GET /.well-known/jwks.json.

##### `elevate_webauthn`

```rust
async fn elevate_webauthn(&self) -> Result<Response<PublicKeyCredentialRequestOptions>, Error>
```

Elevate access for an already signed in user using FIDO2 Webauthn

Generate a Webauthn challenge for elevating user permissions

Performs POST /elevate/webauthn.

##### `verify_elevate_webauthn`

```rust
async fn verify_elevate_webauthn(&self, body: SignInWebauthnVerifyRequest) -> Result<Response<SessionPayload>, Error>
```

Verify FIDO2 Webauthn authentication using public\-key cryptography for elevation

Complete Webauthn elevation by verifying the authentication response

Performs POST /elevate/webauthn/verify.

##### `health_check_get`

```rust
async fn health_check_get(&self) -> Result<Response<OkResponse>, Error>
```

Health check (GET)

Verify if the authentication service is operational using GET method

Performs GET /healthz.

##### `health_check_head`

```rust
async fn health_check_head(&self) -> Result<Response<()>, Error>
```

Health check (HEAD)

Verify if the authentication service is operational using HEAD method

Performs HEAD /healthz.

##### `link_id_token`

```rust
async fn link_id_token(&self, body: LinkIdTokenRequest) -> Result<Response<OkResponse>, Error>
```

Link a user account with the provider's account using an id token

Link the authenticated user's account with an external OAuth provider account using an ID token. Requires elevated permissions.

Performs POST /link/idtoken.

##### `change_user_mfa`

```rust
async fn change_user_mfa(&self) -> Result<Response<TotpGenerateResponse>, Error>
```

Generate TOTP secret

Generate a Time\-based One\-Time Password (TOTP) secret for setting up multi\-factor authentication

Performs GET /mfa/totp/generate.

##### `create_pat`

```rust
async fn create_pat(&self, body: CreatePatRequest) -> Result<Response<CreatePatResponse>, Error>
```

Create a Personal Access Token (PAT)

Generate a new Personal Access Token for programmatic API access. PATs are long\-lived tokens that can be used instead of regular authentication for automated systems. Requires elevated permissions.

Performs POST /pat.

##### `sign_in_anonymous`

```rust
async fn sign_in_anonymous(&self, body: Option<SignInAnonymousRequest>) -> Result<Response<SessionPayload>, Error>
```

Sign in anonymously

Create an anonymous user session without providing credentials. Anonymous users can be converted to regular users later via the deanonymize endpoint.
This endpoint always creates a new user and is \*\*not\*\* gated by \`AUTH\_DISABLE\_AUTO\_SIGNUP\`; it is controlled by \`AUTH\_DISABLE\_SIGNUP\` and \`AUTH\_ANONYMOUS\_USERS\_ENABLED\`.

Performs POST /signin/anonymous.

##### `sign_in_email_password`

```rust
async fn sign_in_email_password(&self, body: SignInEmailPasswordRequest) -> Result<Response<SignInEmailPasswordResponse>, Error>
```

Sign in with email and password

Authenticate a user with their email and password. Returns a session object or MFA challenge if two\-factor authentication is enabled.

Performs POST /signin/email-password.

##### `sign_in_id_token`

```rust
async fn sign_in_id_token(&self, body: SignInIdTokenRequest) -> Result<Response<SessionPayload>, Error>
```

Sign in with an ID token

Authenticate using an ID token from a supported OAuth provider (Apple or Google).
If the user doesn't exist and \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is not set, a new account will be created.
When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, users must use the \`/signup/idtoken\` endpoint to register first.

Performs POST /signin/idtoken.

##### `verify_sign_in_mfa_totp`

```rust
async fn verify_sign_in_mfa_totp(&self, body: SignInMfaTotpRequest) -> Result<Response<SessionPayload>, Error>
```

Verify TOTP for MFA

Complete the multi\-factor authentication by verifying a Time\-based One\-Time Password (TOTP). Returns a session if validation is successful.

Performs POST /signin/mfa/totp.

##### `sign_in_otp_email`

```rust
async fn sign_in_otp_email(&self, body: SignInOtpEmailRequest) -> Result<Response<OkResponse>, Error>
```

Sign in with email OTP

Initiate email\-based one\-time password authentication. Sends an OTP to the specified email address.
If the user doesn't exist and \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is not set, a new account will be created with the provided options.
When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, users must use the \`/signup/otp/email\` endpoint to register first.

Performs POST /signin/otp/email.

##### `verify_sign_in_otp_email`

```rust
async fn verify_sign_in_otp_email(&self, body: SignInOtpEmailVerifyRequest) -> Result<Response<SignInOtpEmailVerifyResponse>, Error>
```

Verify email OTP

Complete email OTP authentication by verifying the one\-time password. Returns a session if validation is successful.

Performs POST /signin/otp/email/verify.

##### `sign_in_passwordless_email`

```rust
async fn sign_in_passwordless_email(&self, body: SignInPasswordlessEmailRequest) -> Result<Response<OkResponse>, Error>
```

Sign in with magic link email

Initiate passwordless authentication by sending a magic link to the user's email.
If the user doesn't exist and \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is not set, a new account will be created with the provided options.
When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, users must use the \`/signup/passwordless/email\` endpoint to register first.

Performs POST /signin/passwordless/email.

##### `sign_in_passwordless_sms`

```rust
async fn sign_in_passwordless_sms(&self, body: SignInPasswordlessSmsRequest) -> Result<Response<OkResponse>, Error>
```

Sign in with SMS OTP

Initiate passwordless authentication by sending a one\-time password to the user's phone number.
If the user doesn't exist and \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is not set, a new account will be created with the provided options.
When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, users must use the \`/signup/passwordless/sms\` endpoint to register first.

Performs POST /signin/passwordless/sms.

##### `verify_sign_in_passwordless_sms`

```rust
async fn verify_sign_in_passwordless_sms(&self, body: SignInPasswordlessSmsOtpRequest) -> Result<Response<SignInPasswordlessSmsOtpResponse>, Error>
```

Verify SMS OTP and complete authentication

Complete passwordless SMS authentication by verifying the one\-time password and returning a session.

Performs POST /signin/passwordless/sms/otp.

##### `sign_in_pat`

```rust
async fn sign_in_pat(&self, body: SignInPatRequest) -> Result<Response<SessionPayload>, Error>
```

Sign in with Personal Access Token (PAT)

Authenticate using a Personal Access Token. PATs are long\-lived tokens that can be used for programmatic access to the API.

Performs POST /signin/pat.

##### `sign_in_provider_url`

```rust
fn sign_in_provider_url(&self, provider: &str, params: Option<&SignInProviderParams>) -> Result<String, Error>
```

Sign in with an OAuth2 provider

Initiate OAuth2 authentication flow with a social provider. Redirects the user to the provider's authorization page.
If the user doesn't exist and \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is not set, a new account will be created upon callback.
When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, users must use the \`/signup/provider/{provider}\` endpoint to register first.

Builds the URL for GET /signin/provider/{provider} without following the redirect.

##### `get_provider_tokens`

```rust
async fn get_provider_tokens(&self, provider: &str) -> Result<Response<ProviderSession>, Error>
```

Retrieve OAuth2 provider tokens from callback

After successful OAuth2 authentication, retrieve the provider session containing access token, refresh token, and expiration information for the specified provider. To ensure the data isn't stale this endpoint must be called immediately after the OAuth callback to obtain the tokens. The session is cleared from the database during this call, so subsequent calls will fail without going through the sign\-in flow again. It is the user's responsibility to store the session safely (e.g., in browser local storage).

Performs GET /signin/provider/{provider}/callback/tokens.

##### `sign_in_webauthn`

```rust
async fn sign_in_webauthn(&self, body: Option<SignInWebauthnRequest>) -> Result<Response<PublicKeyCredentialRequestOptions>, Error>
```

Sign in with Webauthn

Initiate a Webauthn sign\-in process by sending a challenge to the user's device. The user must have previously registered a Webauthn credential.

Performs POST /signin/webauthn.

##### `verify_sign_in_webauthn`

```rust
async fn verify_sign_in_webauthn(&self, body: SignInWebauthnVerifyRequest) -> Result<Response<SessionPayload>, Error>
```

Verify Webauthn sign\-in

Complete the Webauthn sign\-in process by verifying the response from the user's device. Returns a session if validation is successful.

Performs POST /signin/webauthn/verify.

##### `sign_out`

```rust
async fn sign_out(&self, body: SignOutRequest) -> Result<Response<OkResponse>, Error>
```

Sign out

End the current user session by invalidating refresh tokens. Optionally sign out from all devices.

Performs POST /signout.

##### `sign_up_email_password`

```rust
async fn sign_up_email_password(&self, body: SignUpEmailPasswordRequest) -> Result<Response<SessionPayload>, Error>
```

Sign up with email and password

Register a new user account with email and password. Returns a session if email verification is not required, otherwise returns null session.

Performs POST /signup/email-password.

##### `sign_up_webauthn`

```rust
async fn sign_up_webauthn(&self, body: SignUpWebauthnRequest) -> Result<Response<PublicKeyCredentialCreationOptions>, Error>
```

Sign up with Webauthn

Initiate a Webauthn sign\-up process by sending a challenge to the user's device. The user must not have an existing account.

Performs POST /signup/webauthn.

##### `verify_sign_up_webauthn`

```rust
async fn verify_sign_up_webauthn(&self, body: SignUpWebauthnVerifyRequest) -> Result<Response<SessionPayload>, Error>
```

Verify Webauthn sign\-up

Complete the Webauthn sign\-up process by verifying the response from the user's device. Returns a session if validation is successful.

Performs POST /signup/webauthn/verify.

##### `sign_up_passwordless_email`

```rust
async fn sign_up_passwordless_email(&self, body: SignUpPasswordlessEmailRequest) -> Result<Response<OkResponse>, Error>
```

Sign up with magic link email

Register a new user account using passwordless email authentication. Sends a magic link to the specified email address for verification.
Use this endpoint to explicitly register a new account. When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, this is the only way to register through this method.

Performs POST /signup/passwordless/email.

##### `sign_up_otp_email`

```rust
async fn sign_up_otp_email(&self, body: SignUpOtpEmailRequest) -> Result<Response<OkResponse>, Error>
```

Sign up with email OTP

Register a new user account using email OTP authentication. Sends a one\-time password to the specified email address.
Use this endpoint to explicitly register a new account. When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, this is the only way to register through this method.

Performs POST /signup/otp/email.

##### `sign_up_passwordless_sms`

```rust
async fn sign_up_passwordless_sms(&self, body: SignUpPasswordlessSmsRequest) -> Result<Response<OkResponse>, Error>
```

Sign up with SMS OTP

Register a new user account using SMS OTP authentication. Sends a one\-time password to the specified phone number.
Use this endpoint to explicitly register a new account. When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, this is the only way to register through this method.

Performs POST /signup/passwordless/sms.

##### `sign_up_id_token`

```rust
async fn sign_up_id_token(&self, body: SignUpIdTokenRequest) -> Result<Response<SessionPayload>, Error>
```

Sign up with ID token

Register a new user account using an ID token from Apple or Google.
Use this endpoint to explicitly register a new account. When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, this is the only way to register through this method.
If the user already exists, a \`user\-already\-exists\` error is returned.

Performs POST /signup/idtoken.

##### `sign_up_provider_url`

```rust
fn sign_up_provider_url(&self, provider: &str, params: Option<&SignUpProviderParams>) -> Result<String, Error>
```

Sign up with OAuth provider

Initiate OAuth signup flow with the specified provider. Redirects to the provider's authorization page.
Use this endpoint to explicitly register a new account. When \`AUTH\_DISABLE\_AUTO\_SIGNUP\` is enabled, this is the only way to register through this method.
If the user already exists at callback time, they are redirected with \`error=user\-already\-exists\`.

Builds the URL for GET /signup/provider/{provider} without following the redirect.

##### `refresh_token`

```rust
async fn refresh_token(&self, body: RefreshTokenRequest) -> Result<Response<Session>, Error>
```

Refresh access token

Generate a new JWT access token using a valid refresh token. The refresh token used will be revoked and a new one will be issued.

Performs POST /token.

##### `refresh_provider_token`

```rust
async fn refresh_provider_token(&self, provider: &str, body: RefreshProviderTokenRequest) -> Result<Response<ProviderSession>, Error>
```

Refresh OAuth2 provider tokens

Refresh the OAuth2 provider access token using a valid refresh token. Returns a new provider session with updated access token, refresh token (if rotated by provider), and expiration information. This endpoint allows maintaining long\-lived access to provider APIs without requiring the user to re\-authenticate.

Performs POST /token/provider/{provider}.

##### `verify_token`

```rust
async fn verify_token(&self, body: Option<VerifyTokenRequest>) -> Result<Response<String>, Error>
```

Verify JWT token

Verify the validity of a JWT access token. If no request body is provided, the Authorization header will be used for verification.

Performs POST /token/verify.

##### `get_user`

```rust
async fn get_user(&self) -> Result<Response<User>, Error>
```

Get user information

Retrieve the authenticated user's profile information including roles, metadata, and account status.

Performs GET /user.

##### `deanonymize_user`

```rust
async fn deanonymize_user(&self, body: UserDeanonymizeRequest) -> Result<Response<OkResponse>, Error>
```

Deanonymize an anonymous user

Convert an anonymous user to a regular user by adding email and optionally password credentials. A confirmation email will be sent if the server is configured to do so.

Performs POST /user/deanonymize.

##### `deanonymize_user_sms`

```rust
async fn deanonymize_user_sms(&self, body: UserDeanonymizeSmsRequest) -> Result<Response<OkResponse>, Error>
```

Deanonymize an anonymous user with SMS OTP

Convert an anonymous user to a regular user by adding a phone number. A one\-time password is sent to the
phone number; the user completes verification by calling \`/signin/passwordless/sms/otp\` with the OTP, which
marks the phone number as verified and returns a session.

Performs POST /user/deanonymize/sms.

##### `change_user_email`

```rust
async fn change_user_email(&self, body: UserEmailChangeRequest) -> Result<Response<OkResponse>, Error>
```

Change user email

Request to change the authenticated user's email address. A verification email will be sent to the new address to confirm the change. Requires elevated permissions.

Performs POST /user/email/change.

##### `change_user_phone_number`

```rust
async fn change_user_phone_number(&self, body: UserPhoneNumberChangeRequest) -> Result<Response<OkResponse>, Error>
```

Change user phone number

Request to change the authenticated user's phone number. A one\-time password is sent
via SMS to the new phone number; complete the change by calling
\`/user/phone\-number/change/verify\` with the OTP. The current \`phone\_number\` is left
unchanged until verification succeeds. Requires elevated permissions.

Performs POST /user/phone-number/change.

##### `verify_change_user_phone_number`

```rust
async fn verify_change_user_phone_number(&self, body: UserPhoneNumberChangeVerifyRequest) -> Result<Response<OkResponse>, Error>
```

Verify phone number change

Complete a previously\-requested phone number change by submitting the OTP that was
sent via SMS. On success the staged phone number becomes the user's verified phone
number. Requires elevated permissions.

Performs POST /user/phone-number/change/verify.

##### `send_verification_email`

```rust
async fn send_verification_email(&self, body: UserEmailSendVerificationEmailRequest) -> Result<Response<OkResponse>, Error>
```

Send verification email

Send an email verification link to the specified email address. Used to verify email addresses for new accounts or email changes.

Performs POST /user/email/send-verification-email.

##### `verify_change_user_mfa`

```rust
async fn verify_change_user_mfa(&self, body: UserMfaRequest) -> Result<Response<OkResponse>, Error>
```

Manage multi\-factor authentication

Activate or deactivate multi\-factor authentication for the authenticated user

Performs POST /user/mfa.

##### `change_user_password`

```rust
async fn change_user_password(&self, body: UserPasswordRequest) -> Result<Response<OkResponse>, Error>
```

Change user password

Change the user's password. The user must be authenticated with elevated permissions or provide a valid password reset ticket.

All of the user's existing sessions are revoked atomically as part of this operation, including the session used to make the request. Clients must treat the user as signed out after a successful response and obtain a new session via sign\-in.

Performs POST /user/password.

##### `send_password_reset_email`

```rust
async fn send_password_reset_email(&self, body: UserPasswordResetRequest) -> Result<Response<OkResponse>, Error>
```

Request password reset

Request a password reset for a user account. An email with a verification link will be sent to the user's email address to complete the password reset process.

Performs POST /user/password/reset.

##### `add_security_key`

```rust
async fn add_security_key(&self) -> Result<Response<PublicKeyCredentialCreationOptions>, Error>
```

Initialize adding of a new webauthn security key

Start the process of adding a new WebAuthn security key to the user's account. Returns a challenge that must be completed by the user's authenticator device. Requires elevated permissions.

Performs POST /user/webauthn/add.

##### `verify_add_security_key`

```rust
async fn verify_add_security_key(&self, body: VerifyAddSecurityKeyRequest) -> Result<Response<VerifyAddSecurityKeyResponse>, Error>
```

Verify adding of a new webauthn security key

Complete the process of adding a new WebAuthn security key by verifying the authenticator response. Requires elevated permissions.

Performs POST /user/webauthn/verify.

##### `token_exchange`

```rust
async fn token_exchange(&self, body: TokenExchangeRequest) -> Result<Response<SessionPayload>, Error>
```

Exchange authorization code for session

Exchange an authorization code (obtained via PKCE flow) together with the original code\_verifier for a session containing access and refresh tokens.

Performs POST /token/exchange.

##### `verify_ticket_url`

```rust
fn verify_ticket_url(&self, params: &VerifyTicketParams) -> Result<String, Error>
```

Verify email and authentication tickets

Verify tickets created by email verification, magic link authentication, or password reset processes. Redirects the user to the appropriate destination upon successful verification.

Builds the URL for GET /verify without following the redirect.

##### `get_version`

```rust
async fn get_version(&self) -> Result<Response<GetVersionResponse200>, Error>
```

Get service version

Retrieve version information about the authentication service

Performs GET /version.

##### `get_open_id_configuration`

```rust
async fn get_open_id_configuration(&self) -> Result<Response<OAuth2DiscoveryResponse>, Error>
```

OpenID Connect Discovery

Returns the OpenID Provider Metadata (RFC 8414)

Performs GET /.well-known/openid-configuration.

##### `get_o_auth_authorization_server`

```rust
async fn get_o_auth_authorization_server(&self) -> Result<Response<OAuth2DiscoveryResponse>, Error>
```

OAuth2 Authorization Server Metadata

Returns the Authorization Server Metadata (RFC 8414). Same content as OpenID Discovery.

Performs GET /.well-known/oauth-authorization-server.

##### `oauth2_authorize_url`

```rust
fn oauth2_authorize_url(&self, params: &Oauth2AuthorizeParams) -> Result<String, Error>
```

OAuth2 Authorization Endpoint

Initiates an OAuth2 authorization code flow. Validates the request and redirects to the login UI for user authentication and consent.

Builds the URL for GET /oauth2/authorize without following the redirect.

##### `oauth2_authorize_post_url`

```rust
fn oauth2_authorize_post_url(&self) -> Result<String, Error>
```

OAuth2 Authorization Endpoint (POST)

Initiates an OAuth2 authorization code flow via POST. Validates the request and redirects to the login UI for user authentication and consent.

Builds the URL for POST /oauth2/authorize without following the redirect.

##### `oauth2_token`

```rust
async fn oauth2_token(&self, body: OAuth2TokenRequest) -> Result<Response<OAuth2TokenResponse>, Error>
```

OAuth2 Token Endpoint

Exchange an authorization code for tokens, or refresh an existing token. Supports grant\_type authorization\_code and refresh\_token.

Performs POST /oauth2/token.

##### `oauth2_userinfo_get`

```rust
async fn oauth2_userinfo_get(&self) -> Result<Response<OAuth2UserinfoResponse>, Error>
```

OpenID Connect UserInfo Endpoint (GET)

Returns claims about the authenticated user based on the access token scopes.

Performs GET /oauth2/userinfo.

##### `oauth2_userinfo_post`

```rust
async fn oauth2_userinfo_post(&self) -> Result<Response<OAuth2UserinfoResponse>, Error>
```

OpenID Connect UserInfo Endpoint (POST)

Returns claims about the authenticated user based on the access token scopes.

Performs POST /oauth2/userinfo.

##### `oauth2_jwks`

```rust
async fn oauth2_jwks(&self) -> Result<Response<OAuth2jwksResponse>, Error>
```

OAuth2 Provider JWKS Endpoint

Returns the JSON Web Key Set containing public keys used for OAuth2/OIDC token signing.

Performs GET /oauth2/jwks.

##### `oauth2_revoke`

```rust
async fn oauth2_revoke(&self, body: OAuth2RevokeRequest) -> Result<Response<()>, Error>
```

OAuth2 Token Revocation (RFC 7009)

Revoke an access token or refresh token.

Performs POST /oauth2/revoke.

##### `oauth2_introspect`

```rust
async fn oauth2_introspect(&self, body: OAuth2IntrospectRequest) -> Result<Response<OAuth2IntrospectResponse>, Error>
```

OAuth2 Token Introspection (RFC 7662)

Introspect a token to determine its current state and metadata.

Performs POST /oauth2/introspect.

##### `oauth2_login_get`

```rust
async fn oauth2_login_get(&self, params: Oauth2LoginGetParams) -> Result<Response<OAuth2LoginResponse>, Error>
```

Get authorization request details for consent screen

Called by the consent UI to get details about the pending authorization request.

Performs GET /oauth2/login.

##### `oauth2_login_post`

```rust
async fn oauth2_login_post(&self, body: OAuth2LoginRequest) -> Result<Response<OAuth2LoginCompleteResponse>, Error>
```

Complete login/consent for an authorization request

Called by the consent UI after user authenticates and consents. Sets the user on the auth request and redirects back to the client with an authorization code.

Performs POST /oauth2/login.

### `CreatePatRequest`

```rust
struct CreatePatRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `expires_at` | `String` | Expiration date of the PAT |
| `metadata` | `Option<serde_json::Value>` |  |

### `CreatePatResponse`

```rust
struct CreatePatResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | ID of the PAT |
| `personal_access_token` | `String` | PAT |

### `CredentialAssertionResponse`

```rust
struct CredentialAssertionResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | The credential's identifier |
| `r#type` | `String` | The credential type represented by this object |
| `raw_id` | `UrlEncodedBase64` | Base64url\-encoded binary data |
| `client_extension_results` | `Option<AuthenticationExtensionsClientOutputs>` | Map of extension outputs from the client |
| `authenticator_attachment` | `Option<String>` | The authenticator attachment |
| `response` | `AuthenticatorAssertionResponse` |  |

### `CredentialCreationResponse`

```rust
struct CredentialCreationResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | The credential's identifier |
| `r#type` | `String` | The credential type represented by this object |
| `raw_id` | `UrlEncodedBase64` | Base64url\-encoded binary data |
| `client_extension_results` | `Option<AuthenticationExtensionsClientOutputs>` | Map of extension outputs from the client |
| `authenticator_attachment` | `Option<String>` | The authenticator attachment |
| `response` | `AuthenticatorAttestationResponse` |  |

### `CredentialParameter`

```rust
struct CredentialParameter
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `r#type` | `CredentialType` | The valid credential types |
| `alg` | `i64` | The cryptographic algorithm identifier |

### `CredentialPropertiesOutput`

```rust
struct CredentialPropertiesOutput
```

Credential properties extension output

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `rk` | `Option<bool>` | Indicates if the credential is a resident key |

### `ErrorResponse`

```rust
struct ErrorResponse
```

Standardized error response

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `status` | `i64` | HTTP status error code |
| `message` | `String` | Human\-friendly error message |
| `error` | `auth::ErrorResponseError` | Error code identifying the specific application error |

### `GetVersionResponse200`

```rust
struct GetVersionResponse200
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `version` | `String` | The version of the authentication service |

### `Jwk`

```rust
struct Jwk
```

JSON Web Key for JWT verification

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `alg` | `String` | Algorithm used with this key |
| `e` | `String` | RSA public exponent |
| `kid` | `String` | Key ID |
| `kty` | `String` | Key type |
| `n` | `String` | RSA modulus |
| `r#use` | `String` | Key usage |

### `JwkSet`

```rust
struct JwkSet
```

JSON Web Key Set for verifying JWT signatures

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `keys` | `Vec<Jwk>` | Array of public keys |

### `LinkIdTokenRequest`

```rust
struct LinkIdTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `IdTokenProvider` |  |
| `id_token` | `String` | Apple ID token |
| `nonce` | `Option<String>` | Nonce used during sign in process |

### `MfaChallengePayload`

```rust
struct MfaChallengePayload
```

Challenge payload for multi\-factor authentication

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket` | `String` | Ticket to use when completing the MFA challenge |

### `Oauth2AuthorizeParams`

```rust
struct Oauth2AuthorizeParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `client_id` | `String` | The OAuth2 client identifier (RFC 6749 Section 2.2). |
| `redirect_uri` | `String` | The URI to redirect the user\-agent to after authorization (RFC 6749 Section 3.1.2). |
| `response_type` | `String` | The authorization response type. Only 'code' is supported (RFC 6749 Section 3.1.1). |
| `scope` | `Option<String>` | Space\-delimited list of requested scopes (RFC 6749 Section 3.3). |
| `state` | `Option<String>` | Opaque value used to maintain state between the request and callback (RFC 6749 Section 4.1.1). |
| `nonce` | `Option<String>` | String value used to associate a client session with an ID token (OpenID Connect Core Section 3.1.2.1). |
| `code_challenge` | `Option<String>` | PKCE code challenge derived from the code verifier (RFC 7636 Section 4.2). |
| `code_challenge_method` | `Option<GetCodeChallengeMethod>` | Only S256 is supported. The plain method is not allowed. |
| `resource` | `Option<String>` | Resource indicator for the target service (RFC 8707). |
| `prompt` | `Option<String>` | Space\-delimited list of prompts to present to the user (OpenID Connect Core Section 3.1.2.1). |

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
| `code_challenge_method` | `Option<String>` | Only S256 is supported. The plain method is not allowed. |
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
| `error` | `String` | OAuth2 error code |
| `error_description` | `Option<String>` | Human\-readable error description |

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
| `request_id` | `String` | The pending authorization request identifier. |

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
| `verifier` | `String` | The high-entropy secret sent only when exchanging the authorization code. |
| `challenge` | `String` | The public S256 digest sent with the initial authorization request. |

### `ProviderSession`

```rust
struct ProviderSession
```

OAuth2 provider session containing access and refresh tokens

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | `String` | OAuth2 provider access token for API calls |
| `expires_in` | `i64` | Number of seconds until the access token expires |
| `expires_at` | `String` | Timestamp when the access token expires |
| `refresh_token` | `Option<String>` | OAuth2 provider refresh token for obtaining new access tokens (if provided by the provider) |

### `ProviderSpecificParams`

```rust
struct ProviderSpecificParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `connection` | `Option<String>` | (workos) Specifies the connection to use for authentication |
| `organization` | `Option<String>` | (workos) Specifies the organization to use for authentication |

### `PublicKeyCredentialCreationOptions`

```rust
struct PublicKeyCredentialCreationOptions
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `rp` | `RelyingPartyEntity` |  |
| `user` | `UserEntity` |  |
| `challenge` | `UrlEncodedBase64` | Base64url\-encoded binary data |
| `pub_key_cred_params` | `Vec<CredentialParameter>` | The desired credential types and their respective cryptographic parameters |
| `timeout` | `Option<i64>` | A time, in milliseconds, that the caller is willing to wait for the call to complete |
| `exclude_credentials` | `Option<Vec<PublicKeyCredentialDescriptor>>` | A list of PublicKeyCredentialDescriptor objects representing public key credentials that are not acceptable to the caller |
| `authenticator_selection` | `Option<AuthenticatorSelection>` |  |
| `hints` | `Option<Vec<PublicKeyCredentialHints>>` | Hints to help guide the user through the experience |
| `attestation` | `Option<ConveyancePreference>` | The attestation conveyance preference |
| `attestation_formats` | `Option<Vec<AttestationFormat>>` | The preferred attestation statement formats |
| `extensions` | `Option<serde_json::Value>` | Additional parameters requesting additional processing by the client and authenticator |

### `PublicKeyCredentialDescriptor`

```rust
struct PublicKeyCredentialDescriptor
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `r#type` | `CredentialType` | The valid credential types |
| `id` | `UrlEncodedBase64` | Base64url\-encoded binary data |
| `transports` | `Option<Vec<AuthenticatorTransport>>` | The authenticator transports that can be used |

### `PublicKeyCredentialRequestOptions`

```rust
struct PublicKeyCredentialRequestOptions
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `challenge` | `UrlEncodedBase64` | Base64url\-encoded binary data |
| `timeout` | `Option<i64>` | A time, in milliseconds, that the caller is willing to wait for the call to complete |
| `rp_id` | `Option<String>` | The RP ID the credential should be scoped to |
| `allow_credentials` | `Option<Vec<PublicKeyCredentialDescriptor>>` | A list of CredentialDescriptor objects representing public key credentials acceptable to the caller |
| `user_verification` | `Option<UserVerificationRequirement>` | A requirement for user verification for the operation |
| `hints` | `Option<Vec<PublicKeyCredentialHints>>` | Hints to help guide the user through the experience |
| `extensions` | `Option<serde_json::Value>` | Additional parameters requesting additional processing by the client and authenticator |

### `RefreshProviderTokenRequest`

```rust
struct RefreshProviderTokenRequest
```

Request to refresh OAuth2 provider tokens

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `refresh_token` | `String` | OAuth2 provider refresh token obtained from previous authentication |

### `RefreshTokenRequest`

```rust
struct RefreshTokenRequest
```

Request to refresh an access token

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `refresh_token` | `String` | Refresh token used to generate a new access token |

### `RelyingPartyEntity`

```rust
struct RelyingPartyEntity
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `String` | A human\-palatable name for the entity |
| `id` | `String` | A unique identifier for the Relying Party entity, which sets the RP ID |

### `Session`

```rust
struct Session
```

User authentication session containing tokens and user information

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `access_token` | `String` | JWT token for authenticating API requests |
| `access_token_expires_in` | `i64` | Expiration time of the access token in seconds |
| `refresh_token_id` | `String` | Identifier for the refresh token |
| `refresh_token` | `String` | Token used to refresh the access token |
| `user` | `Option<User>` | User profile and account information |

### `SessionPayload`

```rust
struct SessionPayload
```

Container for session information

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` | User authentication session containing tokens and user information |

### `SignInAnonymousRequest`

```rust
struct SignInAnonymousRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `display_name` | `Option<String>` |  |
| `locale` | `Option<String>` | A two or three characters locale |
| `metadata` | `Option<serde_json::Value>` |  |

### `SignInEmailPasswordRequest`

```rust
struct SignInEmailPasswordRequest
```

Request to authenticate using email and password

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | User's email address |
| `password` | `String` | User's password |

### `SignInEmailPasswordResponse`

```rust
struct SignInEmailPasswordResponse
```

Response for email\-password authentication that may include a session or MFA challenge

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` | User authentication session containing tokens and user information |
| `mfa` | `Option<MfaChallengePayload>` | Challenge payload for multi\-factor authentication |

### `SignInIdTokenRequest`

```rust
struct SignInIdTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `IdTokenProvider` |  |
| `id_token` | `String` | Apple ID token |
| `nonce` | `Option<String>` | Nonce used during sign in process |
| `options` | `Option<SignUpOptions>` |  |

### `SignInMfaTotpRequest`

```rust
struct SignInMfaTotpRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket` | `String` | Ticket |
| `otp` | `String` | One time password |

### `SignInOtpEmailRequest`

```rust
struct SignInOtpEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
| `options` | `Option<SignUpOptions>` |  |

### `SignInOtpEmailVerifyRequest`

```rust
struct SignInOtpEmailVerifyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `otp` | `String` | One time password |
| `email` | `String` | A valid email |

### `SignInOtpEmailVerifyResponse`

```rust
struct SignInOtpEmailVerifyResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` | User authentication session containing tokens and user information |

### `SignInPasswordlessEmailRequest`

```rust
struct SignInPasswordlessEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the verification redirect will contain an authorization code instead of a refresh token. |

### `SignInPasswordlessSmsOtpRequest`

```rust
struct SignInPasswordlessSmsOtpRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` | Phone number of the user |
| `otp` | `String` | One\-time password received by SMS |

### `SignInPasswordlessSmsOtpResponse`

```rust
struct SignInPasswordlessSmsOtpResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `session` | `Option<Session>` | User authentication session containing tokens and user information |
| `mfa` | `Option<MfaChallengePayload>` | Challenge payload for multi\-factor authentication |

### `SignInPasswordlessSmsRequest`

```rust
struct SignInPasswordlessSmsRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` | Phone number of the user |
| `options` | `Option<SignUpOptions>` |  |

### `SignInPatRequest`

```rust
struct SignInPatRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `personal_access_token` | `String` | PAT |

### `SignInProviderParams`

```rust
struct SignInProviderParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `allowed_roles` | `Option<Vec<String>>` | Array of allowed roles for the user |
| `default_role` | `Option<String>` | Default role for the user |
| `display_name` | `Option<String>` | Display name for the user |
| `locale` | `Option<String>` | A two or three characters locale |
| `metadata` | `Option<serde_json::Value>` | Additional metadata for the user (JSON encoded string) |
| `redirect_to` | `Option<String>` | URI to redirect to |
| `connect` | `Option<String>` | If set, this means that the user is already authenticated and wants to link their account. This needs to be a valid JWT access token. |
| `state` | `Option<String>` | Opaque state value to be returned by the provider |
| `provider_specific_params` | `Option<ProviderSpecificParams>` | Additional provider\-specific parameters |
| `upstream_params` | `Option<HashMap<String, String>>` | Extra parameters forwarded to the upstream OAuth2 provider's authorization URL. Reserved OAuth2/OIDC parameters are rejected. Extra parameters forwarded to the upstream OAuth2 provider's authorization URL (e.g. Google's prompt or login\_hint). Reserved OAuth2/OIDC parameters are rejected. |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the callback redirect will contain an authorization code instead of a refresh token. |

#### Trait implementations

- `Default`

### `SignInWebauthnRequest`

```rust
struct SignInWebauthnRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `Option<String>` | A valid email |

### `SignInWebauthnVerifyRequest`

```rust
struct SignInWebauthnVerifyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `Option<String>` | A valid email. Deprecated, no longer used |
| `credential` | `CredentialAssertionResponse` |  |

### `SignOutRequest`

```rust
struct SignOutRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `refresh_token` | `Option<String>` | Refresh token for the current session |
| `all` | `Option<bool>` | Sign out from all connected devices |

### `SignUpEmailPasswordRequest`

```rust
struct SignUpEmailPasswordRequest
```

Request to register a new user with email and password

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | Email address for the new user account |
| `password` | `String` | Password for the new user account |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided and email verification is required, the verification redirect will contain an authorization code instead of a refresh token. |

### `SignUpIdTokenRequest`

```rust
struct SignUpIdTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `provider` | `IdTokenProvider` |  |
| `id_token` | `String` | Apple or Google ID token |
| `nonce` | `Option<String>` | Nonce used during sign in process |
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
| `locale` | `Option<String>` | A two or three characters locale |
| `metadata` | `Option<serde_json::Value>` |  |
| `redirect_to` | `Option<String>` |  |

### `SignUpOtpEmailRequest`

```rust
struct SignUpOtpEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
| `options` | `Option<SignUpOptions>` |  |

### `SignUpPasswordlessEmailRequest`

```rust
struct SignUpPasswordlessEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the verification redirect will contain an authorization code instead of a refresh token. |

### `SignUpPasswordlessSmsRequest`

```rust
struct SignUpPasswordlessSmsRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` | Phone number of the user |
| `options` | `Option<SignUpOptions>` |  |

### `SignUpProviderParams`

```rust
struct SignUpProviderParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `allowed_roles` | `Option<Vec<String>>` | Array of allowed roles for the user |
| `default_role` | `Option<String>` | Default role for the user |
| `display_name` | `Option<String>` | Display name for the user |
| `locale` | `Option<String>` | A two or three characters locale |
| `metadata` | `Option<serde_json::Value>` | Additional metadata for the user (JSON encoded string) |
| `redirect_to` | `Option<String>` | URI to redirect to |
| `state` | `Option<String>` | Opaque state value to be returned by the provider |
| `provider_specific_params` | `Option<ProviderSpecificParams>` | Additional provider\-specific parameters |
| `upstream_params` | `Option<HashMap<String, String>>` | Extra parameters forwarded to the upstream OAuth2 provider's authorization URL. Reserved OAuth2/OIDC parameters are rejected. Extra parameters forwarded to the upstream OAuth2 provider's authorization URL (e.g. Google's prompt or login\_hint). Reserved OAuth2/OIDC parameters are rejected. |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the callback redirect will contain an authorization code instead of a refresh token. |

#### Trait implementations

- `Default`

### `SignUpWebauthnRequest`

```rust
struct SignUpWebauthnRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
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
| `nickname` | `Option<String>` | Nickname for the security key |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided and email verification is required, the verification redirect will contain an authorization code instead of a refresh token. |

### `TokenExchangeRequest`

```rust
struct TokenExchangeRequest
```

Request to exchange an authorization code for a session using PKCE

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `code` | `String` | The authorization code received from the redirect |
| `code_verifier` | `String` | The original PKCE code verifier (43\-128 characters) |

### `TotpGenerateResponse`

```rust
struct TotpGenerateResponse
```

Response containing TOTP setup information for MFA

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `image_url` | `String` | URL to QR code image for scanning with an authenticator app |
| `totp_secret` | `String` | TOTP secret key for manual setup with an authenticator app |

### `User`

```rust
struct User
```

User profile and account information

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `avatar_url` | `String` | URL to the user's profile picture |
| `created_at` | `String` | Timestamp when the user account was created |
| `default_role` | `String` | Default authorization role for the user |
| `display_name` | `String` | User's display name |
| `email` | `Option<String>` | User's email address |
| `email_verified` | `bool` | Whether the user's email has been verified |
| `id` | `String` | Unique identifier for the user |
| `is_anonymous` | `bool` | Whether this is an anonymous user account |
| `locale` | `String` | User's preferred locale (language code) |
| `metadata` | `Option<serde_json::Value>` | Custom metadata associated with the user |
| `phone_number` | `Option<String>` | User's phone number |
| `phone_number_verified` | `bool` | Whether the user's phone number has been verified |
| `roles` | `Vec<String>` | List of roles assigned to the user |
| `active_mfa_type` | `Option<String>` | Active MFA type for the user |

### `UserDeanonymizeRequest`

```rust
struct UserDeanonymizeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `sign_in_method` | `UserDeanonymizeRequestSignInMethod` | Which sign\-in method to use |
| `email` | `String` | A valid email |
| `password` | `Option<String>` | A password of minimum 3 characters |
| `connection` | `Option<String>` | Deprecated, will be ignored |
| `options` | `Option<SignUpOptions>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the verification redirect will contain an authorization code instead of a refresh token. |

### `UserDeanonymizeSmsRequest`

```rust
struct UserDeanonymizeSmsRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `phone_number` | `String` | Phone number of the user |
| `options` | `Option<SignUpOptions>` |  |

### `UserEmailChangeRequest`

```rust
struct UserEmailChangeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `new_email` | `String` | A valid email |
| `options` | `Option<OptionsRedirectTo>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the verification redirect will contain an authorization code instead of a refresh token. |

### `UserEmailSendVerificationEmailRequest`

```rust
struct UserEmailSendVerificationEmailRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
| `options` | `Option<OptionsRedirectTo>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the verification redirect will contain an authorization code instead of a refresh token. |

### `UserEntity`

```rust
struct UserEntity
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `name` | `String` | A human\-palatable name for the entity |
| `display_name` | `String` | A human\-palatable name for the user account, intended only for display |
| `id` | `String` | The user handle of the user account entity |

### `UserMfaRequest`

```rust
struct UserMfaRequest
```

Request to activate or deactivate multi\-factor authentication

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `code` | `String` | Verification code from the authenticator app when activating MFA |
| `active_mfa_type` | `Option<UserMfaRequestActiveMfaType>` | Type of MFA to activate. Use empty string to disable MFA. |

### `UserPasswordRequest`

```rust
struct UserPasswordRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `new_password` | `String` | A password of minimum 3 characters |
| `ticket` | `Option<String>` | Ticket to reset the password, required if the user is not authenticated |

### `UserPasswordResetRequest`

```rust
struct UserPasswordResetRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `email` | `String` | A valid email |
| `options` | `Option<OptionsRedirectTo>` |  |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When provided, the verification redirect will contain an authorization code instead of a refresh token. |

### `UserPhoneNumberChangeRequest`

```rust
struct UserPhoneNumberChangeRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `new_phone_number` | `String` | New phone number to bind to the user once verified via SMS OTP |

### `UserPhoneNumberChangeVerifyRequest`

```rust
struct UserPhoneNumberChangeVerifyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `new_phone_number` | `String` | The phone number that was previously requested via /user/phone\-number/change |
| `otp` | `String` | One\-time password received via SMS at the new phone number |

### `VerifyAddSecurityKeyRequest`

```rust
struct VerifyAddSecurityKeyRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `credential` | `CredentialCreationResponse` |  |
| `nickname` | `Option<String>` | Optional nickname for the security key |

### `VerifyAddSecurityKeyResponse`

```rust
struct VerifyAddSecurityKeyResponse
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | `String` | The ID of the newly added security key |
| `nickname` | `Option<String>` | The nickname of the security key if provided |

### `VerifyTicketParams`

```rust
struct VerifyTicketParams
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `ticket` | `TicketQuery` | Ticket Ticket |
| `r#type` | `Option<TicketTypeQuery>` | Type of the ticket. Deprecated, no longer used Type of the ticket |
| `redirect_to` | `RedirectToQuery` | Target URL for the redirect Target URL for the redirect |
| `code_challenge` | `Option<String>` | PKCE code challenge (S256). When present, the redirect will contain an authorization code instead of a refresh token. |

### `VerifyTokenRequest`

```rust
struct VerifyTokenRequest
```

#### Fields

| Field | Type | Description |
| --- | --- | --- |
| `token` | `Option<String>` | JWT token to verify |

## Type Aliases

### `AttestationFormat`

```rust
type AttestationFormat = String
```

The attestation statement format

One of: "packed", "tpm", "android-key", "android-safetynet", "fido-u2f", "apple", "none".

### `AuthenticatorAttachment`

```rust
type AuthenticatorAttachment = String
```

The authenticator attachment modality

One of: "platform", "cross-platform".

### `AuthenticatorTransport`

```rust
type AuthenticatorTransport = String
```

The authenticator transports that can be used

One of: "usb", "nfc", "ble", "smart-card", "hybrid", "internal".

### `ConveyancePreference`

```rust
type ConveyancePreference = String
```

The attestation conveyance preference

One of: "none", "indirect", "direct", "enterprise".

### `CredentialType`

```rust
type CredentialType = String
```

The valid credential types

One of: "public-key".

### `ErrorResponseError`

```rust
type ErrorResponseError = String
```

Error code identifying the specific application error

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

Hints to help guide the user through the experience

One of: "security-key", "client-device", "hybrid".

### `RedirectToQuery`

```rust
type RedirectToQuery = String
```

Target URL for the redirect

### `ResidentKeyRequirement`

```rust
type ResidentKeyRequirement = String
```

The resident key requirement

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

Ticket

### `TicketTypeQuery`

```rust
type TicketTypeQuery = String
```

Type of the ticket

One of: "emailVerify", "emailConfirmChange", "signinPasswordless", "passwordReset".

### `UrlEncodedBase64`

```rust
type UrlEncodedBase64 = String
```

Base64url\-encoded binary data

### `UserDeanonymizeRequestSignInMethod`

```rust
type UserDeanonymizeRequestSignInMethod = String
```

Which sign\-in method to use

One of: "email-password", "passwordless".

### `UserMfaRequestActiveMfaType`

```rust
type UserMfaRequestActiveMfaType = String
```

Type of MFA to activate. Use empty string to disable MFA.

One of: "totp", "".

### `UserVerificationRequirement`

```rust
type UserVerificationRequirement = String
```

A requirement for user verification for the operation

One of: "required", "preferred", "discouraged".
