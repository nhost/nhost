# Nhost + React Native

An auth starter for Expo. It signs people in, keeps a session on the device,
and guards one screen behind it. There is no database schema: the app uses only
the `auth.users` table the backend ships with, so there is nothing to undo when
you start building your own.

Four sign-in methods are on offer and `nhost init --template` scaffolds the ones
you asked for with `--auth-methods`, email and password by default.
`src/signin/methods.ts` lists the ones you have.

The password form opens on **sign up**, because a fresh local backend has no
accounts in it yet. Signing in and signing up are kept apart: the home screen
offers both, and the screen that wants the other mode is opened with an
`intent` of `sign-in`.

Anywhere the app says "check your inbox", those words open the local mailbox,
since against a local backend that is where the email went. They go back to
being plain text once the app targets a real project and the email really does
arrive in yours.

The components under `src/components/ui/` are plain NativeWind and yours to
edit. There is no shadcn/ui option here: that library is built on Radix and the
DOM, neither of which exists on a device.

Routing is Expo Router unless you passed `--navigation navigation`, which
scaffolds React Navigation instead. See "Swapping the navigation system" below
for what that changes.

## Run it

You need Node 22+, pnpm, a running local backend, and either a simulator or the
Expo Go app on a phone:

```sh
nhost up                      # from the project root, next to nhost/
cd frontend
pnpm install
pnpm dev                      # then press i, a, or scan the QR code
```

On a local backend `nhost init` created there is nothing to configure first:
it already allows the links the app comes back on, see "Coming back into the
app" below. On a backend you already had, or one init pulled with `--remote`,
do what init's next steps named before you sign up.

### Pointing the app at your backend

This is the one thing that is harder than on the web. `nhost up` serves the
backend at `https://local.*.local.nhost.run`, names that resolve to
`127.0.0.1`. That address is your machine only from something that shares its
network, which the iOS simulator does and the Android emulator and a phone do
not.

- iOS simulator: it works as is.
- Android emulator: `127.0.0.1` is the emulator itself, and your machine is
  `10.0.2.2` from inside it. Start the backend on the subdomain that resolves
  there, and run the app against the same one:

  ```sh
  nhost --local-subdomain 10-0-2-2 up             # from the project root
  EXPO_PUBLIC_NHOST_SUBDOMAIN=10-0-2-2 pnpm dev   # from frontend/
  ```

  The stack still answers on `local.*` while it runs this way, but the URLs it
  prints, the links in its emails, an OAuth provider's callback URL and the
  dashboard's own calls to the backend all move to `10-0-2-2`, which only the
  emulator can reach. Go back to a plain `nhost up` when you are done with the
  emulator.
- A real device: run `nhost up` and expose it to your network, then set
  `EXPO_PUBLIC_NHOST_SUBDOMAIN` and `EXPO_PUBLIC_NHOST_REGION` to a project
  the device can reach - a real Nhost project is the simplest answer while
  developing on hardware.

Two addresses are worth keeping open while the local stack is up, and neither
exists once you ship:

- <https://local.dashboard.local.nhost.run/orgs/local/projects/local> is the
  dashboard for the local project: users, data, permissions and the GraphQL
  API.
- <https://local.mailhog.local.nhost.run> is the mailbox every local email
  lands in, which is where sign-in links, verification links and one-time codes
  turn up.

## Coming back into the app

On the web, an auth email sends the browser back to a URL. There is no URL
here: the only way back into a native app is a deep link on the scheme declared
in `app.json`, which is `nhoststarter` until you change it.

`src/lib/nhost/redirect.ts` builds those links, and
`src/lib/nhost/linkToken.ts` reads the refresh token out of one and redeems it,
but only when nobody is signed in. Any web page or app can open the scheme, so
a link that replaced a signed-in session would let its sender move the user
into the sender's account. Sign out first to follow a link for another one.
When the link fails, a provider that is not enabled yet or an expired email
link, the service sends an `error` code instead. The app says what went wrong
in its own words above the screen the link opens, and the service's
description goes to the console.
Under Expo Go, which is what `pnpm dev` runs the app in, `Linking.createURL`
builds the development server's `exp://<host>:<port>/--/...` URL instead.

The backend refuses to redirect to anything but its `clientUrl` and what
`auth.redirections.allowedUrls` allows. When `nhost init` creates a local
backend it allows both kinds of link, in two different places:

- `nhoststarter://` in `nhost/nhost.toml`, the configuration every
  environment shares.
- `exp://` in `nhost/overlays/local.json`, which only the local backend
  applies.

`exp://` has to be allowed whole, since its host is whatever address the
development server is on, and allowed whole it matches a link into any project
Expo Go can load, including one someone else runs. Against the local backend
that costs nothing, because every email it sends lands in the local mailbox.
On a project real people sign in to, anyone could request a sign-in link for
someone else's address and have that person's session delivered to their own
project. That is why it is in the local overlay, which nothing deploys.
The overlay appends to the `allowedUrls` list in `nhost.toml`, so that line has
to stay, even as `allowedUrls = []`: remove it, or let `nhost config pull`
replace it from a project that allows nothing, and `nhost up` and `nhost config
validate` fail with "doc is missing path" without naming the overlay.

A backend you already had, or one pulled with `--remote`, keeps its
configuration as it was, and init names the entries it is missing. Add
`nhoststarter://` to `allowedUrls` in `nhost.toml`, and `exp://` for the
local backend only with `nhost config edit --subdomain local`, which writes
that overlay.

Expo Go against a real project, the way to develop on a phone, needs that
project to allow the development server's own address, the one `pnpm dev`
prints, such as `exp://192.168.1.20:8081`. Allow that address and not bare
`exp://`, and remove it before real people sign in.

