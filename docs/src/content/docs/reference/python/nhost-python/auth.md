---
title: Auth
---

Nhost Auth generated API and hand-written conveniences.

## Functions

### `generate_code_challenge`

```python
def generate_code_challenge(verifier: str) -> str
```

Derive an S256 code challenge from a code verifier.

### `generate_code_verifier`

```python
def generate_code_verifier() -> str
```

Generate a cryptographically random PKCE code verifier.

Returns 43 base64url characters (32 random bytes), the RFC 7636 recommended
length.

### `generate_pkce_pair`

```python
def generate_pkce_pair() -> PKCEPair
```

Generate a PKCE code verifier and its S256 challenge in one call.

## Classes

### `AuthClient`

```python
class AuthClient(Client):
```

Extends [`Client`](#client).

Generated Auth API plus stable, idiomatically named conveniences.

#### Methods

##### `aclose`

```python
async def aclose(self) -> None
```

Close the internally owned HTTP client, if any.

##### `add_middleware`

```python
def add_middleware(self, middleware: Middleware) -> None
```

Append HTTP middleware and rebuild the request pipeline.

##### `add_security_key`

```python
async def add_security_key(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialCreationOptions]
```

Initialize adding of a new webauthn security key

Start the process of adding a new WebAuthn security key to the user's account. Returns a challenge that must be completed by the user's authenticator device. Requires elevated permissions.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialCreationOptions]: The HTTP response.

##### `change_user_email`

