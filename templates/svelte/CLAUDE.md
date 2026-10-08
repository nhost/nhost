# Working in this project

This is an Nhost project scaffolded by `nhost init --template svelte`.
It has two halves:

- `nhost/` - the backend configuration. Migrations and metadata live here and
  are applied by `nhost up`. This template ships **none**: the app uses only
  the `auth.users` table the backend provides.
- `frontend/` - a SvelteKit single-page app with Tailwind v4, built around
  authentication. Read `frontend/README.md` first.
  `src/lib/components/ui/` holds plain Tailwind modules the project owns, or
  the shadcn-svelte versions of the same API when it was scaffolded with
  `--ui shadcn`.

## Rules that are easy to break

1. **One client, created once.** `frontend/src/lib/nhost/auth.svelte.ts` calls
   `createClient` at module scope and exports it through `useAuth()`. That
   client owns the refresh timer and keeps the session in `localStorage`.
   Creating a second one anywhere gives you two rotators of a single-use
   refresh token. Always reach for `useAuth()`.
2. **`useAuth().session` is a getter, and has to stay one.** That is what keeps
   it reactive through the function call. Destructuring it (`const { session }
   = useAuth()`) reads it once and never updates again.
3. **There is no server.** `frontend/src/routes/+layout.ts` sets `ssr = false`
   and `prerender = false`, and the adapter is `adapter-static` with an
   `index.html` fallback. Do not add a `+page.server.ts` or a `+server.ts`:
   nothing would run them, and the session lives in the browser.
4. **The session is read before the first page renders.** The root
   `+layout.ts` awaits `startAuth()`. Nothing needs a loading check, and
   adding one would be dead code.
5. **The token on the URL is redeemed once, at startup.**
   `frontend/src/lib/nhost/linkToken.ts` exchanges the `refreshToken` query
   parameter that auth emails and the OAuth callback come back with, then
   strips it from the address bar. Do not redeem it again from a page: it is
   single use.
6. **Sign-in methods are isolated.** Each is one directory under
   `frontend/src/routes/auth/` holding its `+page.svelte` and the code only it
   uses, plus one line in `frontend/src/lib/signin/methods.ts`. A method may
   import from `$lib/*` - never from another method, and nothing in `$lib` may
   import from a method.
7. **Routes are the directory tree.** SvelteKit maps `src/routes/` to URLs, so
   a method directory is its own route and deleting it removes that route. Do
   not add a route table.
8. **The protected page is a convenience, not a control.** The check runs in
   the browser. What actually protects data is the backend's permissions on
   the access token. Never treat a client-side check as authorization.
9. **Config, not schema.** Enabling an auth method is a `nhost.toml` change,
   not a migration.

## Adding a table

The template adds no schema of its own, but the backend may already have one:
it can predate the template, or have been pulled with `nhost init --remote`.
Read `nhost/migrations/default/` and `nhost/metadata/` before adding a table.

With `nhost up` running, create the table in the local dashboard at
<https://local.dashboard.local.nhost.run>. It writes the migration to
`nhost/migrations/default/` and the tracking and permissions to
`nhost/metadata/`.

Without a browser, `nhost dev hasura` wraps the Hasura CLI. It needs the
backend running and writes `nhost/migrations/default/<ts>_<name>/`:

```sh
nhost dev hasura migrate create <name> --database-name default \
  --endpoint https://local.hasura.local.nhost.run \
  --admin-secret nhost-admin-secret \
  --up-sql 'CREATE TABLE ...' --down-sql 'DROP TABLE ...'
nhost up                            # applies it
```

That writes no metadata: track the table and set permissions in the dashboard
or in `nhost/metadata/`, then read it from the frontend through
`@nhost/nhost-js`'s GraphQL client.

## Commands

```sh
nhost up                                   # backend, from the project root
cd frontend && pnpm install && pnpm dev    # app on :3000
pnpm lint && pnpm test && pnpm build       # lint, tests, type-checked build
```

Local emails are captured at <https://local.mailhog.local.nhost.run>.
