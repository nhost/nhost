# OAuth2/OIDC Demo — Sign in with Nhost via Grafana

This demo shows Nhost Auth acting as an OAuth2/OpenID Connect Identity Provider. Grafana is configured as a relying party that uses "Sign in with Nhost" for authentication.

## Architecture

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│ Grafana │────→│  Nhost Auth  │────→│  Consent UI  │
│ :3001   │     │  :4000       │     │  :3000       │
└─────────┘     └──────────────┘     └──────────────┘
                       │
              ┌────────┼────────┐
              │        │        │
         ┌────┴───┐ ┌──┴──┐ ┌──┴────┐
         │Postgres│ │Hasura│ │Mailhog│
         │:5432   │ │:8080 │ │:8025  │
         └────────┘ └─────┘ └───────┘
```

## Prerequisites

- Docker and Docker Compose
- The `auth:0.0.0-dev` image built locally

Build the auth image from the repo root:

```bash
cd services/auth
make build-docker-image
```

## Quick Start

```bash
# 1. Start infrastructure (postgres, hasura, mailhog, auth, consent UI)
docker compose up -d postgres graphql mailhog auth consent-ui

# 2. Run the setup script to create the test user and OAuth2 client
./setup.sh

# 3. Start Grafana (uses the .env file created by setup.sh)
docker compose up -d grafana
```

## Testing the Flow

1. Open **http://localhost:3001** (Grafana)
2. Click **"Sign in with Nhost"**
3. You'll be redirected to the consent page at `http://localhost:3000/consent.html`
4. Enter the test credentials:
   - Email: `demo@example.com`
   - Password: `Demo1234!`
5. Click **"Sign in & Authorize"**
6. You'll be redirected back to Grafana, now logged in

## Useful Links

| Service | URL |
|---------|-----|
| Grafana | http://localhost:3001 |
| Demo Landing Page | http://localhost:3000 |
| Auth Service | http://localhost:4000 |
| OIDC Discovery | http://localhost:4000/.well-known/openid-configuration |
| JWKS | http://localhost:4000/oauth2/jwks |
| Hasura Console | http://localhost:8080 |
| Mailhog (Email UI) | http://localhost:8025 |

## How It Works

1. **Grafana** redirects to `http://localhost:4000/oauth2/authorize` with standard OAuth2 parameters (client_id, redirect_uri, scope, state, PKCE code_challenge)
2. **Nhost Auth** validates the request and redirects to the configured login URL (`http://localhost:3000/consent.html?request_id=<uuid>`)
3. The **consent page** fetches request details from `GET /oauth2/login?request_id=<uuid>` and displays the client info and requested scopes
4. The user signs in via `POST /signin/email-password` to obtain a JWT
5. The consent page completes the flow via `POST /oauth2/login` with the JWT and request ID
6. **Nhost Auth** returns a redirect URI containing the authorization code
7. The browser redirects to Grafana's callback URL with the code
8. **Grafana** (server-side) exchanges the code for tokens via `POST /oauth2/token`
9. **Grafana** fetches user info via `GET /oauth2/userinfo` and creates a session

## Cleanup

```bash
docker compose down --volumes
rm -f .env
```
