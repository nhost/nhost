# Summary of OAuth2/OIDC Identity Provider Endpoints (idp-oid branch)

This branch adds a full set of OAuth2/OpenID Connect Identity Provider (IdP) endpoints to the Nhost Auth service. This turns the auth service from purely an authentication service into an **OAuth2 Authorization Server / OpenID Provider**, allowing third-party applications to authenticate users via Nhost using standard OAuth2/OIDC flows.

---

## New Endpoints

### 1. Discovery Endpoints

| Endpoint | Method | Spec |
|---|---|---|
| `/.well-known/openid-configuration` | GET | [OpenID Connect Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html) / [RFC 8414](https://datatracker.ietf.org/doc/html/rfc8414) |
| `/.well-known/oauth-authorization-server` | GET | [RFC 8414 - OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) |

**Purpose:** Allow clients to auto-discover the authorization server's capabilities (endpoints, supported scopes, grant types, signing algorithms, etc.). Both endpoints return the same `OAuth2DiscoveryResponse` schema. The first is the OIDC-standard path, the second is the pure OAuth2-standard path.

**Spec compliance:** Both are defined by RFC 8414. The OIDC one is also required by OpenID Connect Discovery 1.0 Section 4.

---

### 2. Authorization Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/authorize` | GET | [RFC 6749 Section 3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-3.1) (OAuth2 Core) |
| `/oauth2/authorize` | POST | [RFC 6749 Section 3.1](https://datatracker.ietf.org/doc/html/rfc6749#section-3.1) (OAuth2 Core) |

**Purpose:** Initiates the OAuth2 Authorization Code flow. Validates the client request and redirects the user to a login/consent UI. Returns a 302 redirect.

**Parameters supported:**
- `client_id` (required) - RFC 6749 Section 2.2
- `redirect_uri` (required) - RFC 6749 Section 3.1.2
- `response_type` (optional, only `code`) - RFC 6749 Section 3.1.1
- `scope` (optional) - RFC 6749 Section 3.3
- `state` (optional) - RFC 6749 Section 4.1.1
- `nonce` (optional) - OpenID Connect Core Section 3.1.2.1
- `code_challenge` / `code_challenge_method` (optional, S256 only) - [RFC 7636 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636)
- `resource` (optional) - [RFC 8707 (Resource Indicators)](https://datatracker.ietf.org/doc/html/rfc8707)
- `prompt` (optional) - OpenID Connect Core Section 3.1.2.1
- `request` (optional) - [RFC 9101 (JWT-Secured Authorization Request)](https://datatracker.ietf.org/doc/html/rfc9101)

**Spec compliance:** Core OAuth2 (RFC 6749), PKCE (RFC 7636), OIDC Core, Resource Indicators (RFC 8707). Note: only the `code` response type is supported (no implicit or hybrid flows). The `request` parameter (JAR/RFC 9101) is accepted in the OpenAPI schema but **explicitly rejected** by the implementation with `request_not_supported` -- this is a spec-valid behavior per RFC 9101 Section 10.4. Also supports RFC 9728 (CIMD) when enabled -- the `client_id` can be a URL pointing to the client's metadata document.

---

### 3. Token Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/token` | POST | [RFC 6749 Section 3.2](https://datatracker.ietf.org/doc/html/rfc6749#section-3.2) |

**Purpose:** Exchange an authorization code for tokens, or refresh an existing token. Accepts `application/x-www-form-urlencoded` as required by the spec.

**Supported grant types:** `authorization_code`, `refresh_token`

**Request fields:** `grant_type`, `code`, `redirect_uri`, `client_id`, `client_secret`, `code_verifier` (PKCE), `refresh_token`, `resource` (RFC 8707)

**Response:** `access_token`, `token_type`, `expires_in`, `refresh_token`, `id_token`, `scope`

**Spec compliance:** RFC 6749 Section 4.1.3 (authorization code grant), RFC 6749 Section 6 (refresh token grant), RFC 7636 (PKCE code_verifier), RFC 8707 (resource indicator).

---

### 4. UserInfo Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/userinfo` | GET | [OpenID Connect Core Section 5.3](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo) |
| `/oauth2/userinfo` | POST | [OpenID Connect Core Section 5.3](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo) |

**Purpose:** Returns claims about the authenticated user based on the access token scopes. Requires Bearer authentication.

**Response claims:** `sub`, `name`, `email`, `email_verified`, `picture`, `locale`, `phone_number`, `phone_number_verified`

**Spec compliance:** OpenID Connect Core 1.0 Section 5.3. Both GET and POST are required by the spec.

---

### 5. JWKS Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/jwks` | GET | [RFC 7517 (JWK)](https://datatracker.ietf.org/doc/html/rfc7517) / [RFC 7518 (JWA)](https://datatracker.ietf.org/doc/html/rfc7518) |

**Purpose:** Returns the JSON Web Key Set containing the public keys used to sign OAuth2/OIDC tokens. Clients use this to verify token signatures.

**Response:** A `keys` array of JWK objects (with `kty`, `use`, `alg`, `kid`, `n`, `e` fields -- RSA key structure).

**Spec compliance:** RFC 7517, referenced from OIDC Discovery.

---

### 6. Token Revocation Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/revoke` | POST | [RFC 7009 - OAuth 2.0 Token Revocation](https://datatracker.ietf.org/doc/html/rfc7009) |

**Purpose:** Revoke an access token or refresh token.

**Request fields:** `token` (required), `token_type_hint` (optional: `access_token` or `refresh_token`), `client_id`, `client_secret`

**Spec compliance:** RFC 7009 Section 2.1.

---

### 7. Token Introspection Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/introspect` | POST | [RFC 7662 - OAuth 2.0 Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662) |

**Purpose:** Introspect a token to determine its current state (active/inactive) and metadata. Used by resource servers to validate tokens.

**Request fields:** `token` (required), `token_type_hint`, `client_id`, `client_secret`

**Response fields:** `active` (required), `scope`, `client_id`, `sub`, `exp`, `iat`, `iss`, `token_type`

**Spec compliance:** RFC 7662 Section 2.

---

### 8. Dynamic Client Registration Endpoint

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/register` | POST | [RFC 7591 - OAuth 2.0 Dynamic Client Registration](https://datatracker.ietf.org/doc/html/rfc7591) |

**Purpose:** Dynamically register a new OAuth2 client. Requires Bearer authentication.

**Request fields:** `client_name` (required), `redirect_uris` (required), `grant_types`, `response_types`, `scope`, `token_endpoint_auth_method` (one of: `client_secret_basic`, `client_secret_post`, `none`), `client_uri`, `logo_uri`

**Response:** Returns the registered client details including a `client_secret` and `client_secret_expires_at`.

**Spec compliance:** RFC 7591 Section 2. Note: requires authentication, which is an optional security measure allowed by the spec.

---

### 9. Login/Consent Helper Endpoints (Non-standard)

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/login` | GET | **Not part of any OAuth2/OIDC spec** |
| `/oauth2/login` | POST | **Not part of any OAuth2/OIDC spec** |

**Purpose:** These are internal helper endpoints for the consent/login UI:
- **GET** `/oauth2/login?request_id=<uuid>` - Called by the consent UI to retrieve details about the pending authorization request (client name, requested scopes, redirect URI). Returns `OAuth2LoginResponse`.
- **POST** `/oauth2/login` - Called by the consent UI after the user authenticates and consents. Accepts a `requestId`, requires Bearer auth (authenticated user), and returns a `redirectUri` that the UI should redirect to (containing the authorization code).

**Spec compliance:** These are implementation-specific endpoints needed to bridge the OAuth2 authorization flow with the consent UI. The OAuth2 spec intentionally leaves the user authentication/consent mechanism undefined, so this is a common implementation pattern (similar to Hydra's login/consent flow).

---

### 10. Client Management Endpoints (Non-standard / Admin)

| Endpoint | Method | Spec |
|---|---|---|
| `/oauth2/clients` | GET | **Not part of any OAuth2/OIDC spec** |
| `/oauth2/clients` | POST | **Not part of any OAuth2/OIDC spec** |
| `/oauth2/clients/{clientId}` | GET | **Not part of any OAuth2/OIDC spec** |
| `/oauth2/clients/{clientId}` | PUT | **Not part of any OAuth2/OIDC spec** |
| `/oauth2/clients/{clientId}` | DELETE | **Not part of any OAuth2/OIDC spec** |

**Purpose:** Admin CRUD endpoints for managing OAuth2 clients. All require Bearer authentication (admin-only). Separate from the RFC 7591 dynamic registration -- these provide full management capabilities:

- **List clients** - GET `/oauth2/clients`
- **Create client** - POST `/oauth2/clients` (returns `clientSecret` only on creation)
- **Get client** - GET `/oauth2/clients/{clientId}`
- **Update client** - PUT `/oauth2/clients/{clientId}`
- **Delete client** - DELETE `/oauth2/clients/{clientId}`

Client properties include: `clientName`, `redirectUris`, `grantTypes`, `responseTypes`, `scopes`, `isPublic`, `tokenEndpointAuthMethod`, `clientUri`, `logoUri`, `accessTokenLifetime`, `refreshTokenLifetime`.

**Spec compliance:** Not standardized. These are a common administrative feature. RFC 7592 (OAuth 2.0 Dynamic Client Registration Management) covers a similar concept but with a different API shape (using registration_access_token). These endpoints use a simpler admin-auth approach.

---

## Non-endpoint Features

### Client ID Metadata Document (CIMD) - RFC 9728

Implemented in `go/oauth2/cimd.go`. When enabled (`CIMDEnabled` config), the authorization endpoint accepts a **URL as the `client_id`** instead of requiring pre-registration. The server fetches the client's metadata JSON from that URL.

**How it works:**
1. If `client_id` is an HTTPS URL with a path, it's treated as a CIMD client
2. The server validates the URL (no fragments, credentials, dot segments, private IPs)
3. Fetches the JSON metadata from the URL (max 5KB, 5s timeout, max 3 redirects)
4. Validates the metadata: `client_id` in the document must match the URL, `client_secret` fields must not be present, at least one `redirect_uri` required
5. Caches the resolved client in the database with a 1-hour TTL (`UpsertOAuth2CIMDClient`)

**Security protections:**
- SSRF prevention: DNS resolution checks reject private/loopback/link-local IPs before connecting
- HTTPS-only (unless `CIMDAllowInsecureTransport` is set for dev/testing)
- Redirect validation: max 3 redirects, must stay HTTPS
- Response size capped at 5KB
- Separate insecure HTTP client for dev (`newInsecureHTTPClient`) with TLS skip but still has timeouts

**Spec compliance:** [RFC 9728 - OAuth 2.0 Client ID Metadata Document](https://datatracker.ietf.org/doc/html/rfc9728)

---

## Non-endpoint Changes

The diff also includes:
- **Quoting style normalization**: Single quotes changed to double quotes in existing endpoint definitions (cosmetic, no functional change)
- **Removed email**: `support@nhost.io` contact email removed from API info
- **Schema reordering**: Existing schemas appear to be reordered alphabetically in the diff, but this is an artifact of the schemas being moved after the new endpoint definitions. The content of existing schemas is unchanged.

---

## Summary of Spec Coverage

| Spec | Status |
|---|---|
| RFC 6749 (OAuth 2.0 Core) | Authorization Code + Refresh Token grant types |
| RFC 7009 (Token Revocation) | Supported |
| RFC 7517/7518 (JWK/JWA) | JWKS endpoint |
| RFC 7591 (Dynamic Client Registration) | Supported (authenticated) |
| RFC 7636 (PKCE) | Supported (S256 only, plain disallowed) |
| RFC 7662 (Token Introspection) | Supported |
| RFC 8414 (Authorization Server Metadata) | Both OIDC and OAuth2 discovery |
| RFC 8707 (Resource Indicators) | Supported in authorize + token |
| RFC 9728 (Client ID Metadata Document) | Supported (CIMD) - client_id as URL with auto-fetched metadata, SSRF-safe, cached 1h |
| OpenID Connect Core 1.0 | Authorization code flow, UserInfo, ID tokens, nonce |
| OpenID Connect Discovery 1.0 | Supported |

**Not supported (by design):**
- Implicit flow (`response_type=token`)
- Hybrid flow (`response_type=code token`, etc.)
- `plain` PKCE method (only S256)
- RFC 7592 (Dynamic Client Registration Management) -- admin endpoints used instead
- RFC 9101 (JAR) -- `request` parameter is accepted in the OpenAPI spec but the implementation explicitly rejects it with `request_not_supported` (`authorize.go:140-147`)

---

## Review Feedback

### Spec Inconsistencies (should fix)

1. **`response_type` is marked `required: false` on `/oauth2/authorize`** -- RFC 6749 Section 3.1.1 says it's REQUIRED. The code correctly rejects it if missing (`authorize.go:149-151`), but the OpenAPI spec is misleading. A client reading the spec would think it's optional. Should be `required: true`.

2. **`request` parameter (JAR) is listed but rejected** -- The OpenAPI spec accepts a `request` parameter on the authorize endpoint, but the implementation explicitly rejects it with `request_not_supported` (`authorize.go:140-147`). Either remove the parameter from the OpenAPI spec or add a description noting it will return `request_not_supported`. As-is, a client would try to use it and get a surprising error.

### Potential Omissions (worth considering)

3. **RFC 9207 (Authorization Server Issuer Identification)** -- Adds an `iss` parameter to authorization responses (the redirect back to the client). It's a simple addition that prevents mix-up attacks when a client talks to multiple authorization servers. Increasingly recommended, and the implementation cost is trivial (one extra query parameter on the redirect).

4. **`client_credentials` grant type** -- Not supported. Fine if the service is purely user-authentication focused, but if there's a machine-to-machine use case (service-to-service API access), it would be needed. Intentional omission?

5. **Client authentication on introspect/revoke** -- The schemas accept `client_id`/`client_secret` as form body parameters (`client_secret_post`), but RFC 7662 Section 2.1 and RFC 7009 Section 2.1 also expect support for `client_secret_basic` (HTTP Basic auth header). Many OAuth2 clients default to Basic auth for these endpoints.

6. **OIDC parameters on authorize** -- Some commonly used OIDC parameters are missing: `login_hint` (pre-fill email on login screen), `max_age` (force re-auth after N seconds), `acr_values` (requested authentication levels). These are optional but frequently expected by OIDC client libraries.

### Things That Look Good

- No implicit/hybrid flow -- aligns with OAuth 2.1 direction
- S256-only PKCE -- correct, `plain` is basically useless
- CIMD (RFC 9728) with SSRF protections -- well done
- Separate admin CRUD vs RFC 7591 dynamic registration -- clean separation
- `request` parameter rejected but present in schema -- valid per RFC 9101 Section 10.4, just needs better documentation in the OpenAPI spec
