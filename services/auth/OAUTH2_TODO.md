# OAuth2/OIDC Provider - Future Work

## Flows

- **Client Credentials Grant** - Machine-to-machine auth for backend services that don't act on behalf of a user
- **Device Authorization Grant (RFC 8628)** - For CLI tools and devices that can't easily open a browser

## Token & Security

- **Token introspection endpoint hardening** - Add rate limiting, require client authentication
- **Access token revocation** - Currently only refresh tokens can be revoked; add JWT blacklisting or switch to opaque access tokens
- **Key rotation** - Automated RSA signing key rotation with grace period for old keys

## User Experience

- **Consent management UI** - Allow users to view and revoke granted permissions per client
- **Consent screen frontend** - Build the actual consent UI that the `/oauth2/login` API backs

## Administration

- **Client management via Hasura console integration** - Manage OAuth2 clients from the Nhost dashboard
- **Client update endpoint** - PUT `/oauth2/clients/{clientId}` for modifying existing clients

## Specification Compliance

- **OIDC Session Management** - RP-initiated logout, back-channel logout
- **Scopes refinement** - Custom scope definitions beyond the standard OIDC scopes
- **PAR (Pushed Authorization Requests, RFC 9126)** - For enhanced security in authorization flows

## Operational

- **Expired token cleanup** - Background job to periodically delete expired auth requests, authorization codes, and refresh tokens
- **Metrics and observability** - Track token issuance rates, error rates, and client usage

---

# Code Review Findings

## BUGS

### 1. Missing `return` after error responses in `change_env.go:42-47, 53-64`
When JSON unmarshaling of custom claims or defaults fails, the error response is sent but execution falls through. This can cause double-writes to the response, panics, or silently proceeding with nil/invalid state.

```go
// line 42-47 - missing return after c.JSON(...)
if err := json.Unmarshal([]byte(ctrl.config.CustomClaims), &rawClaims); err != nil {
    c.JSON(http.StatusBadRequest, gin.H{...})
    // BUG: no return here!
}
```
Same pattern at lines 53-64 for `CustomClaimsDefaults`.

### 2. `ErrorRedirectURL` can panic on invalid URI (`oauth2/errors.go:32`)
```go
u, _ := url.Parse(redirectURI)  // error ignored
q := u.Query()                   // nil dereference if parse fails
```

### 3. `oauth2_login.go` hardcodes all errors as 400
Lines 30-37 and 84-92: every `oauthErr` from the provider is returned as `http.StatusBadRequest`, even `"server_error"` (which should be 500). Other endpoints like `oauth2_token.go` correctly use `oauth2provider.ErrorStatusCode()`.

### 4. `oauth2_discovery.go:19,34` returns `nil, nil` for disabled provider
Unlike every other oauth2 endpoint (which returns a proper error response), these return `nil, nil`, which may produce unexpected behavior in the generated server code.

---

## SECURITY

### 10. `modify_oauth2_client` SQL function lacks authorization (migration `00021`)
Unlike `create_oauth2_client` which takes `hasura_session` and extracts `x-hasura-user-id`, `modify_oauth2_client` has no session parameter and performs no ownership check. Any Hasura user with mutation access can modify any client.

### 11. SQL functions likely fail at runtime due to missing permissions (migration `00021`)
`create_oauth2_client` and `modify_oauth2_client` perform INSERT/UPDATE as `nhost_hasura`, which only has `SELECT` on `oauth2_clients`. Without `SECURITY DEFINER`, these will fail with permission errors.

### 12. Plaintext client secret in SQL function parameters (migration `00021:16,44,102,133`)
Raw client secrets appear in `pg_stat_activity` and PostgreSQL logs.

### 14. JWT middleware leaks validation details to client (`controller/jwt.go:468`)
```go
Message: fmt.Sprintf("error validating token: %s", err),
```
Exposes internal JWT validation error details (key type, signing algorithm, etc.) to the client.

---

## OPERATIONAL

### 18. Graceful shutdown uses already-cancelled context (`serve.go:1554`)
When the parent `ctx` is cancelled by OS signal, `server.Shutdown(ctx)` returns immediately without draining in-flight requests. Fix: use `context.WithTimeout(context.Background(), 15*time.Second)`.

### 19. Missing `http.ErrServerClosed` check (`serve.go:1545-1547`)
`ListenAndServe` always returns `ErrServerClosed` after `Shutdown()`. This is logged at error level on every normal shutdown.

### 20. WebAuthn attestation timeout type mismatch (`serve.go:557`, `config.go:112`)
Flag registered as `cli.IntFlag` (value: 60000) but read with `cmd.Duration()`. This likely results in a zero-second timeout in production.

### 21. No startup validation of `OAuth2ProviderLoginURL` (`serve.go:1482-1488`)
When `flagOAuth2ProviderEnabled` is true, RS256 is validated but `LoginURL` is not checked. An empty login URL causes silent runtime failures in the authorize flow.

