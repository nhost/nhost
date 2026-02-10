# OAuth2/OIDC Provider Security & Privacy Review

## Executive Summary

The OAuth2/OIDC implementation is **well-architected overall** with good adherence to RFCs and proper token lifecycle management. However, there are **1 critical, 2 high, and several medium severity issues** that should be addressed.

---

## HIGH

### 2. CORS: Wildcard Origin + Credentials

**File:** `go/cmd/serve.go:1338-1346`

```go
func getCORSOptions() oapimw.CORSOptions {
    return oapimw.CORSOptions{
        AllowedOrigins:   []string{"*"},
        AllowCredentials: true,
        // ...
    }
}
```

`Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true` is a well-known misconfiguration. While most modern browsers will block this combination (per the CORS spec, `*` is not allowed with credentials), some older user agents or improperly configured proxies may not enforce this. This configuration signals intent to allow any origin to make authenticated requests.

**Impact:** Potential cross-origin credential theft via CSRF-like attacks.

**Fix:** Use an explicit allowlist of trusted origins, or remove `AllowCredentials: true`.

### 3. Unauthenticated Dynamic Client Registration

**File:** `go/oauth2/register.go` — the `POST /oauth2/register` endpoint requires no authentication.

Any anonymous user can register unlimited OAuth2 clients. While RFC 7591 permits open registration, in practice this enables:
- Resource exhaustion (unlimited DB rows)
- Client enumeration
- Phishing attacks using legitimately registered client names/logos
- Pollution of the client registry

**Impact:** DoS, social engineering, resource exhaustion.

**Fix:** Require authentication or implement rate limiting on this endpoint.

---

### 11. No Audit Logging for OAuth2 Events

There is no audit trail for:
- Client registration/deletion
- Authorization grants/denials
- Token issuance/revocation
- Failed authentication attempts

This makes incident response and compliance difficult.

---

## Positive Security Findings

The implementation gets many things right:

- **Token hashing:** All tokens (auth codes, refresh tokens, client secrets) are hashed before storage — SHA256 for tokens, bcrypt for client secrets
- **Authorization code one-time use:** Codes are deleted immediately after exchange
- **Refresh token rotation:** Old tokens are deleted and new ones issued on refresh
- **Redirect URI strict matching:** Exact string match against whitelist, no substring/regex
- **PKCE support:** Enables secure public client flows
- **RS256 JWT signing:** Asymmetric signing with key ID headers for rotation
- **ID token audience binding:** `aud` claim correctly set to client ID
- **Nonce support:** OIDC replay attack prevention
- **Scope enforcement:** Per-client scope whitelisting at authorization time
- **UserInfo scope-gating:** PII only returned for granted scopes (email, profile, phone)
- **Request object rejection:** Simplifies attack surface
- **Only `response_type=code` supported:** No implicit flow token leakage
- **Proper error handling:** No internal details leaked, consistent error codes

---


---

## Summary of Recommendations (Priority Order)

1. **CRITICAL:** Fix `oauth2_clients.go:117` — generate real secrets for admin-created clients
2. **HIGH:** Fix CORS configuration — use explicit origin allowlist
3. **HIGH:** Add authentication or rate limiting to dynamic registration
4. **MEDIUM:** Use `subtle.ConstantTimeCompare` for PKCE verification
5. **MEDIUM:** URL-encode state and code parameters in redirect URIs
6. **MEDIUM:** Add client authentication to introspection endpoint
7. **LOW:** Add `aud` claim to access tokens
8. **LOW:** Track real `auth_time` across token refreshes
9. **LOW:** Add audit logging for OAuth2 lifecycle events
10. **LOW:** Schedule expired record cleanup

---

TODO:
- attach only hasura claims if a given scope is passed?
- attach custom claims using some scope-based mechanism?
- make the two above configurable at the client_id level and also at the user level?
- rate limiting?
- Client ID Metadata Documents (CIMD) (https://aaronparecki.com/2025/11/25/1/mcp-authorization-spec-update)
