# Nhost + Next.js starter

Two halves, laid out the way an Nhost project is:

- `nhost/` is the backend configuration `nhost up` runs. It is what
  `nhost init` writes, with the sign-in methods this app offers switched on,
  plus `nhost/metadata/`: the Hasura permissions the account page needs. The
  auth service tracks its own tables but grants nothing, so without these a
  signed-in user could register a passkey and never see it listed. `nhost up`
  applies them, restarts the auth and storage services so they re-add what
  they manage themselves, then exports Hasura's full metadata back into
  `nhost/metadata/`. The first run therefore adds a file for every table the
  two services track and rewrites the three committed ones without their
  comments. That is expected; commit the exported form, as the example
  backends under `examples/` do. The reasons behind the permissions are in
  [Permissions](#permissions) below, which the export does not touch.
  `nhost/emails/` holds only the `en` email templates `nhost init` writes,
  because the config allows only `en` and auth swaps any other locale for the
  default at sign-up. Adding a locale to `allowed` means adding its templates
  too; `nhost init` also writes `bg`, `cs`, `es` and `fr`.
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

`frontend/src/app/signin/methods.ts` lists them. Four work as soon as the
backend is up: email and password is always on, and `nhost/nhost.toml` turns
on magic link, the email code and passkeys. Passkeys are bound to `localhost`,
so open the app at `http://localhost:3000`, not `127.0.0.1`. The fifth, OAuth,
needs you.

### OAuth

A provider only works once an app is registered with it and the backend knows
the app's credentials. The config is already wired to `.secrets`, so it is
four steps:

1. Register an OAuth app with GitHub or Google. The callback URL for the local
   stack is `https://local.auth.local.nhost.run/v1/signin/provider/github/callback`,
   with `google` in place of `github` for Google.
2. Put the client id and secret in `.secrets`, replacing the `fixme` values.
3. Set `enabled = true` on that provider in `nhost/nhost.toml`, then restart
   `nhost up`.
4. List it in `NHOST_OAUTH_PROVIDERS` for the frontend, for example
   `NHOST_OAUTH_PROVIDERS=github,google` in `frontend/.env.local`, then
   restart `pnpm dev`.

The frontend cannot read the backend's config, so the fourth step is how it
knows. Until a provider is listed it offers no button for it, and with none
listed the sign-in page leaves the method out. The variable is only read on
the server, at request time, so a host that deploys the frontend sets it like
any other runtime variable rather than before the build.

## Permissions

The three files in `nhost/metadata/databases/default/tables/` grant the `user`
role what the account page needs and nothing more. The headers in those files
say the same, but the first `nhost up` rewrites the files without them, so
this is the record that lasts.

`auth.users`: the auth API has no endpoint for writing a profile field or for
closing an account, so both go through GraphQL. Select, update and delete are
all scoped to the user's own row, and update is limited to `display_name` and
`avatar_url`. Widening it is the thing to be careful with: an unrestricted
update would let a user rewrite their own roles and email. Delete takes the
account with it, and the rest of the auth schema is wired to the row with
`ON DELETE CASCADE`, so refresh tokens, security keys and provider links go
at the same time. A storage file does not cascade, which is why the
account-deletion action in `frontend/src/app/account/actions.ts` deletes the
avatar through the storage API before it deletes the user.

`auth.user_security_keys`: select and delete, scoped to the user's own rows.
The auth service writes the row itself when a passkey is registered, so
without these a signed-in user could add one but never list or remove it.

`storage.files`: the storage service inserts the row for an upload through
Hasura as the uploading user, so the insert permission decides who may upload
and where, pinned to the `default` bucket. The service finishes the row as
admin, which is why there is no update permission. Select and delete are the
user's own files. The service also reads a file back as the user before
serving it and asks for every column in its `FileMetadataFragment`, so the
select columns must stay exactly that set: dropping one breaks downloads.

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
