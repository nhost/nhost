# notes-cli (Python)

A note-taking CLI built on the [Nhost Python SDK](../../), demonstrating
**Auth**, **GraphQL**, **Storage**, and **Functions**.

## Prepare the backend

This repository does not include a ready-made notes backend. Before running the
full CLI, follow these tutorial pages in order against the same Nhost project:

1. [Local Setup](../../../../docs/src/content/docs/getting-started/tutorials/python/1-introduction.mdx)
   — initialize a project and start its backend.
2. [Authentication](../../../../docs/src/content/docs/getting-started/tutorials/python/2-authentication.mdx)
   — configure email/password sign-up and add persisted sessions.
3. [Notes & GraphQL](../../../../docs/src/content/docs/getting-started/tutorials/python/3-graphql-operations.mdx)
   — create and track `notebooks`, `notes`, `tags`, and `note_tags`, then
   configure their relationships and owner-scoped permissions.
4. [Attachments](../../../../docs/src/content/docs/getting-started/tutorials/python/4-file-uploads.mdx)
   — create the `notes` Storage bucket and `note_attachments`, then configure
   Storage and table relationships and permissions.
5. [Functions & Sharing](../../../../docs/src/content/docs/getting-started/tutorials/python/5-functions-sharing.mdx)
   — create `note_collaborators`, update sharing permissions, and install the
   `notes/export` function.

Apply the pages in order because the later schema and permissions depend on the
earlier tables and relationships. The backend in
`packages/nhost-python/build/backend` is the SDK's movies/webhook integration-test
project, not a notes backend.

## Run

With the prepared backend running and reachable at `subdomain=local`,
`region=local`, run from this directory:

```sh
uv pip install -r requirements.txt   # installs the local `nhost` package (editable) + typer

python main.py signup ada@example.com  # prompts for a password without echoing it
python main.py login  ada@example.com  # prompts for a password without echoing it
python main.py whoami

python main.py notebook new "Work"
python main.py new --content "first!" "Hello"
python main.py ls
python main.py tag add <noteId> urgent
python main.py ls --tag urgent

python main.py attach <noteId> ./diagram.png
python main.py show <noteId>
python main.py download <fileId> ./out.png

python main.py share --role editor <noteId> <userId>
python main.py export          # calls the notes/export function
```

For scripts and CI, provide the secret through the `NOTES_PASSWORD` environment
variable instead of a command-line argument.

The session is persisted to `~/.config/nhost-notes/session.json` (override with
`NHOST_NOTES_SESSION`); the SDK's client-side middleware attaches and refreshes
the access token automatically. Point at a different project with
`NHOST_SUBDOMAIN` / `NHOST_REGION`.

Run `python main.py --help` for the full command list.
