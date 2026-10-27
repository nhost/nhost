# Nhost + Next.js starter

Next.js app with server-side Nhost auth: five sign-in methods and an account
page. The backend config runs locally and deploys to Nhost Cloud unchanged; the
frontend deploys to Vercel.

| Path | Contents |
| --- | --- |
| `nhost/` | Backend for `nhost up`: `nhost.toml`, Hasura metadata, `en` email templates |
| `frontend/` | Next.js 16 (App Router), Tailwind 4, shadcn, Biome, Vitest |
| `.secrets.example` | Local secrets: the fixed set `nhost init` writes, plus `APP_ORIGIN`, `WEBAUTHN_RP_ID` and the four OAuth `fixme` values |

## Run locally

```sh
cp .secrets.example .secrets
nhost up
cd frontend && pnpm install && pnpm dev
```

In `frontend/`: `pnpm lint` (Biome), `pnpm format`, `pnpm test` (Vitest),
`pnpm build`.

- The frontend targets the local stack by default; `frontend/.env.example` only
  matters for a real project.
- Open `http://localhost:3000`, not `127.0.0.1`: passkeys are bound to
  `WEBAUTHN_RP_ID=localhost`.
- `.secrets` is gitignored. Keep it that way once it holds anything real.

## Sign-in methods

Registered in `frontend/src/app/signin/methods.ts`, one directory each under
`frontend/src/app/auth/`. To remove one, delete its directory and its entry;
`isolation.test.ts` checks that no method imports another.

| Method | Default |
| --- | --- |
| Email + password (TOTP, reset) | on |
| Magic link | on |
| Email code | on |
| Passkeys | on |
| OAuth: GitHub, Google | off |

### Enabling OAuth

1. Register an OAuth app with the provider. Callback URL:
   `https://local.auth.local.nhost.run/v1/signin/provider/<github|google>/callback`
   locally, `https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/<github|google>/callback`
   in the cloud.
2. Set its client id and secret: in `.secrets` locally, with
   `nhost secrets update` in the cloud.
3. Set `enabled = true` on the provider in `nhost/nhost.toml` and restart
   `nhost up`.
4. Add it to `NHOST_OAUTH_PROVIDERS` (e.g. `github,google`): in
   `frontend/.env.local` locally, as a project env var on Vercel. Restart or
   redeploy.

`NHOST_OAUTH_PROVIDERS` is how the frontend knows which buttons work; it can't
read the backend config. It is server-only and read per request. It also adds
the Linked accounts row to the account page; linking reuses the sign-in
callback URL. A provider can't be unlinked when it is the account's only way
in.

## Deploy

