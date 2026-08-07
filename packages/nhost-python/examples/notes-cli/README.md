# notes-cli (Python)

A note-taking CLI built on the [Nhost Python SDK](../../), demonstrating
**Auth**, **GraphQL**, **Storage**, and **Functions** against the `notes`
quickstart backend.

## Run

Install the SDK from the repo checkout, then start the notes backend
(`nhost up`) so it's reachable at `subdomain=local`, `region=local`:

```sh
uv pip install -r requirements.txt   # installs the local `nhost` package (editable)

python main.py signup ada@example.com secret-password
python main.py login  ada@example.com secret-password
python main.py whoami

python main.py notebook new "Work"
python main.py note new --content "first!" "Hello"
python main.py note ls
python main.py note tag <noteId> urgent
python main.py note ls --tag urgent

python main.py attach <noteId> ./diagram.png
python main.py note show <noteId>
python main.py download <fileId> ./out.png

python main.py share --role editor <noteId> <userId>
python main.py export          # calls the notes/export function
```

The session is persisted to `~/.config/nhost-notes/session.json` (override with
`NHOST_NOTES_SESSION`); the SDK's client-side middleware attaches and refreshes
the access token automatically. Point at a different project with
`NHOST_SUBDOMAIN` / `NHOST_REGION`.

Run `python main.py --help` for the full command list.
