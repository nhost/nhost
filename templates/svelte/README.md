# Nhost + Svelte Starter

A Svelte starter with Nhost auth, built with SvelteKit. Users can sign in with a
password, magic link, email code, passkey, GitHub or Google, and manage their
account.

It has the same pages, features and backend as the Nhost + Next.js starter. The
end of How it works lists what works differently.

## What's included

- Five sign-in methods, each in its own folder under
  `frontend/src/routes/auth/`
- An account page: profile, avatar, email, password, two-factor, passkeys,
  linked accounts, sessions, and account deletion
- Sessions handled on the server, so browser JavaScript never sees a token
- `nhost/`: the backend config, Hasura permissions, and email templates

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

Other commands in `frontend/`: `pnpm test`, `pnpm lint`, `pnpm check` and
`pnpm build`.

## Sign-in methods

Email and password, magic link, email code and passkeys are on by default.
OAuth is off until you add credentials.

To remove a method, delete its folder in `frontend/src/routes/auth/` and its
entry in `frontend/src/routes/signin/methods.ts`.

### Turning on OAuth

1. Create an OAuth app with GitHub or Google. The callback URL is
   `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`
   (use `google` for Google).
2. Add the client ID and secret to `.secrets`.
3. Set `enabled = true` for the provider in `nhost/nhost.toml` and restart
   `nhost up`.
4. Add `NHOST_OAUTH_PROVIDERS=github` (or `github,google`) to
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

The session lives in an httpOnly cookie that only the server hook
(`frontend/src/hooks.server.ts`) and server code can read.

The hook is the only place the token gets refreshed, on page loads, client-side
navigations and remote commands. Refresh tokens can only be used once, so remote
queries and `/api/` routes, which run alongside the page that asked for them,
read the session without refreshing it. For the same reason `src/app.html` turns
off data preloading, so don't turn it on.

The root layout's load reads the URL, so every client-side navigation fetches
its data from the server and goes through the hook. That is how a sign-out in
another tab shows on the next page. A signed-in tab returned to after five
minutes loads its page again.

If two requests try to refresh at once, the one that loses doesn't sign the
user out. It goes ahead signed out and sets a short-lived `nhostRefreshRejected`
cookie with the time. Only a second failure more than a few seconds later signs
them out, so a request the browser sends before the winner's cookie arrives,
such as the redirect from a protected page, can't.

### Remote functions

Each method's server code is in an `actions.remote.ts` file: remote commands for
changes, and remote queries that the account page's rows `await` as they render.
Both run on the server, and the browser calls them over HTTP.

Remote functions and `await` in components are experimental in SvelteKit 3.
`vite.config.ts` turns them on with `experimental.remoteFunctions` and Svelte's
`compilerOptions.experimental.async`. A SvelteKit or Svelte release can change
them, so keep the lockfile and upgrade on purpose.

Every remote function is a public endpoint. Each checks its argument with a
valibot schema and looks up the session itself, since the page that called it
proves nothing about who is calling.

### Links in emails

Sign-in emails and OAuth send the user back with a `refreshToken` in the URL.
The hook only uses it if they're signed out, so a link from someone else can't
replace their session. If they're already signed in, the token is revoked
instead. Either way, it's removed from the URL on every path the hook sees:
pages, `/api/` routes, and the URLs of remote functions. SvelteKit answers the
rest of `/_app/` with a 404 before the hook runs, and on Vercel `/_app/immutable/`
is served from the CDN, so a `redirectTo` pointed there leaves the token in the
address bar, unredeemed, until it expires.

Linking an OAuth provider also puts a token in the URL, because the auth
service needs the access token to link the account. It's valid for 15 minutes.

### Redirects

`?next=` is only followed if it's a path on this site, and each remote command
checks it again.

### Session list

The account page lists the user's sessions with when each one signed in. It
doesn't show device, IP address or location: the app has no trustworthy source
for them, so add that only once you have one.

Signing out a session deletes its row. The hook checks for the row on every page
load and navigation, so that device is signed out on its next one rather than
when its token expires.

### Rate limits

Auth's limits in `nhost/nhost.toml` count requests per visitor address. Every
auth call comes from the SvelteKit server, so the server sends the visitor's
address as `X-Forwarded-For`, taken from SvelteKit's `getClientAddress()`. On
Vercel, the adapter reads it from a header Vercel sets itself. With
`adapter-node` behind a proxy, set `ADDRESS_HEADER` and `XFF_DEPTH` to match
that proxy, or every visitor shares its address.

