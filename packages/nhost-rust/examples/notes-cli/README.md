# notes-cli (Rust)

A note-taking CLI built on the [Nhost Rust SDK](../../), demonstrating **Auth**,
**GraphQL**, **Storage**, and **Functions**.

This is the finished reference implementation for the [Rust notes tutorial](../../../../docs/src/content/docs/getting-started/tutorials/rust/1-introduction.mdx).
The backend it uses is not committed with this example. Follow the tutorial to
create a project with `nhost init` and `nhost up`, then add the notes schema and
permissions, the `notes` storage bucket, and the `notes/export` function used by
this CLI.

## Run

With `nhost up` running in the project created through the tutorial, run these
commands from this directory. Sign-up and login prompt for a password without
echoing it; scripts and CI can supply it through the `NOTES_PASSWORD`
environment variable instead.

```sh
cargo run -- signup ada@example.com
cargo run -- login ada@example.com
cargo run -- whoami

cargo run -- notebook new "Work"
cargo run -- new --content "first!" "Hello"
cargo run -- ls
cargo run -- tag add <noteId> urgent
cargo run -- ls --tag urgent

cargo run -- attach <noteId> ./diagram.png
cargo run -- show <noteId>
cargo run -- download <fileId> ./out.png

cargo run -- share --role editor <noteId> <userId>
cargo run -- export          # calls the notes/export function
```

The session is persisted to `~/.config/nhost-notes/session.json` (override with
`NHOST_NOTES_SESSION`); the SDK's client-side middleware attaches and refreshes
the access token automatically. Point at a different project with
`NHOST_SUBDOMAIN` / `NHOST_REGION`.

Arg parsing uses [clap](https://docs.rs/clap); run `cargo run -- --help` (or
`cargo run -- <command> --help`) for the full, generated command list.
