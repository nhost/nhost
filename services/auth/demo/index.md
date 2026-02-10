# OAuth2/OIDC Demo Suite

This directory contains demos showcasing the OAuth2/OIDC Identity Provider features of Nhost Auth.

## Prerequisites

All script-based demos reuse the **Grafana demo infrastructure**. Before running any demo, start the Grafana stack:

```bash
cd demo/grafana
docker compose up -d postgres graphql mailhog auth consent-ui
./setup.sh
```

Required tools (installed on most systems):
- `curl`
- `jq`
- `openssl` (for the discovery-jwks demo)

## Demos

| Demo | Directory | What it showcases |
|------|-----------|-------------------|
| **Grafana Sign-in** | [`grafana/`](grafana/) | Authorization Code + PKCE with Grafana as a confidential client (interactive browser flow) |
| **Conformance Suite** | [`conformance/`](conformance/) | OpenID Connect Conformance Suite automated testing |
| **PKCE Public Client** | [`pkce-public-client/`](pkce-public-client/) | Authorization Code + PKCE (S256) with a public client (no client secret) |
| **Token Lifecycle** | [`token-lifecycle/`](token-lifecycle/) | Token introspection (RFC 7662), revocation (RFC 7009), and refresh token rotation |
| **Dynamic Registration** | [`dynamic-registration/`](dynamic-registration/) | Dynamic Client Registration (RFC 7591) followed by a full OAuth2 flow |
| **Discovery & JWKS** | [`discovery-jwks/`](discovery-jwks/) | OIDC Discovery (RFC 8414), JWKS retrieval, and offline JWT signature verification |

## Running a Demo

Each script-based demo is self-contained. With the Grafana stack running:

```bash
# Example
cd demo/pkce-public-client
./demo.sh
```

The scripts walk through each step with explanatory output, showing the API calls and responses.

## Test Credentials

All demos use the same test user created by the Grafana setup script:

- **Email:** `demo@example.com`
- **Password:** `Demo1234!`