| Where | Variable | Notes |
| --- | --- | --- |
| Backend secrets | `APP_ORIGIN` | Frontend origin; auth only redirects here |
| | `WEBAUTHN_RP_ID` | Frontend hostname; passkeys are bound to it |
| | `GITHUB_*`, `GOOGLE_*` | Must exist because `nhost.toml` references them; `fixme` until enabled |
| Frontend, build time | `NEXT_PUBLIC_NHOST_SUBDOMAIN`, `NEXT_PUBLIC_NHOST_REGION` | Unset means the local stack |
| | `NEXT_PUBLIC_APP_ORIGIN` | Must equal `APP_ORIGIN`. Optional on Vercel, which falls back to the production domain |
| | `NEXT_PUBLIC_NHOST_ORG_SLUG` | Optional. The part after `/orgs/` in the dashboard URL; makes the footer link open the project directly |
| Frontend, runtime | `NHOST_OAUTH_PROVIDERS` | See [Enabling OAuth](#enabling-oauth) |

```sh
nhost secrets create APP_ORIGIN https://myapp.example.com
nhost secrets create WEBAUTHN_RP_ID myapp.example.com
```

`NEXT_PUBLIC_*` values are inlined at build time and are public. They can live in
a committed `frontend/.env.production` once `frontend/.gitignore` stops ignoring
it; nothing secret goes there.

## Backend config

- `nhost/metadata/` is the full Hasura export `nhost up` writes, as in the
  example backends under `examples/`. Exports carry no comments, so
  [Permissions](#permissions) is the record of why.
- `nhost/emails/` has only `en`, the one allowed locale. `signin-otp` differs
  from the `nhost init` default: its body links `${redirectTo}` (the code page)
  and its subject is fixed. A new locale needs its templates and the same two
  changes.

## Permissions

The `user` role gets only what the account page needs, always scoped to its own
rows. Every other tracked table grants nothing.

| Table | `user` may | Why, and what not to widen |
| --- | --- | --- |
| `auth.users` | select, delete; update `display_name`, `avatar_url` | Auth has no API for profile edits or account deletion. Don't add auth-managed columns to update: `default_role` and `email` are on this row. Delete cascades through the auth schema; the avatar is deleted through storage first, since files don't cascade |
| `auth.user_security_keys` | select, delete | List and remove passkeys; auth inserts the rows |
| `auth.refresh_tokens` | select `id`, `created_at`, `expires_at`, `metadata`; update `metadata`; delete; `regular` rows only | Sessions list and the proxy's revocation check. Never `refresh_token_hash`; personal access tokens are excluded |
| `auth.user_providers` | select `id`, `provider_id`, `created_at`; delete | Linked accounts. The row also holds provider tokens; keep them out |
| `storage.files` | insert (bucket `default`), select, delete | Storage inserts as the user and finishes as admin, so no update. Select columns must match storage's `FileMetadataFragment` exactly or downloads break |

## Design notes

What the code relies on. Read before refactoring.

### Session

- The session, refresh token included, is in an httpOnly cookie read only by
  the proxy and server code. `nhostSignedIn` is a readable flag with no token,
  used to notice sign-outs in other tabs. Page script never sees a token.
- Sign-in and sign-out are server actions. Pages read the session on the
  server.
- Only the proxy (`frontend/src/proxy.ts`, `lib/nhost/server.ts`) refreshes:
  60 s before expiry, on real navigations. Prefetches never refresh, because
  refresh tokens are single-use and a concurrent refresh makes the SDK clear
  the session. Don't set `prefetch={true}` or enable the SDK's browser
  auto-refresh.
- Two real requests can still race after expiry (tab refocus plus a click,
  restored tabs). The first rejection renders signed out and sets
  `nhostRefreshRejected` (60 s, names the refresh token id); only a second
  rejection for the same id clears the cookies. The first rejection must leave
  the cookies in the browser: `RefreshOnSessionChange` sees `nhostSignedIn` on
  the signed-out render and refreshes, which picks up the winner's session or,
  for a dead token, clears the cookies. Remaining gap: the winner's response
  landing during that retry still signs out.
- Exceptions to "no token in the browser":
  - Sign-in links (below).
  - OAuth linking: auth only links when given the access token as `connect`,
    so `connect/route.ts` puts it in the redirect URL. It travels in the
    OAuth `state` (signed, not encrypted), can land in browser history and
    provider logs, and is valid for `[auth.session.accessToken] expiresIn`
    (900 s). Page script can't read a cross-origin redirect, so XSS still
    can't get it. Fixing that needs an auth-service change.

### Sign-in links

- Auth emails and the OAuth callback return `?refreshToken=`. The proxy redeems
  it only for a signed-out visitor; redeeming for a signed-in one would let a
  crafted link swap their session for the sender's.
- For a signed-in visitor it revokes the token with `/signout`, since auth
  already minted a 30-day session for it. It uses a bare auth client because
  the proxy's client clears the session on any `/signout`.
- The token is always stripped with a redirect. The proxy's second matcher
  entry covers any path, because `redirectTo` can name one.

### Redirects

- `?next=` is kept only if it resolves, browser-style, to a canonical path on
  this origin. `//evil.example`, `/\evil.example` and `/..//evil.example` all
  look like paths and aren't.
- Raw spaces and non-ASCII are refused; auth re-encodes them and the browser
  lands elsewhere.
- Every server action that builds a `redirectTo` checks `next` again; actions
  are public endpoints.

### Sessions list

- Auth records nothing about a session's device, so the proxy writes
  `metadata` on change or every 5 minutes:
  - IP from `x-real-ip` / `x-forwarded-for`
  - device from the user agent
  - location from the geo headers Vercel or Cloudflare add (none elsewhere;
    Cloudflare sends city and region only with visitor location headers on)
  - `seenAt`
- Users can write their own `metadata`, so it is a record, not an audit log.
  On a host without a trusted proxy the IP is whatever the client claims.
- Sign-out deletes the row, but its access token lives 15 minutes. The proxy
  checks the row on each navigation, and idle tabs recheck on focus, at most
  every 5 minutes.

### Account

- Password change: auth revokes every session. The action signs this browser
  back in (new password, plus TOTP if on). Accounts without an email get a
  replacement card instead (`ReplacePageLayout`).
- Sign-out: one request, a server action that redirects home via
  `useActionState`.
- Passkeys: a device refuses a second passkey for the same account. Local
  storage remembers passkeys used in this browser to warn before Add.
- Avatar:
  - A private storage file served at `/api/avatar/<id>` with the session token
    (`<img>` can't send it), keeping storage's `Cache-Control` and `ETag`,
    marked `private`.
  - PNG, JPEG, WebP and AVIF only, 415 otherwise: SVG and HTML could run
    script on this origin, and GIF can't be resized. The route checks the
    type itself because files can reach storage without the upload form. The
    sandboxing CSP is set in `next.config.ts`, since Next prefers a config
    header over a handler's.
  - 4 MB cap, to stay under Vercel's 4.5 MB request limit.
  - Only your own avatar is readable. Widen `storage.files` select before
    showing other users'.

### UI

- "Last used" badge: a method's page records an attempt; the first signed-in
  response keeps it.
- `staleTimes.dynamic` is 30 s. Signing in or out clears it, and account
  changes refresh.
- Toasts render in a top-layer popover to sit above modal dialogs. A modal
  makes the popover inert, so `Dialog` repeats the toast in a hidden status
  region for screen readers.
- `useRemoved` drops removed items before the refresh lands, so slow backends
  can't double-submit.
