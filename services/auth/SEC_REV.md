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

---

### 11. No Audit Logging for OAuth2 Events

There is no audit trail for:
- Client registration/deletion
- Authorization grants/denials
- Token issuance/revocation
- Failed authentication attempts

This makes incident response and compliance difficult.

---

TODO:
- rate limiting?
- [factorio] jwt signing keys - move default to RS256 and also document they need this to oauth2
- issuer - implications? check billing and bragi
- evaluate CRUD operations on oauth2 clients, not part of any standard and graphql might be better, maybe using a pg function

---
