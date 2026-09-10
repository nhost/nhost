# notes-cli (Rust)

A note-taking CLI built on the [Nhost Rust SDK](../../../packages/nhost-rust),
demonstrating **Auth**, **GraphQL**, **Storage**, and **Functions**.

This is the finished reference implementation for the
[Rust notes tutorial](https://docs.nhost.io/getting-started/tutorials/rust/1-introduction).
You do not have to work through the tutorial first — the backend it needs is
committed alongside it in [`../backend-notes`](../backend-notes).

## Run

Start the backend, then run the CLI from this directory:

```sh
cd ../backend-notes && ./env-up.sh   # or: make backend-up
```

Only one local backend can run at a time, so stop any other one first.

Sign-up and login prompt for a password without echoing it; scripts and CI can
supply it through the `NOTES_PASSWORD` environment variable instead.

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
