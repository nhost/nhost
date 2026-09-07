# backend-notes

The Nhost project the **notes CLI tutorials** are built against — the Go, Rust
and Python tracks under
[`/getting-started/tutorials`](https://docs.nhost.io/getting-started/tutorials).
It is the finished state of those five parts, so you can run the completed CLIs
without working through the tutorial first.

The sibling [`backend/`](../backend) serves the frontend tutorials (React, Vue,
Svelte, Next.js, React Native) and has a different schema. Only one local
backend can run at a time — the CLI binds fixed `local.*.local.nhost.run`
hostnames — so start whichever one matches the tutorial you are following.

## Run it

```sh
cd examples/tutorials/backend-notes
./env-up.sh          # copies .secrets.example to .secrets on first run, then `nhost up`
```

Then run any of the notes CLIs against it:

```sh
cd ../nhost-rust-tutorial && cargo run -- signup ada@example.com
```

Stop it with `nhost down --volumes`.

## What's in it

The SQL here is kept identical to the SQL printed in the tutorial pages, so
following the tutorial by hand and running this project produce the same
backend. If you change one, change the other.

| Migration | Tutorial part |
| --- | --- |
| `notes` | Part 3 — `notebooks`, `notes`, `tags`, `note_tags` and the `updated_at` trigger |
| `notes_bucket_and_attachments` | Part 4 — the `notes` storage bucket and `note_attachments` |
| `note_collaborators` | Part 5 — `note_collaborators` |

Permissions for the `user` role are owner-scoped: writes take `user_id` from the
session, and reads and writes are filtered to the caller's own rows. Two places
deliberately open up, matching Part 5:

- **notes → select** — the owner **or** any collaborator
- **notes → update** — the owner **or** a collaborator whose role is `editor`

Deleting a note stays owner-only. Tables without a `user_id` column
(`note_tags`, `note_attachments`, `note_collaborators`) inherit ownership
through their parent note.

`functions/notes/export.ts` renders the caller's notes to Markdown and uploads
the result to Storage, forwarding the caller's token so Hasura permissions and
Storage rules apply exactly as they do in the CLI.

## Why email verification is off

`nhost.toml` sets `emailVerificationRequired = false`. The CLIs sign up and use
the returned session immediately; with verification on, `signup` returns no
session and there is no way to continue without a mail client. The sibling
`backend/` keeps verification on, as a browser app should.
