# Nhost + Next.js starter

Scaffold for a Next.js app with server-side Nhost auth: five sign-in methods and
an account page.

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

1. Register an OAuth app with the provider, with callback URL
   `https://local.auth.local.nhost.run/v1/signin/provider/<github|google>/callback`.
2. Put its client id and secret in `.secrets`.
3. Set `enabled = true` on the provider in `nhost/nhost.toml` and restart
   `nhost up`.
4. Add it to `NHOST_OAUTH_PROVIDERS` (e.g. `github,google`) in
   `frontend/.env.local` and restart `pnpm dev`.

The frontend can't read the backend config, so `NHOST_OAUTH_PROVIDERS` decides
which provider buttons and Linked accounts rows show. Linking reuses the
sign-in callback URL. A provider can't be unlinked when it is the account's
only way in.

## Backend config

- `nhost/metadata/` is the full Hasura export `nhost up` writes. Exports carry
  no comments, so [Permissions](#permissions) is the record of why.
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

- The proxy writes each session's `metadata` when it changes, at most every
  5 minutes otherwise:
  - IP address, from `x-real-ip` or `x-forwarded-for`
  - browser and OS, from the user agent
  - location, from the geo headers Vercel or Cloudflare add (none elsewhere;
    Cloudflare sends city and region only with visitor location headers on)
  - last seen time
- Users can write their own `metadata`, so it is a record, not an audit log.
  On a host without a trusted proxy, the IP address is whatever the client
  claims.
- Sign-out deletes the row, but its access token lives 15 minutes. The proxy
  checks the row on each navigation, and idle tabs recheck on focus, at most
  every 5 minutes.

### Account

- Password change: auth revokes every session. The action signs this browser
  back in (new password, plus TOTP if on). Accounts without an email get a
  replacement card instead (`ReplacePageLayout`).
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

- `staleTimes.dynamic` is 30 s. Signing in or out clears it, and account
  changes refresh.
- Toasts render in a top-layer popover to sit above modal dialogs. A modal
  makes the popover inert, so `Dialog` repeats the toast in a hidden status
  region for screen readers.

## Deploying

The config deploys unchanged; only secrets and env vars differ.

- Backend: set `APP_ORIGIN` (the frontend origin) and `WEBAUTHN_RP_ID` (its
  hostname) with `nhost secrets create`. The four OAuth secrets must exist
  (`fixme` is fine until enabled).
- Frontend: set `NEXT_PUBLIC_NHOST_SUBDOMAIN`, `NEXT_PUBLIC_NHOST_REGION` and
  `NEXT_PUBLIC_APP_ORIGIN` (equal to `APP_ORIGIN`) before `next build`.
  `frontend/.env.example` documents each variable.
- OAuth: the same steps, with callback URL
  `https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/<github|google>/callback`
  and credentials set with `nhost secrets`.
