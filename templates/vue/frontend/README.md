# Nhost + Vue

An auth starter. It signs people in, keeps a session for them in the browser,
and guards one page behind it. There is no database schema: the app uses only
the `auth.users` table the backend ships with, so there is nothing to undo when
you start building your own.

Four sign-in methods are on offer and `nhost init --template` scaffolds the ones
you asked for with `--auth-methods`, email and password by default.
`src/signin/methods.ts` lists the ones you have.

The password form opens on **sign up**, because a fresh local backend has no
accounts in it yet. Signing in and signing up are kept apart: the home page
offers both, and a link asks for the other mode with `?intent=sign-in`.

Anywhere the app says "check your inbox", those words are a link to the local
mailbox, since against a local backend that is where the email went. They go
back to being plain text once the app targets a real project and the email
really does arrive in yours.

The components under `src/components/ui/` are plain Tailwind and yours to edit,
unless you passed `--ui shadcn`, which swaps them for the shadcn-vue versions
with the same props. Nothing else in the app changes either way: it only ever
imports `@/components/ui/*`, so adopting shadcn-vue later is a matter of running
its CLI over the same paths.

This is a single-page app: Vite builds it to static files and there is no
server of your own anywhere in it. If that matters for how the session is
stored, read "Where the session lives" below before you build on it.

## Run it

You need Node 22+, pnpm and a running local backend:

```sh
nhost up                      # from the project root, next to nhost/
cd frontend
pnpm install
pnpm dev                      # http://localhost:3000
```

If something already holds port 3000 the dev server stops instead of moving to
another one, because auth links only come back to an address the backend was
told to allow. Moving the app means changing `server.port` in `vite.config.ts`,
`VITE_APP_ORIGIN` and the backend's `auth.redirections.allowedUrls` together.

Two addresses are worth keeping open while the local stack is up, and neither
exists once you deploy:

- <https://local.dashboard.local.nhost.run/orgs/local/projects/local> is the
  dashboard for the local project: users, data, permissions and the GraphQL
  API.
- <https://local.mailhog.local.nhost.run> is the mailbox every local email
  lands in, which is where sign-in links, verification links and one-time codes
  turn up.

## The sign-in methods

Each method is a directory under `src/auth/` and a line in
`src/signin/methods.ts`. Nothing else in the app knows a method exists: the
router finds pages by globbing `./auth/**/route.vue`, so there is no route
table naming them.

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

1. Delete its directory under `src/auth/`.
2. Delete its line in `src/signin/methods.ts`.

`pnpm build` proves the rest still stands. Nothing outside a method's directory
imports from it, the sign-in page only reads `methods.ts`, and the router only
globs, so there is nothing else to find.

## Where the session lives

In `localStorage`, refresh token included, written by the SDK. One client is
created in `src/lib/nhost/auth.ts`, at module scope so there can only ever be
one, and it refreshes the access token itself when a request goes out within
60s of expiry. There is no timer, and `navigator.locks` keeps two tabs from
spending the same refresh token at once. `src/lib/nhost/watchSession.ts` keeps
the `shallowRef` every component reads through `useAuth()` in step:
`sessionStorage.onChange` reports this tab's own writes, and the browser's
`storage` event reports other tabs', so signing in or out in one tab does the
same in the rest.

`main.ts` awaits `startAuth()` before mounting the app. That is what makes the
first render already know whether there is a session, so nothing flashes a
signed-out view and no protected route bounces a signed-in visitor on reload.
It costs nothing on an ordinary load, because with no token on the URL there is
no request to make.

**Read this before shipping something sensitive.** A browser app has nowhere to
put a refresh token that JavaScript cannot reach. Anything that manages to run
script on your origin can take the whole session and keep renewing it, not just
an access token that expires in minutes. That is inherent to a static SPA, not
something this template does badly, and it is the one real difference from the
`nextjs` template, which keeps the refresh token in an httpOnly cookie that only
its server half can read. If that tradeoff is the wrong one for what you are
building, `nhost init --template nextjs` is the same app with a server in front
of it.

What a client-side session does not change is who can read your data: the access
token is what the API checks, and the backend's permissions decide what comes
back. The protected page here redirects a signed-out visitor as a convenience,
and that is all it is. Never treat it as authorization.

One thing happens outside the SDK. Auth emails and the OAuth callback send the
browser back with a `refreshToken` on the URL, and
`src/lib/nhost/linkToken.ts` strips it from the address bar before anything
else, so it does not sit in history, then exchanges it for a session once at
startup. It only does so for a signed-out visitor: a link may sign someone in,
it may not replace whoever is already signed in. It is single use, so nothing
else should try to redeem it. When the redirect fails, a provider that is not
enabled yet or an expired link, the service sends an `error` code instead. That
is taken off the URL the same way, and the page the visitor lands on says what
went wrong in its own words; the service's description goes to the console.

## Deploy

`vite build` writes static files to `dist/`. `VITE_*` variables are inlined at
build time, so set these before the build, not on the host serving the files:

```sh
VITE_NHOST_SUBDOMAIN=<your subdomain>
VITE_NHOST_REGION=<your region>
VITE_APP_ORIGIN=https://your.app
```

`VITE_APP_ORIGIN` is where auth emails send people back to. Keep it in the
backend's `auth.redirections.allowedUrls`.

Serve `dist/` with a rewrite that sends unknown paths to `index.html`, or deep
links like `/auth/password` 404 on reload. Everything in `VITE_*` ships to the
visitor, so none of it may be a secret.

## Scripts

| command | does |
| --- | --- |
| `pnpm dev` | development server |
| `pnpm build` | production build, type-checks everything |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm test` | Vitest |
