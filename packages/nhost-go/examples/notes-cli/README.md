# notes-cli (Go)

A note-taking CLI built on the [Nhost Go SDK](../../), demonstrating **Auth**,
**GraphQL**, **Storage**, and **Functions**. This directory is the completed
source for the [Notes CLI with Nhost and Go tutorial](https://docs.nhost.io/getting-started/tutorials/go/1-introduction).

## Prepare the backend

This repository does not include a ready-made notes backend. Before running the
full CLI, follow these tutorial pages in order against the same Nhost project:

1. [Local Setup](https://docs.nhost.io/getting-started/tutorials/go/1-introduction) — initialize a
   project and start its backend with `nhost up`.
2. [Authentication](https://docs.nhost.io/getting-started/tutorials/go/2-authentication) — decide
   whether *"Require verified emails"* stays on. The `signup` and `login`
   commands below depend on this: with it on, `signup` lands in the
   verify-email state and locally the message is caught by Mailhog.
3. [Notes & GraphQL](https://docs.nhost.io/getting-started/tutorials/go/3-graphql-operations) — create
   and track `notebooks`, `notes`, `tags`, and `note_tags`, then configure their
   relationships and owner-scoped permissions.
4. [Attachments](https://docs.nhost.io/getting-started/tutorials/go/4-file-uploads) — create the
   `notes` Storage bucket and `note_attachments`, then configure Storage and
   table relationships and permissions.
5. [Functions & Sharing](https://docs.nhost.io/getting-started/tutorials/go/5-functions-sharing) —
   create `note_collaborators`, update sharing permissions, and install the
   `notes/export` function.

Apply the pages in order because the later schema and permissions depend on the
earlier tables and relationships. The backend in
`packages/nhost-go/build/backend` is the SDK's `movies` integration-test
project, not a notes backend.

## Run

With the prepared backend running and reachable at `subdomain=local`,
`region=local`, run from this directory:

```sh
go run . signup ada@example.com secret-password
go run . login  ada@example.com secret-password
go run . whoami

go run . notebook new "Work"
go run . new --content "first!" "Hello"
go run . ls
go run . tag add <noteId> urgent
go run . ls --tag urgent

go run . attach <noteId> ./diagram.png
go run . show <noteId>
go run . download <fileId> ./out.png

go run . share --role editor <noteId> <userId>
go run . export          # calls the notes/export function
```

The session is persisted to `~/.config/nhost-notes/session.json` (override with
`NHOST_NOTES_SESSION`); the SDK's client-side middleware attaches and refreshes
the access token automatically. Point at a different project with
`NHOST_SUBDOMAIN` / `NHOST_REGION`.

Arg parsing uses [cobra](https://github.com/spf13/cobra); run `go run . --help`
(or `go run . <command> --help`) for the full, generated command list.
