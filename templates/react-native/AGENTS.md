# Working in this project

This is an Nhost project scaffolded by `nhost init --template react-native`.
It has two halves:

- `nhost/` - the backend configuration. Migrations and metadata live here and
  are applied by `nhost up`. This template ships **none**: the app uses only
  the `auth.users` table the backend provides.
- `frontend/` - an Expo app styled with NativeWind, built around
  authentication, routed by Expo Router or React Navigation depending on what
  `--navigation` was given. Read `frontend/README.md` first.

## Rules that are easy to break

1. **`src/app` is routes and nothing else.** Expo Router turns every file
   under it into a route, including files that export no component - they end
   up in the route table and in the sitemap. Under React Navigation,
   `src/screens.ts` registers the `.tsx` files in it as screens the same way.
   So a sign-in method's calls live in the file that is its route, not in a
   module beside it. Anything shared goes in `src/lib`, `src/components` or
   `src/signin`.
2. **Screens reach the navigation library through one module.**
   `frontend/src/lib/navigation.tsx` is the seam, the same idea as
   `components/ui`: screens call `useGo()`, `useParams()` and `Redirect` and
   import nothing else for navigation. This project has one copy of it,
   written against whichever of Expo Router and React Navigation it was
   scaffolded with. If you need something the seam does not expose, add it
   there rather than importing the library in a screen.
3. **One client, created once.** `frontend/src/lib/nhost/AuthProvider.tsx`
   calls `createClient` in a `useMemo` with no dependencies and shares it
   through context. That client owns the refresh timer. Creating a second one
   anywhere gives you two rotators of a single-use refresh token. Always reach
   for `useAuth()`.
4. **The session is read off disk before anything decides.**
   `src/lib/nhost/storage.ts` keeps it in AsyncStorage. The SDK reads storage
   synchronously, so the session is held in memory and written through, and
   `hydrate()` fills that memory on launch. `src/lib/nhost/startAuth.ts` then
   redeems the link the app was opened with, and each link that arrives
   later, one at a time. `isLoading` covers all of it, so it goes true again
   while a later link is redeemed. Until it is false nothing knows whether
   anyone is signed in.
5. **Coming back into the app is a deep link, not a URL.** Auth emails and the
   OAuth callback reopen the app on the scheme in `app.json`.
   `src/lib/nhost/linkToken.ts` reads the refresh token out of that link and
   redeems it, only when nobody is signed in: any page or app can open the
   scheme, and a link that replaced a session would move the user into the
   sender's account. Build the link with
   `authRedirectURL()` in `src/lib/nhost/redirect.ts` - never by hand, because
   that is the one place that stops a crafted `next` from sending the user's
   emailed link somewhere else. A failed link comes back with `error` instead,
   which `startAuth` reads in its turn into `useAuth().linkError` as one of
   the app's own sentences; show that, and never the `errorDescription` a link
   carries, since anyone can write one.
6. **Sign-in methods are isolated.** Each is one directory under
   `frontend/src/app/auth/` plus one line in
   `frontend/src/signin/methods.ts`. A method may import from `@/lib/*`,
   `@/components/*` and `@/signin/*` - never from another method, and nothing
   shared may import from a method.
7. **Routes are the directory tree.** Expo Router, or `src/screens.ts` under
   React Navigation, maps `src/app/` to paths, so a method directory is its own
   route and deleting it removes that route. Do not add a route table.
8. **Typed routes are off.** `methods.ts` is generated data with no imports and
   types `href` as a plain string, which is what lets the sign-in screen list
   methods without depending on any of them. Under Expo Router, turning
   `experiments.typedRoutes` on makes every `href` have to be a route literal
   and breaks that.
9. **The protected screen is a convenience, not a control.** The check runs on
   the device, and the bundle is on the user's phone. What actually protects
   data is the backend's permissions on the access token. Never treat a
   client-side check as authorization.
10. **Config, not schema.** Enabling an auth method is a `nhost.toml` change,
   not a migration.
11. **Sign up is the default, and an `intent` param is what changes it.** The
   password form opens on sign-up, because anyone running this against a fresh
   local backend has no account yet. A link that wants the other mode carries
   an `intent` of `sign-in`; `frontend/src/signin/intent.ts` parses it.
   Nothing is gated on it, so a missing or crafted value costs nothing.
   `frontend/src/signin/route.ts` builds every link that carries it, and it is
   the only thing that does: `next` and `intent` both have to survive the hop
   out to a method and the hop back, and a second builder is how one of them
   gets dropped. It uses only the navigation seam's types, so it works under
   either navigation system.
12. **"Check your inbox" is the link to the local mailbox.** Against a local
   backend the email is in Mailhog, so every state that waits on one titles
   itself with `<CheckYourInbox />` and those words open it. They stay plain
   text once the app targets a real project, where a link would be a lie about
   where the email is.
13. **The back-link counts the methods.** `--auth-methods` can scaffold
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
or in `nhost/metadata/`, then read it from the app through `@nhost/nhost-js`'s
GraphQL client.

## Commands

```sh
nhost up                                   # backend, from the project root
cd frontend && pnpm install && pnpm dev    # Expo dev server
pnpm lint && pnpm test && pnpm build       # lint, tests, type-checked bundle
```

`local.*.local.nhost.run` resolves to `127.0.0.1`, so the iOS simulator reaches
the local stack as is, while the Android emulator and a phone do not;
`frontend/README.md` says what to do for each. Local emails are captured at
<https://local.mailhog.local.nhost.run>.
