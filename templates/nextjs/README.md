# Nhost + Next.js starter

Two halves, laid out the way an Nhost project is:

- `nhost/` is the backend configuration `nhost up` runs. It is what
  `nhost init` writes, with the sign-in methods this app offers switched on,
  plus `nhost/metadata/`: the Hasura permissions the account page needs. The
  auth service tracks its own tables but grants nothing, so without these a
  signed-in user could register a passkey and never see it listed. `nhost up`
  applies them, then restarts the auth and storage services so they re-add
  what they manage themselves. `nhost/emails/` holds only the `en` email
  templates `nhost init` writes, because the config allows only `en` and auth
  swaps any other locale for the default at sign-up. Adding a locale to
  `allowed` means adding its templates too; `nhost init` also writes `bg`,
  `cs`, `es` and `fr`.
- `frontend/` is the Next.js app. See its README for the commands.

## Running it

```sh
cp .secrets.example .secrets
nhost up
cd frontend && pnpm install && pnpm dev
```

`.secrets` holds the local development secrets, including the JWT keypair the
auth service signs sessions with. The example file is the fixed set `nhost init`
writes for every local project, so copying it is all a local stack needs. It is
gitignored, and it must stay that way once it holds anything real.

`nhost up` prints the local URLs. The frontend targets the local stack by
default, so nothing in `frontend/.env.example` needs setting until the app
points at a real project.

## Sign-in methods

`frontend/src/app/signin/methods.ts` lists them. Three work as soon as the
backend is up: email and password is always on, and `nhost/nhost.toml` turns
on magic link and the email code. The fourth needs you.

### OAuth

A provider only works once an app is registered with it and the backend knows
the app's credentials. The config is already wired to `.secrets`, so it is
three steps:

1. Register an OAuth app with GitHub or Google. The callback URL for the local
   stack is `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`,
   with `google` in place of `github` for Google.
2. Put the client id and secret in `.secrets`, replacing the `fixme` values.
3. Set `enabled = true` on that provider in `nhost/nhost.toml`, then restart
   `nhost up`.

Until then the button is there but the auth service refuses the redirect, and
the home page shows its reason.

## The avatar

An uploaded avatar is a private file in storage, and the account's
`avatar_url` points at this app's own route, `/api/avatar/<file id>`, rather
than at storage. The storage service reads the session from a header an
`<img>` cannot send, so the route handler reads the file with the session
token and streams it back with storage's `Cache-Control` and `ETag` intact,
marked `private` because the response is gated by the cookie. The browser
caches it for the hour storage sets and revalidates by ETag after that.

The route serves PNG, JPEG, GIF, WebP and AVIF and answers 415 for anything
else, SVG included: it serves on this app's origin, where an HTML or SVG file
could run script with the visitor's session, and a file can reach storage
without going through the upload form. Behind that check, `next.config.ts`
gives the route a sandboxing `Content-Security-Policy`, as storage does for
HTML and SVG on its own origin. It is set there rather than in the handler
because Next keeps a config header over a handler's header of the same name.

The select permission is the user's own files, which covers everywhere this
app shows an avatar: it only ever shows you yours. Showing other users'
avatars means widening that permission, and that is the first thing to
change if the app grows a page that lists people.
