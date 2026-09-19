# Nhost + Next.js + shadcn/ui

A full-stack, agent-ready starter created with `nhost create`:

- **`backend/`** — authentication, PostgreSQL, a GraphQL API, storage, serverless functions, migrations, and GraphQL metadata.
- **`frontend/`** — Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, `@nhost/nhost-js`, TanStack Query, and typed GraphQL documents.
- **`SKILLS.md`** and **`.claude/skills/`**: zero-install workflows that help an LLM add tables, permissions, and functions while keeping project context current. Same content, one file for any agent and one directory per skill for Claude Code.

## Prerequisites

- [Node.js](https://nodejs.org) >= 22 and a package manager — the commands below use the one this project was created with
- The [Nhost CLI](https://docs.nhost.io/platform/cli) (`nhost`)
- Docker for the local backend

## 1. Start the backend

```sh
cd backend
nhost up
```

`nhost create` recorded this project's Docker Compose project name in `backend/nhost/project-name`. It namespaces the local containers and database volume so they do not collide with another project also stored in a `backend/` directory. Set `NHOST_PROJECT_NAME`, or pass `--project-name`, when you want to override it.

The local stack includes the database, authentication, GraphQL API, storage, and functions runtime. Local sign-in emails are captured by the mail viewer instead of being sent.

## 2. Start the frontend

In another terminal:

```sh
cd frontend
cp .env.example .env.local
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The home page reports GraphQL connectivity and links to the sign-in flow, the protected todos page, and, once signed in, your profile.

Sign-in asks for your email first and then shows the step that account uses: a password if one is set, otherwise a code sent by email. An address with no account gets a code too, and verifying it creates the account, so there is no separate sign-up form.

The default environment points to the local backend:

```dotenv
NEXT_PUBLIC_NHOST_SUBDOMAIN=local
NEXT_PUBLIC_NHOST_REGION=local
```

Use your project's subdomain and region when deploying to Nhost Cloud. This one pair is the only backend configuration: the browser client and server components both read it through `frontend/src/lib/nhost/env.ts`, so they cannot end up pointing at different backends.

Next.js inlines `NEXT_PUBLIC_*` values into the bundle at **build** time, not at runtime. Set both variables before `next build` — in your host's build environment, or as build arguments if you build a container image. Setting them on the running host has no effect, and a build that leaves them unset permanently targets the local stack. Such a build logs an error to that effect on startup.

## Before you deploy

Put a rate limit in front of `/auth-method` (for example at your CDN or edge, keyed on client IP) before this sign-in page is reachable from the public internet. `hasPassword` in `frontend/src/app/signin/actions.ts` calls that function from the sign-in page — the most public page in the app — and it runs with the admin secret to look up whether an address has a password set. The response is bounded (an unknown address and a password-less account both answer the same way), but left unmetered it lets anyone run bulk lookups against a list of addresses. See the note at the top of `backend/functions/auth-method.ts`.

## Agent-ready development loop

The primary workflow is local files plus the Nhost CLI:

1. Start the backend: `(cd backend && nhost up)`.
2. After any schema or GraphQL metadata change, run `(cd frontend && pnpm codegen)`.
3. Prompt your LLM to build the feature. It should read `frontend/schema.graphql`, `AGENTS.md` or `CLAUDE.md`, and the matching workflow in `SKILLS.md` (or `.claude/skills/<name>/SKILL.md`) first.
4. Review the implementation and run the relevant frontend checks.

The starter includes these skills:

- `add-table` for reversible migrations, tracked metadata, and user permissions
- `add-permission` for role and row-level access changes
- `create-function` for file-routed serverless endpoints and logs
- `refresh-context` for refreshing the committed schema and generated types

## `schema.graphql` is codegen input and LLM context

`frontend/schema.graphql` is intentionally committed and dual-purpose:

- GraphQL Code Generator reads it to produce the typed documents in `frontend/src/gql/`.
- An LLM reads it as the current, role-scoped backend contract when implementing data-backed features.

From `frontend/`, `pnpm codegen` first runs:

```sh
nhost schema dump --subdomain local --role user -o schema.graphql
```

It then regenerates `src/gql/`. Run it after every table, column, relationship, or permission change and commit the updated schema and generated files together. When the schema file is already current, `pnpm codegen:types` regenerates types offline without contacting the backend.

Do not hand-edit `schema.graphql`; refresh it from a running, fully applied local backend.

## Copy the todos example

The starter ships a complete `public.todos` feature with per-user row permissions:

- `backend/nhost/migrations/default/1700000000000_init_todos/` creates and rolls back the table.
- `backend/nhost/migrations/default/1700000000003_todo_location_and_sharing/` adds the optional location, the sharing flag, the attachment column, and the attachments bucket.
- `backend/nhost/metadata/databases/default/tables/public_todos.yaml` tracks it, sets row ownership on insert, and limits operations to the current user.
- `frontend/src/app/protected/Todos.tsx` defines typed `GetTodos` and `CreateTodo` documents, calls them through `@nhost/nhost-js`, and uses TanStack Query for loading, mutation, and cache invalidation.

Use those files and the `add-table` skill as the copy-me pattern for new user-owned features.

## "I want to…" and the shared list

An item is something you want to do, optionally somewhere in particular: *I want to go skateboarding*, or *I want to go skateboarding in Los Angeles, California*. The form is that sentence, and the location half is always there to fill in or leave empty.

That is three columns rather than a category: `location` (nullable), `preposition`, and the `title` that was already there. An empty location box stores `NULL`, so there is one way to say "no particular place". The preposition is the user's pick from `in / at / from` (`PREPOSITIONS` in `frontend/src/lib/want.ts`), because no single word fits every case: you skate *in* a city, stay *at* a hotel, watch the lights *from* a hillside.

There is no check constraint on the preposition. It is a display word the app never branches on, and the list is the kind that grows, so it is narrowed in the UI where widening it costs nothing instead of in the database where it would cost a migration.

Any item can carry a photo and be shared, with or without a location.

Sharing takes two switches, and both have to be on:

1. **The eye on the row** marks one place as shared. A crossed-out eye is private, which is the default.
2. **Publish my profile**, on the profile page, gives those places a page at `/u/<your user id>`. The card shows the link and copies it.

So nothing becomes public as a side effect of one click in one place, and unpublishing the profile retracts everything at once rather than just hiding the page.

This is the part of the starter that shows a role other than `user`, and it is worth reading before you build your own public page:

- **The `public` role is the unauthenticated one.** Hasura answers a request carrying no token as `public`. Every other permission in this project filters by `X-Hasura-User-Id`; these are the ones that do not.
- **Permissions filter through relationships.** `public_todos.yaml` requires `is_public` on the row *and*, through the `user` relationship, that the owner published their profile. `storage_files.yaml` repeats that condition through `todos`, because a relationship filter matches raw rows rather than applying the related table's own permission.
- **`user` is not a weaker `public`.** Anyone can sign up, so every branch of the `user` rule that is not about the caller's own rows carries the same owner condition. A rule like a bare `todos: { is_public: true }` reads as "shared items only" but actually hands every signed-in account every attachment in the project, including those of owners who never published.
- **Avatars follow the profile.** The avatar's file id *is* the user's id, so `storage_files.yaml` reaches the owner through the `avatarOwner` relationship and applies the same published-and-not-deleted test. Left unconditional, an avatar would stay readable after its owner unpublished, at a URL derivable from any user id that was ever public.
- **Pointing at a file is a write, not just a read.** `todos.file_id` decides which file the rule above exposes, so the insert *and* update checks in `public_todos.yaml` require the file to be one you uploaded. Without that, anyone could attach someone else's private file to their own shared item and publish it.
- **The page queries anonymously on purpose.** `/u/[id]` uses `createAnonymousClient()` from `frontend/src/lib/nhost/server.ts`, not the session client. Reading public data through the visitor's own session would have Hasura answer as `user`, whose row-level filter hides everyone else's rows, so the page would render empty for signed-in visitors and only for them.
- **A missing page and a private one are the same 404.** Neither the page nor the permission distinguishes them, so the URL cannot be used to discover whether an account exists.
- **Soft-deleted accounts drop out.** The `public` rule on `auth_users.yaml` also requires no `deletedAt`, so deleting an account takes its page down immediately even while published.

The columns left off the `public` lists are the ones that cannot leak: the account's email, `metadata` and `avatar_url`, and `todos.user_id`. `avatar_url` is left off because, for an account that never uploaded a photo, it holds the sign-up Gravatar URL, which embeds `md5(lowercase(email))`; the shared page serves the picture from `storage.files` instead, under the same published-and-not-deleted condition.

## Attachments, and the two ways to accept a file

The starter uploads files in both of the ways Nhost supports, and the difference is the point:

- **The avatar goes through a serverless function** holding the admin secret, because it has to be resized to 512×512 somewhere the browser cannot skip.
- **A todo photo goes straight from the browser** to the storage API with the signed-in user's own token, in `frontend/src/app/protected/TodoAttachment.tsx`. No function and no admin secret: the `storage.files` insert permission for the `user` role is what allows it, and it allows only the `todo-attachments` bucket.

The direct path is the ordinary one. Reach for a function when something has to happen that the client must not be trusted to do.

That insert permission also has to stop a signed-in client from choosing a file id that is not theirs to choose. The client picks the file's `id`, and the avatar feature keys one file per account by that id, so an id equal to someone else's user id would let this path plant a `todo-attachments` row that a later avatar upload replaces in place, keeping its existing bucket and owner. `storage_files.yaml` blocks that by rejecting any insert whose `id` already names an account, through the `avatarOwner` relationship. Check it after changing that rule:

```sh
curl -o /dev/null -w '%{http_code}\n' -X POST "$STORAGE_URL/files" \
  -H "Authorization: Bearer $USER_JWT" \
  -F 'bucket-id=todo-attachments' \
  -F "metadata[]={\"id\":\"<any other account's user id>\",\"name\":\"x.jpg\"}" \
  -F 'file[]=@x.jpg'
```

It must not be 200/201 for an id that belongs to an existing account.

Reads are governed the same way. `storage_files.yaml` makes a file readable by `public` when the item pointing at it is shared, which is a filter back through the `todos` relationship. An `<img>` tag sends no Authorization header, so storage always answers it as `public`: the photo on a shared item loads for everyone, and the same URL on a private one is a 404, with no presigned URL to expire. That rule is the one to be careful with, because widening it is how every private attachment becomes world-readable at once. Check it after changing it:

```sh
curl -o /dev/null -w '%{http_code}\n' "$STORAGE_URL/files/<id of a private item's photo>"
```

It must be 404 while the item is private and 200 once it is shared.

One thing deliberately left out: auto-fetching a map image for a place. It needs geocoding and a tile renderer, and the keyless options are either donated infrastructure that a template should not aim thousands of installs at, or hobby endpoints that would break every new project the day they go away. Everything else needs an API key, which would stop this starter working the moment you clone it. It is a good first feature to add once you have picked a provider.

## The profile page

Sign in and open `/profile` to see the rest of the stack in one place:

- **Avatar** — click it, or drop an image on it, and the photo goes to the `avatar` serverless function, which resizes it to 512×512 and stores it in the `avatars` storage bucket. Writes go only through the function. Reads follow the profile: strangers can load it once you publish, and your own view of it is fetched through a presigned URL so it works whether you have published or not.
- **Display name** — a GraphQL mutation on your own `auth.users` row, allowed by row-level permissions.
- **Email** — a change takes effect only after you confirm it from the new address; the pending state shows on the card.
- **Password** — three flows, driven by whether one is set. Set a password if you only ever used codes, change it with the current one, or mail yourself a reset link.
- **Delete account** — a soft delete with a 30-day grace period. It stamps `metadata.deletedAt` and signs you out everywhere; signing back in offers to restore the account.

Changing a password revokes every refresh token on the account, which is what should happen: it boots whoever else was signed in. The profile page signs you back in on the new password so it does not also boot you.

The template marks and restores accounts but never purges them. If you keep this flow in a real product, schedule the actual erasure after the grace period yourself; a deletion request is only fulfilled once the data really goes away.

## Emails, end to end

Password resets and email changes send a real email, and locally the mail viewer catches it. The link goes to the auth service, which verifies the ticket and redirects back with a refresh token in the query string. `frontend/src/proxy.ts` redeems that token into the session cookie and redirects to the same page without it, so the page behind the link opens signed in and the token never lingers in history or the referer header.

Redemption is deliberately narrow: only a ticket `type` the auth service actually emits, only on the paths this app's own emails target — `/profile` and `/reset-password`, listed as `LINK_REDEMPTION_PATHS` in `frontend/src/lib/nhost/server.ts` — and only when it would not replace a session already signed in as somebody else. All three matter. A proxy that redeemed any `?refreshToken=` on any page would let a crafted link sign a visitor into the attacker's account, and everything they wrote next would land there; narrowing the paths alone still leaves that open on the two paths that remain, which is why the last condition is there.

The parameters are stripped whenever they appear, not only when they were redeemed. A token the proxy declined was never spent, so it is still a live credential — leaving it in the address bar would park it in history and bookmarks for the month until it expires.

So before you add a page an auth email points at: aim the email at one of those paths, or add the new path to that list. The session is then already there and the page only has to do its job.

The reset flow leans on the same mechanism. Setting a password on an account that already has one normally requires the current password, which the server checks by reading `hasPassword` itself rather than trusting the form. Arriving through a reset link is the alternative, and the proxy records it as a short-lived `httpOnly` grant cookie when it redeems a `type=passwordReset` link. The cookie names the account the link signed in and is only honoured for that account, so a grant obtained for one account cannot be spent on another; it is cleared on sign-out and on every sign-in, and `/reset-password` offers a fresh link rather than a form once it has expired.

Be precise about what that grant proves: this browser redeemed a reset link **for this account**. It is not proof of mailbox control. The session cookie is readable by JS (see below), so anyone already holding a live refresh token can mint a grant for whatever account that token names, without any email. Treat that as the escalation it is: a stolen session cannot otherwise change the password, because `changePassword` demands proof it does not carry — the current password when the account has one, or (through the same `requireCurrentPasswordProof` helper `changeEmail` uses) a fresh code emailed to the account when it does not — so the grant path is what turns a stolen session into a permanent takeover — changing the password revokes every other refresh token and locks the real owner out. Closing that gap means moving to the auth service's PKCE flow, where the redeemed `code` is bound to the ticket itself.

Where the app is deployed is configuration, not something read off the request: `redirectTo` is built from `NEXT_PUBLIC_APP_ORIGIN` (see `appOrigin` in `frontend/src/lib/nhost/env.ts`, and `frontend/.env.example`). A `Host` header is set by whoever sent the request, so deriving the origin from it would let anyone point somebody else's reset link at a host they control. Set it before `next build`, and keep the same origin in the backend's `auth.redirections.allowedUrls`.

## Where things live

```text
backend/
  nhost/migrations/  database migrations
  nhost/metadata/    tracked tables, relationships, and permissions
  functions/         file-routed serverless functions (avatar.ts is the shipped example)
  nhost/nhost.toml   backend configuration
frontend/
  schema.graphql     committed codegen input and LLM backend context
  src/gql/           committed generated GraphQL types and documents
  src/app/           App Router pages
  src/components/    shared and shadcn/ui components
  src/lib/nhost/     Nhost client wiring for server components and the proxy
  src/proxy.ts       auth session refresh and protected-route guard
SKILLS.md            the same workflows in one file, for any agent
.claude/skills/      project-specific LLM workflows
```

## Useful frontend commands

Run these from `frontend/`:

- `pnpm dev` — start the development server.
- `pnpm codegen` — dump the current user-role schema and regenerate types.
- `pnpm codegen:types` — regenerate types from the committed schema without a backend.
- `pnpm lint` — check with Biome. `pnpm format` — apply Biome's safe fixes (formatting, import sorting); it still exits non-zero if unfixable lint errors remain.
- `pnpm test` — run the Vitest suites covering the proxy, session cookies, and storage helpers.
- `pnpm build` — create a production build.

## Session cookie security

The session cookie holds the refresh token (30 day maxAge) and is intentionally set with `httpOnly: false`. The browser SDK in `frontend/src/lib/nhost/client.ts` reads it through `document.cookie` to make client-side GraphQL requests, so this trades XSS refresh-token exposure for client-side data fetching.

If you want to keep the refresh token out of JavaScript, fetch and mutate only from server components and server actions, then set `httpOnly: true` in `frontend/src/lib/nhost/server.ts`. The same note lives next to the cookie options in that file.

## Optional MCP integration

The optional `.mcp.json` registers the Nhost MCP server for assistants that support it. It is not required: the committed schema, generated types, skills, and every step in the primary development loop work without MCP.

The entry sets `NHOST_MCP_CONFIG_FILE` to `backend/.nhost/mcp-nhost.toml`, resolved from the directory the client starts the server in, which is the project root. Do not rely on a `cwd` key instead: it is not part of the stdio server shape clients accept, so it is dropped silently.

Until that config file exists, the server runs on its built-in default, which grants the local admin secret, unrestricted queries and mutations, and metadata management. The admin secret bypasses row-level permissions, so the assistant can read and write every row of the local database and change metadata. Run `nhost mcp config` from `backend/` to write a scoped `mcp-nhost.toml`, and point this server at a local project only.
