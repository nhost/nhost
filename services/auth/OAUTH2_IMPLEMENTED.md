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
11. [Client ID Metadata Document (RFC 9728)](#client-id-metadata-document-rfc-9728)
12. [Discovery and Metadata (RFC 8414)](#discovery-and-metadata-rfc-8414)
13. [Token Introspection (RFC 7662)](#token-introspection-rfc-7662)
14. [Token Revocation (RFC 7009)](#token-revocation-rfc-7009)
15. [Resource Indicators (RFC 8707)](#resource-indicators-rfc-8707)
16. [Key Management and JWKS](#key-management-and-jwks)
17. [Security Measures](#security-measures)
18. [Configuration](#configuration)
19. [Database Schema](#database-schema)
20. [Appendix A: Changes to Existing Code](#appendix-a-changes-to-existing-code)

---

## Overview

Nhost Auth acts as an OAuth2 Authorization Server and OpenID Connect Provider. External applications can use standard OAuth2/OIDC flows to authenticate Nhost users and obtain access tokens, ID tokens, and refresh tokens.

The implementation follows the controller/workflow pattern used throughout Nhost Auth: endpoints are defined in the OpenAPI spec, generated via oapi-codegen, and implemented as controller methods that delegate to an `oauth2.Provider` struct for business logic. The OAuth2 provider code lives in `go/oauth2/` as a self-contained package with its own interfaces (`Signer`, `DBClient`, `PasswordHasher`, etc.), wired to the controller at initialization time.

---

## RFC Compliance Matrix

| RFC | Title | Status | Notes |
|-----|-------|--------|-------|
| [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749) | OAuth 2.0 Authorization Framework | Partial | Authorization Code grant only. Implicit, Password, and Client Credentials grants not implemented. |
| [RFC 6750](https://datatracker.ietf.org/doc/html/rfc6750) | OAuth 2.0 Bearer Token Usage | Full | Bearer tokens in `Authorization` header. |
| [RFC 7009](https://datatracker.ietf.org/doc/html/rfc7009) | OAuth 2.0 Token Revocation | Partial | Refresh tokens revoked from DB. Access tokens are stateless JWTs and cannot be revoked. Client authentication required. Always returns 200. |
| [RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517) | JSON Web Key (JWK) | Full | JWKS endpoint serves RSA public keys. |
| [RFC 7519](https://datatracker.ietf.org/doc/html/rfc7519) | JSON Web Token (JWT) | Full | Access tokens and ID tokens are RS256-signed JWTs. |
| [RFC 7591](https://datatracker.ietf.org/doc/html/rfc7591) | OAuth 2.0 Dynamic Client Registration | Partial | Requires Bearer authentication (user must be logged in). Client update (RFC 7592) not implemented via DCR endpoint. |
| [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) | PKCE | Partial | Only S256 method supported. `plain` method is explicitly rejected. PKCE is optional (not enforced for public clients). |
| [RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662) | OAuth 2.0 Token Introspection | Full | Supports both refresh tokens (DB lookup) and access tokens (JWT verification). Client authentication required. |
| [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) | OAuth 2.0 Authorization Server Metadata | Full | Both `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server`. |
| [RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707) | Resource Indicators for OAuth 2.0 | Partial | `resource` parameter accepted and stored. Not used for audience restriction in issued tokens. |
| [RFC 9101](https://datatracker.ietf.org/doc/html/rfc9101) | JWT-Secured Authorization Request (JAR) | Not Supported | `request` parameter accepted in schema but explicitly rejected with `request_not_supported` (valid per RFC 9101 Section 10.4). |
| [RFC 9207](https://datatracker.ietf.org/doc/html/rfc9207) | OAuth 2.0 Authorization Server Issuer Identification | Full | `iss` parameter included in authorization response redirects. `authorization_response_iss_parameter_supported: true` advertised in discovery. |
| [RFC 9728](https://datatracker.ietf.org/doc/html/rfc9728) | OAuth 2.0 Client ID Metadata Document | Full | URL-based client_id with metadata fetched from the URL. SSRF protection, 1h cache TTL. |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | OpenID Connect | Partial | ID tokens, UserInfo endpoint, `nonce`, standard claims. `prompt` parameter accepted. No RP-initiated logout, no session management, no pairwise subject identifiers. |

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
| POST | `/oauth2/authorize` | `application/x-www-form-urlencoded` | Authorization endpoint (POST variant). Same behavior as GET. |
| POST | `/oauth2/token` | `application/x-www-form-urlencoded` | Token endpoint. Exchanges authorization codes and refresh tokens for tokens. |

### OIDC

| Method | Path | Description |
|--------|------|-------------|
| GET | `/oauth2/userinfo` | Returns user claims for the authenticated access token, filtered by token scopes. |
| POST | `/oauth2/userinfo` | Same as GET (per OIDC spec). |
| GET | `/oauth2/jwks` | JSON Web Key Set with RSA public signing keys. |

### Token Management

| Method | Path | Content-Type | Description |
|--------|------|-------------|-------------|
| POST | `/oauth2/revoke` | `application/x-www-form-urlencoded` | Token revocation (RFC 7009). Requires client authentication. |
| POST | `/oauth2/introspect` | `application/x-www-form-urlencoded` | Token introspection (RFC 7662). Requires client authentication. |

### Dynamic Client Registration

| Method | Path | Content-Type | Description |
|--------|------|-------------|-------------|
| POST | `/oauth2/register` | `application/json` | Register a new OAuth2 client (RFC 7591). Requires Bearer authentication. |

### Login/Consent API (called by frontend consent UI)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/oauth2/login?request_id={uuid}` | Retrieve auth request details for the consent screen. |
| POST | `/oauth2/login` | Complete login/consent. Requires authenticated user (Bearer token). Generates authorization code. |

### Client Management (via Hasura GraphQL)

Client CRUD operations are exposed through the Hasura GraphQL API, not as REST endpoints. The database tables are tracked in Hasura metadata and two SQL functions are available as mutations:

- **`create_oauth2_client`** — Creates a new client. Accepts client name, secret, redirect URIs, scopes, etc. Hashes the secret with bcrypt, derives `is_public` from whether a secret is provided.
- **`modify_oauth2_client`** — Updates an existing client. NULL parameters keep existing values. Empty string for secret removes it (makes client public).
- **DELETE** — Direct table operation via Hasura GraphQL.
- **Query** — Clients can be queried via standard Hasura GraphQL queries on the `oauth2_clients` table.

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
   &prompt=<prompt>              (optional, forwarded to login UI)
   &resource=<resource_uri>      (optional, RFC 8707)

   Server validates: client exists, redirect_uri registered, scopes allowed,
   response_type is "code". Creates auth request in DB (expires in 10 min).

   → 302 redirect to login UI with ?request_id=<uuid>[&prompt=<prompt>]

2. GET /oauth2/login?request_id=<uuid>

   Consent UI fetches request details: client name, requested scopes, redirect URI.

3. POST /oauth2/login
   Authorization: Bearer <user_session_jwt>
   Body: { "requestId": "<uuid>" }

   Server sets user_id on auth request, generates authorization code (UUID),
   stores SHA256(code) in DB (expires in 5 min).

   → { "redirectUri": "<redirect_uri>?code=<code>&iss=<issuer>&state=<state>" }

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

**Note**: The authorization response includes `iss` (issuer) as a query parameter per RFC 9207.

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
| S256 | `S256` | `code_challenge = BASE64URL(SHA256(code_verifier))`. Required if PKCE is used. |

The `plain` method is **explicitly rejected** with error `"Unsupported code_challenge_method, only S256 is supported"`.

### Behavior

- PKCE is **optional**. If `code_challenge` is not sent in the authorization request, no PKCE validation occurs at the token endpoint.
- If `code_challenge` is present in the authorization request, `code_verifier` is **required** at the token endpoint.
- PKCE parameters are stored in the auth request record and validated during code exchange.
- Uses constant-time comparison (`subtle.ConstantTimeCompare`) to prevent timing attacks.

### Validation Logic (`ValidatePKCE`)

```
if no code_challenge stored → pass (PKCE not used)
if code_challenge stored but no code_verifier provided → error: "Missing code_verifier"
if method is not S256 → error: "Unsupported code_challenge_method"
if BASE64URL(SHA256(code_verifier)) != stored code_challenge → error: "Invalid code_verifier"
```

---

## Token Formats

### Access Token (JWT)

- **Format**: JWT signed with RS256
- **Default lifetime**: 900 seconds (15 minutes)
- **Configurable**: globally via `AUTH_OAUTH2_PROVIDER_ACCESS_TOKEN_TTL`, per-client via `access_token_lifetime`
- **Headers**: `{ "alg": "RS256", "typ": "JWT", "kid": "<key_id>" }`

**Standard claims**:
```json
{
  "iss": "<issuer_url>",
  "sub": "<user_uuid>",
  "aud": "<client_id>",
  "iat": 1234567890,
  "exp": 1234568790,
  "scope": "openid profile email"
}
```

**With `graphql` scope** (adds Hasura-compatible claims):
```json
{
  "iss": "<issuer_url>",
  "sub": "<user_uuid>",
  "aud": "<client_id>",
  "iat": 1234567890,
  "exp": 1234568790,
  "scope": "openid profile email graphql",
  "https://hasura.io/jwt/claims": {
    "x-hasura-allowed-roles": ["user", "me"],
    "x-hasura-default-role": "user",
    "x-hasura-user-id": "<user_uuid>"
  }
}
```

The `https://hasura.io/jwt/claims` namespace is only included when the `graphql` scope is requested, allowing access tokens to be used directly with Hasura for authorization. Roles are fetched from the user's assigned roles in the database.

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
- `nonce`: included if provided in the authorization request (not included on refresh)
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
- **Lifetime**: 5 minutes (hardcoded, `AuthCodeTTL`)
- **Storage**: SHA256 hash stored in database
- **One-time use**: deleted immediately after exchange (whether successful or not)
- **Binding**: tied to the auth request which contains client_id, redirect_uri, scopes, PKCE challenge

---

## Scopes and Claims

### Supported Scopes

| Scope | Effect |
|-------|--------|
| `openid` | Required for OIDC. Triggers ID token issuance. Default if no scope specified. |
| `profile` | Adds `name`, `picture`, `locale` to ID token and UserInfo (if values exist on user). |
| `email` | Adds `email`, `email_verified` to ID token and UserInfo (if user has email). |
| `phone` | Adds `phone_number`, `phone_number_verified` to ID token and UserInfo (if user has phone). |
| `offline_access` | Recognized in discovery metadata. Refresh tokens are issued regardless of this scope. |
| `graphql` | Adds Hasura GraphQL claims (`https://hasura.io/jwt/claims`) to access tokens. Includes user roles, default role, and user ID. |

### Scope Validation

- Requested scopes are validated against the client's configured `scopes` array.
- If no scope is requested, defaults to `["openid"]`.
- An unrecognized or disallowed scope returns `invalid_scope`.

### Default Client Scopes

- All creation paths default to: `openid profile email phone offline_access graphql`
- Configurable at creation time via DCR `scope` field, CIMD metadata `scope` field, or Hasura mutation `scopes` parameter

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

The UserInfo endpoint (`/oauth2/userinfo`) returns user claims **filtered by the token's scopes**. It extracts the `scope` claim from the JWT access token and only returns claims matching the granted scopes:

| Scope | Claim | Condition |
|-------|-------|-----------|
| (always) | `sub` | Always (user UUID) |
| `email` | `email`, `email_verified` | If user has email |
| `profile` | `name` | If `display_name` non-empty |
| `profile` | `picture` | If `avatar_url` non-empty |
| `profile` | `locale` | If `locale` non-empty |
| `phone` | `phone_number`, `phone_number_verified` | If user has phone number |

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

### Client Authentication

Client authentication via `authenticateClient` is required at the following endpoints:

- **Token endpoint** (`/oauth2/token`) — during code exchange and refresh token grants
- **Introspection endpoint** (`/oauth2/introspect`) — `client_id` is required
- **Revocation endpoint** (`/oauth2/revoke`) — `client_id` is required

All three endpoints support two authentication methods for confidential clients:

- **`client_secret_post`**: Client credentials (`client_id`, `client_secret`) sent in the form body.
- **`client_secret_basic`**: Client credentials sent via `Authorization: Basic` header (RFC 6749 Section 2.3.1). The header value is `base64(client_id:client_secret)`.

When `client_secret_basic` is used, the credentials are extracted from the `Authorization` header and injected into the request before processing. Body values take precedence if both are provided.

The `authenticateClient` function:

1. If `client_id` is provided in the request and doesn't match the expected client → `invalid_client`
2. Look up client by expected `client_id`
3. If client is public (`is_public = true`) → pass (no secret required)
4. If client is confidential:
   - `client_secret` must be provided → `invalid_client` if missing
   - Verify `client_secret` against stored bcrypt hash → `invalid_client` if mismatch

### Client ID Format

Generated as `nhoa_` + 16 hex characters (e.g., `nhoa_a1b2c3d4e5f67890`), derived from `SHA256(UUID)[:16]`. Unique constraint enforced in database. For CIMD clients, the client_id is the HTTPS URL itself.

### Client Secret Generation

For confidential clients: `uuid.NewString() + uuid.NewString()` (two concatenated UUIDs, ~72 characters). Hashed with bcrypt before storage. The plaintext secret is returned **only once** during registration and cannot be retrieved later.

---

## Dynamic Client Registration (RFC 7591)

### Endpoint

`POST /oauth2/register`

### Authentication

**Bearer authentication required.** The user must be logged in with a valid JWT. The authenticated user is recorded as the client's `created_by` owner. This is an optional security measure allowed by RFC 7591.

### Request

```json
{
  "client_name": "My App",
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "scope": "openid profile email",
  "token_endpoint_auth_method": "client_secret_basic",
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
| `scope` | No | `"openid profile email phone offline_access"` |
| `token_endpoint_auth_method` | No | `"client_secret_basic"` (per RFC 7591) |
| `client_uri` | No | — |
| `logo_uri` | No | — |

### Response (201 Created)

```json
{
  "client_id": "nhoa_a1b2c3d4e5f67890",
  "client_secret": "<secret>",
  "client_secret_expires_at": 0,
  "client_name": "My App",
  "redirect_uris": ["https://app.example.com/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"],
  "scope": "openid profile email phone offline_access",
  "token_endpoint_auth_method": "client_secret_basic"
}
```

- `client_secret` is only present for confidential clients (`token_endpoint_auth_method != "none"`)
- `client_secret` is returned only at registration time
- `client_secret_expires_at` is `0` (non-expiring)

### Per-User Client Limit

When `AUTH_OAUTH2_PROVIDER_DCR_MAX_CLIENTS_PER_USER` is set to a value > 0, the endpoint checks the number of existing clients owned by the user and rejects registration if the limit is reached.

### Limitations

- RFC 7592 (Client Configuration Management) not implemented via DCR — use Hasura GraphQL mutations instead
- No software statement support

---

## Client ID Metadata Document (RFC 9728)

### Specification

[RFC 9728 — OAuth 2.0 Client ID Metadata Document](https://datatracker.ietf.org/doc/html/rfc9728)

### Overview

Instead of pre-registering a client via admin endpoints or DCR, a client can present an HTTPS URL as its `client_id` (e.g., `https://my-mcp-tool.example.com/oauth/client.json`). The authorization server fetches JSON metadata from that URL to learn the client's name, redirect URIs, logo, etc. This is particularly useful for the MCP (Model Context Protocol) authorization use case.

CIMD clients are always **public** (no client secret). They are upserted into the `oauth2_clients` table with `type = 'client_id_metadata_document'`, preserving existing FK constraints and requiring no changes to the token flow.

### Detection

A `client_id` is treated as a CIMD client when all of the following are true:
- Scheme is `https` (or `http` if `CIMDAllowInsecureTransport` is set for development)
- Host is non-empty
- Path is non-empty and not just `/`

Otherwise, the client_id is looked up as a regular registered or DCR client.

### URL Validation (`ValidateCIMDURL`)

The client_id URL must satisfy:
- **HTTPS only** — HTTP and other schemes are rejected (unless `CIMDAllowInsecureTransport`)
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

**Development mode**: When `CIMDAllowInsecureTransport` is enabled, an insecure HTTP client is used that skips TLS verification and allows HTTP URLs, but still enforces timeouts.

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
  "issuer": "<issuer>",
  "authorization_endpoint": "<issuer>/oauth2/authorize",
  "token_endpoint": "<issuer>/oauth2/token",
  "userinfo_endpoint": "<issuer>/oauth2/userinfo",
  "jwks_uri": "<issuer>/oauth2/jwks",
  "revocation_endpoint": "<issuer>/oauth2/revoke",
  "introspection_endpoint": "<issuer>/oauth2/introspect",
  "registration_endpoint": "<issuer>/oauth2/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "scopes_supported": ["openid", "profile", "email", "phone", "offline_access", "graphql"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
  "code_challenge_methods_supported": ["S256"],
  "request_parameter_supported": false,
  "authorization_response_iss_parameter_supported": true
}
```

The `issuer` and all endpoint URLs are derived from the JWT signer's configured issuer (which comes from the `HASURA_GRAPHQL_JWT_SECRET` configuration).

When the OAuth2 provider is disabled, both endpoints return `nil` (no response body).

### Conditional Fields

| Field | Condition | Value |
|-------|-----------|-------|
| `registration_endpoint` | Always present | `<issuer>/oauth2/register` |
| `client_id_metadata_document_supported` | CIMD enabled | `true` |

---

## Token Introspection (RFC 7662)

### Endpoint

`POST /oauth2/introspect` (`application/x-www-form-urlencoded`)

### Authentication

**Client authentication is required.** The `client_id` parameter is mandatory, and the client is authenticated via `authenticateClient` (public clients pass with just the ID; confidential clients need their secret). Supports both `client_secret_post` and `client_secret_basic`.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | The token to introspect |
| `token_type_hint` | No | `access_token` or `refresh_token` |
| `client_id` | Yes | Client identifier (required for authentication) |
| `client_secret` | Conditional | Required for confidential clients |

### Introspection Logic

1. Authenticate the client.
2. If `token_type_hint` is `refresh_token` or unset: look up `SHA256(token)` in refresh tokens table.
   - If found and not expired → return active response with refresh token metadata.
   - If hint was explicitly `refresh_token` and not found → return `{ "active": false }`.
3. Parse token as JWT, verify RS256 signature against the signing key, validate claims.
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
  "iss": "<issuer>",
  "token_type": "refresh_token"
}
```

### Active Access Token Response

```json
{
  "active": true,
  "client_id": "<client_id>",
  "sub": "<user_uuid>",
  "scope": "openid profile email",
  "exp": 1234568790,
  "iat": 1234567890,
  "iss": "<issuer>",
  "token_type": "access_token"
}
```

**Note**: `client_id` and `scope` in the access token response are only included if the JWT contains `aud` and `scope` claims respectively.

---

## Token Revocation (RFC 7009)

### Endpoint

`POST /oauth2/revoke` (`application/x-www-form-urlencoded`)

### Authentication

**Client authentication is required.** The `client_id` parameter is mandatory, and the client is authenticated via `authenticateClient`. Supports both `client_secret_post` and `client_secret_basic`.

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `token` | Yes | The token to revoke |
| `token_type_hint` | No | Accepted but ignored |
| `client_id` | Yes | Client identifier (required for authentication) |
| `client_secret` | Conditional | Required for confidential clients |

### Behavior

1. Authenticate the client.
2. Compute `SHA256(token)` and attempt to delete the matching refresh token from the database.
3. Always return `200 OK` regardless of whether the token existed or was already revoked (per RFC 7009 security considerations).

### Limitations

- **Only refresh tokens can be revoked.** Access tokens are stateless JWTs and cannot be invalidated server-side. Clients must wait for the access token to expire.
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

### Signing Key

The OAuth2 provider reuses the existing Nhost Auth JWT signing infrastructure configured via `HASURA_GRAPHQL_JWT_SECRET`. There is no separate OAuth2-specific signing key table.

- **Algorithm**: RS256 (RSA PKCS#1 v1.5 with SHA-256) — **required** when the OAuth2 provider is enabled
- The provider requires an RS256 key to be configured; other algorithms will prevent the OAuth2 provider from starting
- The signing key is managed by the existing `JWTGetter`, which the OAuth2 provider accesses via the `Signer` interface

### JWKS Endpoint

`GET /oauth2/jwks` returns the public key(s) from the existing JWT configuration:

```json
{
  "keys": [
    {
      "kty": "RSA",
      "use": "sig",
      "alg": "RS256",
      "kid": "<key_id>",
      "n": "<base64url_modulus>",
      "e": "AQAB"
    }
  ]
}
```

### Limitations

- No automatic key rotation.
- Key management follows the same process as the existing Nhost Auth JWT key configuration.

---

## Security Measures

### Token Hashing

All secrets stored in the database are hashed:

| Secret | Algorithm | Storage |
|--------|-----------|---------|
| Authorization codes | `hex(SHA256(code))` | `oauth2_authorization_codes.code_hash` |
| Refresh tokens | `hex(SHA256(token))` | `oauth2_refresh_tokens.token_hash` |
| Client secrets | bcrypt | `oauth2_clients.client_secret_hash` |

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

### Issuer Identification (RFC 9207)

- The `iss` (issuer) parameter is included in the authorization response redirect URL.
- This helps clients verify the response came from the expected authorization server, preventing mix-up attacks.

### Nonce (OIDC Replay Protection)

- The `nonce` parameter from the authorization request is stored and included in the ID token.
- The client should verify the nonce in the ID token matches the one it sent.
- On refresh token grants, the nonce is not included in the reissued ID token.

### Scope Binding

- Scopes are validated against the client's allowed scopes at authorization time.
- Scopes are stored in the auth request and propagated to refresh tokens.
- Refresh token grants preserve the original scopes (no scope escalation).

### Expired Record Cleanup

The token endpoint performs opportunistic cleanup of expired records: on approximately 1 in 1000 requests, `DeleteExpiredRecords()` is called, which removes expired auth requests, authorization codes, and refresh tokens from the database.

### Rate Limiting

OAuth2 endpoints have specific rate limiting:
- `/oauth2/authorize` and `/oauth2/login` are brute-force protected (same rate limiter as sign-in endpoints).
- `/oauth2/register` uses the signup rate limiter.
- `/oauth2/token` and `/oauth2/introspect` have a dedicated rate limiter (default: burst 100, interval 5 minutes).

---

## Configuration

### Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUTH_OAUTH2_PROVIDER_ENABLED` | bool | `false` | Enable/disable the OAuth2 provider. |
| `AUTH_OAUTH2_PROVIDER_LOGIN_URL` | string | `AUTH_CLIENT_URL/oauth2/login` | URL where `/oauth2/authorize` redirects for user login/consent. |
| `AUTH_OAUTH2_PROVIDER_ACCESS_TOKEN_TTL` | int | `900` | Access token lifetime in seconds (15 minutes). |
| `AUTH_OAUTH2_PROVIDER_REFRESH_TOKEN_TTL` | int | `2592000` | Refresh token lifetime in seconds (30 days). |
| `AUTH_OAUTH2_PROVIDER_DCR_ENABLED` | bool | `false` | Enable Dynamic Client Registration (RFC 7591). |
| `AUTH_OAUTH2_PROVIDER_DCR_MAX_CLIENTS_PER_USER` | int | `0` | Maximum DCR clients per user (0 = unlimited). |
| `AUTH_OAUTH2_PROVIDER_CIMD_ENABLED` | bool | `false` | Enable Client ID Metadata Document support (RFC 9728). |
| `AUTH_OAUTH2_PROVIDER_CIMD_ALLOW_INSECURE_TRANSPORT` | bool | `false` | Allow HTTP (non-HTTPS) for CIMD URLs. For development/testing only. |

### Hardcoded Values

| Value | Duration | Description |
|-------|----------|-------------|
| Auth request TTL | 10 minutes | Time before an uncompleted authorization request expires (`AuthRequestTTL`). |
| Authorization code TTL | 5 minutes | Time before an unexchanged authorization code expires (`AuthCodeTTL`). |
| Signing algorithm | RS256 | JWT signing algorithm (required). |

### Per-Client Overrides

Each client has `access_token_lifetime` and `refresh_token_lifetime` fields (in seconds). If set to a value > 0, they override the global defaults.

---

## Database Schema

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
| `client_id` | text UNIQUE | Client identifier (`nhoa_` prefix for registered/DCR, HTTPS URL for CIMD) |
| `client_secret_hash` | text nullable | bcrypt hash (null for public clients) |
| `client_name` | text | Human-readable name |
| `client_uri` | text nullable | Client website URL |
| `logo_uri` | text nullable | Client logo URL |
| `redirect_uris` | text[] | Registered redirect URIs (default: `{}`) |
| `grant_types` | text[] | Allowed grant types (default: `{authorization_code}`) |
| `response_types` | text[] | Allowed response types (default: `{code}`) |
| `scopes` | text[] | Allowed scopes (default: `{openid,profile,email,phone,offline_access,graphql}`) |
| `is_public` | boolean | Public client flag (derived: true when no secret hash) |
| `token_endpoint_auth_method` | text | Auth method (default: `client_secret_basic`, forced to `none` for public clients) |
| `id_token_signed_response_alg` | text | `"RS256"` |
| `access_token_lifetime` | integer | Per-client override (default: 900) |
| `refresh_token_lifetime` | integer | Per-client override (default: 2592000) |
| `type` | text NOT NULL | Client type, FK to `oauth2_client_types` (default: `registered`) |
| `metadata` | jsonb nullable | Arbitrary metadata |
| `metadata_document_fetched_at` | timestamptz nullable | When CIMD metadata was last fetched (null for non-CIMD clients) |
| `created_by` | uuid nullable FK | User who created the client. References `users.id` (SET NULL on delete) |
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
| `code_challenge_method` | text nullable | PKCE method (only `S256` supported) |
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
| `clients.created_by` → `users.id` | CASCADE | SET NULL |
| `clients.type` → `client_types.value` | — | RESTRICT |

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

---

## Appendix A: Changes to Existing Code

This section describes modifications to existing files in `services/auth/go/` that were necessary to support the OAuth2 provider feature.

### `go/controller/jwt.go` — JWT Handling Enhancements

The JWTGetter was extended with methods required by the OAuth2 provider's `Signer` interface:

- **`RSASigningKey()`** — Returns the RSA private key and kid for OAuth2 token signing.
- **`JWKS()`** — Returns the JWKS array for the `/oauth2/jwks` endpoint.
- **`SignClaims(claims, exp)`** — Signs arbitrary claim maps (used for access tokens and ID tokens).
- **`ValidateToken(token)`** — Validates JWTs and returns structured `oauth2provider.ValidatedClaims`.
- **`GraphQLClaims()`** — Extracted from `GetToken()` to allow the OAuth2 provider to build Hasura-compatible claims for access tokens with the `graphql` scope.
- **`Issuer()`** — Returns the configured issuer string.
- **Signature change**: `NewJWTGetter()` and `decodeJWTSecret()` now accept a `defaultIssuer` parameter.

### `go/controller/workflows.go` — JWTGetter Pointer

- Changed `jwtGetter` field from value type to pointer (`*JWTGetter`) so the same instance can be shared between the Workflows and the OAuth2 provider.

### `go/controller/controller.go` — OAuth2 Provider Integration

- `DBClient` interface now composes `oauth2provider.DBClient` (adds ~20 OAuth2 database methods).
- Added `bcryptHasher` struct implementing `oauth2provider.PasswordHasher`.
- `Controller` struct gained `jwtGetter *JWTGetter` and `oauth2 *oauth2provider.Provider` fields.
- `New()` constructor conditionally initializes the OAuth2 provider when `config.OAuth2ProviderEnabled` is true.

### `go/controller/config.go` — Configuration Fields

Added 9 new fields to `Config` struct for OAuth2 provider settings (see [Configuration](#configuration)).

### `go/controller/errors.go` — Error Response Visitors

Added `VisitOauth2LoginGetResponse()` and `VisitOauth2LoginPostResponse()` methods for OAuth2 login endpoint error handling.

### `go/cmd/serve.go` — CLI Flags and Rate Limiting

- Added CLI flag definitions for all OAuth2 provider settings.
- Added rate limiting flags (`--rate-limit-oauth2-server-burst`, `--rate-limit-oauth2-server-interval`) with defaults of burst=100, interval=5 minutes.
- Validates that RS256 JWT algorithm is configured when OAuth2 provider is enabled.

### `go/cmd/config.go` — Flag-to-Config Mapping

Maps new CLI flags to the controller Config struct fields.

### `go/middleware/ratelimit/rate_limit.go` — OAuth2 Rate Limiting

- `/oauth2/authorize` and `/oauth2/login` added to brute-force protection.
- `/oauth2/register` added to signup rate limiter.
- New `isOAuth2Server()` function and dedicated rate limiter for `/oauth2/token` and `/oauth2/introspect`.
- `RateLimit()` function signature changed to accept `oauth2ServerLimit` and `oauth2ServerInterval` parameters.

### `go/migrations/hasura.go` — Hasura Metadata

- Added OAuth2 table tracking (oauth2_client_types, oauth2_clients, oauth2_auth_requests, oauth2_authorization_codes, oauth2_refresh_tokens).
- Added relationships from `auth.users` to OAuth2 entities (`oauth2Clients`, `oauth2AuthRequests`, `oauth2RefreshTokens`).
- Added function tracking for `create_oauth2_client` and `modify_oauth2_client` SQL functions.
- Added custom naming and field mappings for all OAuth2 tables.

### `go/oidc/idtoken.go` — Minor Lint Fix

Added `nolintlint` directive to `GetClaim()` function (cosmetic only).

### Test Files

- **`main_test.go`**: Updated `getController()` helper for new `NewJWTGetter()` signature. Added `testOAuth2Client()` helper.
- **`jwt_test.go`**: Updated for new `NewJWTGetter()` signature. Refactored to use dynamic test token generation.
- **`validator_test.go`**: Updated `getConfig()` helper to include all OAuth2 provider config fields with defaults.
