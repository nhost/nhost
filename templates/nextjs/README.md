# Nhost + Next.js starter

Two halves, laid out the way an Nhost project is:

- `nhost/` is the backend configuration `nhost up` runs. It is what
  `nhost init` writes, with the sign-in methods this app offers switched on
  except OAuth, which needs credentials first (see [OAuth](#oauth)), plus
  `nhost/metadata/`: the Hasura permissions the account page needs. The auth
  service tracks its own tables but grants nothing, so without these a
  signed-in user could register a passkey and never see it listed. `nhost up`
  applies them, restarts the auth and storage services so they re-add what
  they manage themselves, then exports Hasura's full metadata back into
  `nhost/metadata/`. That export is what is committed, as in the example
  backends under `examples/`, so there is a file for every table the two
  services track. The exported files carry no comments, so the reasons
  behind the permissions are in [Permissions](#permissions) below.
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
writes for every local project, plus the frontend's address (see
[Deploying](#deploying)), so copying it is all a local stack needs. It is
gitignored, and it must stay that way once it holds anything real.

`nhost up` prints the local URLs. The frontend targets the local stack by
default, so nothing in `frontend/.env.example` needs setting until the app
points at a real project.

## Sign-in methods

`frontend/src/app/signin/methods.ts` lists them. Four work as soon as the
backend is up: email and password is always on, and `nhost/nhost.toml` turns
on magic link, the email code and passkeys. Passkeys are bound to the
`WEBAUTHN_RP_ID` secret, `localhost` locally, so open the app at
`http://localhost:3000`, not `127.0.0.1`. The fifth, OAuth, needs you.

### OAuth

Both providers ship switched off. A provider only works once an app is
registered with it and the backend knows the app's credentials. The config is
already wired to `.secrets`, so turning one on is four steps:

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

The same list puts a Linked accounts row on the account page, where a
signed-in user can link a provider to their account or unlink one. Linking is
the sign-in round trip with the session's access token passed as `connect`,
so the provider callback URL above covers it. A provider is not unlinked when
it is the only way into the account, which is only possible for an account
with no email address.

## Sessions

The account page lists every browser signed in to the account, two lines
each: the start of the session's id and the browser and system, then, where
the host provides it, the city, then the address and when it was last used,
in the visitor's time zone. Each one can be signed out from its line, this browser's included.

The auth service records none of this, so the app does. The proxy writes it to
the session's row in `auth.refresh_tokens`, in the `metadata` column the auth
service leaves empty for a browser session, when it changes and at most every
five minutes otherwise. The address comes from `x-real-ip` or
`x-forwarded-for`, and the location from the headers Vercel
(`x-vercel-ip-country`, `x-vercel-ip-country-region`, `x-vercel-ip-city`) or
Cloudflare (`cf-ipcountry`, plus `cf-ipcity` and `cf-region` with its visitor
location headers on) set. Elsewhere there is no location, and a server that
takes requests directly records whatever address the browser claims. The user
role may write the column, so this is the user's own record of their
sessions, not an audit log.

Signing a session out deletes its row, but an access token stays valid until
it expires, 15 minutes with this config. So on every page load the proxy also
looks for the session's row, and signs the browser out when it is gone. A tab
left open checks again when it is next looked at, at most every five minutes.

## Deploying

The config takes the frontend's address from two secrets rather than from
`nhost.toml`, so the same file deploys anywhere and no overlay is needed:
`APP_ORIGIN` is where auth may redirect, and `WEBAUTHN_RP_ID` is the bare
hostname passkeys are bound to. A cloud project sets both, for example:

```sh
nhost secrets create APP_ORIGIN https://myapp.example.com
nhost secrets create WEBAUTHN_RP_ID myapp.example.com
```

The four OAuth secrets need to exist too, even while the providers are off,
because the config references them. `fixme` is fine until a provider is
enabled. Turning one on in the cloud follows the [OAuth](#oauth) steps, with
the callback URL
`https://<subdomain>.auth.<region>.nhost.run/v1/signin/provider/github/callback`
and the credentials set with `nhost secrets update` instead of `.secrets`.
`NHOST_OAUTH_PROVIDERS` goes on the frontend's host, on Vercel as a project
environment variable, and the next deployment picks it up.

The frontend needs the same origin as `NEXT_PUBLIC_APP_ORIGIN`, next to the
project's subdomain and region; `frontend/.env.example` has all three. They
are read when `next build` runs, so set them before building. On Vercel the
origin can be left out, because the build falls back to the project's
production domain, the one `APP_ORIGIN` has to match. None of the three is a
secret, as all of them end up in the browser bundle, so they can also be
committed in a `frontend/.env.production` once `frontend/.gitignore` stops
ignoring it. Nothing secret belongs in that file.

`NEXT_PUBLIC_NHOST_ORG_SLUG` is optional. The footer links the backend's
dashboard, and a cloud project's page there is addressed by its organization
as well as its subdomain, which the app cannot look up. Set it to the part
after `/orgs/` in the project's dashboard URL, for example `acme` in
`https://app.nhost.io/orgs/acme/projects/abcdefgh`, and the link opens the
project directly. Without it the dashboard asks which organization first.
`nhost list` shows the organization's name, which helps pick the right one,
but the slug is only in the dashboard URL.

## Permissions

Five of the files in `nhost/metadata/databases/default/tables/`,
`auth_users.yaml`, `auth_user_security_keys.yaml`, `auth_refresh_tokens.yaml`,
`auth_user_providers.yaml` and `storage_files.yaml`, grant the `user` role
what the account page needs and nothing more. The rest
are the services' own tables with no permissions. Hasura's export keeps no
comments, so this section is the record of why.

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

`auth.refresh_tokens`: one row per session. Select, update and delete are
scoped to the user's own `regular` rows, which leaves out personal access
tokens. Select is `id`, `created_at`, `expires_at` and `metadata`, never
`refresh_token_hash`, and update is `metadata` alone (see
[Sessions](#sessions)). The proxy reads a session's row on every page load to
find out whether it was revoked, so without the select permission a session
signed out from another device lasts until its access token expires.

`auth.user_providers`: select and delete, scoped to the user's own rows.
Select is `id`, `provider_id` and `created_at`. The row also holds the
provider's access and refresh tokens, which must stay out of it. The auth
service writes the row when a provider is connected.

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

## Design notes

The code's comments say what each piece does. This is the why behind the
parts that are easy to break by tidying them.

### The session lives on the server

The session, refresh token included, is in an httpOnly cookie that only the
proxy and server code read. A second cookie, `nhostSignedIn`, is readable by
JavaScript and carries nothing but the fact that a session is there; the nav
uses it to notice a session that ended in another tab. No token reaches the
browser, so an XSS cannot act as the user. Signing in and out go through
server actions, which write the cookies, and every page reads the session on
the server.

The proxy (`frontend/src/proxy.ts`, `lib/nhost/server.ts`) is the only thing
that refreshes the access token, and it does so a minute before expiry on
every real navigation. Refresh tokens are single-use, so two refreshes at
once mean one of them fails with a token the backend has already replaced,
and the SDK answers that by clearing the session. Next prefetches every link
in view through the same proxy, concurrently with the real request, which is
exactly that race. So a prefetch reads the stored session and never refreshes,
and the browser never gets a refresh token to try with. Turning
`prefetch={true}` on a link, or giving the browser client the SDK's own
auto-refresh, reopens the race.

### Links that sign in

Auth emails and the OAuth callback send the browser back with a refresh token
in the query string. The proxy redeems it, but only for a signed-out visitor:
redeeming on sight would let a crafted link swap a signed-in visitor's session
for the sender's. The token is then stripped from the URL with a redirect,
whether it was redeemed or not, since a token the proxy declined is still a
live credential until it expires, and query strings leak through history,
bookmarks and the referer header. The proxy's matcher has a second entry so it
runs on every path a link token lands on, because `redirectTo` can name any
path on this origin.

### Where sign-in lands

`?next=` is attacker-controlled. `signInDestination` keeps it only if it is a
path on this site in canonical form, decided by resolving it the way a browser
does rather than by matching its shape: `//evil.example`, `/\evil.example`, a
tab after the slash and `/..//evil.example` all pass a "starts with one slash"
check and leave the site. A path with a raw space or a non-ASCII character is
refused because the auth service re-encodes it on the way back and the browser
then reads a different path. Every server action that puts `next` into a
`redirectTo` checks it again, because an action is a public endpoint that can
be called with any arguments.

### Changing the password

The auth service revokes every session when the password changes, this one
included. The change action signs this browser straight back in with the new
password, and with two-factor on, the code the form asked for, so the visitor
keeps their place while every other device is signed out. An account with no
email address has nothing to sign back in with and gets the old behaviour: the
page is replaced by a card saying so, which a layout holds while Next renders
the page again without a session (`ReplacePageLayout`).

### Signing out

Sign-out is one request: a server action that signs out and redirects home,
called through `useActionState`, so Next sends the signed-out home page back
with the action's answer and the control stays pressed until it is on screen.
Pushing home and refreshing after the action was three requests, with the
button briefly back to "Sign out" between them.

### Sessions and passkeys on this device

The sessions list is the user's own record, written by the proxy into the
`metadata` column of their refresh token row (see [Sessions](#sessions)); the
`user` role may write it, so it is not an audit log. A revoked session keeps
a valid access token for up to fifteen minutes, so the proxy looks the row up
on every real navigation and signs the browser out when it is gone, and a tab
left open checks again when it is next looked at.

A device refuses to add a second passkey for the same account, because the
auth service lists the existing ones as excluded. A browser does not say which
passkeys its device holds without a prompt, so the account page remembers the
passkeys added or used in this browser (local storage) to warn before Add,
and reads the browser's refusal to explain after.

### The small things

- The "Last used" badge on the sign-in list comes from two cookies: a method's
  page opened signed out records an attempt, and the first response with a
  session keeps it, so a way in that was opened and abandoned changes nothing.
- Every page is dynamic, so `staleTimes.dynamic` keeps a recently visited page
  in the browser for 30 seconds. Nothing goes stale that matters: signing in
  or out clears that cache, and every change on the account page refreshes it.
- Toasts render in a popover so they sit in the browser's top layer, above a
  modal `<dialog>`, which no z-index reaches.
- Items removed from a list on the account page leave it before the refreshed
  page arrives (`useRemoved`), because on a deployed backend the refresh takes
  long enough to press the same button twice.
- The `frontend/src/app/signin/methods.ts` registry is how a sign-in method is
  deleted: remove its directory and its entry there. `isolation.test.ts`
  checks that no method imports another and shared code imports no method.