An auth email has to be opened on the device running the app, because the
scheme resolves to that device's copy. And if you rename the scheme in
`app.json`, rename it in `nhost.toml` too.

## The sign-in methods

Each method is a directory under `src/app/auth/` and a line in
`src/signin/methods.ts`. Nothing else in the app knows a method exists: Expo
Router maps the directory tree to routes, so there is no route table naming
them.

| method | `--auth-methods` name | directory | what the backend needs |
| --- | --- | --- | --- |
| Email and password | `password` | `app/auth/password/` | on by default |
| Magic link | `magic-link` | `app/auth/magic-link/` | `auth.method.emailPasswordless.enabled = true` |
| Email code | `otp` | `app/auth/otp/` | `auth.method.otp.email.enabled = true` |
| GitHub or Google | `oauth` | `app/auth/oauth/` | a provider section, see below |

Email code is the only one that needs no deep link: the code is typed back into
the app, so the whole exchange finishes there. The other three come back
through a link.

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
`nhost up` after changing either file. The app opens the provider in a system
browser session rather than a page of its own, and is handed the callback when
it closes.

Password sign-up sends a verification email first: the account works once the
link in it is opened. That is the backend's default and it is deliberately left
alone here.

## Keep only the methods you want

This is what `--auth-methods` does at scaffold time, and it works just as well
by hand afterwards. Two steps per method, in either order:

1. Delete its directory under `src/app/auth/`.
2. Delete its line in `src/signin/methods.ts`.

`pnpm build` proves the rest still stands. Nothing outside a method's directory
is used only by it, the sign-in screen only reads `methods.ts`, and the route is
the directory, so there is nothing else to find.

## Where a method's code lives

In the route file, not beside it. Expo Router turns **every** file under
`src/app` into a route, including ones that export no component, so a
`actions.ts` next to a screen would show up in the route table and the sitemap.
That is why each method's calls sit in its `index.tsx` rather than in a module
of its own, and why anything genuinely shared lives in `src/lib`,
`src/components` or `src/signin`.

The exception is `src/lib/nhost/redirect.ts`. Building the link an auth email
comes back to is the one security-relevant decision every method makes, so it
is in one place and tested once rather than repeated four times.

## Swapping the navigation system

`src/lib/navigation.tsx` is a seam, the same idea as `components/ui`: it is the
only module that imports a navigation library. Screens use `useGo()`,
`useParams()` and `Redirect` from it and nothing else, which is what lets
`--navigation` change the library without touching a single screen.

| | `--navigation router` (default) | `--navigation navigation` |
| --- | --- | --- |
| library | Expo Router | React Navigation (native stack) |
| entry | `expo-router/entry` | `index.ts` registering `src/App.tsx` |
| routes | the framework reads `src/app/` | `src/screens.ts` reads the same directory with `require.context` and registers each screen under its path |
| shell | `src/app/_layout.tsx` | `src/App.tsx` |

Both read `src/app/` to find screens, and in both a path reaches a screen the
way a deep link to it does, so `signin/methods.ts` is correct either way and
deleting a method directory removes its route under both. React Navigation
follows Expo Router's `[id]`, `(group)`, `[...rest]` and `+not-found` names,
though a catch-all gets no parameter for the segments it took, and without a
`+not-found` screen a path no screen is at goes home.

If you add something to the seam, add it to both copies: the one in
`frontend/src/lib/navigation.tsx` and the one the other system ships. CI
scaffolds and builds each system, so a screen that reaches past the seam fails
there.

## Where the session lives

In AsyncStorage, refresh token included. One client is created in
`src/lib/nhost/AuthProvider.tsx` and shared through context, and it refreshes
the access token itself when a request goes out within 60s of expiry.

The SDK reads storage synchronously and AsyncStorage is asynchronous, so
`src/lib/nhost/storage.ts` keeps the session in memory, answers reads from
there, and mirrors every write to disk. `hydrate()` fills that memory on
launch. `isLoading` waits for that and then for the link the app was opened
with to be redeemed, and is true again while a later link is;
`src/lib/nhost/startAuth.ts` runs them in that order.

**Read this before shipping something sensitive.** AsyncStorage is not
encrypted: it is a file in the app's sandbox. That is fine against another app
on the same device, which cannot read it, and no protection at all on a rooted
or jailbroken one, or against anyone with a backup of the device. If that
tradeoff is wrong for what you are building, swap the storage for
`expo-secure-store`, which is backed by the Keychain and the Android keystore -
`storage.ts` is the only file that would change, and its interface is three
methods.

What the session storage does not change is who can read your data: the access
token is what the API checks, and the backend's permissions decide what comes
back. The protected screen here redirects a signed-out user as a convenience,
and that is all it is. Never treat it as authorization.

## Ship it

`EXPO_PUBLIC_*` variables are inlined when the bundle is built, so set them
before building, not on a running app:

```sh
EXPO_PUBLIC_NHOST_SUBDOMAIN=<your subdomain>
EXPO_PUBLIC_NHOST_REGION=<your region>
```

Everything in the bundle ships to the device and anyone can unpack it, so none
of it may be a secret.

Before a store build, change `scheme`, `ios.bundleIdentifier` and
`android.package` in `app.json` to your own, and the scheme in `allowedUrls`
with them. The production project's `allowedUrls` should hold that scheme and
no `exp://` entry at all.

## Scripts

| command | does |
| --- | --- |
| `pnpm dev` | Expo development server |
| `pnpm android` / `pnpm ios` | open it on a device or simulator |
| `pnpm build` | type-checks everything, then bundles it |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm test` | Vitest |

`pnpm test` runs the plain TypeScript: the deep-link parsing, the session
storage and the redirect rule. Rendering a screen needs Metro and a device
runtime, so the screens are covered by `pnpm build` type-checking and bundling
them instead.
