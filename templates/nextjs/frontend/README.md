# Nhost + Next.js

An auth starter. It signs people in, keeps a session for them across the server
and the browser, and guards one page behind it. There is no database schema: the
app uses only the `auth.users` table the backend ships with, so there is nothing
to undo when you start building your own.

Four sign-in methods are on offer and `nhost init --template` scaffolds the ones
you asked for with `--auth-methods`, email and password by default.
`src/app/signin/methods.ts` lists the ones you have.

Sign up is the default, because a fresh local backend has no accounts in it
yet: the sign-in page is headed "Create an account", and if you scaffolded email
and password, its form opens on sign up. Signing in and signing up are kept
apart: the home page offers both, and a link asks for the other mode with
`?intent=sign-in`.

Anywhere the app says "check your inbox", those words are a link to the local
mailbox, since against a local backend that is where the email went. They go
back to being plain text once the app targets a real project and the email
really does arrive in yours.

The components under `src/components/ui/` are plain Tailwind and yours to edit,
unless you passed `--ui shadcn`, which swaps them for the shadcn/ui versions
with the same props. Nothing else in the app changes either way: it only ever
imports `@/components/ui/*`, so adopting shadcn/ui later is a matter of running
its CLI over the same paths.

## Run it

You need Node 22+, pnpm and a running local backend:

```sh
nhost up                      # from the project root, next to nhost/
cd frontend
pnpm install
pnpm dev                      # http://localhost:3000
```

Two addresses are worth keeping open while the local stack is up, and neither
exists once you deploy:

- <https://local.dashboard.local.nhost.run/orgs/local/projects/local> is the
  dashboard for the local project: users, data, permissions and the GraphQL
  API.
- <https://local.mailhog.local.nhost.run> is the mailbox every local email
  lands in, which is where sign-in links, verification links and one-time codes
  turn up.

## The sign-in methods

Each method is a directory under `src/app/auth/` and a line in
`src/app/signin/methods.ts`. Nothing else in the app knows a method exists.

| method | `--auth-methods` name | directory | what the backend needs |
| --- | --- | --- | --- |
| Email and password | `password` | `auth/password/` | on by default |
| Magic link | `magic-link` | `auth/magic-link/` | `auth.method.emailPasswordless.enabled = true` |
| Email code | `otp` | `auth/otp/` | `auth.method.otp.email.enabled = true` |
| GitHub or Google | `oauth` | `auth/oauth/` | a provider section, see below |

When `nhost init` creates the backend, it enables whichever of magic link and
email code you asked for, since both are off in a stock backend. The default
asks for neither and so changes no configuration. A backend you already had, or
one pulled from a linked project with `--remote`, keeps its `nhost.toml` as it
was: init names the methods it still has off, and the lines above are yours to
add.

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

A crafted `redirectTo` can point an auth email at any path on this origin, so
the proxy runs wherever a `refreshToken` lands, including the static files and
API routes it otherwise skips. The template sets no `basePath`. If you add one,
Next prefixes every proxy matcher with it, so the proxy alone never sees a link
that lands outside it: with a `basePath` of `/app`, a link to
`/app/..//elsewhere` resolves to `/elsewhere`. Narrowing the backend's allowed
URLs to the `basePath` does not stop that, because the backend compares the URL
before the browser resolves the `..`. Add a redirect to `next.config.ts` that
sends those requests back under the `basePath`, where the proxy strips the
token:

```ts
basePath: '/app',
experimental: { caseSensitiveRoutes: true },
async redirects() {
  return [
    {
      source: '/:path((?!app(?:/|$)).*)',
      has: [{ type: 'query', key: 'refreshToken' }],
      destination: '/app/:path',
      basePath: false,
      permanent: false,
    },
  ];
},
```

Replace all three `app`s with your `basePath`, escaping any regex characters
such as `.` in the source. The source has to skip paths already under it, or
`/app/protected?refreshToken=...` redirects to `/app/app/protected` and on
forever. It has to skip only that exact case, which is what
`caseSensitiveRoutes` is for: Next matches redirect sources case-insensitively
but checks the `basePath` case-sensitively, so without the flag
`/APP/x?refreshToken=...` is neither redirected nor proxied and 404s with the
token still in the URL. The flag applies to every header, redirect and rewrite
source. Writing `(?-i:app)` in the source instead closes the same gap without
it on Node 24, but `next build` rejects it on Node 22.

The rest of the template does not handle a `basePath` yet: the proxy's
redirect to sign in and the `redirectTo` that auth emails and OAuth send people
back to are built without it, so they land on a 404.

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
