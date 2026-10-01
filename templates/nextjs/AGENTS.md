# Working in this project

This is an Nhost project scaffolded by `nhost init --template nextjs`.
It has two halves:

- `nhost/` - the backend configuration. Migrations and metadata live here and
  are applied by `nhost up`. This template ships **none**: the app uses only
  the `auth.users` table the backend provides.
- `frontend/` - a Next.js 16 (App Router) app with Tailwind v4, built around
  authentication. Read `frontend/README.md` first. `src/components/ui/` holds
  plain Tailwind modules the project owns, or the shadcn/ui versions of the
  same API when it was scaffolded with `--ui shadcn`.

## Rules that are easy to break

1. **The proxy is the only token refresher.** `frontend/src/proxy.ts` refreshes
   the session; `frontend/src/lib/nhost/client.ts` is deliberately built
   without the SDK's auto-refresh middleware and only reads the access token.
   The refresh token stays in the httpOnly `nhostSession` cookie. Do not add a
   second refresher or make that cookie readable by JavaScript.
2. **Sign-in methods are isolated.** Each is one directory under
   `frontend/src/app/auth/` plus one line in
   `frontend/src/app/signin/methods.ts`. A method may import from
   `@/lib/nhost/*`, `@/components/*` and `@/app/signin/destination` - never
   from another method, and nothing shared may import from a method.
3. **Removing a method is two deletions**: the directory and its line in
   `methods.ts`. Then stop `pnpm dev`, delete `frontend/.next` and run
   `pnpm build`: the dev server's route types there still import the page.
4. **Config, not schema.** Enabling an auth method is a `nhost.toml` change,
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