This relies on Nhost Cloud passing the forwarded address on to auth. If it
doesn't, every visitor shares the server's budget, and the fix is to raise the
`[auth.rateLimit]` limits in `nhost/nhost.toml`.

The brute-force limit allows 30 requests per address every 5 minutes. It counts
every sign-in request and its two-factor step, every link and code check, and
the two-factor check before a password change, so a passkey or two-factor
sign-in uses two of them.

The local stack sends at most 10 emails an hour. To reset these counts while you
develop, restart `nhost up`.

### Avatars

Avatars are private files served through `/api/avatar/<id>`. Only PNG, JPEG,
WebP and AVIF are allowed, up to 4 MB. SVG and HTML are blocked because they
could run scripts on this site.

The upload is a remote form, which posts the file as it is. A remote command
would encode it at almost twice its size, past the 4.5 MB request body Vercel
accepts.

### Password changes

Changing the password signs out every session. The app signs the user back in
on the current device straight away. If that fails, the account page says the
password changed, and this device is signed out too.

With two-factor on, the form also asks for a code, which it needs to sign this
device back in. It checks the code first, through auth's `/elevate/totp` (auth
0.53.0 or later), so a wrong code changes nothing. Auth itself doesn't ask for
a code to change the password while `[auth.elevatedPrivileges]` is `disabled`,
so a stolen session could still change it. Turning that setting on makes auth
ask for a fresh check before changing the password or email, adding a passkey
or setting up two-factor, and this app has no step for that yet.

### Content security policy

SvelteKit adds a nonce to every script it renders, and `vite.config.ts` lets
only those and files from this origin run. `frame-ancestors 'none'` keeps the
app out of other sites' frames. `src/hooks.server.ts` adds `X-Frame-Options`,
`Referrer-Policy` and `X-Content-Type-Options` to the pages and routes it
serves. A script you add to `src/app.html` needs `nonce="%sveltekit.nonce%"`.

### Email templates

`nhost/emails/` only has English templates. The `signin-otp` email links to the
code page with `${clientUrl}/auth/otp`, so make the same change if you add
another language. Auth pastes template variables in without escaping them, so
only use the ones auth builds or reads from config (`link`, `ticket`, `code`,
`clientUrl`, `serverUrl`), never `redirectTo`, `email` or `displayName`, which
come from the request. `frontend/src/lib/nhost/emails.test.ts` checks this.

### Differences from the Next.js starter

- With two-factor on, a password change checks the code before changing
  anything. The Next.js starter changes the password first, so there a wrong
  code still changes it and signs the user out.
- The brute-force limit is 30 requests every 5 minutes, where the Next.js
  starter allows 10.
- A rate-limited request says how long to wait.
- The email code page can take a code already sent without sending another, and
  says when a new code makes the earlier ones stop working.
- The content security policy also limits scripts, since SvelteKit adds the
  nonces itself.
- The server reads its configuration when it starts, rather than at build time.

## Deploying

Before you deploy:

- Set the `APP_ORIGIN` (your frontend URL) and `WEBAUTHN_RP_ID` (its hostname)
  secrets with `nhost secrets create`. The OAuth secrets must exist too, even
  with OAuth off. `fixme` is fine.
- Set `NHOST_SUBDOMAIN`, `NHOST_REGION` and `APP_ORIGIN` where the server runs,
  and `NHOST_OAUTH_PROVIDERS` with OAuth on. The server reads them when it
  starts, and a production server logs which ones fell back to the local
  defaults.
- On Vercel, import the repo and set the project's Root Directory to
  `frontend`, where the app and its `vercel.json` live. Add the variables above
  as environment variables. `APP_ORIGIN` can stay unset: it falls back to the
  project's production domain, so set the `APP_ORIGIN` secret to that.
- On another host, swap `@sveltejs/adapter-vercel` in `vite.config.ts` for that
  host's adapter. With `adapter-node`, also set `ORIGIN` to the app's URL,
  which SvelteKit checks remote calls against, `BODY_SIZE_LIMIT=5M` for avatar
  uploads, and the address headers under Rate limits.
- For OAuth, use the callback URL
  `https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/github/callback`
  and set the client ID and secret with `nhost secrets`.
