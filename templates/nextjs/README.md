# Nhost + Next.js Starter

A Next.js starter with Nhost auth. Users can sign in with a password, magic
link, email code, passkey, GitHub or Google, and manage their account.

## What's included

- Five sign-in methods, each in its own folder under `frontend/src/app/auth/`
- An account page: profile, avatar, email, password, two-factor, passkeys,
  linked accounts, sessions and account deletion
- Sessions handled on the server, so browser JavaScript never sees a token
- `nhost/`: the backend config, Hasura permissions and email templates

## Getting started

```sh
cp .secrets.example .secrets
nhost up
cd frontend
pnpm install
pnpm dev
```

Open http://localhost:3000. Use `localhost`, not `127.0.0.1`, or passkeys won't
work.

Other commands in `frontend/`: `pnpm test`, `pnpm lint` and `pnpm build`.

## Sign-in methods

Email and password, magic link, email code and passkeys are on by default.
OAuth is off until you add credentials.

To remove a method, delete its folder in `frontend/src/app/auth/` and its entry
in `frontend/src/app/signin/methods.ts`.

### Turning on OAuth

1. Create an OAuth app with GitHub or Google. The callback URL is
   `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`
   (use `google` for Google).
2. Add the client ID and secret to `.secrets`.
3. Set `enabled = true` for the provider in `nhost/nhost.toml` and restart
   `nhost up`.
4. Add `NHOST_OAUTH_PROVIDERS=github` (or `github,google`) to
   `frontend/.env.local` and restart `pnpm dev`.

## Permissions

The `user` role can only touch its own rows, and only what the account page
needs.

| Table | Allowed |
| --- | --- |
| `auth.users` | read, delete, update `display_name` and `avatar_url` |
| `auth.user_security_keys` | read, delete |
| `auth.refresh_tokens` | read, delete, update `metadata` |
| `auth.user_providers` | read, delete |
| `storage.files` | upload to the `default` bucket, read, delete |

A few things to keep in mind if you change these:

- `auth.users` also holds the user's role and email, so don't let users update
  other columns.
- Never expose `refresh_token_hash` or the provider tokens in
  `auth.user_providers`.
- Keep the `storage.files` read columns as they are. Storage reads them back
  when it serves a file.

## How it works

### Sessions

The session lives in an httpOnly cookie that only the proxy
(`frontend/src/proxy.ts`) and server code can read. The browser gets a second
cookie, `nhostSignedIn`, which only says whether someone is signed in.

The proxy is the only place the token gets refreshed. Refresh tokens can only
be used once, so prefetches never refresh. Don't turn on `prefetch={true}` or
the SDK's browser auto-refresh.

If two requests try to refresh at once, the one that loses doesn't sign the
user out. It sets a short-lived `nhostRefreshRejected` cookie and the page
retries. Only a second failure signs them out.

### Links in emails

Sign-in emails and OAuth send the user back with a `refreshToken` in the URL.
The proxy only uses it if they're signed out, so a link from someone else can't
replace their session. If they're already signed in, the token is revoked
instead. Either way, it's removed from the URL.

Linking an OAuth provider also puts a token in the URL, because the auth
service needs the access token to link the account. It's valid for 15 minutes.

### Redirects

`?next=` is only followed if it's a path on this site, and each server action
checks it again.

### Session list

The account page lists the user's sessions. The proxy saves each session's IP
address, browser, OS and location in `auth.refresh_tokens.metadata`. Location
only shows up on Vercel or Cloudflare, which add it as request headers. Users
can edit their own metadata, so it's informational, not an audit log.

Signing out a session deletes its row. The proxy checks for the row on every
page load, so that device is signed out on its next page load rather than when
its token expires.

### Avatars

Avatars are private files served through `/api/avatar/<id>`. Only PNG, JPEG,
WebP and AVIF are allowed, up to 4 MB. SVG and HTML are blocked because they
could run scripts on this site.

### Password changes

Changing the password signs out every session. The app signs the user back in
on the current device straight away.

### Email templates

`nhost/emails/` only has English templates. The `signin-otp` email links to the
code page, so make the same change if you add another language.

## Deploying

Before you deploy:

- Set the `APP_ORIGIN` (your frontend URL) and `WEBAUTHN_RP_ID` (its hostname)
  secrets with `nhost secrets create`. The OAuth secrets must exist too, even
  with OAuth off. `fixme` is fine.
- Set `NEXT_PUBLIC_NHOST_SUBDOMAIN`, `NEXT_PUBLIC_NHOST_REGION` and
  `NEXT_PUBLIC_APP_ORIGIN` before `next build`. See `frontend/.env.example`.
- For OAuth, use the callback URL
  `https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/github/callback`
  and set the client ID and secret with `nhost secrets`.
