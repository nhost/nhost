---
title: Auth
---

Nhost Auth: generated REST client and models plus hand-written PKCE helpers.

## Functions

### `create_api_client`

```python
def create_api_client(base_url: 'str', chain_functions: 'list[ChainFunction] | None' = None, http_client: 'httpx.AsyncClient | None' = None) -> 'Client'
```

Create a new API client.

### `generate_code_challenge`

```python
def generate_code_challenge(verifier: 'str') -> 'str'
```

Derive an S256 code challenge from a code verifier.

### `generate_code_verifier`

```python
def generate_code_verifier() -> 'str'
```

Generate a cryptographically random PKCE code verifier.

Returns 43 base64url characters (32 random bytes), the RFC 7636 recommended
length.

### `generate_pkce_pair`

```python
def generate_pkce_pair() -> 'PKCEPair'
```

Generate a PKCE code verifier and its S256 challenge in one call.

## Classes

### `AuthenticationExtensionsClientOutputs`

```python
class AuthenticationExtensionsClientOutputs
```

#### Fields

| Field | Type |
| --- | --- |
| `appid` | `bool | None` |
| `cred_props` | `CredentialPropertiesOutput | None` |
| `hmac_create_secret` | `bool | None` |

### `AuthenticatorAssertionResponse`

```python
class AuthenticatorAssertionResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `client_data_json` | `str` |
| `authenticator_data` | `str` |
| `signature` | `str` |
| `user_handle` | `str | None` |

### `AuthenticatorAttestationResponse`

```python
class AuthenticatorAttestationResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `client_data_json` | `str` |
| `transports` | `list[str] | None` |
| `authenticator_data` | `str | None` |
| `public_key` | `str | None` |
| `public_key_algorithm` | `int | None` |
| `attestation_object` | `str` |

### `AuthenticatorSelection`

```python
class AuthenticatorSelection
```

#### Fields

| Field | Type |
| --- | --- |
| `authenticator_attachment` | `AuthenticatorAttachment | None` |
| `require_resident_key` | `bool | None` |
| `resident_key` | `ResidentKeyRequirement | None` |
| `user_verification` | `UserVerificationRequirement | None` |

### `Client`

```python
class Client
```

Generated async API client backed by an httpx.AsyncClient and a middleware chain.

#### Methods

##### `add_security_key`

```python
async def add_security_key(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[PublicKeyCredentialCreationOptions]'
```

##### `change_user_email`

