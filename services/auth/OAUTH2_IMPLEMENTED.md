# OAuth2/OIDC Identity Provider - Implementation Reference

This document describes the OAuth2/OIDC Identity Provider functionality implemented in Nhost Auth. It covers all endpoints, supported flows, token formats, security measures, and RFC compliance. Partial implementations are noted explicitly.

## Table of Contents

1. [Overview](#overview)
2. [RFC Compliance Matrix](#rfc-compliance-matrix)
3. [Endpoints](#endpoints)
4. [Authorization Code Flow](#authorization-code-flow)
5. [Grant Types](#grant-types)
6. [PKCE (RFC 7636)](#pkce-rfc-7636)
7. [Token Formats](#token-formats)
8. [Scopes and Claims](#scopes-and-claims)
9. [Client Types and Authentication](#client-types-and-authentication)
10. [Dynamic Client Registration (RFC 7591)](#dynamic-client-registration-rfc-7591)
11. [Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document)](#client-id-metadata-document)
12. [Discovery and Metadata (RFC 8414)](#discovery-and-metadata-rfc-8414)
13. [Token Introspection (RFC 7662)](#token-introspection-rfc-7662)
14. [Token Revocation (RFC 7009)](#token-revocation-rfc-7009)
15. [Resource Indicators (RFC 8707)](#resource-indicators-rfc-8707)
16. [Key Management and JWKS](#key-management-and-jwks)
17. [Security Measures](#security-measures)
18. [Configuration](#configuration)
19. [Database Schema](#database-schema)

---

## Overview

Nhost Auth acts as an OAuth2 Authorization Server and OpenID Connect Provider. External applications can use standard OAuth2/OIDC flows to authenticate Nhost users and obtain access tokens, ID tokens, and refresh tokens.

The implementation follows the controller/workflow pattern used throughout Nhost Auth: endpoints are defined in the OpenAPI spec, generated via oapi-codegen, and implemented as controller methods that delegate to workflow functions for business logic.

---

## RFC Compliance Matrix

| RFC | Title | Status | Notes |
|-----|-------|--------|-------|
| [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) | OAuth 2.0 Authorization Framework | Partial | Authorization Code grant only. Implicit, Password, and Client Credentials grants not implemented. |
| [RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750) | OAuth 2.0 Bearer Token Usage | Full | Bearer tokens in `Authorization` header. |
| [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009) | OAuth 2.0 Token Revocation | Partial | Refresh tokens revoked from DB. Access tokens are stateless JWTs and cannot be revoked. Always returns 200. |
| [RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517) | JSON Web Key (JWK) | Full | JWKS endpoint serves RSA public keys. |
| [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519) | JSON Web Token (JWT) | Full | Access tokens and ID tokens are RS256-signed JWTs. |
| [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) | OAuth 2.0 Dynamic Client Registration | Partial | Open registration (no initial access token). Client update (RFC 7592) not implemented via DCR endpoint. |
| [draft-ietf-oauth-client-id-metadata-document](https://www.ietf.org/archive/id/draft-ietf-oauth-client-id-metadata-document-00.html) | Client ID Metadata Document | Full | URL-based client_id with metadata fetched from the URL. SSRF protection, 1h cache TTL. |
| [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) | PKCE | Full | S256 and plain methods supported. Optional (not enforced for public clients). |
| [RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662) | OAuth 2.0 Token Introspection | Full | Supports both refresh tokens (DB lookup) and access tokens (JWT verification). |
| [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) | OAuth 2.0 Authorization Server Metadata | Full | Both `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server`. |
| [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) | Resource Indicators for OAuth 2.0 | Partial | `resource` parameter accepted and stored. Not used for audience restriction in issued tokens. |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | OpenID Connect | Partial | ID tokens, UserInfo endpoint, `nonce`, standard claims. No RP-initiated logout, no session management, no pairwise subject identifiers. |

---

## Endpoints

### Discovery

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/openid-configuration` | OpenID Connect Discovery metadata |
| GET | `/.well-known/oauth-authorization-server` | OAuth2 Authorization Server metadata (same content) |

### Core OAuth2 Flow

| Method | Path | Content-Type | Description |
|--------|------|-------------|-------------|
| GET | `/oauth2/authorize` | — | Authorization endpoint. Validates request, creates auth request, redirects to login UI. |
| POST | `/oauth2/token` | `application/x-www-form-urlencoded` | Token endpoint. Exchanges authorization codes and refresh tokens for tokens. |

### OIDC

| Method | Path | Description |
|--------|------|-------------|
| GET | `/oauth2/userinfo` | Returns user claims for the authenticated access token. |
| POST | `/oauth2/userinfo` | Same as GET (per OIDC spec). |
| GET | `/oauth2/jwks` | JSON Web Key Set with RSA public signing keys. |

### Token Management

| Method | Path | Content-Type | Description |
|--------|------|-------------|-------------|
| POST | `/oauth2/revoke` | `application/x-www-form-urlencoded` | Token revocation (RFC 7009). |
| POST | `/oauth2/introspect` | `application/x-www-form-urlencoded` | Token introspection (RFC 7662). |

### Dynamic Client Registration

| Method | Path | Content-Type | Description |
|--------|------|-------------|-------------|
| POST | `/oauth2/register` | `application/json` | Register a new OAuth2 client (RFC 7591). No authentication required. |

### Login/Consent API (called by frontend consent UI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/oauth2/login?request_id={uuid}` | Retrieve auth request details for the consent screen. |
| POST | `/oauth2/login` | Complete login/consent. Requires authenticated user (Bearer token). Generates authorization code. |

### Admin Client Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/oauth2/clients` | List all registered clients. |
| POST | `/oauth2/clients` | Create a new client. |
| GET | `/oauth2/clients/{clientId}` | Get a single client. |
| PUT | `/oauth2/clients/{clientId}` | Update a client. |
| DELETE | `/oauth2/clients/{clientId}` | Delete a client. |

---

## Authorization Code Flow

Complete flow from authorization request to token issuance:

```
1. GET /oauth2/authorize
   ?client_id=<client_id>
   &redirect_uri=<registered_redirect_uri>
   &response_type=code
   &scope=openid+profile+email
   &state=<csrf_state>
   &nonce=<oidc_nonce>
   &code_challenge=<base64url(sha256(verifier))>
   &code_challenge_method=S256

   Server validates: client exists, redirect_uri registered, scopes allowed,
   response_type is "code". Creates auth request in DB (expires in 10 min).

   → 302 redirect to login UI with ?request_id=<uuid>

2. GET /oauth2/login?request_id=<uuid>

   Consent UI fetches request details: client name, requested scopes, redirect URI.

3. POST /oauth2/login
   Authorization: Bearer <user_session_jwt>
   Body: { "requestId": "<uuid>" }

   Server sets user_id on auth request, generates authorization code (UUID),
   stores SHA256(code) in DB (expires in 5 min).

   → { "redirectUri": "<redirect_uri>?code=<code>&state=<state>" }

4. POST /oauth2/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &code=<authorization_code>
   &redirect_uri=<redirect_uri>
   &client_id=<client_id>
   &client_secret=<secret>          (confidential clients only)
   &code_verifier=<pkce_verifier>   (if code_challenge was sent)

   Server validates: code hash lookup, code not expired, redirect_uri matches,
   PKCE verifier (if challenge present), client authentication.
   Deletes authorization code (one-time use).

   → {
       "access_token": "<jwt>",
       "token_type": "Bearer",
       "expires_in": 900,
       "refresh_token": "<uuid>",
       "id_token": "<jwt>",     (only if openid scope requested)
       "scope": "openid profile email"
     }
```

---

## Grant Types

### Supported

| Grant Type | `grant_type` value | Description |
|-----------|-------------------|-------------|
| Authorization Code | `authorization_code` | Standard OAuth2 flow with user authentication and consent. |
| Refresh Token | `refresh_token` | Exchange a refresh token for new access/ID/refresh tokens. Implements token rotation (old token deleted, new token issued). |

### Not Supported

| Grant Type | `grant_type` value | Reason |
|-----------|-------------------|--------|
| Implicit | `implicit` | Deprecated by OAuth 2.1. Not implemented. |
| Resource Owner Password | `password` | Deprecated by OAuth 2.1. Not implemented. |
| Client Credentials | `client_credentials` | No machine-to-machine flow without a user. |
| Device Authorization | `urn:ietf:params:oauth:grant-type:device_code` | RFC 8628 not implemented. |

---

## PKCE (RFC 7636)

### Supported Methods

| Method | `code_challenge_method` | Description |
|--------|------------------------|-------------|
| S256 | `S256` | `code_challenge = BASE64URL(SHA256(code_verifier))`. Recommended. |
| Plain | `plain` | `code_challenge = code_verifier`. Less secure, supported for compatibility. |

### Behavior

- PKCE is **optional**. If `code_challenge` is not sent in the authorization request, no PKCE validation occurs at the token endpoint.
- If `code_challenge` is present in the authorization request, `code_verifier` is **required** at the token endpoint.
- PKCE parameters are stored in the auth request record and validated during code exchange.

### Validation Logic (`validatePKCE`)

```
if no code_challenge stored → pass (PKCE not used)
if code_challenge stored but no code_verifier provided → error: "Missing code_verifier"
if method is S256 → BASE64URL(SHA256(code_verifier)) must equal stored code_challenge
if method is plain → code_verifier must exactly equal stored code_challenge
```

---

## Token Formats

### Access Token (JWT)

- **Format**: JWT signed with RS256
- **Default lifetime**: 900 seconds (15 minutes)
- **Configurable**: globally via `AUTH_OAUTH2_PROVIDER_ACCESS_TOKEN_TTL`, per-client via `access_token_lifetime`
- **Headers**: `{ "alg": "RS256", "typ": "JWT", "kid": "<key_id>" }`

**Claims**:
```json
{
  "iss": "<issuer_url>",
  "sub": "<user_uuid>",
  "iat": 1234567890,
  "exp": 1234568790,
  "scope": "openid profile email",
  "https://hasura.io/jwt/claims": {
    "x-hasura-allowed-roles": ["user", "me"],
    "x-hasura-default-role": "user",
    "x-hasura-user-id": "<user_uuid>"
  }
}
```

The `https://hasura.io/jwt/claims` namespace is included so access tokens can be used directly with Hasura for authorization. Roles are fetched from the user's assigned roles in the database.

### ID Token (JWT)

- **Format**: JWT signed with RS256
- **Issued**: only when `openid` scope is requested
- **Lifetime**: same as access token
- **Headers**: `{ "alg": "RS256", "typ": "JWT", "kid": "<key_id>" }`

**Base claims** (always present):
```json
{
  "iss": "<issuer_url>",
  "sub": "<user_uuid>",
  "aud": "<client_id>",
  "iat": 1234567890,
  "exp": 1234568790,
  "auth_time": 1234567890
}
```

**Conditional claims** (see [Scopes and Claims](#scopes-and-claims) for details):
- `nonce`: included if provided in the authorization request
- `name`, `picture`, `locale`: included if `profile` scope and values exist
- `email`, `email_verified`: included if `email` scope and email is set
- `phone_number`, `phone_number_verified`: included if `phone` scope and phone is set

### Refresh Token

- **Format**: UUID string (not JWT)
- **Default lifetime**: 2,592,000 seconds (30 days)
- **Configurable**: globally via `AUTH_OAUTH2_PROVIDER_REFRESH_TOKEN_TTL`, per-client via `refresh_token_lifetime`
- **Storage**: SHA256 hash stored in database (`hex(SHA256(token))`)
- **Rotation**: on each refresh, the old token is deleted and a new one is issued. The new token inherits the original scopes.

### Authorization Code

- **Format**: UUID string
- **Lifetime**: 5 minutes (hardcoded, `oauth2AuthCodeTTL`)
- **Storage**: SHA256 hash stored in database
- **One-time use**: deleted immediately after exchange (whether successful or not)
- **Binding**: tied to the auth request which contains client_id, redirect_uri, scopes, PKCE challenge

---

## Scopes and Claims

### Supported Scopes

| Scope | Effect |
|-------|--------|
| `openid` | Required for OIDC. Triggers ID token issuance. Default if no scope specified. |
| `profile` | Adds `name`, `picture`, `locale` to ID token (if values exist on user). |
| `email` | Adds `email`, `email_verified` to ID token (if user has email). |
| `phone` | Adds `phone_number`, `phone_number_verified` to ID token (if user has phone). |
| `offline_access` | Recognized in discovery metadata. Refresh tokens are issued regardless of this scope. |

### Scope Validation

- Requested scopes are validated against the client's configured `scopes` array.
- If no scope is requested, defaults to `["openid"]`.
- An unrecognized or disallowed scope returns `invalid_scope`.

### Default Client Scopes

- Dynamic registration default: `openid profile email`
- Admin-created client default: configurable at creation time

### ID Token Claims by Scope

| Scope | Claims | Condition |
|-------|--------|-----------|
| (always) | `iss`, `sub`, `aud`, `iat`, `exp`, `auth_time` | — |
| (if provided) | `nonce` | Only if `nonce` was in the authorization request |
| `profile` | `name` | If `user.display_name` is non-empty |
| `profile` | `picture` | If `user.avatar_url` is non-empty |
| `profile` | `locale` | If `user.locale` is non-empty |
| `email` | `email`, `email_verified` | If `user.email` is set (non-null) |
| `phone` | `phone_number`, `phone_number_verified` | If `user.phone_number` is set (non-null) |

### UserInfo Endpoint Claims

The UserInfo endpoint (`/oauth2/userinfo`) returns all available user claims based on data availability. Unlike the ID token, it does **not** filter by the token's scopes - it returns all non-null user fields:

| Claim | Condition |
|-------|-----------|
| `sub` | Always (user UUID) |
| `email`, `email_verified` | If user has email |
| `name` | If `display_name` non-empty |
| `picture` | If `avatar_url` non-empty |
| `locale` | If `locale` non-empty |
| `phone_number`, `phone_number_verified` | If user has phone number |

**Note**: The UserInfo endpoint authenticates via the existing Nhost Auth JWT middleware (`GetJWTInContext`), which validates the Bearer token as a Hasura-compatible JWT.

---

## Client Types and Authentication

### Client Types

| Type | `type` column | `is_public` | Has Secret | `token_endpoint_auth_method` |
|------|---------------|------------|------------|------------------------------|
| Confidential (registered) | `registered` | `false` | Yes (bcrypt hash stored) | `client_secret_post` or `client_secret_basic` |
| Public (registered) | `registered` | `true` | No | `none` |
| DCR | `dcr` | Varies | Varies | Per registration request |
| CIMD | `client_id_metadata_document` | `true` | No | `none` |

The `type` column in `oauth2_clients` tracks how the client was created. It references the `auth.oauth2_client_types` lookup table. CIMD clients are always public and cannot have a client secret.

### Client Authentication at Token Endpoint

The token endpoint supports two authentication methods for confidential clients:

- **`client_secret_post`**: Client credentials (`client_id`, `client_secret`) sent in the form body.
- **`client_secret_basic`**: Client credentials sent via `Authorization: Basic` header (RFC 6749 Section 2.3.1). The header value is `base64(client_id:client_secret)`.

When `client_secret_basic` is used, the credentials are extracted from the `Authorization` header and injected into the request before processing. If credentials are present in both the header and the body, the body values take precedence.

The `authenticateClient` function runs during code exchange and token refresh:

1. If `client_id` is provided in the request and doesn't match the expected client → `invalid_client`
2. Look up client by expected `client_id`
3. If client is public (`is_public = true`) → pass (no secret required)
4. If client is confidential:
   - `client_secret` must be provided → `invalid_client` if missing
   - Verify `client_secret` against stored bcrypt hash → `invalid_client` if mismatch

### Client ID Format

Generated as a UUID string (e.g., `550e8400-e29b-41d4-a716-446655440000`). Unique constraint enforced in database.

### Client Secret Generation

For confidential clients: `uuid.NewString() + uuid.NewString()` (two concatenated UUIDs, ~72 characters). Hashed with bcrypt before storage. The plaintext secret is returned **only once** during registration and cannot be retrieved later.

---

## Dynamic Client Registration (RFC 7591)

### Endpoint

`POST /oauth2/register`

### Authentication

None required (open registration).

### Request

```json
{
  "client_name": "My App",
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "scope": "openid profile email",
  "token_endpoint_auth_method": "client_secret_post",
  "client_uri": "https://app.example.com",
  "logo_uri": "https://app.example.com/logo.png"
}
```

| Field | Required | Default |
|-------|----------|---------|
| `client_name` | Yes | — |
| `redirect_uris` | Yes (non-empty) | — |
| `grant_types` | No | `["authorization_code"]` |
| `response_types` | No | `["code"]` |
| `scope` | No | `"openid profile email"` |
| `token_endpoint_auth_method` | No | `"client_secret_post"` |
| `client_uri` | No | — |
| `logo_uri` | No | — |

### Response (201 Created)

```json
{
  "client_id": "<uuid>",
  "client_secret": "<secret>",
  "client_name": "My App",
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "scope": "openid profile email",
  "token_endpoint_auth_method": "client_secret_post"
}
```

- `client_secret` is only present for confidential clients (`token_endpoint_auth_method != "none"`)
- `client_secret` is returned only at registration time

### Limitations

- No initial access token required (fully open)
- RFC 7592 (Client Configuration Management) not implemented via DCR - use admin endpoints instead
- No software statement support

---

## Client ID Metadata Document

### Specification

[draft-ietf-oauth-client-id-metadata-document-00](https://www.ietf.org/archive/id/draft-ietf-oauth-client-id-metadata-document-00.html)

### Overview

Instead of pre-registering a client via admin endpoints or DCR, a client can present an HTTPS URL as its `client_id` (e.g., `https://my-mcp-tool.example.com/oauth/client.json`). The authorization server fetches JSON metadata from that URL to learn the client's name, redirect URIs, logo, etc. This is particularly useful for the MCP (Model Context Protocol) authorization use case.

CIMD clients are always **public** (no client secret). They are upserted into the `oauth2_clients` table with `type = 'client_id_metadata_document'`, preserving existing FK constraints and requiring no changes to the token flow.

### Detection

A `client_id` is treated as a CIMD client when all of the following are true:
- Scheme is `https`
- Host is non-empty
- Path is non-empty and not just `/`

Otherwise, the client_id is looked up as a regular registered or DCR client.

### URL Validation (`ValidateCIMDURL`)

The client_id URL must satisfy:
- **HTTPS only** — HTTP and other schemes are rejected
- **Path required** — must have a non-trivial path (not empty, not just `/`)
- **No fragment** — URL must not contain a `#fragment`
- **No credentials** — URL must not contain `user:password@`
- **No dot segments** — path must not contain `/.`, `/..`, `/../`, `/./`
- **No private IPs** — hostname must not resolve to a loopback, private, or link-local address

### Metadata Document Format

The server fetches the URL with `Accept: application/json` and expects a JSON document:

```json
{
  "client_id": "https://my-mcp-tool.example.com/oauth/client.json",
  "client_name": "My MCP Tool",
  "client_uri": "https://my-mcp-tool.example.com",
  "logo_uri": "https://my-mcp-tool.example.com/logo.png",
  "redirect_uris": ["https://my-mcp-tool.example.com/callback"],
  "scope": "openid profile email",
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

### Metadata Validation

| Field | Required | Validation |
|-------|----------|------------|
| `client_id` | Yes | Must exactly match the URL used to fetch the document |
| `redirect_uris` | Yes | Must contain at least one URI |
| `client_name` | No | Defaults to the URL's hostname if missing |
| `client_secret` | Prohibited | Document must not contain this field |
| `client_secret_expires_at` | Prohibited | Document must not contain this field |
| `scope` | No | Defaults to `openid profile email phone offline_access` |
| Other fields | No | `client_uri`, `logo_uri`, `grant_types`, `response_types`, `token_endpoint_auth_method` are accepted but not enforced |

### Caching

- Fetched metadata is cached for **1 hour** (`CIMDCacheTTL`), tracked via the `metadata_document_fetched_at` column.
- On subsequent requests within the TTL, the cached client record is returned without re-fetching.
- After the TTL expires, the metadata is re-fetched and the client record is upserted with fresh data.

### SSRF Protection

The HTTP client used for fetching metadata documents includes multiple layers of SSRF protection:

| Protection | Description |
|------------|-------------|
| URL validation | Loopback and private IPs rejected before fetch |
| DNS resolution validation | After DNS resolution, all resolved IPs are checked for private/loopback/link-local ranges (defends against DNS rebinding) |
| HTTPS-only redirects | Redirects to non-HTTPS URLs are rejected |
| Redirect limit | Maximum 3 redirects |
| Timeout | 5-second fetch timeout (`CIMDFetchTimeout`) |
| Response size limit | Maximum 5KB response body (`CIMDMaxResponseSize`) |

### Authorization Flow

When CIMD is enabled and a URL-based `client_id` arrives at `/oauth2/authorize`:

```
1. Detect URL-based client_id (IsCIMDClientID)
2. Validate URL (ValidateCIMDURL)
3. Check DB cache:
   - If client exists with type='client_id_metadata_document'
     and metadata_document_fetched_at is within 1 hour → use cached record
4. Fetch metadata document (FetchCIMDMetadata)
5. Validate metadata (client_id match, no secrets, redirect_uris present)
6. Upsert client record (UpsertOAuth2CIMDClient):
   - type = 'client_id_metadata_document'
   - is_public = true
   - token_endpoint_auth_method = 'none'
   - grant_types = '{authorization_code}'
   - response_types = '{code}'
7. Continue with standard authorization flow (redirect_uri validation, scope validation, etc.)
```

### Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `CIMDMaxResponseSize` | 5 KB | Maximum metadata document response body size |
| `CIMDFetchTimeout` | 5 seconds | HTTP fetch timeout |
| `CIMDCacheTTL` | 1 hour | How long to cache metadata before re-fetching |

---

## Discovery and Metadata (RFC 8414)

Both endpoints return identical content:

- `GET /.well-known/openid-configuration` (OpenID Connect Discovery)
- `GET /.well-known/oauth-authorization-server` (OAuth2 AS Metadata)

### Response

```json
{
  "issuer": "<server_url or custom issuer>",
  "authorization_endpoint": "<server_url>/oauth2/authorize",
  "token_endpoint": "<server_url>/oauth2/token",
  "userinfo_endpoint": "<server_url>/oauth2/userinfo",
  "jwks_uri": "<server_url>/oauth2/jwks",
  "revocation_endpoint": "<server_url>/oauth2/revoke",
  "introspection_endpoint": "<server_url>/oauth2/introspect",
  "registration_endpoint": "<server_url>/oauth2/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "scopes_supported": ["openid", "profile", "email", "phone", "offline_access"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256", "plain"]
}
```

The `issuer` is derived from `AUTH_OAUTH2_PROVIDER_ISSUER` if set, otherwise from `AUTH_SERVER_URL`. All endpoint URLs use `AUTH_SERVER_URL` as base regardless of issuer setting.

When the OAuth2 provider is disabled, both endpoints return `nil` (no response body).

### Conditional Fields

| Field | Condition | Value |
|-------|-----------|-------|
| `registration_endpoint` | DCR enabled | `<server_url>/oauth2/register` |
| `client_id_metadata_document_supported` | CIMD enabled | `true` |

---

## Token Introspection (RFC 7662)

### Endpoint

`POST /oauth2/introspect` (`application/x-www-form-urlencoded`)

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | The token to introspect |
| `token_type_hint` | No | `access_token` or `refresh_token` |
| `client_id` | No | Not currently validated |
| `client_secret` | No | Not currently validated |

### Introspection Logic

1. If `token_type_hint` is `refresh_token` or unset: look up `SHA256(token)` in refresh tokens table.
   - If found and not expired → return active response with refresh token metadata.
   - If hint was explicitly `refresh_token` and not found → return `{ "active": false }`.
2. Parse token as JWT, verify RS256 signature against the active signing key, validate issuer claim.
   - If valid → return active response with JWT claims.
   - If invalid → return `{ "active": false }`.

### Active Refresh Token Response

```json
{
  "active": true,
  "client_id": "<client_id>",
  "sub": "<user_uuid>",
  "scope": "openid profile email",
  "exp": 1234568790,
  "iat": 1234567890,
  "token_type": "refresh_token"
}
```

### Active Access Token Response

```json
{
  "active": true,
  "sub": "<user_uuid>",
  "exp": 1234568790,
  "iat": 1234567890,
  "iss": "<issuer>",
  "token_type": "access_token"
}
```

### Limitations

- Client authentication is not enforced on the introspection endpoint (the `client_id`/`client_secret` parameters are accepted but not validated).

---

## Token Revocation (RFC 7009)

### Endpoint

`POST /oauth2/revoke` (`application/x-www-form-urlencoded`)

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | The token to revoke |
| `token_type_hint` | No | Accepted but ignored |
| `client_id` | No | Accepted but not validated |
| `client_secret` | No | Accepted but not validated |

### Behavior

1. Compute `SHA256(token)` and attempt to delete the matching refresh token from the database.
2. Always return `200 OK` regardless of whether the token existed or was already revoked (per RFC 7009 security considerations).

### Limitations

- **Only refresh tokens can be revoked.** Access tokens are stateless JWTs and cannot be invalidated server-side. Clients must wait for the access token to expire.
- Client authentication is not enforced on the revocation endpoint.
- The `token_type_hint` is ignored; the token is always treated as a potential refresh token.

---

## Resource Indicators (RFC 8707)

### Status: Accepted, Not Enforced

The `resource` parameter is accepted in the authorization request (`GET /oauth2/authorize`) and stored in the auth request record. However:

- It is **not** used to restrict the `aud` claim in access tokens.
- It is **not** validated against any registered resource set.
- It is available in the auth request for potential future use.

This means the parameter is wire-compatible with RFC 8707 but does not provide audience restriction functionality.

---

## Key Management and JWKS

### RSA Key Generation

- **Algorithm**: RS256 (RSA PKCS#1 v1.5 with SHA-256)
- **Key size**: 2048 bits
- **Generation**: `rsa.GenerateKey(crypto/rand.Reader, 2048)`
- **Key ID**: UUID string
- **Initialization**: `EnsureSigningKey()` is called at startup. If no active key exists, a new key pair is generated.

### Key Storage

- **Private key**: serialized as PKCS#1 DER (`x509.MarshalPKCS1PrivateKey`), then encrypted using the application's `Encrypter` interface (AES), stored as `bytea`.
- **Public key**: serialized as PKIX DER (`x509.MarshalPKIXPublicKey`), stored as `bytea` in plaintext.
- **Table**: `auth.oauth2_signing_keys`

### JWKS Endpoint

`GET /oauth2/jwks` returns all signing keys (currently one active key):

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "<key_uuid>",
      "n": "<base64url_modulus>",
      "e": "AQAB"
    }
  ]
}
```

### Limitations

- No automatic key rotation. Only one active key at a time.
- Key rotation must be done manually (insert new key, deactivate old one).
- No key expiration enforcement (the `expires_at` column exists but is not used in rotation logic).

---

## Security Measures

### Token Hashing

All secrets stored in the database are hashed:

| Secret | Algorithm | Storage |
|--------|-----------|---------|
| Authorization codes | `hex(SHA256(code))` | `oauth2_authorization_codes.code_hash` |
| Refresh tokens | `hex(SHA256(token))` | `oauth2_refresh_tokens.token_hash` |
| Client secrets | bcrypt | `oauth2_clients.client_secret_hash` |
| RSA private keys | AES encryption | `oauth2_signing_keys.private_key` |

### Authorization Code Security

- One-time use: deleted immediately after exchange attempt (even on failure).
- Short-lived: 5-minute expiration.
- Bound to specific auth request (client, redirect_uri, scopes, PKCE challenge).

### Refresh Token Rotation

On every refresh grant:
1. Old refresh token is deleted from database.
2. New refresh token is generated and stored.
3. New token inherits the original scopes and client binding.

This limits the window of exposure if a refresh token is compromised.

### CSRF Protection

- The `state` parameter is stored in the auth request and returned to the client in the redirect URI.
- The client is responsible for verifying the returned state matches what it sent.

### Nonce (OIDC Replay Protection)

- The `nonce` parameter from the authorization request is stored and included in the ID token.
- The client should verify the nonce in the ID token matches the one it sent.

### Scope Binding

- Scopes are validated against the client's allowed scopes at authorization time.
- Scopes are stored in the auth request and propagated to refresh tokens.
- Refresh token grants preserve the original scopes (no scope escalation).

---

## Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUTH_OAUTH2_PROVIDER_ENABLED` | bool | `false` | Enable/disable the OAuth2 provider. |
| `AUTH_OAUTH2_PROVIDER_ISSUER` | string | `AUTH_SERVER_URL` | Custom issuer URL for token `iss` claim. |
| `AUTH_OAUTH2_PROVIDER_LOGIN_URL` | string | `AUTH_CLIENT_URL/oauth2/login` | URL where `/oauth2/authorize` redirects for user login/consent. |
| `AUTH_OAUTH2_PROVIDER_ACCESS_TOKEN_TTL` | int | `900` | Access token lifetime in seconds (15 minutes). |
| `AUTH_OAUTH2_PROVIDER_REFRESH_TOKEN_TTL` | int | `2592000` | Refresh token lifetime in seconds (30 days). |
| `AUTH_OAUTH2_PROVIDER_DCR_ENABLED` | bool | `false` | Enable Dynamic Client Registration (RFC 7591). |
| `AUTH_OAUTH2_PROVIDER_DCR_MAX_CLIENTS_PER_USER` | int | `0` | Maximum DCR clients per user (0 = unlimited). |
| `AUTH_OAUTH2_PROVIDER_CIMD_ENABLED` | bool | `false` | Enable Client ID Metadata Document support. |

### Hardcoded Values

| Value | Duration | Description |
|-------|----------|-------------|
| Auth request TTL | 10 minutes | Time before an uncompleted authorization request expires. |
| Authorization code TTL | 5 minutes | Time before an unexchanged authorization code expires. |
| RSA key size | 2048 bits | Signing key size. |
| Signing algorithm | RS256 | JWT signing algorithm. |

### Per-Client Overrides

Each client has `access_token_lifetime` and `refresh_token_lifetime` fields (in seconds). If set to a value > 0, they override the global defaults.

---

## Database Schema

### `auth.oauth2_signing_keys`

RSA key pairs for JWT signing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Row identifier |
| `private_key` | bytea | AES-encrypted PKCS#1 DER private key |
| `public_key` | bytea | PKIX DER public key |
| `algorithm` | text | `"RS256"` |
| `key_id` | text UNIQUE | Key identifier (UUID), used as JWT `kid` header |
| `is_active` | boolean | Whether this key is the active signing key |
| `created_at` | timestamptz | Creation timestamp |
| `expires_at` | timestamptz | Optional expiration (not enforced) |

### `auth.oauth2_client_types`

Lookup table for client type values.

| Column | Type | Description |
|--------|------|-------------|
| `value` | text PK | Type identifier |
| `comment` | text | Human-readable description |

Values: `registered`, `dcr`, `client_id_metadata_document`

### `auth.oauth2_clients`

Registered OAuth2 client applications.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Row identifier |
| `client_id` | text UNIQUE | Client identifier (UUID for registered/DCR, HTTPS URL for CIMD) |
| `client_secret_hash` | text nullable | bcrypt hash (null for public clients) |
| `client_name` | text | Human-readable name |
| `client_uri` | text nullable | Client website URL |
| `logo_uri` | text nullable | Client logo URL |
| `redirect_uris` | text[] | Registered redirect URIs |
| `grant_types` | text[] | Allowed grant types (default: `{authorization_code}`) |
| `response_types` | text[] | Allowed response types (default: `{code}`) |
| `scopes` | text[] | Allowed scopes (default: `{openid}`) |
| `is_public` | boolean | Public client flag |
| `token_endpoint_auth_method` | text | Auth method (default: `client_secret_basic`) |
| `id_token_signed_response_alg` | text | `"RS256"` |
| `access_token_lifetime` | integer | Per-client override (0 = use global, default: 900) |
| `refresh_token_lifetime` | integer | Per-client override (0 = use global, default: 2592000) |
| `type` | text NOT NULL | Client type, FK to `oauth2_client_types` (default: `registered`) |
| `metadata_document_fetched_at` | timestamptz nullable | When CIMD metadata was last fetched (null for non-CIMD clients) |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Auto-updated via trigger |

### `auth.oauth2_auth_requests`

In-flight authorization requests.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Request identifier (used as `request_id` in login flow) |
| `client_id` | text FK | References `oauth2_clients.client_id` |
| `scopes` | text[] | Requested scopes |
| `redirect_uri` | text | Where to redirect after authorization |
| `state` | text nullable | CSRF protection parameter |
| `nonce` | text nullable | OIDC nonce for ID token |
| `response_type` | text | `"code"` |
| `code_challenge` | text nullable | PKCE code challenge |
| `code_challenge_method` | text nullable | PKCE method (`S256` or `plain`) |
| `resource` | text nullable | RFC 8707 resource indicator |
| `user_id` | uuid nullable FK | Set after user completes login. References `users.id` |
| `done` | boolean | Whether authorization has been completed |
| `auth_time` | timestamptz nullable | When the user authenticated |
| `created_at` | timestamptz | Creation timestamp |
| `expires_at` | timestamptz | Expiration (10 min from creation) |

### `auth.oauth2_authorization_codes`

Authorization codes pending exchange.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Row identifier |
| `code_hash` | text UNIQUE | `hex(SHA256(code))` |
| `auth_request_id` | uuid FK | References `oauth2_auth_requests.id` |
| `created_at` | timestamptz | Creation timestamp |
| `expires_at` | timestamptz | Expiration (5 min from creation) |

### `auth.oauth2_refresh_tokens`

OAuth2 refresh tokens (separate from session refresh tokens).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid PK | Row identifier |
| `token_hash` | text UNIQUE | `hex(SHA256(token))` |
| `auth_request_id` | uuid nullable FK | References `oauth2_auth_requests.id` (SET NULL on delete) |
| `client_id` | text FK | References `oauth2_clients.client_id` |
| `user_id` | uuid FK | References `users.id` |
| `scopes` | text[] | Scopes bound to this token |
| `created_at` | timestamptz | Creation timestamp |
| `expires_at` | timestamptz | Expiration |

### Indexes

```sql
oauth2_auth_requests_client_id_idx     ON oauth2_auth_requests (client_id)
oauth2_auth_requests_expires_at_idx    ON oauth2_auth_requests (expires_at)
oauth2_authorization_codes_expires_at_idx ON oauth2_authorization_codes (expires_at)
oauth2_refresh_tokens_user_id_idx      ON oauth2_refresh_tokens (user_id)
oauth2_refresh_tokens_client_id_idx    ON oauth2_refresh_tokens (client_id)
oauth2_refresh_tokens_expires_at_idx   ON oauth2_refresh_tokens (expires_at)
```

### Foreign Key Cascade Behavior

| Relationship | ON UPDATE | ON DELETE |
|---|---|---|
| `auth_requests.client_id` → `clients.client_id` | CASCADE | CASCADE |
| `auth_requests.user_id` → `users.id` | CASCADE | CASCADE |
| `authorization_codes.auth_request_id` → `auth_requests.id` | CASCADE | CASCADE |
| `refresh_tokens.auth_request_id` → `auth_requests.id` | CASCADE | SET NULL |
| `refresh_tokens.client_id` → `clients.client_id` | CASCADE | CASCADE |
| `refresh_tokens.user_id` → `users.id` | CASCADE | CASCADE |

---

## Error Responses

All OAuth2 endpoints use the standard OAuth2 error format:

```json
{
  "error": "<error_code>",
  "error_description": "<human_readable_message>"
}
```

| Error Code | HTTP Status | When |
|-----------|------------|------|
| `invalid_request` | 400 | Missing or malformed parameters |
| `invalid_client` | 401 | Client not found or authentication failed |
| `invalid_grant` | 400 | Authorization code or refresh token invalid/expired, PKCE failure |
| `invalid_scope` | 400 | Requested scope not in client's allowed scopes |
| `invalid_token` | 401 | Access token invalid (userinfo endpoint) |
| `invalid_client_metadata` | 400 | Invalid client registration data |
| `unsupported_response_type` | 400 | Response type other than `code` |
| `unsupported_grant_type` | 400 | Grant type not `authorization_code` or `refresh_token` |
| `server_error` | 500 | Internal error |
