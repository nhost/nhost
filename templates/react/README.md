# Nhost + React Starter

A React starter with Nhost auth, built with Vite and React Router. Users can
sign in with a password, magic link, email code, passkey, GitHub or Google, and
manage their account.

It has the same pages, features and backend as the Nhost + Next.js starter, as
a single-page app. The end of How it works lists what works differently.

## What's included

- Five sign-in methods, each in its own folder under `frontend/src/app/auth/`
- An account page: profile, avatar, email, password, two-factor, passkeys,
  linked accounts, sessions and account deletion
- Sessions handled in the browser by the Nhost SDK, so the app deploys as
  static files
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

Emails the local stack sends, such as sign-in links and codes, land in Mailhog
at https://local.mailhog.local.nhost.run.

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
4. Add `VITE_NHOST_OAUTH_PROVIDERS=github` (or `github,google`) to
   `frontend/.env.local` and restart `pnpm dev`.

### Unlinking a provider

Unlink on the account page deletes the link, but it doesn't stop that provider
signing in. If the provider reports a verified email that matches the account's
email, auth signs the user in to that account and links the provider again. So
unlinking a GitHub or Google account that someone else has taken over doesn't
lock them out. Changing the account's email does, and so does turning the
provider off in `nhost/nhost.toml`, which turns it off for every user. Unlink
removes a provider for good only when its verified email differs from the
account's, or the account has no email. That is why the page keeps the last link
on an account with no email.

## Permissions

The `user` role can only touch its own rows, and only what the account page
needs.

| Table | Allowed |
| --- | --- |
| `auth.users` | read, delete, update `display_name` and `avatar_url` |
| `auth.user_security_keys` | read, delete |
| `auth.refresh_tokens` | read, delete |
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

The SDK client in `frontend/src/lib/nhost/client.ts` keeps the session in
`localStorage`, so every tab shares it. The SDK refreshes the access token
before a request when it's about to expire. Refresh tokens can only be used
once, so it refreshes under a Web Lock that every tab shares, and a tab that
waited for the lock uses the session the first one stored.

Before the first render, `frontend/src/lib/nhost/startSession.ts` runs once per
page load, in this order: it takes `refreshToken` and `type` out of the URL,
refreshes the session if the access token expires within a minute, drops the
session if its row in `auth.refresh_tokens` is gone, then uses or revokes a
link token from the URL. Nothing renders until it's done, so no page shows a
session that is about to change, and React's StrictMode can't use a link token
twice.

`frontend/src/guard.ts` is the counterpart of the Next.js starter's `proxy.ts`.
It keeps signed-out visitors off `/account`, sends signed-in visitors on from
the sign-in pages, and keeps a session from a password-reset link on the reset
page until the new password is saved, in every tab and across reloads.
`SessionGuard` runs it before each page renders, so a protected page never
shows to a signed-out visitor. It runs again when another tab signs in, signs
out or opens a reset link, when the session turns out to be revoked, and when a
page loads its data again. A sign-out in the same tab doesn't run it: whatever
signed out navigates on its own.

Any script on the page can read the tokens in `localStorage`, and write a
session there too. So the guard only decides where to send a visitor, and the
account page asks auth who the user is before it shows anything.
`frontend/vercel.json` sends a Content Security Policy that only runs scripts
from this site, which makes it harder to inject one. Keep it, and treat any
third-party script you add as able to read the session.

Most tests mock the client. Two use the real SDK client with a stubbed
`fetch`, because a mock can't show what the SDK stores:
`frontend/src/lib/nhost/session.integration.test.ts`, and
`frontend/src/app/auth/password/change/actions.integration.test.ts`, which sits
in the password folder so it goes when the method does.

### Links in emails

Sign-in emails and OAuth send the user back with a `refreshToken` in the URL.
The app only uses it if they're signed out, so a link from someone else can't
replace their session. If they're already signed in, the token is revoked
instead. Either way, it's removed from the URL before anything else runs.

Linking an OAuth provider also puts a token in the URL, because the auth
service needs the access token to link the account. It's valid for 15 minutes.

### Redirects

`?next=` is only followed if it's a path on this site, and it's checked again
wherever the app navigates to it or sends it to auth as a `redirectTo`.

### Session list

The account page lists the user's sessions with when each one signed in. It
doesn't show device, IP address or location: the app has no trustworthy source
for them, so add that only once you have one.

Signing out a session deletes its row. Each tab checks for its row when the
page loads, on every navigation, and when you come back to the tab after at
least five minutes, so that device is signed out at its next check rather
than when its token expires. The check on navigation runs after the page
renders, so a revoked session can show one page before it lands on sign-in.

### Rate limits

Auth's limits in `nhost/nhost.toml` count requests per visitor address. The
browser calls auth directly, so each visitor is counted by their own address,
with no forwarded headers to trust.

The brute-force limit allows 30 requests per address every 5 minutes. It
counts every sign-in request, including the two-factor step, plus link and code
checks and the two-factor check before a password change, so a passkey or
two-factor sign-in uses two of them.

The local stack sends at most 10 emails an hour. To reset these counts while
you develop, restart `nhost up`.

