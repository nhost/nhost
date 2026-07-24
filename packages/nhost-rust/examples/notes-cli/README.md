# notes-cli (Rust)

A note-taking CLI built on the [Nhost Rust SDK](../../), demonstrating **Auth**,
**GraphQL**, **Storage**, and **Functions** against the `notes` quickstart
backend.

## Run

Start the notes backend (`nhost up`) so it's reachable at `subdomain=local`,
`region=local`, then from this directory:

```sh
cargo run -- signup ada@example.com secret-password
cargo run -- login  ada@example.com secret-password
cargo run -- whoami

cargo run -- notebook new "Work"
cargo run -- note new --content "first!" "Hello"
cargo run -- note ls
cargo run -- note tag <noteId> urgent
cargo run -- note ls --tag urgent

cargo run -- attach <noteId> ./diagram.png
cargo run -- note show <noteId>
cargo run -- download <fileId> ./out.png

cargo run -- share --role editor <noteId> <userId>
cargo run -- export          # calls the notes/export function
```

The session is persisted to `~/.config/nhost-notes/session.json` (override with
`NHOST_NOTES_SESSION`); the SDK's client-side middleware attaches and refreshes
the access token automatically. Point at a different project with
`NHOST_SUBDOMAIN` / `NHOST_REGION`.

Run `cargo run -- help` for the full command list.