### 22. No bounds checking on OAuth2 TTL values (`config.go:125-126`)
TTL values passed through without validation. Zero or negative values cause tokens that expire immediately or have undefined behavior.

---

## CODE DUPLICATION

### 23. `OAuth2ProviderEnabled` guard repeated in every handler (10+ occurrences)
This cross-cutting concern should be middleware.

### 24. `deptr[T any]` helper duplicated
Identical in `controller/controller.go:24` and `oauth2/helpers.go:44`.

### 25. `logError` helper duplicated
Identical in `controller/errors.go:66` and `oauth2/token.go:389`.

### 26. Seven near-identical oauth2 error helper functions
Each controller oauth2 file defines its own error wrapper with the same logic, just different generated types.

### 27. OAuth2 provider construction duplicated
Identical `oauth2provider.NewProvider(...)` call in `controller/controller.go:213-232` and `change_env.go:112-131`.

### 28. Token TTL resolution logic duplicated (`oauth2/token.go`)
Access/refresh TTL resolution (config default + per-client override) is copy-pasted between `issueTokens()` (lines 201-210) and `RefreshToken()` (lines 124-133).

### 29. Auth request fetch + expiration check duplicated (`oauth2/login.go`)
Both `GetLoginRequest()` and `CompleteLogin()` have identical fetch/validate/check-expiry blocks.

---

## NAMING / READABILITY

### 30. Persistent typos across multiple files
- `flagSMTPAPIHedaer` (should be `Header`) - `serve.go:57`
- `flagWebauhtnRPName` / `webauhtnRPID` / `WebauhtnAttestationTimeout` (should be `webauthn`) - `serve.go:77`, `config.go:61-75,112`
- `sqlIsDuplcateError` (should be `Duplicate`) - `controller/errors.go`
- `ErrRedirecToNotAllowed` (should be `Redirect`) - `controller/errors.go:42`
- `stringlice` (should be `stringSlice`) - `controller/config.go:11`

### 31. Dead code: `flagTrustedProxies` (`serve.go:34`)
Defined but never used or registered as a CLI flag.

### 32. Missing CLI flag for `flagWorkosScope` (`serve.go:158`)
The constant exists and is used in `oauth.go:181`, but no `cli.StringSliceFlag` is registered. WorkOS scope configuration is silently broken.

### 33. Magic strings for OAuth2 error codes
Error codes like `"invalid_request"`, `"invalid_grant"`, `"server_error"` are hardcoded as string literals throughout all files. Should be constants.

### 34. `Error.Err` field naming
The `oauth2.Error` struct has field `Err` which is confusing (shadows Go convention where `Err` is for sentinels). Should be `Code` or `ErrorCode`.

---

## SQL / MIGRATIONS

### 35. Missing indexes
- `oauth2_auth_requests.user_id` -- no index, but Hasura relationship queries filter on it
- `auth.users.ticket` -- `GetUserByTicket` does a full table scan

### 36. `DeleteExpired*` queries are unbounded
All expired-record cleanup queries lack `LIMIT`. On large tables, this locks many rows in a single transaction.

### 37. Missing `IF NOT EXISTS` on index creation (migration `00020`)
If migration partially succeeds and retries, index creation fails. Other migrations use `IF NOT EXISTS`.

### 38. Misleading query names for mutating operations
`GetUserByTicket`, `GetUserByEmailAndTicket`, `GetUserByPhoneNumberAndOTP`, and `GetProviderSession` all perform writes (UPDATE/DELETE) but are named as reads.

### 39. `modify_oauth2_client` COALESCE prevents setting fields to NULL (migration `00021:150-164`)
`COALESCE(new_value, existing_value)` means you can never intentionally clear a field like `client_uri`, `logo_uri`, or `metadata`.

### 40. No input validation in database functions (migration `00021`)
Neither `create_oauth2_client` nor `modify_oauth2_client` validates grant_types, response_types, token_endpoint_auth_method, redirect_uris, or TTL bounds.

---

## DESIGN

### 41. No transaction boundaries for multi-step operations
`CompleteLogin()` does update-auth-request + insert-authorization-code without a transaction. If step 2 fails, the auth request is in an inconsistent state. Same for `ExchangeCode()` where auth code deletion and refresh token insertion should be atomic.

### 42. `io.ReadAll` without size limit (`change_env.go:14`)
Unbounded request body read could exhaust server memory.

### 43. `http.Client{}` without timeout (`change_env.go:70`)
Custom claims HTTP client has no timeout, risking hanging connections.

### 44. `hasura.go` creates new `http.Client` per `postMetadata` call
Each invocation creates a new connection pool during startup, when a single client should be reused.

### 45. Missing input validation in DCR (`oauth2/register.go`)
No validation of redirect URI schemes (allows `javascript:`, `data:`), grant_types, response_types, scopes, or token_endpoint_auth_method against supported values.

### 46. `AllowedRedirectURLs` contains empty string from empty config (`controller/config.go:116`)
`strings.Split("", ",")` produces `[""]`, not `[]string{}`. The empty string may match empty redirect parameters.