### Avatars

Avatars are private files. Storage needs the session in a header an `<img>`
can't send, so `frontend/src/app/account/useAvatarSrc.ts` downloads the file
and shows it through an object URL. `avatar_url` holds `/api/avatar/<id>`, the
format the Next.js starter writes, so both starters can share a backend.
Nothing serves that path here; it's only a format. Gravatar URLs are shown as
they are.

Only PNG, JPEG, WebP and AVIF are allowed, up to 4 MB, and a downloaded file of
any other type isn't shown. SVG and HTML are blocked because an object URL
belongs to this site, so one opened from such a file could run scripts on it.

Each tab keeps one avatar in memory at a time. After the avatar changes on
another device, the nav may show the initial until this tab's session
refreshes.

### Password changes

Changing the password signs out every session. The app signs the user back in
on the current device straight away. Until it has, it holds the SDK's session
lock, which pauses SDK requests in every tab, so no tab refreshes with a token
the change just revoked. If signing back in fails, the account page says the
password changed and signs this device out.

With two-factor on, the form also asks for a code, which it needs to sign this
device back in. It checks the code first, through auth's `/elevate/totp` (auth
0.53.0 or later), so a wrong code changes nothing. Auth itself doesn't ask for
a code to change the password while `[auth.elevatedPrivileges]` is `disabled`,
so a stolen session could still change it. Turning that setting on makes auth
ask for a fresh check before changing the password or email, adding a passkey
or setting up two-factor, and this app has no step for that yet.

### Email templates

`nhost/emails/` only has English templates. The `signin-otp` email links to the
code page with `${clientUrl}/auth/otp`, so make the same change if you add
another language. Auth pastes template variables in without escaping them, so
only use the ones auth builds or reads from config (`link`, `ticket`, `code`,
`clientUrl`, `serverUrl`), never `redirectTo`, `email` or `displayName`, which
come from the request. `frontend/src/lib/nhost/emails.test.ts` checks this.

### Compared with the Next.js starter

With no server in front of auth, some guarantees change:

- The session isn't in an httpOnly cookie, so page scripts can read it. The
  Content Security Policy above is the mitigation. There's no `nhostSignedIn`
  cookie either.
- The SDK refreshes in the browser under its own lock, so there's no prefetch
  rule and no `nhostRefreshRejected` cookie.
- Auth sees each visitor's own address, so there's no `X-Forwarded-For`
  handling.
- Avatars download in the browser and uploads go straight to storage, so
  there's no avatar route, and 4 MB is the app's own limit rather than one set
  by Vercel's request body limit.
- `watchSession.ts` replaces `RefreshOnSessionChange`: it follows other tabs
  and checks the session again when a tab comes back.
- The nav shows signed out as soon as the session ends in the same tab.
- A session revoked elsewhere can show one page after a navigation before it
  lands on sign-in.
- A password change pauses SDK requests in every tab while it signs back in.
- With two-factor on, a password change checks the code before changing
  anything. The Next.js starter changes the password first, so there a wrong
  code still changes it and signs the user out.
- When auth can't say who the user is for a reason other than rejecting the
  token, the account page shows an error instead of going to sign-in, so an
  outage can't bounce between the two pages.
- `VITE_NHOST_OAUTH_PROVIDERS` is built into the page, so the list of providers
  is public.
- Links in emails and reloads work on any path only if the host serves
  `index.html` for every path, and the headers in `frontend/vercel.json` only
  apply on Vercel.
- Without `VITE_APP_ORIGIN`, links back to the app use the origin the page is
  served from, so preview deployments send their own origin to auth.

## Deploying

Before you deploy:

- Set the `APP_ORIGIN` (your frontend URL) and `WEBAUTHN_RP_ID` (its hostname)
  secrets with `nhost secrets create`. The OAuth secrets must exist too, even
  with OAuth off. `fixme` is fine.
- Set `VITE_NHOST_SUBDOMAIN` and `VITE_NHOST_REGION` before `pnpm build`. Vite
  writes them into the build, so setting them at runtime does nothing, and the
  build warns when they're missing. `VITE_APP_ORIGIN` is optional: without it,
  links back to the app use the origin the page is served from.
- On Vercel, import the repo and set the project's Root Directory to
  `frontend`, where the app and its `vercel.json` live. `vercel.json` serves
  `index.html` for every path and adds the security headers. Add
  `VITE_NHOST_SUBDOMAIN`, `VITE_NHOST_REGION` and, with OAuth on,
  `VITE_NHOST_OAUTH_PROVIDERS` as environment variables, and set the
  `APP_ORIGIN` secret to the production domain. Auth refuses to send users back
  to a preview deployment's origin unless you add it to
  `[auth.redirections] allowedUrls` in `nhost/nhost.toml`.
- On another host, serve `frontend/dist/` and have it answer every path that
  isn't a file with `index.html`, or links in emails and reloads end on a 404.
  Send the headers from `vercel.json` there too.
- For OAuth, use the callback URL
  `https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/github/callback`
  and set the client ID and secret with `nhost secrets`.
