# notes-cli (Python)

A note-taking CLI built on the
[Nhost Python SDK](../../../packages/nhost-python), demonstrating **Auth**,
**GraphQL**, **Storage**, and **Functions**.

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
[Local Setup](https://docs.nhost.io/getting-started/tutorials/python/1-introduction) →
[Authentication](https://docs.nhost.io/getting-started/tutorials/python/2-authentication) →
[Notes & GraphQL](https://docs.nhost.io/getting-started/tutorials/python/3-graphql-operations) →
[Attachments](https://docs.nhost.io/getting-started/tutorials/python/4-file-uploads) →
[Functions & Sharing](https://docs.nhost.io/getting-started/tutorials/python/5-functions-sharing).
Apply those pages in order, because the later schema and permissions depend on
the earlier tables and relationships.

## Run

With the backend running and reachable at `subdomain=local`, `region=local`, run
from this directory:

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