```python
async def change_user_email(self, *, body: UserEmailChangeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Change user email

Request to change the authenticated user's email address. A verification email will be sent to the new address to confirm the change. Requires elevated permissions.

Args:
    body (UserEmailChangeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `change_user_mfa`

```python
async def change_user_mfa(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[TotpGenerateResponse]
```

Generate TOTP secret

Generate a Time-based One-Time Password (TOTP) secret for setting up multi-factor authentication

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[TotpGenerateResponse]: The HTTP response.

##### `change_user_password`

```python
async def change_user_password(self, *, body: UserPasswordRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Change user password

Change the user's password. The user must be authenticated with elevated permissions or provide a valid password reset ticket.

All of the user's existing sessions are revoked atomically as part of this operation, including the session used to make the request. Clients must treat the user as signed out after a successful response and obtain a new session via sign-in.


Args:
    body (UserPasswordRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `change_user_phone_number`

```python
async def change_user_phone_number(self, *, body: UserPhoneNumberChangeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Change user phone number

Request to change the authenticated user's phone number. A one-time password is sent
via SMS to the new phone number; complete the change by calling
`/user/phone-number/change/verify` with the OTP. The current `phone_number` is left
unchanged until verification succeeds. Requires elevated permissions.


Args:
    body (UserPhoneNumberChangeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `create_pat`

```python
async def create_pat(self, *, body: CreatePATRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[CreatePATResponse]
```

Create a Personal Access Token (PAT)

Generate a new Personal Access Token for programmatic API access. PATs are long-lived tokens that can be used instead of regular authentication for automated systems. Requires elevated permissions.

Args:
    body (CreatePATRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[CreatePATResponse]: The HTTP response.

##### `deanonymize_user`

```python
async def deanonymize_user(self, *, body: UserDeanonymizeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Deanonymize an anonymous user

Convert an anonymous user to a regular user by adding email and optionally password credentials. A confirmation email will be sent if the server is configured to do so.

Args:
    body (UserDeanonymizeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `deanonymize_user_sms`

```python
async def deanonymize_user_sms(self, *, body: UserDeanonymizeSmsRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Deanonymize an anonymous user with SMS OTP

Convert an anonymous user to a regular user by adding a phone number. A one-time password is sent to the
phone number; the user completes verification by calling `/signin/passwordless/sms/otp` with the OTP, which
marks the phone number as verified and returns a session.


Args:
    body (UserDeanonymizeSmsRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `elevate_webauthn`

```python
async def elevate_webauthn(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialRequestOptions]
```

Elevate access for an already signed in user using FIDO2 Webauthn

Generate a Webauthn challenge for elevating user permissions

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialRequestOptions]: The HTTP response.

##### `generate_totp_secret`

```python
async def generate_totp_secret(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[TotpGenerateResponse]
```

Generate a TOTP secret for multi-factor authentication setup.

##### `get_jw_ks`

```python
async def get_jw_ks(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[JWKSet]
```

Get public keys for JWT verification in JWK Set format

Retrieve the JSON Web Key Set (JWKS) containing public keys used to verify JWT signatures. This endpoint is used by clients to validate access tokens.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[JWKSet]: The HTTP response.

##### `get_jwks`

```python
async def get_jwks(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[JWKSet]
```

Return the JSON Web Key Set used to verify access tokens.

##### `get_o_auth_authorization_server`

```python
async def get_o_auth_authorization_server(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2DiscoveryResponse]
```

OAuth2 Authorization Server Metadata

Returns the Authorization Server Metadata (RFC 8414). Same content as OpenID Discovery.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2DiscoveryResponse]: The HTTP response.

##### `get_oauth_authorization_server`

```python
async def get_oauth_authorization_server(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2DiscoveryResponse]
```

Return RFC 8414 OAuth authorization-server metadata.

##### `get_open_id_configuration`

```python
async def get_open_id_configuration(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2DiscoveryResponse]
```

OpenID Connect Discovery

Returns the OpenID Provider Metadata (RFC 8414)

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2DiscoveryResponse]: The HTTP response.

##### `get_provider_tokens`

```python
async def get_provider_tokens(self, provider: SignInProvider, *, headers: Mapping[str, str] | None = None) -> FetchResponse[ProviderSession]
```

Retrieve OAuth2 provider tokens from callback

After successful OAuth2 authentication, retrieve the provider session containing access token, refresh token, and expiration information for the specified provider. To ensure the data isn't stale this endpoint must be called immediately after the OAuth callback to obtain the tokens. The session is cleared from the database during this call, so subsequent calls will fail without going through the sign-in flow again. It is the user's responsibility to store the session safely (e.g., in browser local storage).

Args:
    provider (SignInProvider): The name of the social provider
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ProviderSession]: The HTTP response.

##### `get_user`

```python
async def get_user(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[User]
```

Get user information

Retrieve the authenticated user's profile information including roles, metadata, and account status.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[User]: The HTTP response.

##### `get_version`

```python
async def get_version(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[GetVersionResponse200]
```

Get service version

Retrieve version information about the authentication service

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[GetVersionResponse200]: The HTTP response.

##### `health_check_get`

```python
async def health_check_get(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Health check (GET)

Verify if the authentication service is operational using GET method

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `health_check_head`

```python
async def health_check_head(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[None]
```

Health check (HEAD)

Verify if the authentication service is operational using HEAD method

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[None]: The HTTP response.

##### `link_id_token`

```python
async def link_id_token(self, *, body: LinkIdTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Link a user account with the provider's account using an id token

Link the authenticated user's account with an external OAuth provider account using an ID token. Requires elevated permissions.

Args:
    body (LinkIdTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `oauth2_authorize_post_url`

```python
def oauth2_authorize_post_url(self) -> str
```

OAuth2 Authorization Endpoint (POST)

Initiates an OAuth2 authorization code flow via POST. Validates the request and redirects to the login UI for user authentication and consent.

Returns:
    str: The redirect URL.

##### `oauth2_authorize_url`

```python
def oauth2_authorize_url(self, *, params: Oauth2AuthorizeParams) -> str
```

OAuth2 Authorization Endpoint

Initiates an OAuth2 authorization code flow. Validates the request and redirects to the login UI for user authentication and consent.

Args:
    params (Oauth2AuthorizeParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `oauth2_introspect`

```python
async def oauth2_introspect(self, *, body: OAuth2IntrospectRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2IntrospectResponse]
```

OAuth2 Token Introspection (RFC 7662)

Introspect a token to determine its current state and metadata.

Args:
    body (OAuth2IntrospectRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2IntrospectResponse]: The HTTP response.

##### `oauth2_jwks`

```python
async def oauth2_jwks(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2JWKSResponse]
```

OAuth2 Provider JWKS Endpoint

Returns the JSON Web Key Set containing public keys used for OAuth2/OIDC token signing.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2JWKSResponse]: The HTTP response.

##### `oauth2_login_get`

```python
async def oauth2_login_get(self, *, params: Oauth2LoginGetParams, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2LoginResponse]
```

Get authorization request details for consent screen

Called by the consent UI to get details about the pending authorization request.

Args:
    params (Oauth2LoginGetParams): Query and header parameters.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2LoginResponse]: The HTTP response.

##### `oauth2_login_post`

```python
async def oauth2_login_post(self, *, body: OAuth2LoginRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2LoginCompleteResponse]
```

Complete login/consent for an authorization request

Called by the consent UI after user authenticates and consents. Sets the user on the auth request and redirects back to the client with an authorization code.

Args:
    body (OAuth2LoginRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2LoginCompleteResponse]: The HTTP response.

##### `oauth2_revoke`

```python
async def oauth2_revoke(self, *, body: OAuth2RevokeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[None]
```

OAuth2 Token Revocation (RFC 7009)

Revoke an access token or refresh token.

Args:
    body (OAuth2RevokeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[None]: The HTTP response.

##### `oauth2_token`

```python
async def oauth2_token(self, *, body: OAuth2TokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2TokenResponse]
```

OAuth2 Token Endpoint

Exchange an authorization code for tokens, or refresh an existing token. Supports grant_type authorization_code and refresh_token.

Args:
    body (OAuth2TokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2TokenResponse]: The HTTP response.

##### `oauth2_userinfo_get`

```python
async def oauth2_userinfo_get(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2UserinfoResponse]
```

OpenID Connect UserInfo Endpoint (GET)

Returns claims about the authenticated user based on the access token scopes.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2UserinfoResponse]: The HTTP response.

##### `oauth2_userinfo_post`

```python
async def oauth2_userinfo_post(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2UserinfoResponse]
```

OpenID Connect UserInfo Endpoint (POST)

Returns claims about the authenticated user based on the access token scopes.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2UserinfoResponse]: The HTTP response.

##### `refresh_provider_token`

```python
async def refresh_provider_token(self, provider: SignInProvider, *, body: RefreshProviderTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[ProviderSession]
```

Refresh OAuth2 provider tokens

Refresh the OAuth2 provider access token using a valid refresh token. Returns a new provider session with updated access token, refresh token (if rotated by provider), and expiration information. This endpoint allows maintaining long-lived access to provider APIs without requiring the user to re-authenticate.

Args:
    provider (SignInProvider): The name of the social provider
    body (RefreshProviderTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ProviderSession]: The HTTP response.

##### `refresh_token`

```python
async def refresh_token(self, *, body: RefreshTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[Session]
```

Refresh access token

Generate a new JWT access token using a valid refresh token. The refresh token used will be revoked and a new one will be issued.

Args:
    body (RefreshTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[Session]: The HTTP response.

##### `send_password_reset_email`

```python
async def send_password_reset_email(self, *, body: UserPasswordResetRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Request password reset

Request a password reset for a user account. An email with a verification link will be sent to the user's email address to complete the password reset process.

Args:
    body (UserPasswordResetRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `send_verification_email`

```python
async def send_verification_email(self, *, body: UserEmailSendVerificationEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Send verification email

Send an email verification link to the specified email address. Used to verify email addresses for new accounts or email changes.

Args:
    body (UserEmailSendVerificationEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_anonymous`

```python
async def sign_in_anonymous(self, *, body: SignInAnonymousRequest | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign in anonymously

Create an anonymous user session without providing credentials. Anonymous users can be converted to regular users later via the deanonymize endpoint.
This endpoint always creates a new user and is **not** gated by `AUTH_DISABLE_AUTO_SIGNUP`; it is controlled by `AUTH_DISABLE_SIGNUP` and `AUTH_ANONYMOUS_USERS_ENABLED`.


Args:
    body (SignInAnonymousRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_in_email_password`

```python
async def sign_in_email_password(self, *, body: SignInEmailPasswordRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SignInEmailPasswordResponse]
```

Sign in with email and password

Authenticate a user with their email and password. Returns a session object or MFA challenge if two-factor authentication is enabled.

Args:
    body (SignInEmailPasswordRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SignInEmailPasswordResponse]: The HTTP response.

##### `sign_in_id_token`

```python
async def sign_in_id_token(self, *, body: SignInIdTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign in with an ID token

Authenticate using an ID token from a supported OAuth provider (Apple or Google).
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/idtoken` endpoint to register first.


Args:
    body (SignInIdTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_in_otp_email`

```python
async def sign_in_otp_email(self, *, body: SignInOTPEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign in with email OTP

Initiate email-based one-time password authentication. Sends an OTP to the specified email address.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created with the provided options.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/otp/email` endpoint to register first.


Args:
    body (SignInOTPEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_passwordless_email`

```python
async def sign_in_passwordless_email(self, *, body: SignInPasswordlessEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign in with magic link email

Initiate passwordless authentication by sending a magic link to the user's email.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created with the provided options.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/passwordless/email` endpoint to register first.


Args:
    body (SignInPasswordlessEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_passwordless_sms`

```python
async def sign_in_passwordless_sms(self, *, body: SignInPasswordlessSmsRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign in with SMS OTP

Initiate passwordless authentication by sending a one-time password to the user's phone number.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created with the provided options.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/passwordless/sms` endpoint to register first.


Args:
    body (SignInPasswordlessSmsRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_pat`

```python
async def sign_in_pat(self, *, body: SignInPATRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign in with Personal Access Token (PAT)

Authenticate using a Personal Access Token. PATs are long-lived tokens that can be used for programmatic access to the API.

Args:
    body (SignInPATRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_in_provider_url`

```python
def sign_in_provider_url(self, provider: SignInProvider, *, params: SignInProviderParams | None = None) -> str
```

Sign in with an OAuth2 provider

Initiate OAuth2 authentication flow with a social provider. Redirects the user to the provider's authorization page.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created upon callback.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/provider/{provider}` endpoint to register first.


Args:
    provider (SignInProvider): The name of the social provider
    params (SignInProviderParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `sign_in_webauthn`

```python
async def sign_in_webauthn(self, *, body: SignInWebauthnRequest | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialRequestOptions]
```

Sign in with Webauthn

Initiate a Webauthn sign-in process by sending a challenge to the user's device. The user must have previously registered a Webauthn credential.

Args:
    body (SignInWebauthnRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialRequestOptions]: The HTTP response.

##### `sign_out`

```python
async def sign_out(self, *, body: SignOutRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign out

End the current user session by invalidating refresh tokens. Optionally sign out from all devices.

Args:
    body (SignOutRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_email_password`

```python
async def sign_up_email_password(self, *, body: SignUpEmailPasswordRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign up with email and password

Register a new user account with email and password. Returns a session if email verification is not required, otherwise returns null session.

Args:
    body (SignUpEmailPasswordRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_up_id_token`

```python
async def sign_up_id_token(self, *, body: SignUpIdTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign up with ID token

Register a new user account using an ID token from Apple or Google.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.
If the user already exists, a `user-already-exists` error is returned.


Args:
    body (SignUpIdTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_up_otp_email`

```python
async def sign_up_otp_email(self, *, body: SignUpOTPEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign up with email OTP

Register a new user account using email OTP authentication. Sends a one-time password to the specified email address.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.


Args:
    body (SignUpOTPEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_passwordless_email`

```python
async def sign_up_passwordless_email(self, *, body: SignUpPasswordlessEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign up with magic link email

Register a new user account using passwordless email authentication. Sends a magic link to the specified email address for verification.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.


Args:
    body (SignUpPasswordlessEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_passwordless_sms`

```python
async def sign_up_passwordless_sms(self, *, body: SignUpPasswordlessSmsRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign up with SMS OTP

Register a new user account using SMS OTP authentication. Sends a one-time password to the specified phone number.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.


Args:
    body (SignUpPasswordlessSmsRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_provider_url`

```python
def sign_up_provider_url(self, provider: SignInProvider, *, params: SignUpProviderParams | None = None) -> str
```

Sign up with OAuth provider

Initiate OAuth signup flow with the specified provider. Redirects to the provider's authorization page.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.
If the user already exists at callback time, they are redirected with `error=user-already-exists`.


Args:
    provider (SignInProvider): The name of the social provider
    params (SignUpProviderParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `sign_up_webauthn`

```python
async def sign_up_webauthn(self, *, body: SignUpWebauthnRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialCreationOptions]
```

Sign up with Webauthn

Initiate a Webauthn sign-up process by sending a challenge to the user's device. The user must not have an existing account.

Args:
    body (SignUpWebauthnRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialCreationOptions]: The HTTP response.

##### `token_exchange`

```python
async def token_exchange(self, *, body: TokenExchangeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Exchange authorization code for session

Exchange an authorization code (obtained via PKCE flow) together with the original code_verifier for a session containing access and refresh tokens.

Args:
    body (TokenExchangeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_add_security_key`

```python
async def verify_add_security_key(self, *, body: VerifyAddSecurityKeyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[VerifyAddSecurityKeyResponse]
```

Verify adding of a new webauthn security key

Complete the process of adding a new WebAuthn security key by verifying the authenticator response. Requires elevated permissions.

Args:
    body (VerifyAddSecurityKeyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[VerifyAddSecurityKeyResponse]: The HTTP response.

##### `verify_change_user_mfa`

```python
async def verify_change_user_mfa(self, *, body: UserMfaRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Manage multi-factor authentication

Activate or deactivate multi-factor authentication for the authenticated user

Args:
    body (UserMfaRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `verify_change_user_phone_number`

```python
async def verify_change_user_phone_number(self, *, body: UserPhoneNumberChangeVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Verify phone number change

Complete a previously-requested phone number change by submitting the OTP that was
sent via SMS. On success the staged phone number becomes the user's verified phone
number. Requires elevated permissions.


Args:
    body (UserPhoneNumberChangeVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `verify_elevate_webauthn`

```python
async def verify_elevate_webauthn(self, *, body: SignInWebauthnVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify FIDO2 Webauthn authentication using public-key cryptography for elevation

Complete Webauthn elevation by verifying the authentication response

Args:
    body (SignInWebauthnVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_sign_in_mfa_totp`

```python
async def verify_sign_in_mfa_totp(self, *, body: SignInMfaTotpRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify TOTP for MFA

Complete the multi-factor authentication by verifying a Time-based One-Time Password (TOTP). Returns a session if validation is successful.

Args:
    body (SignInMfaTotpRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_sign_in_otp_email`

```python
async def verify_sign_in_otp_email(self, *, body: SignInOTPEmailVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SignInOTPEmailVerifyResponse]
```

Verify email OTP

Complete email OTP authentication by verifying the one-time password. Returns a session if validation is successful.

Args:
    body (SignInOTPEmailVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SignInOTPEmailVerifyResponse]: The HTTP response.

##### `verify_sign_in_passwordless_sms`

```python
async def verify_sign_in_passwordless_sms(self, *, body: SignInPasswordlessSmsOtpRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SignInPasswordlessSmsOtpResponse]
```

Verify SMS OTP and complete authentication

Complete passwordless SMS authentication by verifying the one-time password and returning a session.

Args:
    body (SignInPasswordlessSmsOtpRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SignInPasswordlessSmsOtpResponse]: The HTTP response.

##### `verify_sign_in_webauthn`

```python
async def verify_sign_in_webauthn(self, *, body: SignInWebauthnVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify Webauthn sign-in

Complete the Webauthn sign-in process by verifying the response from the user's device. Returns a session if validation is successful.

Args:
    body (SignInWebauthnVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_sign_up_webauthn`

```python
async def verify_sign_up_webauthn(self, *, body: SignUpWebauthnVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify Webauthn sign-up

Complete the Webauthn sign-up process by verifying the response from the user's device. Returns a session if validation is successful.

Args:
    body (SignUpWebauthnVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_ticket_url`

```python
def verify_ticket_url(self, *, params: VerifyTicketParams) -> str
```

Verify email and authentication tickets

Verify tickets created by email verification, magic link authentication, or password reset processes. Redirects the user to the appropriate destination upon successful verification.

Args:
    params (VerifyTicketParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `verify_token`

```python
async def verify_token(self, *, body: VerifyTokenRequest | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[str]
```

Verify JWT token

Verify the validity of a JWT access token. If no request body is provided, the Authorization header will be used for verification.

Args:
    body (VerifyTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[str]: The HTTP response.

### `AuthenticationExtensionsClientOutputs`

```python
class AuthenticationExtensionsClientOutputs(BaseModel):
```

Map of extension outputs from the client

#### Fields

| Field | Type |
| --- | --- |
| `appid` | `bool \| None` |
| `cred_props` | `CredentialPropertiesOutput \| None` |
| `hmac_create_secret` | `bool \| None` |

### `AuthenticatorAssertionResponse`

```python
class AuthenticatorAssertionResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `client_data_json` | `str` |
| `authenticator_data` | `str` |
| `signature` | `str` |
| `user_handle` | `str \| None` |

### `AuthenticatorAttestationResponse`

```python
class AuthenticatorAttestationResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `client_data_json` | `str` |
| `transports` | `list[str] \| None` |
| `authenticator_data` | `str \| None` |
| `public_key` | `str \| None` |
| `public_key_algorithm` | `int \| None` |
| `attestation_object` | `str` |

### `AuthenticatorSelection`

```python
class AuthenticatorSelection(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `authenticator_attachment` | `AuthenticatorAttachment \| None` |
| `require_resident_key` | `bool \| None` |
| `resident_key` | `ResidentKeyRequirement \| None` |
| `user_verification` | `UserVerificationRequirement \| None` |

### `Client`

```python
class Client:
    def __init__(base_url: str, *, middleware: Sequence[Middleware] = (), http_client: httpx.AsyncClient | None = None) -> None
```

Generated async API client backed by an httpx.AsyncClient and a middleware chain.

#### Methods

##### `aclose`

```python
async def aclose(self) -> None
```

Close the internally owned HTTP client, if any.

##### `add_middleware`

```python
def add_middleware(self, middleware: Middleware) -> None
```

Append HTTP middleware and rebuild the request pipeline.

##### `add_security_key`

```python
async def add_security_key(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialCreationOptions]
```

Initialize adding of a new webauthn security key

Start the process of adding a new WebAuthn security key to the user's account. Returns a challenge that must be completed by the user's authenticator device. Requires elevated permissions.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialCreationOptions]: The HTTP response.

##### `change_user_email`

```python
async def change_user_email(self, *, body: UserEmailChangeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Change user email

Request to change the authenticated user's email address. A verification email will be sent to the new address to confirm the change. Requires elevated permissions.

Args:
    body (UserEmailChangeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `change_user_mfa`

```python
async def change_user_mfa(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[TotpGenerateResponse]
```

Generate TOTP secret

Generate a Time-based One-Time Password (TOTP) secret for setting up multi-factor authentication

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[TotpGenerateResponse]: The HTTP response.

##### `change_user_password`

```python
async def change_user_password(self, *, body: UserPasswordRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Change user password

Change the user's password. The user must be authenticated with elevated permissions or provide a valid password reset ticket.

All of the user's existing sessions are revoked atomically as part of this operation, including the session used to make the request. Clients must treat the user as signed out after a successful response and obtain a new session via sign-in.


Args:
    body (UserPasswordRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `change_user_phone_number`

```python
async def change_user_phone_number(self, *, body: UserPhoneNumberChangeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Change user phone number

Request to change the authenticated user's phone number. A one-time password is sent
via SMS to the new phone number; complete the change by calling
`/user/phone-number/change/verify` with the OTP. The current `phone_number` is left
unchanged until verification succeeds. Requires elevated permissions.


Args:
    body (UserPhoneNumberChangeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `create_pat`

```python
async def create_pat(self, *, body: CreatePATRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[CreatePATResponse]
```

Create a Personal Access Token (PAT)

Generate a new Personal Access Token for programmatic API access. PATs are long-lived tokens that can be used instead of regular authentication for automated systems. Requires elevated permissions.

Args:
    body (CreatePATRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[CreatePATResponse]: The HTTP response.

##### `deanonymize_user`

```python
async def deanonymize_user(self, *, body: UserDeanonymizeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Deanonymize an anonymous user

Convert an anonymous user to a regular user by adding email and optionally password credentials. A confirmation email will be sent if the server is configured to do so.

Args:
    body (UserDeanonymizeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `deanonymize_user_sms`

```python
async def deanonymize_user_sms(self, *, body: UserDeanonymizeSmsRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Deanonymize an anonymous user with SMS OTP

Convert an anonymous user to a regular user by adding a phone number. A one-time password is sent to the
phone number; the user completes verification by calling `/signin/passwordless/sms/otp` with the OTP, which
marks the phone number as verified and returns a session.


Args:
    body (UserDeanonymizeSmsRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `elevate_webauthn`

```python
async def elevate_webauthn(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialRequestOptions]
```

Elevate access for an already signed in user using FIDO2 Webauthn

Generate a Webauthn challenge for elevating user permissions

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialRequestOptions]: The HTTP response.

##### `get_jw_ks`

```python
async def get_jw_ks(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[JWKSet]
```

Get public keys for JWT verification in JWK Set format

Retrieve the JSON Web Key Set (JWKS) containing public keys used to verify JWT signatures. This endpoint is used by clients to validate access tokens.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[JWKSet]: The HTTP response.

##### `get_o_auth_authorization_server`

```python
async def get_o_auth_authorization_server(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2DiscoveryResponse]
```

OAuth2 Authorization Server Metadata

Returns the Authorization Server Metadata (RFC 8414). Same content as OpenID Discovery.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2DiscoveryResponse]: The HTTP response.

##### `get_open_id_configuration`

```python
async def get_open_id_configuration(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2DiscoveryResponse]
```

OpenID Connect Discovery

Returns the OpenID Provider Metadata (RFC 8414)

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2DiscoveryResponse]: The HTTP response.

##### `get_provider_tokens`

```python
async def get_provider_tokens(self, provider: SignInProvider, *, headers: Mapping[str, str] | None = None) -> FetchResponse[ProviderSession]
```

Retrieve OAuth2 provider tokens from callback

After successful OAuth2 authentication, retrieve the provider session containing access token, refresh token, and expiration information for the specified provider. To ensure the data isn't stale this endpoint must be called immediately after the OAuth callback to obtain the tokens. The session is cleared from the database during this call, so subsequent calls will fail without going through the sign-in flow again. It is the user's responsibility to store the session safely (e.g., in browser local storage).

Args:
    provider (SignInProvider): The name of the social provider
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ProviderSession]: The HTTP response.

##### `get_user`

```python
async def get_user(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[User]
```

Get user information

Retrieve the authenticated user's profile information including roles, metadata, and account status.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[User]: The HTTP response.

##### `get_version`

```python
async def get_version(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[GetVersionResponse200]
```

Get service version

Retrieve version information about the authentication service

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[GetVersionResponse200]: The HTTP response.

##### `health_check_get`

```python
async def health_check_get(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Health check (GET)

Verify if the authentication service is operational using GET method

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `health_check_head`

```python
async def health_check_head(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[None]
```

Health check (HEAD)

Verify if the authentication service is operational using HEAD method

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[None]: The HTTP response.

##### `link_id_token`

```python
async def link_id_token(self, *, body: LinkIdTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Link a user account with the provider's account using an id token

Link the authenticated user's account with an external OAuth provider account using an ID token. Requires elevated permissions.

Args:
    body (LinkIdTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `oauth2_authorize_post_url`

```python
def oauth2_authorize_post_url(self) -> str
```

OAuth2 Authorization Endpoint (POST)

Initiates an OAuth2 authorization code flow via POST. Validates the request and redirects to the login UI for user authentication and consent.

Returns:
    str: The redirect URL.

##### `oauth2_authorize_url`

```python
def oauth2_authorize_url(self, *, params: Oauth2AuthorizeParams) -> str
```

OAuth2 Authorization Endpoint

Initiates an OAuth2 authorization code flow. Validates the request and redirects to the login UI for user authentication and consent.

Args:
    params (Oauth2AuthorizeParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `oauth2_introspect`

```python
async def oauth2_introspect(self, *, body: OAuth2IntrospectRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2IntrospectResponse]
```

OAuth2 Token Introspection (RFC 7662)

Introspect a token to determine its current state and metadata.

Args:
    body (OAuth2IntrospectRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2IntrospectResponse]: The HTTP response.

##### `oauth2_jwks`

```python
async def oauth2_jwks(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2JWKSResponse]
```

OAuth2 Provider JWKS Endpoint

Returns the JSON Web Key Set containing public keys used for OAuth2/OIDC token signing.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2JWKSResponse]: The HTTP response.

##### `oauth2_login_get`

```python
async def oauth2_login_get(self, *, params: Oauth2LoginGetParams, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2LoginResponse]
```

Get authorization request details for consent screen

Called by the consent UI to get details about the pending authorization request.

Args:
    params (Oauth2LoginGetParams): Query and header parameters.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2LoginResponse]: The HTTP response.

##### `oauth2_login_post`

```python
async def oauth2_login_post(self, *, body: OAuth2LoginRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2LoginCompleteResponse]
```

Complete login/consent for an authorization request

Called by the consent UI after user authenticates and consents. Sets the user on the auth request and redirects back to the client with an authorization code.

Args:
    body (OAuth2LoginRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2LoginCompleteResponse]: The HTTP response.

##### `oauth2_revoke`

```python
async def oauth2_revoke(self, *, body: OAuth2RevokeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[None]
```

OAuth2 Token Revocation (RFC 7009)

Revoke an access token or refresh token.

Args:
    body (OAuth2RevokeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[None]: The HTTP response.

##### `oauth2_token`

```python
async def oauth2_token(self, *, body: OAuth2TokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2TokenResponse]
```

OAuth2 Token Endpoint

Exchange an authorization code for tokens, or refresh an existing token. Supports grant_type authorization_code and refresh_token.

Args:
    body (OAuth2TokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2TokenResponse]: The HTTP response.

##### `oauth2_userinfo_get`

```python
async def oauth2_userinfo_get(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2UserinfoResponse]
```

OpenID Connect UserInfo Endpoint (GET)

Returns claims about the authenticated user based on the access token scopes.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2UserinfoResponse]: The HTTP response.

##### `oauth2_userinfo_post`

```python
async def oauth2_userinfo_post(self, *, headers: Mapping[str, str] | None = None) -> FetchResponse[OAuth2UserinfoResponse]
```

OpenID Connect UserInfo Endpoint (POST)

Returns claims about the authenticated user based on the access token scopes.

Args:
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OAuth2UserinfoResponse]: The HTTP response.

##### `refresh_provider_token`

```python
async def refresh_provider_token(self, provider: SignInProvider, *, body: RefreshProviderTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[ProviderSession]
```

Refresh OAuth2 provider tokens

Refresh the OAuth2 provider access token using a valid refresh token. Returns a new provider session with updated access token, refresh token (if rotated by provider), and expiration information. This endpoint allows maintaining long-lived access to provider APIs without requiring the user to re-authenticate.

Args:
    provider (SignInProvider): The name of the social provider
    body (RefreshProviderTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[ProviderSession]: The HTTP response.

##### `refresh_token`

```python
async def refresh_token(self, *, body: RefreshTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[Session]
```

Refresh access token

Generate a new JWT access token using a valid refresh token. The refresh token used will be revoked and a new one will be issued.

Args:
    body (RefreshTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[Session]: The HTTP response.

##### `send_password_reset_email`

```python
async def send_password_reset_email(self, *, body: UserPasswordResetRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Request password reset

Request a password reset for a user account. An email with a verification link will be sent to the user's email address to complete the password reset process.

Args:
    body (UserPasswordResetRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `send_verification_email`

```python
async def send_verification_email(self, *, body: UserEmailSendVerificationEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Send verification email

Send an email verification link to the specified email address. Used to verify email addresses for new accounts or email changes.

Args:
    body (UserEmailSendVerificationEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_anonymous`

```python
async def sign_in_anonymous(self, *, body: SignInAnonymousRequest | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign in anonymously

Create an anonymous user session without providing credentials. Anonymous users can be converted to regular users later via the deanonymize endpoint.
This endpoint always creates a new user and is **not** gated by `AUTH_DISABLE_AUTO_SIGNUP`; it is controlled by `AUTH_DISABLE_SIGNUP` and `AUTH_ANONYMOUS_USERS_ENABLED`.


Args:
    body (SignInAnonymousRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_in_email_password`

```python
async def sign_in_email_password(self, *, body: SignInEmailPasswordRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SignInEmailPasswordResponse]
```

Sign in with email and password

Authenticate a user with their email and password. Returns a session object or MFA challenge if two-factor authentication is enabled.

Args:
    body (SignInEmailPasswordRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SignInEmailPasswordResponse]: The HTTP response.

##### `sign_in_id_token`

```python
async def sign_in_id_token(self, *, body: SignInIdTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign in with an ID token

Authenticate using an ID token from a supported OAuth provider (Apple or Google).
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/idtoken` endpoint to register first.


Args:
    body (SignInIdTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_in_otp_email`

```python
async def sign_in_otp_email(self, *, body: SignInOTPEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign in with email OTP

Initiate email-based one-time password authentication. Sends an OTP to the specified email address.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created with the provided options.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/otp/email` endpoint to register first.


Args:
    body (SignInOTPEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_passwordless_email`

```python
async def sign_in_passwordless_email(self, *, body: SignInPasswordlessEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign in with magic link email

Initiate passwordless authentication by sending a magic link to the user's email.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created with the provided options.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/passwordless/email` endpoint to register first.


Args:
    body (SignInPasswordlessEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_passwordless_sms`

```python
async def sign_in_passwordless_sms(self, *, body: SignInPasswordlessSmsRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign in with SMS OTP

Initiate passwordless authentication by sending a one-time password to the user's phone number.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created with the provided options.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/passwordless/sms` endpoint to register first.


Args:
    body (SignInPasswordlessSmsRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_in_pat`

```python
async def sign_in_pat(self, *, body: SignInPATRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign in with Personal Access Token (PAT)

Authenticate using a Personal Access Token. PATs are long-lived tokens that can be used for programmatic access to the API.

Args:
    body (SignInPATRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_in_provider_url`

```python
def sign_in_provider_url(self, provider: SignInProvider, *, params: SignInProviderParams | None = None) -> str
```

Sign in with an OAuth2 provider

Initiate OAuth2 authentication flow with a social provider. Redirects the user to the provider's authorization page.
If the user doesn't exist and `AUTH_DISABLE_AUTO_SIGNUP` is not set, a new account will be created upon callback.
When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, users must use the `/signup/provider/{provider}` endpoint to register first.


Args:
    provider (SignInProvider): The name of the social provider
    params (SignInProviderParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `sign_in_webauthn`

```python
async def sign_in_webauthn(self, *, body: SignInWebauthnRequest | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialRequestOptions]
```

Sign in with Webauthn

Initiate a Webauthn sign-in process by sending a challenge to the user's device. The user must have previously registered a Webauthn credential.

Args:
    body (SignInWebauthnRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialRequestOptions]: The HTTP response.

##### `sign_out`

```python
async def sign_out(self, *, body: SignOutRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign out

End the current user session by invalidating refresh tokens. Optionally sign out from all devices.

Args:
    body (SignOutRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_email_password`

```python
async def sign_up_email_password(self, *, body: SignUpEmailPasswordRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign up with email and password

Register a new user account with email and password. Returns a session if email verification is not required, otherwise returns null session.

Args:
    body (SignUpEmailPasswordRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_up_id_token`

```python
async def sign_up_id_token(self, *, body: SignUpIdTokenRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Sign up with ID token

Register a new user account using an ID token from Apple or Google.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.
If the user already exists, a `user-already-exists` error is returned.


Args:
    body (SignUpIdTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `sign_up_otp_email`

```python
async def sign_up_otp_email(self, *, body: SignUpOTPEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign up with email OTP

Register a new user account using email OTP authentication. Sends a one-time password to the specified email address.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.


Args:
    body (SignUpOTPEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_passwordless_email`

```python
async def sign_up_passwordless_email(self, *, body: SignUpPasswordlessEmailRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign up with magic link email

Register a new user account using passwordless email authentication. Sends a magic link to the specified email address for verification.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.


Args:
    body (SignUpPasswordlessEmailRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_passwordless_sms`

```python
async def sign_up_passwordless_sms(self, *, body: SignUpPasswordlessSmsRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Sign up with SMS OTP

Register a new user account using SMS OTP authentication. Sends a one-time password to the specified phone number.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.


Args:
    body (SignUpPasswordlessSmsRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `sign_up_provider_url`

```python
def sign_up_provider_url(self, provider: SignInProvider, *, params: SignUpProviderParams | None = None) -> str
```

Sign up with OAuth provider

Initiate OAuth signup flow with the specified provider. Redirects to the provider's authorization page.
Use this endpoint to explicitly register a new account. When `AUTH_DISABLE_AUTO_SIGNUP` is enabled, this is the only way to register through this method.
If the user already exists at callback time, they are redirected with `error=user-already-exists`.


Args:
    provider (SignInProvider): The name of the social provider
    params (SignUpProviderParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `sign_up_webauthn`

```python
async def sign_up_webauthn(self, *, body: SignUpWebauthnRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[PublicKeyCredentialCreationOptions]
```

Sign up with Webauthn

Initiate a Webauthn sign-up process by sending a challenge to the user's device. The user must not have an existing account.

Args:
    body (SignUpWebauthnRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[PublicKeyCredentialCreationOptions]: The HTTP response.

##### `token_exchange`

```python
async def token_exchange(self, *, body: TokenExchangeRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Exchange authorization code for session

Exchange an authorization code (obtained via PKCE flow) together with the original code_verifier for a session containing access and refresh tokens.

Args:
    body (TokenExchangeRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_add_security_key`

```python
async def verify_add_security_key(self, *, body: VerifyAddSecurityKeyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[VerifyAddSecurityKeyResponse]
```

Verify adding of a new webauthn security key

Complete the process of adding a new WebAuthn security key by verifying the authenticator response. Requires elevated permissions.

Args:
    body (VerifyAddSecurityKeyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[VerifyAddSecurityKeyResponse]: The HTTP response.

##### `verify_change_user_mfa`

```python
async def verify_change_user_mfa(self, *, body: UserMfaRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Manage multi-factor authentication

Activate or deactivate multi-factor authentication for the authenticated user

Args:
    body (UserMfaRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `verify_change_user_phone_number`

```python
async def verify_change_user_phone_number(self, *, body: UserPhoneNumberChangeVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[OKResponse]
```

Verify phone number change

Complete a previously-requested phone number change by submitting the OTP that was
sent via SMS. On success the staged phone number becomes the user's verified phone
number. Requires elevated permissions.


Args:
    body (UserPhoneNumberChangeVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[OKResponse]: The HTTP response.

##### `verify_elevate_webauthn`

```python
async def verify_elevate_webauthn(self, *, body: SignInWebauthnVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify FIDO2 Webauthn authentication using public-key cryptography for elevation

Complete Webauthn elevation by verifying the authentication response

Args:
    body (SignInWebauthnVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_sign_in_mfa_totp`

```python
async def verify_sign_in_mfa_totp(self, *, body: SignInMfaTotpRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify TOTP for MFA

Complete the multi-factor authentication by verifying a Time-based One-Time Password (TOTP). Returns a session if validation is successful.

Args:
    body (SignInMfaTotpRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_sign_in_otp_email`

```python
async def verify_sign_in_otp_email(self, *, body: SignInOTPEmailVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SignInOTPEmailVerifyResponse]
```

Verify email OTP

Complete email OTP authentication by verifying the one-time password. Returns a session if validation is successful.

Args:
    body (SignInOTPEmailVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SignInOTPEmailVerifyResponse]: The HTTP response.

##### `verify_sign_in_passwordless_sms`

```python
async def verify_sign_in_passwordless_sms(self, *, body: SignInPasswordlessSmsOtpRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SignInPasswordlessSmsOtpResponse]
```

Verify SMS OTP and complete authentication

Complete passwordless SMS authentication by verifying the one-time password and returning a session.

Args:
    body (SignInPasswordlessSmsOtpRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SignInPasswordlessSmsOtpResponse]: The HTTP response.

##### `verify_sign_in_webauthn`

```python
async def verify_sign_in_webauthn(self, *, body: SignInWebauthnVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify Webauthn sign-in

Complete the Webauthn sign-in process by verifying the response from the user's device. Returns a session if validation is successful.

Args:
    body (SignInWebauthnVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_sign_up_webauthn`

```python
async def verify_sign_up_webauthn(self, *, body: SignUpWebauthnVerifyRequest, headers: Mapping[str, str] | None = None) -> FetchResponse[SessionPayload]
```

Verify Webauthn sign-up

Complete the Webauthn sign-up process by verifying the response from the user's device. Returns a session if validation is successful.

Args:
    body (SignUpWebauthnVerifyRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[SessionPayload]: The HTTP response.

##### `verify_ticket_url`

```python
def verify_ticket_url(self, *, params: VerifyTicketParams) -> str
```

Verify email and authentication tickets

Verify tickets created by email verification, magic link authentication, or password reset processes. Redirects the user to the appropriate destination upon successful verification.

Args:
    params (VerifyTicketParams): Query and header parameters.

Returns:
    str: The redirect URL.

##### `verify_token`

```python
async def verify_token(self, *, body: VerifyTokenRequest | None = None, headers: Mapping[str, str] | None = None) -> FetchResponse[str]
```

Verify JWT token

Verify the validity of a JWT access token. If no request body is provided, the Authorization header will be used for verification.

Args:
    body (VerifyTokenRequest): Request body.
    headers (Mapping[str, str] | None): Additional request headers.

Returns:
    FetchResponse[str]: The HTTP response.

### `CreatePATRequest`

```python
class CreatePATRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `expires_at` | `datetime` |
| `metadata` | `dict[str, Any] \| None` |

### `CreatePATResponse`

```python
class CreatePATResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `personal_access_token` | `str` |

### `CredentialAssertionResponse`

```python
class CredentialAssertionResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `type` | `str` |
| `raw_id` | `str` |
| `client_extension_results` | `AuthenticationExtensionsClientOutputs \| None` |
| `authenticator_attachment` | `str \| None` |
| `response` | `AuthenticatorAssertionResponse` |

### `CredentialCreationResponse`

```python
class CredentialCreationResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `type` | `str` |
| `raw_id` | `str` |
| `client_extension_results` | `AuthenticationExtensionsClientOutputs \| None` |
| `authenticator_attachment` | `str \| None` |
| `response` | `AuthenticatorAttestationResponse` |

### `CredentialParameter`

```python
class CredentialParameter(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `type` | `CredentialType` |
| `alg` | `int` |

### `CredentialPropertiesOutput`

```python
class CredentialPropertiesOutput(BaseModel):
```

Credential properties extension output

#### Fields

| Field | Type |
| --- | --- |
| `rk` | `bool \| None` |

### `ErrorResponse`

```python
class ErrorResponse(BaseModel):
```

Standardized error response

#### Fields

| Field | Type |
| --- | --- |
| `status` | `int` |
| `message` | `str` |
| `error` | `ErrorResponseError` |

### `GetVersionResponse200`

```python
class GetVersionResponse200(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `version` | `str` |

### `JWK`

```python
class JWK(BaseModel):
```

JSON Web Key for JWT verification

#### Fields

| Field | Type |
| --- | --- |
| `alg` | `str` |
| `e` | `str` |
| `kid` | `str` |
| `kty` | `str` |
| `n` | `str` |
| `use` | `str` |

### `JWKSet`

```python
class JWKSet(BaseModel):
```

JSON Web Key Set for verifying JWT signatures

#### Fields

| Field | Type |
| --- | --- |
| `keys` | `list[JWK]` |

### `LinkIdTokenRequest`

```python
class LinkIdTokenRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `provider` | `IdTokenProvider` |
| `id_token` | `str` |
| `nonce` | `str \| None` |

### `MFAChallengePayload`

```python
class MFAChallengePayload(BaseModel):
```

Challenge payload for multi-factor authentication

#### Fields

| Field | Type |
| --- | --- |
| `ticket` | `str` |

### `OAuth2DiscoveryResponse`

```python
class OAuth2DiscoveryResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `issuer` | `str` |
| `authorization_endpoint` | `str` |
| `token_endpoint` | `str` |
| `userinfo_endpoint` | `str \| None` |
| `jwks_uri` | `str` |
| `revocation_endpoint` | `str \| None` |
| `introspection_endpoint` | `str \| None` |
| `scopes_supported` | `list[str] \| None` |
| `response_types_supported` | `list[str]` |
| `grant_types_supported` | `list[str] \| None` |
| `subject_types_supported` | `list[str] \| None` |
| `id_token_signing_alg_values_supported` | `list[str] \| None` |
| `token_endpoint_auth_methods_supported` | `list[str] \| None` |
| `code_challenge_methods_supported` | `list[str] \| None` |
| `claims_supported` | `list[str] \| None` |
| `request_parameter_supported` | `bool \| None` |
| `authorization_response_iss_parameter_supported` | `bool \| None` |
| `client_id_metadata_document_supported` | `bool \| None` |

### `OAuth2ErrorResponse`

```python
class OAuth2ErrorResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `error` | `str` |
| `error_description` | `str \| None` |

### `OAuth2IntrospectRequest`

```python
class OAuth2IntrospectRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `token` | `str` |
| `token_type_hint` | `OAuth2IntrospectRequestTokenTypeHint \| None` |
| `client_id` | `str \| None` |
| `client_secret` | `str \| None` |

### `OAuth2IntrospectResponse`

```python
class OAuth2IntrospectResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `active` | `bool` |
| `scope` | `str \| None` |
| `client_id` | `str \| None` |
| `sub` | `str \| None` |
| `exp` | `int \| None` |
| `iat` | `int \| None` |
| `iss` | `str \| None` |
| `token_type` | `str \| None` |

### `OAuth2JWKSResponse`

```python
class OAuth2JWKSResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `keys` | `list[JWK]` |

### `OAuth2LoginCompleteResponse`

```python
class OAuth2LoginCompleteResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `redirect_uri` | `str` |

### `OAuth2LoginRequest`

```python
class OAuth2LoginRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `request_id` | `UUID` |

### `OAuth2LoginResponse`

```python
class OAuth2LoginResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `request_id` | `UUID` |
| `client_id` | `str` |
| `scopes` | `list[str]` |
| `redirect_uri` | `str` |

### `OAuth2RevokeRequest`

```python
class OAuth2RevokeRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `token` | `str` |
| `token_type_hint` | `OAuth2RevokeRequestTokenTypeHint \| None` |
| `client_id` | `str \| None` |
| `client_secret` | `str \| None` |

### `OAuth2TokenRequest`

```python
class OAuth2TokenRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `grant_type` | `OAuth2TokenRequestGrantType` |
| `code` | `str \| None` |
| `redirect_uri` | `str \| None` |
| `client_id` | `str \| None` |
| `client_secret` | `str \| None` |
| `code_verifier` | `str \| None` |
| `refresh_token` | `str \| None` |
| `resource` | `str \| None` |

### `OAuth2TokenResponse`

```python
class OAuth2TokenResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `token_type` | `str` |
| `expires_in` | `int` |
| `refresh_token` | `str \| None` |
| `id_token` | `str \| None` |
| `scope` | `str \| None` |

### `OAuth2UserinfoResponse`

```python
class OAuth2UserinfoResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `sub` | `str` |
| `name` | `str \| None` |
| `email` | `str \| None` |
| `email_verified` | `bool \| None` |
| `picture` | `str \| None` |
| `locale` | `str \| None` |
| `phone_number` | `str \| None` |
| `phone_number_verified` | `bool \| None` |

### `Oauth2AuthorizeParams`

```python
class Oauth2AuthorizeParams(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `client_id` | `str` |
| `redirect_uri` | `str` |
| `response_type` | `str` |
| `scope` | `str \| None` |
| `state` | `str \| None` |
| `nonce` | `str \| None` |
| `code_challenge` | `str \| None` |
| `code_challenge_method` | `GetCodeChallengeMethod \| None` |
| `resource` | `str \| None` |
| `prompt` | `str \| None` |

### `Oauth2AuthorizePostBody`

```python
class Oauth2AuthorizePostBody(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `client_id` | `str` |
| `redirect_uri` | `str` |
| `response_type` | `str` |
| `scope` | `str \| None` |
| `state` | `str \| None` |
| `nonce` | `str \| None` |
| `code_challenge` | `str \| None` |
| `code_challenge_method` | `str \| None` |
| `resource` | `str \| None` |
| `prompt` | `str \| None` |

### `Oauth2LoginGetParams`

```python
class Oauth2LoginGetParams(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `request_id` | `UUID` |

### `OptionsRedirectTo`

```python
class OptionsRedirectTo(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `redirect_to` | `str \| None` |

### `PKCEPair`

```python
class PKCEPair(tuple):
```

A PKCE code verifier and its derived S256 challenge.

#### Fields

| Field | Type |
| --- | --- |
| `verifier` | `str` |
| `challenge` | `str` |

### `ProviderSession`

```python
class ProviderSession(BaseModel):
```

OAuth2 provider session containing access and refresh tokens

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `expires_in` | `int` |
| `expires_at` | `datetime` |
| `refresh_token` | `str \| None` |

### `ProviderSpecificParams`

```python
class ProviderSpecificParams(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `connection` | `str \| None` |
| `organization` | `str \| None` |

### `PublicKeyCredentialCreationOptions`

```python
class PublicKeyCredentialCreationOptions(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `rp` | `RelyingPartyEntity` |
| `user` | `UserEntity` |
| `challenge` | `str` |
| `pub_key_cred_params` | `list[CredentialParameter]` |
| `timeout` | `int \| None` |
| `exclude_credentials` | `list[PublicKeyCredentialDescriptor] \| None` |
| `authenticator_selection` | `AuthenticatorSelection \| None` |
| `hints` | `list[PublicKeyCredentialHints] \| None` |
| `attestation` | `ConveyancePreference \| None` |
| `attestation_formats` | `list[AttestationFormat] \| None` |
| `extensions` | `dict[str, Any] \| None` |

### `PublicKeyCredentialDescriptor`

```python
class PublicKeyCredentialDescriptor(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `type` | `CredentialType` |
| `id` | `str` |
| `transports` | `list[AuthenticatorTransport] \| None` |

### `PublicKeyCredentialRequestOptions`

```python
class PublicKeyCredentialRequestOptions(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `challenge` | `str` |
| `timeout` | `int \| None` |
| `rp_id` | `str \| None` |
| `allow_credentials` | `list[PublicKeyCredentialDescriptor] \| None` |
| `user_verification` | `UserVerificationRequirement \| None` |
| `hints` | `list[PublicKeyCredentialHints] \| None` |
| `extensions` | `dict[str, Any] \| None` |

### `RefreshProviderTokenRequest`

```python
class RefreshProviderTokenRequest(BaseModel):
```

Request to refresh OAuth2 provider tokens

#### Fields

| Field | Type |
| --- | --- |
| `refresh_token` | `str` |

### `RefreshTokenRequest`

```python
class RefreshTokenRequest(BaseModel):
```

Request to refresh an access token

#### Fields

| Field | Type |
| --- | --- |
| `refresh_token` | `str` |

### `RelyingPartyEntity`

```python
class RelyingPartyEntity(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `name` | `str` |
| `id` | `str` |

### `Session`

```python
class Session(BaseModel):
```

User authentication session containing tokens and user information

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `access_token_expires_in` | `int` |
| `refresh_token_id` | `str` |
| `refresh_token` | `str` |
| `user` | `User \| None` |

### `SessionPayload`

```python
class SessionPayload(BaseModel):
```

Container for session information

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session \| None` |

### `SignInAnonymousRequest`

```python
class SignInAnonymousRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `display_name` | `str \| None` |
| `locale` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |

### `SignInEmailPasswordRequest`

```python
class SignInEmailPasswordRequest(BaseModel):
```

Request to authenticate using email and password

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `password` | `str` |

### `SignInEmailPasswordResponse`

```python
class SignInEmailPasswordResponse(BaseModel):
```

Response for email-password authentication that may include a session or MFA challenge

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session \| None` |
| `mfa` | `MFAChallengePayload \| None` |

### `SignInIdTokenRequest`

```python
class SignInIdTokenRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `provider` | `IdTokenProvider` |
| `id_token` | `str` |
| `nonce` | `str \| None` |
| `options` | `SignUpOptions \| None` |

### `SignInMfaTotpRequest`

```python
class SignInMfaTotpRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `ticket` | `str` |
| `otp` | `str` |

### `SignInOTPEmailRequest`

```python
class SignInOTPEmailRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions \| None` |

### `SignInOTPEmailVerifyRequest`

```python
class SignInOTPEmailVerifyRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `otp` | `str` |
| `email` | `str` |

### `SignInOTPEmailVerifyResponse`

```python
class SignInOTPEmailVerifyResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session \| None` |

### `SignInPATRequest`

```python
class SignInPATRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `personal_access_token` | `str` |

### `SignInPasswordlessEmailRequest`

```python
class SignInPasswordlessEmailRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions \| None` |
| `code_challenge` | `str \| None` |

### `SignInPasswordlessSmsOtpRequest`

```python
class SignInPasswordlessSmsOtpRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `otp` | `str` |

### `SignInPasswordlessSmsOtpResponse`

```python
class SignInPasswordlessSmsOtpResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session \| None` |
| `mfa` | `MFAChallengePayload \| None` |

### `SignInPasswordlessSmsRequest`

```python
class SignInPasswordlessSmsRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `options` | `SignUpOptions \| None` |

### `SignInProviderParams`

```python
class SignInProviderParams(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `allowed_roles` | `list[str] \| None` |
| `default_role` | `str \| None` |
| `display_name` | `str \| None` |
| `locale` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |
| `redirect_to` | `str \| None` |
| `connect` | `str \| None` |
| `state` | `str \| None` |
| `provider_specific_params` | `ProviderSpecificParams \| None` |
| `upstream_params` | `dict[str, Any] \| None` |
| `code_challenge` | `str \| None` |

### `SignInWebauthnRequest`

```python
class SignInWebauthnRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str \| None` |

### `SignInWebauthnVerifyRequest`

```python
class SignInWebauthnVerifyRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str \| None` |
| `credential` | `CredentialAssertionResponse` |

### `SignOutRequest`

```python
class SignOutRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `refresh_token` | `str \| None` |
| `all` | `bool \| None` |

### `SignUpEmailPasswordRequest`

```python
class SignUpEmailPasswordRequest(BaseModel):
```

Request to register a new user with email and password

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `password` | `str` |
| `options` | `SignUpOptions \| None` |
| `code_challenge` | `str \| None` |

### `SignUpIdTokenRequest`

```python
class SignUpIdTokenRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `provider` | `IdTokenProvider` |
| `id_token` | `str` |
| `nonce` | `str \| None` |
| `options` | `SignUpOptions \| None` |

### `SignUpOTPEmailRequest`

```python
class SignUpOTPEmailRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions \| None` |

### `SignUpOptions`

```python
class SignUpOptions(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `allowed_roles` | `list[str] \| None` |
| `default_role` | `str \| None` |
| `display_name` | `str \| None` |
| `locale` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |
| `redirect_to` | `str \| None` |

### `SignUpPasswordlessEmailRequest`

```python
class SignUpPasswordlessEmailRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions \| None` |
| `code_challenge` | `str \| None` |

### `SignUpPasswordlessSmsRequest`

```python
class SignUpPasswordlessSmsRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `options` | `SignUpOptions \| None` |

### `SignUpProviderParams`

```python
class SignUpProviderParams(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `allowed_roles` | `list[str] \| None` |
| `default_role` | `str \| None` |
| `display_name` | `str \| None` |
| `locale` | `str \| None` |
| `metadata` | `dict[str, Any] \| None` |
| `redirect_to` | `str \| None` |
| `state` | `str \| None` |
| `provider_specific_params` | `ProviderSpecificParams \| None` |
| `upstream_params` | `dict[str, Any] \| None` |
| `code_challenge` | `str \| None` |

### `SignUpWebauthnRequest`

```python
class SignUpWebauthnRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions \| None` |

### `SignUpWebauthnVerifyRequest`

```python
class SignUpWebauthnVerifyRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `credential` | `CredentialCreationResponse` |
| `options` | `SignUpOptions \| None` |
| `nickname` | `str \| None` |
| `code_challenge` | `str \| None` |

### `TokenExchangeRequest`

```python
class TokenExchangeRequest(BaseModel):
```

Request to exchange an authorization code for a session using PKCE

#### Fields

| Field | Type |
| --- | --- |
| `code` | `str` |
| `code_verifier` | `str` |

### `TotpGenerateResponse`

```python
class TotpGenerateResponse(BaseModel):
```

Response containing TOTP setup information for MFA

#### Fields

| Field | Type |
| --- | --- |
| `image_url` | `str` |
| `totp_secret` | `str` |

### `User`

```python
class User(BaseModel):
```

User profile and account information

#### Fields

| Field | Type |
| --- | --- |
| `avatar_url` | `str` |
| `created_at` | `datetime` |
| `default_role` | `str` |
| `display_name` | `str` |
| `email` | `str \| None` |
| `email_verified` | `bool` |
| `id` | `str` |
| `is_anonymous` | `bool` |
| `locale` | `str` |
| `metadata` | `dict[str, Any] \| None` |
| `phone_number` | `str \| None` |
| `phone_number_verified` | `bool` |
| `roles` | `list[str]` |
| `active_mfa_type` | `str \| None` |

### `UserDeanonymizeRequest`

```python
class UserDeanonymizeRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `sign_in_method` | `UserDeanonymizeRequestSignInMethod` |
| `email` | `str` |
| `password` | `str \| None` |
| `connection` | `str \| None` |
| `options` | `SignUpOptions \| None` |
| `code_challenge` | `str \| None` |

### `UserDeanonymizeSmsRequest`

```python
class UserDeanonymizeSmsRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `options` | `SignUpOptions \| None` |

### `UserEmailChangeRequest`

```python
class UserEmailChangeRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `new_email` | `str` |
| `options` | `OptionsRedirectTo \| None` |
| `code_challenge` | `str \| None` |

### `UserEmailSendVerificationEmailRequest`

```python
class UserEmailSendVerificationEmailRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `OptionsRedirectTo \| None` |
| `code_challenge` | `str \| None` |

### `UserEntity`

```python
class UserEntity(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `name` | `str` |
| `display_name` | `str` |
| `id` | `str` |

### `UserMfaRequest`

```python
class UserMfaRequest(BaseModel):
```

Request to activate or deactivate multi-factor authentication

#### Fields

| Field | Type |
| --- | --- |
| `code` | `str` |
| `active_mfa_type` | `UserMfaRequestActiveMfaType \| None` |

### `UserPasswordRequest`

```python
class UserPasswordRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `new_password` | `str` |
| `ticket` | `str \| None` |

### `UserPasswordResetRequest`

```python
class UserPasswordResetRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `OptionsRedirectTo \| None` |
| `code_challenge` | `str \| None` |

### `UserPhoneNumberChangeRequest`

```python
class UserPhoneNumberChangeRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `new_phone_number` | `str` |

### `UserPhoneNumberChangeVerifyRequest`

```python
class UserPhoneNumberChangeVerifyRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `new_phone_number` | `str` |
| `otp` | `str` |

### `VerifyAddSecurityKeyRequest`

```python
class VerifyAddSecurityKeyRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `credential` | `CredentialCreationResponse` |
| `nickname` | `str \| None` |

### `VerifyAddSecurityKeyResponse`

```python
class VerifyAddSecurityKeyResponse(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `nickname` | `str \| None` |

### `VerifyTicketParams`

```python
class VerifyTicketParams(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `ticket` | `TicketQuery` |
| `type` | `TicketTypeQuery \| None` |
| `redirect_to` | `RedirectToQuery` |
| `code_challenge` | `str \| None` |

### `VerifyTokenRequest`

```python
class VerifyTokenRequest(BaseModel):
```

#### Fields

| Field | Type |
| --- | --- |
| `token` | `str \| None` |
