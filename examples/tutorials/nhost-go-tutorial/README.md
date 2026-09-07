# notes-cli (Go)

A note-taking CLI built on the [Nhost Go SDK](../../../packages/nhost-go),
demonstrating **Auth**, **GraphQL**, **Storage**, and **Functions**. It
accompanies the
[Notes CLI with Nhost and Go tutorial](https://docs.nhost.io/getting-started/tutorials/go/1-introduction),
but it is a superset rather than a copy: it carries this repository's lint
scaffolding and commands the tutorial never introduces, and some flag surfaces
differ from the tutorial's smaller teaching program — `new TITLE --content`
here versus `new TITLE [CONTENT]` there, `tag add NOTE_ID TAG_NAME` versus a
flat `tag NOTE_ID TAG_NAME`, and `share --role` versus a positional `ROLE`. Run
the commands as `--help` prints them for whichever program you are using.

## Prepare the backend

The backend this CLI needs — schema, owner-scoped permissions, the `notes`
Storage bucket and the `notes/export` function — is committed next to it in
[`../backend-notes`](../backend-notes). Start it and you are ready:

```sh
cd ../backend-notes && ./env-up.sh   # or, from here: make backend-up
```

Only one local backend can run at a time, so stop any other one first. Email
verification is off in that project, so `signup` returns a usable session
immediately.

If you would rather build the backend yourself, the tutorial does exactly that,
one product at a time:
[Local Setup](https://docs.nhost.io/getting-started/tutorials/go/1-introduction) →
[Authentication](https://docs.nhost.io/getting-started/tutorials/go/2-authentication) →
[Notes & GraphQL](https://docs.nhost.io/getting-started/tutorials/go/3-graphql-operations) →
[Attachments](https://docs.nhost.io/getting-started/tutorials/go/4-file-uploads) →
[Functions & Sharing](https://docs.nhost.io/getting-started/tutorials/go/5-functions-sharing).
Apply those pages in order, because the later schema and permissions depend on
the earlier tables and relationships.

## Run

With the backend running and reachable at `subdomain=local`, `region=local`, run
from this directory:

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

Arg parsing uses [urfave/cli v3](https://github.com/urfave/cli); run
`go run . --help` (or `go run . <command> --help`) for the full, generated
command list.