```python
async def change_user_email(self, body: 'UserEmailChangeRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `change_user_mfa`

```python
async def change_user_mfa(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[TotpGenerateResponse]'
```

##### `change_user_password`

```python
async def change_user_password(self, body: 'UserPasswordRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `create_pat`

```python
async def create_pat(self, body: 'CreatePATRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[CreatePATResponse]'
```

##### `deanonymize_user`

```python
async def deanonymize_user(self, body: 'UserDeanonymizeRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `elevate_webauthn`

```python
async def elevate_webauthn(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[PublicKeyCredentialRequestOptions]'
```

##### `get_jw_ks`

```python
async def get_jw_ks(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[JWKSet]'
```

##### `get_o_auth_authorization_server`

```python
async def get_o_auth_authorization_server(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2DiscoveryResponse]'
```

##### `get_open_id_configuration`

```python
async def get_open_id_configuration(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2DiscoveryResponse]'
```

##### `get_provider_tokens`

```python
async def get_provider_tokens(self, provider: 'SignInProvider', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[ProviderSession]'
```

##### `get_user`

```python
async def get_user(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[User]'
```

##### `get_version`

```python
async def get_version(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[GetVersionResponse200]'
```

##### `health_check_get`

```python
async def health_check_get(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `health_check_head`

```python
async def health_check_head(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[None]'
```

##### `link_id_token`

```python
async def link_id_token(self, body: 'LinkIdTokenRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `oauth2_authorize_post_url`

```python
def oauth2_authorize_post_url(self) -> 'str'
```

##### `oauth2_authorize_url`

```python
def oauth2_authorize_url(self, params: 'Oauth2AuthorizeParams | None' = None) -> 'str'
```

##### `oauth2_introspect`

```python
async def oauth2_introspect(self, body: 'OAuth2IntrospectRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2IntrospectResponse]'
```

##### `oauth2_jwks`

```python
async def oauth2_jwks(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2JWKSResponse]'
```

##### `oauth2_login_get`

```python
async def oauth2_login_get(self, params: 'Oauth2LoginGetParams | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2LoginResponse]'
```

##### `oauth2_login_post`

```python
async def oauth2_login_post(self, body: 'OAuth2LoginRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2LoginCompleteResponse]'
```

##### `oauth2_revoke`

```python
async def oauth2_revoke(self, body: 'OAuth2RevokeRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[None]'
```

##### `oauth2_token`

```python
async def oauth2_token(self, body: 'OAuth2TokenRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2TokenResponse]'
```

##### `oauth2_userinfo_get`

```python
async def oauth2_userinfo_get(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2UserinfoResponse]'
```

##### `oauth2_userinfo_post`

```python
async def oauth2_userinfo_post(self, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OAuth2UserinfoResponse]'
```

##### `push_chain_function`

```python
def push_chain_function(self, chain_function: 'ChainFunction') -> 'None'
```

Append a middleware chain function and rebuild the fetch pipeline.

##### `refresh_provider_token`

```python
async def refresh_provider_token(self, provider: 'SignInProvider', body: 'RefreshProviderTokenRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[ProviderSession]'
```

##### `refresh_token`

```python
async def refresh_token(self, body: 'RefreshTokenRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[Session]'
```

##### `send_password_reset_email`

```python
async def send_password_reset_email(self, body: 'UserPasswordResetRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `send_verification_email`

```python
async def send_verification_email(self, body: 'UserEmailSendVerificationEmailRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_in_anonymous`

```python
async def sign_in_anonymous(self, body: 'SignInAnonymousRequest | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `sign_in_email_password`

```python
async def sign_in_email_password(self, body: 'SignInEmailPasswordRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SignInEmailPasswordResponse]'
```

##### `sign_in_id_token`

```python
async def sign_in_id_token(self, body: 'SignInIdTokenRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `sign_in_otp_email`

```python
async def sign_in_otp_email(self, body: 'SignInOTPEmailRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_in_passwordless_email`

```python
async def sign_in_passwordless_email(self, body: 'SignInPasswordlessEmailRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_in_passwordless_sms`

```python
async def sign_in_passwordless_sms(self, body: 'SignInPasswordlessSmsRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_in_pat`

```python
async def sign_in_pat(self, body: 'SignInPATRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `sign_in_provider_url`

```python
def sign_in_provider_url(self, provider: 'SignInProvider', params: 'SignInProviderParams | None' = None) -> 'str'
```

##### `sign_in_webauthn`

```python
async def sign_in_webauthn(self, body: 'SignInWebauthnRequest | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[PublicKeyCredentialRequestOptions]'
```

##### `sign_out`

```python
async def sign_out(self, body: 'SignOutRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_up_email_password`

```python
async def sign_up_email_password(self, body: 'SignUpEmailPasswordRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `sign_up_id_token`

```python
async def sign_up_id_token(self, body: 'SignUpIdTokenRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `sign_up_otp_email`

```python
async def sign_up_otp_email(self, body: 'SignUpOTPEmailRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_up_passwordless_email`

```python
async def sign_up_passwordless_email(self, body: 'SignUpPasswordlessEmailRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_up_passwordless_sms`

```python
async def sign_up_passwordless_sms(self, body: 'SignUpPasswordlessSmsRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `sign_up_provider_url`

```python
def sign_up_provider_url(self, provider: 'SignInProvider', params: 'SignUpProviderParams | None' = None) -> 'str'
```

##### `sign_up_webauthn`

```python
async def sign_up_webauthn(self, body: 'SignUpWebauthnRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[PublicKeyCredentialCreationOptions]'
```

##### `token_exchange`

```python
async def token_exchange(self, body: 'TokenExchangeRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `verify_add_security_key`

```python
async def verify_add_security_key(self, body: 'VerifyAddSecurityKeyRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[VerifyAddSecurityKeyResponse]'
```

##### `verify_change_user_mfa`

```python
async def verify_change_user_mfa(self, body: 'UserMfaRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[OKResponse]'
```

##### `verify_elevate_webauthn`

```python
async def verify_elevate_webauthn(self, body: 'SignInWebauthnVerifyRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `verify_sign_in_mfa_totp`

```python
async def verify_sign_in_mfa_totp(self, body: 'SignInMfaTotpRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `verify_sign_in_otp_email`

```python
async def verify_sign_in_otp_email(self, body: 'SignInOTPEmailVerifyRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SignInOTPEmailVerifyResponse]'
```

##### `verify_sign_in_passwordless_sms`

```python
async def verify_sign_in_passwordless_sms(self, body: 'SignInPasswordlessSmsOtpRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SignInPasswordlessSmsOtpResponse]'
```

##### `verify_sign_in_webauthn`

```python
async def verify_sign_in_webauthn(self, body: 'SignInWebauthnVerifyRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `verify_sign_up_webauthn`

```python
async def verify_sign_up_webauthn(self, body: 'SignUpWebauthnVerifyRequest', headers: 'dict[str, str] | None' = None) -> 'FetchResponse[SessionPayload]'
```

##### `verify_ticket_url`

```python
def verify_ticket_url(self, params: 'VerifyTicketParams | None' = None) -> 'str'
```

##### `verify_token`

```python
async def verify_token(self, body: 'VerifyTokenRequest | None' = None, headers: 'dict[str, str] | None' = None) -> 'FetchResponse[str]'
```

### `CreatePATRequest`

```python
class CreatePATRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `expires_at` | `str` |
| `metadata` | `dict[str, Any] | None` |

### `CreatePATResponse`

```python
class CreatePATResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `personal_access_token` | `str` |

### `CredentialAssertionResponse`

```python
class CredentialAssertionResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `type` | `str` |
| `raw_id` | `str` |
| `client_extension_results` | `AuthenticationExtensionsClientOutputs | None` |
| `authenticator_attachment` | `str | None` |
| `response` | `AuthenticatorAssertionResponse` |

### `CredentialCreationResponse`

```python
class CredentialCreationResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `type` | `str` |
| `raw_id` | `str` |
| `client_extension_results` | `AuthenticationExtensionsClientOutputs | None` |
| `authenticator_attachment` | `str | None` |
| `response` | `AuthenticatorAttestationResponse` |

### `CredentialParameter`

```python
class CredentialParameter
```

#### Fields

| Field | Type |
| --- | --- |
| `type` | `CredentialType` |
| `alg` | `int` |

### `CredentialPropertiesOutput`

```python
class CredentialPropertiesOutput
```

#### Fields

| Field | Type |
| --- | --- |
| `rk` | `bool | None` |

### `ErrorResponse`

```python
class ErrorResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `status` | `int` |
| `message` | `str` |
| `error` | `ErrorResponseError` |

### `GetVersionResponse200`

```python
class GetVersionResponse200
```

#### Fields

| Field | Type |
| --- | --- |
| `version` | `str` |

### `JWK`

```python
class JWK
```

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
class JWKSet
```

#### Fields

| Field | Type |
| --- | --- |
| `keys` | `list[JWK]` |

### `LinkIdTokenRequest`

```python
class LinkIdTokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `provider` | `IdTokenProvider` |
| `id_token` | `str` |
| `nonce` | `str | None` |

### `MFAChallengePayload`

```python
class MFAChallengePayload
```

#### Fields

| Field | Type |
| --- | --- |
| `ticket` | `str` |

### `OAuth2DiscoveryResponse`

```python
class OAuth2DiscoveryResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `issuer` | `str` |
| `authorization_endpoint` | `str` |
| `token_endpoint` | `str` |
| `userinfo_endpoint` | `str | None` |
| `jwks_uri` | `str` |
| `revocation_endpoint` | `str | None` |
| `introspection_endpoint` | `str | None` |
| `scopes_supported` | `list[str] | None` |
| `response_types_supported` | `list[str]` |
| `grant_types_supported` | `list[str] | None` |
| `subject_types_supported` | `list[str] | None` |
| `id_token_signing_alg_values_supported` | `list[str] | None` |
| `token_endpoint_auth_methods_supported` | `list[str] | None` |
| `code_challenge_methods_supported` | `list[str] | None` |
| `claims_supported` | `list[str] | None` |
| `request_parameter_supported` | `bool | None` |
| `authorization_response_iss_parameter_supported` | `bool | None` |
| `client_id_metadata_document_supported` | `bool | None` |

### `OAuth2ErrorResponse`

```python
class OAuth2ErrorResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `error` | `str` |
| `error_description` | `str | None` |

### `OAuth2IntrospectRequest`

```python
class OAuth2IntrospectRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `token` | `str` |
| `token_type_hint` | `OAuth2IntrospectRequestToken_type_hint | None` |
| `client_id` | `str | None` |
| `client_secret` | `str | None` |

### `OAuth2IntrospectResponse`

```python
class OAuth2IntrospectResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `active` | `bool` |
| `scope` | `str | None` |
| `client_id` | `str | None` |
| `sub` | `str | None` |
| `exp` | `int | None` |
| `iat` | `int | None` |
| `iss` | `str | None` |
| `token_type` | `str | None` |

### `OAuth2JWKSResponse`

```python
class OAuth2JWKSResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `keys` | `list[JWK]` |

### `OAuth2LoginCompleteResponse`

```python
class OAuth2LoginCompleteResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `redirect_uri` | `str` |

### `OAuth2LoginRequest`

```python
class OAuth2LoginRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `request_id` | `str` |

### `OAuth2LoginResponse`

```python
class OAuth2LoginResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `request_id` | `str` |
| `client_id` | `str` |
| `scopes` | `list[str]` |
| `redirect_uri` | `str` |

### `OAuth2RevokeRequest`

```python
class OAuth2RevokeRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `token` | `str` |
| `token_type_hint` | `OAuth2RevokeRequestToken_type_hint | None` |
| `client_id` | `str | None` |
| `client_secret` | `str | None` |

### `OAuth2TokenRequest`

```python
class OAuth2TokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `grant_type` | `OAuth2TokenRequestGrant_type` |
| `code` | `str | None` |
| `redirect_uri` | `str | None` |
| `client_id` | `str | None` |
| `client_secret` | `str | None` |
| `code_verifier` | `str | None` |
| `refresh_token` | `str | None` |
| `resource` | `str | None` |

### `OAuth2TokenResponse`

```python
class OAuth2TokenResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `token_type` | `str` |
| `expires_in` | `int` |
| `refresh_token` | `str | None` |
| `id_token` | `str | None` |
| `scope` | `str | None` |

### `OAuth2UserinfoResponse`

```python
class OAuth2UserinfoResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `sub` | `str` |
| `name` | `str | None` |
| `email` | `str | None` |
| `email_verified` | `bool | None` |
| `picture` | `str | None` |
| `locale` | `str | None` |
| `phone_number` | `str | None` |
| `phone_number_verified` | `bool | None` |

### `Oauth2AuthorizeParams`

```python
class Oauth2AuthorizeParams
```

#### Fields

| Field | Type |
| --- | --- |
| `client_id` | `str` |
| `redirect_uri` | `str` |
| `response_type` | `str` |
| `scope` | `str | None` |
| `state` | `str | None` |
| `nonce` | `str | None` |
| `code_challenge` | `str | None` |
| `code_challenge_method` | `GetCode_challenge_method | None` |
| `resource` | `str | None` |
| `prompt` | `str | None` |

### `Oauth2AuthorizePostBody`

```python
class Oauth2AuthorizePostBody
```

#### Fields

| Field | Type |
| --- | --- |
| `client_id` | `str` |
| `redirect_uri` | `str` |
| `response_type` | `str` |
| `scope` | `str | None` |
| `state` | `str | None` |
| `nonce` | `str | None` |
| `code_challenge` | `str | None` |
| `code_challenge_method` | `str | None` |
| `resource` | `str | None` |
| `prompt` | `str | None` |

### `Oauth2LoginGetParams`

```python
class Oauth2LoginGetParams
```

#### Fields

| Field | Type |
| --- | --- |
| `request_id` | `str` |

### `OptionsRedirectTo`

```python
class OptionsRedirectTo
```

#### Fields

| Field | Type |
| --- | --- |
| `redirect_to` | `str | None` |

### `PKCEPair`

```python
class PKCEPair
```

A PKCE code verifier and its derived S256 challenge.

### `ProviderSession`

```python
class ProviderSession
```

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `expires_in` | `int` |
| `expires_at` | `str` |
| `refresh_token` | `str | None` |

### `ProviderSpecificParams`

```python
class ProviderSpecificParams
```

#### Fields

| Field | Type |
| --- | --- |
| `connection` | `str | None` |
| `organization` | `str | None` |

### `PublicKeyCredentialCreationOptions`

```python
class PublicKeyCredentialCreationOptions
```

#### Fields

| Field | Type |
| --- | --- |
| `rp` | `RelyingPartyEntity` |
| `user` | `UserEntity` |
| `challenge` | `str` |
| `pub_key_cred_params` | `list[CredentialParameter]` |
| `timeout` | `int | None` |
| `exclude_credentials` | `list[PublicKeyCredentialDescriptor] | None` |
| `authenticator_selection` | `AuthenticatorSelection | None` |
| `hints` | `list[PublicKeyCredentialHints] | None` |
| `attestation` | `ConveyancePreference | None` |
| `attestation_formats` | `list[AttestationFormat] | None` |
| `extensions` | `dict[str, Any] | None` |

### `PublicKeyCredentialDescriptor`

```python
class PublicKeyCredentialDescriptor
```

#### Fields

| Field | Type |
| --- | --- |
| `type` | `CredentialType` |
| `id` | `str` |
| `transports` | `list[AuthenticatorTransport] | None` |

### `PublicKeyCredentialRequestOptions`

```python
class PublicKeyCredentialRequestOptions
```

#### Fields

| Field | Type |
| --- | --- |
| `challenge` | `str` |
| `timeout` | `int | None` |
| `rp_id` | `str | None` |
| `allow_credentials` | `list[PublicKeyCredentialDescriptor] | None` |
| `user_verification` | `UserVerificationRequirement | None` |
| `hints` | `list[PublicKeyCredentialHints] | None` |
| `extensions` | `dict[str, Any] | None` |

### `RefreshProviderTokenRequest`

```python
class RefreshProviderTokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `refresh_token` | `str` |

### `RefreshTokenRequest`

```python
class RefreshTokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `refresh_token` | `str` |

### `RelyingPartyEntity`

```python
class RelyingPartyEntity
```

#### Fields

| Field | Type |
| --- | --- |
| `name` | `str` |
| `id` | `str` |

### `Session`

```python
class Session
```

#### Fields

| Field | Type |
| --- | --- |
| `access_token` | `str` |
| `access_token_expires_in` | `int` |
| `refresh_token_id` | `str` |
| `refresh_token` | `str` |
| `user` | `User | None` |

### `SessionPayload`

```python
class SessionPayload
```

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session | None` |

### `SignInAnonymousRequest`

```python
class SignInAnonymousRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `display_name` | `str | None` |
| `locale` | `str | None` |
| `metadata` | `dict[str, Any] | None` |

### `SignInEmailPasswordRequest`

```python
class SignInEmailPasswordRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `password` | `str` |

### `SignInEmailPasswordResponse`

```python
class SignInEmailPasswordResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session | None` |
| `mfa` | `MFAChallengePayload | None` |

### `SignInIdTokenRequest`

```python
class SignInIdTokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `provider` | `IdTokenProvider` |
| `id_token` | `str` |
| `nonce` | `str | None` |
| `options` | `SignUpOptions | None` |

### `SignInMfaTotpRequest`

```python
class SignInMfaTotpRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `ticket` | `str` |
| `otp` | `str` |

### `SignInOTPEmailRequest`

```python
class SignInOTPEmailRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions | None` |

### `SignInOTPEmailVerifyRequest`

```python
class SignInOTPEmailVerifyRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `otp` | `str` |
| `email` | `str` |

### `SignInOTPEmailVerifyResponse`

```python
class SignInOTPEmailVerifyResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session | None` |

### `SignInPATRequest`

```python
class SignInPATRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `personal_access_token` | `str` |

### `SignInPasswordlessEmailRequest`

```python
class SignInPasswordlessEmailRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions | None` |
| `code_challenge` | `str | None` |

### `SignInPasswordlessSmsOtpRequest`

```python
class SignInPasswordlessSmsOtpRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `otp` | `str` |

### `SignInPasswordlessSmsOtpResponse`

```python
class SignInPasswordlessSmsOtpResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `session` | `Session | None` |
| `mfa` | `MFAChallengePayload | None` |

### `SignInPasswordlessSmsRequest`

```python
class SignInPasswordlessSmsRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `options` | `SignUpOptions | None` |

### `SignInProviderParams`

```python
class SignInProviderParams
```

#### Fields

| Field | Type |
| --- | --- |
| `allowed_roles` | `list[str] | None` |
| `default_role` | `str | None` |
| `display_name` | `str | None` |
| `locale` | `str | None` |
| `metadata` | `dict[str, Any] | None` |
| `redirect_to` | `str | None` |
| `connect` | `str | None` |
| `state` | `str | None` |
| `provider_specific_params` | `ProviderSpecificParams | None` |
| `code_challenge` | `str | None` |

### `SignInWebauthnRequest`

```python
class SignInWebauthnRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str | None` |

### `SignInWebauthnVerifyRequest`

```python
class SignInWebauthnVerifyRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str | None` |
| `credential` | `CredentialAssertionResponse` |

### `SignOutRequest`

```python
class SignOutRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `refresh_token` | `str | None` |
| `all` | `bool | None` |

### `SignUpEmailPasswordRequest`

```python
class SignUpEmailPasswordRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `password` | `str` |
| `options` | `SignUpOptions | None` |
| `code_challenge` | `str | None` |

### `SignUpIdTokenRequest`

```python
class SignUpIdTokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `provider` | `IdTokenProvider` |
| `id_token` | `str` |
| `nonce` | `str | None` |
| `options` | `SignUpOptions | None` |

### `SignUpOTPEmailRequest`

```python
class SignUpOTPEmailRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions | None` |

### `SignUpOptions`

```python
class SignUpOptions
```

#### Fields

| Field | Type |
| --- | --- |
| `allowed_roles` | `list[str] | None` |
| `default_role` | `str | None` |
| `display_name` | `str | None` |
| `locale` | `str | None` |
| `metadata` | `dict[str, Any] | None` |
| `redirect_to` | `str | None` |

### `SignUpPasswordlessEmailRequest`

```python
class SignUpPasswordlessEmailRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions | None` |
| `code_challenge` | `str | None` |

### `SignUpPasswordlessSmsRequest`

```python
class SignUpPasswordlessSmsRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `phone_number` | `str` |
| `options` | `SignUpOptions | None` |

### `SignUpProviderParams`

```python
class SignUpProviderParams
```

#### Fields

| Field | Type |
| --- | --- |
| `allowed_roles` | `list[str] | None` |
| `default_role` | `str | None` |
| `display_name` | `str | None` |
| `locale` | `str | None` |
| `metadata` | `dict[str, Any] | None` |
| `redirect_to` | `str | None` |
| `state` | `str | None` |
| `provider_specific_params` | `ProviderSpecificParams | None` |
| `code_challenge` | `str | None` |

### `SignUpWebauthnRequest`

```python
class SignUpWebauthnRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `SignUpOptions | None` |

### `SignUpWebauthnVerifyRequest`

```python
class SignUpWebauthnVerifyRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `credential` | `CredentialCreationResponse` |
| `options` | `SignUpOptions | None` |
| `nickname` | `str | None` |
| `code_challenge` | `str | None` |

### `TokenExchangeRequest`

```python
class TokenExchangeRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `code` | `str` |
| `code_verifier` | `str` |

### `TotpGenerateResponse`

```python
class TotpGenerateResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `image_url` | `str` |
| `totp_secret` | `str` |

### `User`

```python
class User
```

#### Fields

| Field | Type |
| --- | --- |
| `avatar_url` | `str` |
| `created_at` | `str` |
| `default_role` | `str` |
| `display_name` | `str` |
| `email` | `str | None` |
| `email_verified` | `bool` |
| `id` | `str` |
| `is_anonymous` | `bool` |
| `locale` | `str` |
| `metadata` | `dict[str, Any] | None` |
| `phone_number` | `str | None` |
| `phone_number_verified` | `bool` |
| `roles` | `list[str]` |
| `active_mfa_type` | `str | None` |

### `UserDeanonymizeRequest`

```python
class UserDeanonymizeRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `sign_in_method` | `UserDeanonymizeRequestSignInMethod` |
| `email` | `str` |
| `password` | `str | None` |
| `connection` | `str | None` |
| `options` | `SignUpOptions | None` |
| `code_challenge` | `str | None` |

### `UserEmailChangeRequest`

```python
class UserEmailChangeRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `new_email` | `str` |
| `options` | `OptionsRedirectTo | None` |
| `code_challenge` | `str | None` |

### `UserEmailSendVerificationEmailRequest`

```python
class UserEmailSendVerificationEmailRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `OptionsRedirectTo | None` |
| `code_challenge` | `str | None` |

### `UserEntity`

```python
class UserEntity
```

#### Fields

| Field | Type |
| --- | --- |
| `name` | `str` |
| `display_name` | `str` |
| `id` | `str` |

### `UserMfaRequest`

```python
class UserMfaRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `code` | `str` |
| `active_mfa_type` | `UserMfaRequestActiveMfaType | None` |

### `UserPasswordRequest`

```python
class UserPasswordRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `new_password` | `str` |
| `ticket` | `str | None` |

### `UserPasswordResetRequest`

```python
class UserPasswordResetRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `email` | `str` |
| `options` | `OptionsRedirectTo | None` |
| `code_challenge` | `str | None` |

### `VerifyAddSecurityKeyRequest`

```python
class VerifyAddSecurityKeyRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `credential` | `CredentialCreationResponse` |
| `nickname` | `str | None` |

### `VerifyAddSecurityKeyResponse`

```python
class VerifyAddSecurityKeyResponse
```

#### Fields

| Field | Type |
| --- | --- |
| `id` | `str` |
| `nickname` | `str | None` |

### `VerifyTicketParams`

```python
class VerifyTicketParams
```

#### Fields

| Field | Type |
| --- | --- |
| `ticket` | `TicketQuery` |
| `type` | `TicketTypeQuery | None` |
| `redirect_to` | `RedirectToQuery` |
| `code_challenge` | `str | None` |

### `VerifyTokenRequest`

```python
class VerifyTokenRequest
```

#### Fields

| Field | Type |
| --- | --- |
| `token` | `str | None` |
