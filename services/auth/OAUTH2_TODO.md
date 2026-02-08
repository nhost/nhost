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
