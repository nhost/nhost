# OAuth2/OIDC Demo — Sign in with Nhost via Outline

This demo shows Nhost Auth acting as an OAuth2/OpenID Connect Identity Provider. Outline (a collaborative wiki) is configured as a relying party that uses "Continue with Nhost" for authentication.

## Architecture

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│ Outline │────→│  Nhost Auth  │────→│  React Demo  │
│ :3000   │     │  (backend)   │     │  :5173       │
└─────────┘     └──────────────┘     └──────────────┘
      │                │
      │       ┌────────┼────────┐
      │       │        │        │
      │  ┌────┴───┐ ┌──┴──┐ ┌──┴────┐
      │  │Postgres│ │Hasura│ │Mailhog│
      │  └────────┘ └─────┘ └───────┘
      │
 ┌────┴───┐
 │ Redis  │
 └────────┘
```

The backend services (Auth, Postgres, Hasura, Mailhog) are managed by `nhost dev` in `../backend/`. Outline and Redis run via this demo's `docker-compose.yaml`, connecting to the backend via the `backend_default` Docker network.

## Quick Start

```bash
# 1. Start the backend (from ../backend/)
cd ../backend && nhost up

# 2. Run the setup script to create the test user and OAuth2 client
./setup.sh

# 3. Start Outline infrastructure
docker compose up -d

# 4. Start the react-demo consent page (from ../react-demo/)
cd ../react-demo && pnpm dev
```

## Testing the Flow

1. Open **http://localhost:3000** (Outline)
2. Click **"Continue with Nhost"**
3. You'll be redirected to `/oauth2/consent`, then to `/signin?redirect=...`
4. Enter the test credentials:
   - Email: `user1@nhost.local`
   - Password: `Demo1234!`
5. After signing in, you'll be redirected back to the consent page
6. Click **"Authorize"**
7. You'll be redirected back to Outline, now logged in

## Useful Links

| Service | URL |
|---------|-----|
| Outline | http://localhost:3000 |
| React Demo (Consent) | http://localhost:5173/oauth2/consent |
| Auth Service | https://local.auth.local.nhost.run/v1 |
| OIDC Discovery | https://local.auth.local.nhost.run/v1/.well-known/openid-configuration |
| JWKS | https://local.auth.local.nhost.run/v1/oauth2/jwks |

## How It Works

1. **Outline** redirects to `https://local.auth.local.nhost.run/v1/oauth2/authorize` with standard OAuth2 parameters (client_id, redirect_uri, scope, state)
2. **Nhost Auth** validates the request and redirects to the configured login URL (`http://localhost:5173/oauth2/consent?request_id=<uuid>`)
3. The **consent page** (React Demo) fetches request details via the Nhost SDK (`oauth2LoginGet`) and, if the user is not authenticated, redirects to `/signin?redirect=/oauth2/consent?request_id=...`
4. The user signs in via the **sign-in page** (`signInEmailPassword`) to establish a session, then is redirected back to the consent page
5. The **consent page** displays the client info and requested scopes; the user clicks "Authorize" and the page completes the flow via the Nhost SDK (`oauth2LoginPost`) with the request ID
6. **Nhost Auth** returns a redirect URI containing the authorization code
7. The browser redirects to Outline's callback URL (`/auth/oidc.callback`) with the code
8. **Outline** (server-side) exchanges the code for tokens via `POST /oauth2/token`
9. **Outline** fetches user info via `GET /oauth2/userinfo` and creates a session

## Cleanup

```bash
docker compose down --volumes
rm -f .env
```
