# notes-cli (Go)

A note-taking CLI built on the [Nhost Go SDK](../../), demonstrating **Auth**,
**GraphQL**, **Storage**, and **Functions** against the `notes` quickstart
backend.

## Run

Start the notes backend (`nhost up`) so it's reachable at `subdomain=local`,
`region=local`, then from this directory:

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
