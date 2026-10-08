# Working in this project

This is an Nhost project scaffolded by `nhost init --template react`.
It has two halves:

- `nhost/` - the backend configuration. Migrations and metadata live here and
  are applied by `nhost up`. This template ships **none**: the app uses only
  the `auth.users` table the backend provides.
- `frontend/` - a React 19 single-page app on Vite with Tailwind v4, built
  around authentication. Read `frontend/README.md` first.
  `src/components/ui/` holds plain Tailwind modules the project owns, or the
  shadcn/ui versions of the same API when it was scaffolded with
  `--ui shadcn`.

## Rules that are easy to break

1. **One client, created once.** `frontend/src/lib/nhost/AuthProvider.tsx`
   calls `createClient` in a `useMemo` with no dependencies and shares it
   through context. That client keeps the session in `localStorage`, and the
   app follows the session through its `sessionStorage.onChange`, which hears
   only writes made through that instance. A sign-in or sign-out through a
   second client would leave the app rendering the old visitor. Always reach
   for `useAuth()`.
2. **The token on the URL is redeemed once, at startup.**
   `frontend/src/lib/nhost/linkToken.ts` strips the `refreshToken` query
   parameter that auth emails and the OAuth callback come back with from the
   address bar, then exchanges it, but only for a signed-out visitor: a link
   may sign someone in, it may not replace whoever is already signed in. Do
   not redeem it again from a page: it is single use. A failed redirect comes
   back with `error` instead, which is stripped the same way and read once
   into `useAuth().linkError`; read it from there, not from the URL, and do
   not render the `errorDescription` a link carries.
3. **Sign-in methods are isolated.** Each is one directory under
   `frontend/src/auth/` holding a `route.tsx`, plus one line in
   `frontend/src/signin/methods.ts`. A method may import from
   `@/lib/nhost/*`, `@/components/*` and `@/signin/*` - never from another
   method, and nothing shared may import from a method.
4. **Routes are found, not listed.** `frontend/src/App.tsx` collects
   `./auth/**/route.tsx` with `import.meta.glob`, so a new method directory
   becomes a route with no edit there, and a deleted one stops being a route.
   Do not replace that with a hand-written route table.
5. **The protected page is a convenience, not a control.** The check runs in
   the browser. What actually protects data is the backend's permissions on
   the access token. Never treat a client-side check as authorization.
6. **Config, not schema.** Enabling an auth method is a `nhost.toml` change,
   not a migration.
7. **Sign up is the default, and `?intent=` is what changes it.** The
   password form opens on sign-up, because anyone running this against a fresh
   local backend has no account yet. A link that wants the other mode says
   `?intent=sign-in`; `frontend/src/signin/intent.ts` parses it.
   Nothing is gated on it, so a missing or crafted value costs nothing.
   `frontend/src/signin/query.ts` builds every link that carries it, and it is
   the only thing that does: `next` and `intent` both have to survive the hop
   out to a method and the hop back, and a second builder is how one of them
   gets dropped.
8. **"Check your inbox" is the link to the local mailbox.** Against a local
   backend the email is in Mailhog, so every state that waits on one heads
   itself with `<CheckYourInbox />` and those words open it. They stay plain
   text once the app targets a real project, where a link would be a lie about
   where the email is.
9. **The back-link counts the methods.** `--auth-methods` can scaffold
   one, and "Other ways to sign in" would then promise choices that do not
   exist. `frontend/src/signin/OtherWaysLink.tsx` reads
   `methods.ts` and renders nothing when there is only one. It counts rather
   than naming any method, which is what lets it be shared.

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
