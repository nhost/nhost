# Nhost + Next.js + shadcn/ui

An auth starter. It signs people in, keeps a session for them across the server
and the browser, and guards one page behind it. There is no database schema: the
app uses only the `auth.users` table the backend ships with, so there is nothing
to undo when you start building your own.

Four sign-in methods are on offer and `nhost init --template` scaffolds all of
them. `src/app/signin/methods.ts` lists the ones you have.

## Run it

You need Node 22+, pnpm and a running local backend:

```sh
nhost up                      # from the project root, next to nhost/
cd frontend
pnpm install
pnpm dev                      # http://localhost:3000
```

Every email the backend sends locally lands in the mailbox at
<https://local.mailhog.local.nhost.run>. That is where sign-in links,
verification links and one-time codes turn up.

## The sign-in methods

Each method is a directory under `src/app/auth/` and a line in
`src/app/signin/methods.ts`. Nothing else in the app knows a method exists.

| method | name | directory | what the backend needs |
| --- | --- | --- | --- |
| Email and password | `password` | `auth/password/` | on by default |
| Magic link | `magic-link` | `auth/magic-link/` | `auth.method.emailPasswordless.enabled = true` |
| Email code | `otp` | `auth/otp/` | `auth.method.otp.email.enabled = true` |
| GitHub or Google | `oauth` | `auth/oauth/` | a provider section, see below |

Magic link and email code are off in a stock backend, and `nhost init` leaves
them that way: set the two lines above in `nhost/nhost.toml` before using
either. The next steps init prints name them too.

OAuth needs an app registered with the provider. Its callback URL for the local
stack is `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`
(swap `github` for `google`). Then, in `nhost.toml`:

```toml
[auth.method.oauth.github]
enabled = true
clientId = "..."
clientSecret = "{{ secrets.GITHUB_CLIENT_SECRET }}"
```

and the matching `GITHUB_CLIENT_SECRET=...` line in `.secrets`. Restart
`nhost up` after changing either file.

Password sign-up sends a verification email first: the account works once the
link in it is opened. That is the backend's default and it is deliberately left
alone here.

## Keep only the methods you want

This is what `--auth-methods` does at scaffold time, and it works just as well
by hand afterwards. Two steps per method, in either order:

1. Delete its directory under `src/app/auth/`.
2. Delete its line in `src/app/signin/methods.ts`.

`pnpm build` proves the rest still stands. Nothing outside a method's directory
imports from it, and the sign-in page only reads `methods.ts`, so there is
nothing else to find.

## Where the session lives

The session is two cookies, both written by the proxy in `src/proxy.ts` and by
the server actions that sign people in. `nhostSession` holds the whole session,
refresh token included, and is httpOnly: only server code
(`src/lib/nhost/server.ts`) reads it. `nhostAccessToken` holds just the access
token and expires with it, and is what the browser client
(`src/lib/nhost/client.ts`) reads.

**The proxy is the only thing that refreshes the token.** Refresh tokens are
single-use, so two refreshers would race, and the loser's failure makes the
SDK delete the session. The browser client is built without the SDK's own
auto-refresh middleware and never sees the refresh token for exactly this
reason. Keep it that way.

The proxy also redeems the `refreshToken` an auth email or an OAuth callback
puts on the URL, then redirects to a clean URL so the token does not sit in
history. It only does so for a signed-out visitor: a link may sign someone in,
it may not replace whoever is already signed in.

Keeping the refresh token away from JavaScript bounds what an XSS can take: an
access token that stops working within minutes, not a session that renews
itself for a month. The browser client only reads, so sign in and out through
server actions, as the template does. If you never call the backend from the
browser, delete `client.ts` and stop writing `nhostAccessToken` in
`sessionCookies` (`src/lib/nhost/server.ts`).

## Deploy

`NEXT_PUBLIC_*` variables are inlined at build time, so set these before
`next build`, not on the running host:

```sh
NEXT_PUBLIC_NHOST_SUBDOMAIN=<your subdomain>
NEXT_PUBLIC_NHOST_REGION=<your region>
NEXT_PUBLIC_APP_ORIGIN=https://your.app
```

`NEXT_PUBLIC_APP_ORIGIN` is where auth emails send people back to. Keep it in
the backend's `auth.redirections.allowedUrls`.

## Scripts

| command | does |
| --- | --- |
| `pnpm dev` | development server |
| `pnpm build` | production build, type-checks everything |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm test` | Vitest |
