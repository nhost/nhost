"""notes-cli — a note-taking CLI built on the Nhost Python SDK.

Demonstrates the SDK end to end against the "notes" quickstart backend:

    Auth      — login/logout/whoami, session persisted to a JSON file
                (session middleware attaches + refreshes the token automatically)
    GraphQL   — notes, notebooks and tags CRUD (permissions enforced by Hasura)
    Storage   — attach/download files in the "notes" bucket
    Functions — `export` calls the notes/export serverless function

Configuration (env, all optional):

    NHOST_SUBDOMAIN       default "local"
    NHOST_REGION          default "local"
    NHOST_NOTES_SESSION   session file path (default under ~/.config)
    NOTES_PASSWORD        non-interactive login/sign-up password
"""

from __future__ import annotations

import asyncio
import getpass
import json
import os
from collections.abc import Awaitable, Callable
from contextlib import suppress
from enum import StrEnum
from pathlib import Path
from typing import Annotated, Any

import typer

from nhost import FetchError, FileStorage, NhostClient, NhostClientOptions, create_client
from nhost.auth import (
    SignInEmailPasswordRequest,
    SignOutRequest,
    SignUpEmailPasswordRequest,
)
from nhost.storage import UploadFileMetadata, UploadFilesBody

BUCKET = "notes"


def session_path() -> Path:
    override = os.environ.get("NHOST_NOTES_SESSION")
    if override:
        return Path(override)
    base = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config"))
    return base / "nhost-notes" / "session.json"


def make_client() -> NhostClient:
    return create_client(
        NhostClientOptions(
            subdomain=os.environ.get("NHOST_SUBDOMAIN", "local"),
            region=os.environ.get("NHOST_REGION", "local"),
            storage=FileStorage(session_path()),
        )
    )


async def gql(
    nhost: NhostClient,
    query: str,
    variables: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run a GraphQL operation and return the ``data`` map."""
    resp = await nhost.graphql.request(query, variables=variables)
    return resp.body.data or {}


def tag_list(note: dict[str, Any]) -> str:
    tags = [nt["tag"]["name"] for nt in note.get("noteTags", [])]
    return "  " + " ".join(f"#{t}" for t in tags) if tags else ""


# --- auth -------------------------------------------------------------------


async def cmd_login(nhost: NhostClient, email: str, password: str) -> None:
    await nhost.auth.sign_in_email_password(
        SignInEmailPasswordRequest(email=email, password=password)
    )
    print("logged in as", email)


async def cmd_signup(nhost: NhostClient, email: str, password: str) -> None:
    await nhost.auth.sign_up_email_password(
        SignUpEmailPasswordRequest(email=email, password=password)
    )
    if nhost.get_user_session() is not None:
        print("signed up and logged in as", email)
    else:
        print("signed up; verify your email, then `login`")


async def cmd_logout(nhost: NhostClient) -> None:
    session = nhost.get_user_session()
    if session is not None:
        with suppress(FetchError):
            await nhost.auth.sign_out(SignOutRequest(refresh_token=session.refresh_token))
    nhost.clear_session()
    print("logged out")


async def cmd_whoami(nhost: NhostClient) -> None:
    session = nhost.get_user_session()
    if session is None or session.user is None:
        raise SystemExit("not logged in")
    print(f"{session.user.email} ({session.user.id})")


# --- notes ------------------------------------------------------------------


async def cmd_note_new(
    nhost: NhostClient,
    title: str,
    content: str | None,
    notebook: str | None,
) -> None:
    obj: dict[str, Any] = {"title": title, "content": content or ""}
    if notebook:
        obj["notebook_id"] = notebook
    data = await gql(
        nhost,
        """
        mutation NewNote($obj: notes_insert_input!) {
          insert_notes_one(object: $obj) { id }
        }""",
        {"obj": obj},
    )
    print("created", data["insert_notes_one"]["id"])


async def cmd_note_ls(nhost: NhostClient, archived: bool, tag: str | None) -> None:
    where: dict[str, Any] = {"is_archived": {"_eq": bool(archived)}}
    if tag:
        where["noteTags"] = {"tag": {"name": {"_eq": tag}}}
    data = await gql(
        nhost,
        """
        query Notes($where: notes_bool_exp!) {
          notes(where: $where, order_by: [{is_pinned: desc}, {updated_at: desc}]) {
            id title is_pinned notebook { name } noteTags { tag { name } }
          }
        }""",
        {"where": where},
    )
    notes = data.get("notes", [])
    if not notes:
        print("(no notes)")
        return
    for n in notes:
        pin = "*" if n["is_pinned"] else " "
        nb = f"  [{n['notebook']['name']}]" if n.get("notebook") else ""
        print(f"{pin} {n['id']}  {n['title']}{nb}{tag_list(n)}")


async def cmd_note_show(nhost: NhostClient, note_id: str) -> None:
    data = await gql(
        nhost,
        """
        query Note($id: uuid!) {
          notes_by_pk(id: $id) {
            id title content is_pinned is_archived
            notebook { name }
            noteTags { tag { name color } }
            attachments { file { id name mimeType size } }
            collaborators { user_id role }
          }
        }""",
        {"id": note_id},
    )
    n = data.get("notes_by_pk")
    if not n:
        raise SystemExit("note not found")
    print(f"# {n['title']}\n\n{n['content']}")
    print(f"\npinned={n['is_pinned']} archived={n['is_archived']}{tag_list(n)}")
    if n["attachments"]:
        print("attachments:")
        for a in n["attachments"]:
            f = a["file"]
            print(f"  {f['id']}  {f['name']} ({f['mimeType']})")
    if n["collaborators"]:
        print("shared with:")
        for c in n["collaborators"]:
            print(f"  {c['user_id']} ({c['role']})")


async def _update_note(
    nhost: NhostClient,
    note_id: str,
    set_: dict[str, Any],
) -> None:
    data = await gql(
        nhost,
        """
        mutation UpdateNote($id: uuid!, $set: notes_set_input!) {
          update_notes_by_pk(pk_columns: {id: $id}, _set: $set) { id }
        }""",
        {"id": note_id, "set": set_},
    )
    if not data.get("update_notes_by_pk"):
        raise SystemExit("note not found or not permitted")
    print("updated", note_id)


async def cmd_note_edit(
    nhost: NhostClient,
    note_id: str,
    title: str | None,
    content: str | None,
) -> None:
    set_: dict[str, Any] = {}
    if title is not None:
        set_["title"] = title
    if content is not None:
        set_["content"] = content
    if not set_:
        raise SystemExit("nothing to update (pass --title and/or --content)")
    await _update_note(nhost, note_id, set_)


async def cmd_note_rm(nhost: NhostClient, note_id: str) -> None:
    data = await gql(
        nhost,
        "mutation Del($id: uuid!) { delete_notes_by_pk(id: $id) { id } }",
        {"id": note_id},
    )
    if not data.get("delete_notes_by_pk"):
        raise SystemExit("note not found or not permitted")
    print("deleted", note_id)


async def cmd_note_tag(nhost: NhostClient, note_id: str, tag_name: str) -> None:
    tag_id = await upsert_tag(nhost, tag_name, None)
    await gql(
        nhost,
        """
        mutation TagNote($noteId: uuid!, $tagId: uuid!) {
          insert_note_tags_one(
            object: {note_id: $noteId, tag_id: $tagId}
            on_conflict: {constraint: note_tags_pkey, update_columns: []}
          ) { note_id }
        }""",
        {"noteId": note_id, "tagId": tag_id},
    )
    print(f"tagged {note_id} with #{tag_name}")


async def cmd_note_untag(nhost: NhostClient, note_id: str, tag_name: str) -> None:
    await gql(
        nhost,
        """
        mutation Untag($noteId: uuid!, $name: String!) {
          delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
            affected_rows
          }
        }""",
        {"noteId": note_id, "name": tag_name},
    )
    print(f"removed #{tag_name} from {note_id}")


# --- notebooks & tags -------------------------------------------------------


async def cmd_notebook_new(nhost: NhostClient, name: str) -> None:
    data = await gql(
        nhost,
        """
        mutation NewNotebook($name: String!) {
          insert_notebooks_one(object: {name: $name}) { id }
        }""",
        {"name": name},
    )
    print("created", data["insert_notebooks_one"]["id"])


async def cmd_notebook_ls(nhost: NhostClient) -> None:
    data = await gql(nhost, "query { notebooks(order_by: {name: asc}) { id name } }")
    for nb in data.get("notebooks", []):
        print(f"{nb['id']}  {nb['name']}")


async def upsert_tag(nhost: NhostClient, name: str, color: str | None) -> str:
    obj: dict[str, Any] = {"name": name}
    # Always update `name` on conflict so the upsert returns the existing row's
    # id (an empty update_columns makes Hasura DO NOTHING and return null).
    update: list[str] = ["name"]
    if color:
        obj["color"] = color
        update.append("color")
    data = await gql(
        nhost,
        """
        mutation UpsertTag($obj: tags_insert_input!, $update: [tags_update_column!]!) {
          insert_tags_one(
            object: $obj
            on_conflict: {constraint: tags_user_id_name_key, update_columns: $update}
          ) { id }
        }""",
        {"obj": obj, "update": update},
    )
    return str(data["insert_tags_one"]["id"])


async def cmd_tag_new(nhost: NhostClient, name: str, color: str) -> None:
    print("created", await upsert_tag(nhost, name, color))


async def cmd_tag_ls(nhost: NhostClient) -> None:
    data = await gql(nhost, "query { tags(order_by: {name: asc}) { id name color } }")
    for t in data.get("tags", []):
        print(f"{t['id']}  {t['name']:<16} {t['color']}")


# --- storage / sharing / functions -----------------------------------------


async def cmd_attach(nhost: NhostClient, note_id: str, file: str) -> None:
    raw = Path(file).read_bytes()
    name = Path(file).name
    up = await nhost.storage.upload_files(
        UploadFilesBody(
            bucket_id=BUCKET,
            file=[raw],
            metadata=[UploadFileMetadata(name=name)],
        )
    )
    if not up.body.processed_files:
        raise SystemExit("upload failed")
    file_id = up.body.processed_files[0].id
    await gql(
        nhost,
        """
        mutation Attach($noteId: uuid!, $fileId: uuid!) {
          insert_note_attachments_one(object: {note_id: $noteId, file_id: $fileId}) { file_id }
        }""",
        {"noteId": note_id, "fileId": file_id},
    )
    print(f"attached {name} (file {file_id}) to {note_id}")


async def cmd_download(nhost: NhostClient, file_id: str, out_path: str) -> None:
    resp = await nhost.storage.get_file(file_id)
    Path(out_path).write_bytes(resp.body)
    print(f"wrote {len(resp.body)} bytes to {out_path}")


async def cmd_share(
    nhost: NhostClient,
    note_id: str,
    user_id: str,
    role: str,
) -> None:
    await gql(
        nhost,
        """
        mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
          insert_note_collaborators_one(
            object: {note_id: $noteId, user_id: $userId, role: $role}
            on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
          ) { note_id role }
        }""",
        {"noteId": note_id, "userId": user_id, "role": role},
    )
    print(f"shared {note_id} with {user_id} as {role}")


async def cmd_unshare(nhost: NhostClient, note_id: str, user_id: str) -> None:
    await gql(
        nhost,
        """
        mutation Unshare($noteId: uuid!, $userId: uuid!) {
          delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
        }""",
        {"noteId": note_id, "userId": user_id},
    )
    print(f"unshared {note_id} from {user_id}")


async def cmd_export(nhost: NhostClient) -> None:
    resp = await nhost.functions.post("/notes/export", {})
    print(json.dumps(resp.body, indent=2))


# --- CLI wiring -------------------------------------------------------------

app = typer.Typer(
    name="notes-cli",
    help="Nhost Python SDK demo",
    add_completion=False,
    no_args_is_help=True,
)


class Role(StrEnum):
    viewer = "viewer"
    editor = "editor"


def _read_password() -> str:
    password = os.environ.get("NOTES_PASSWORD")
    if password:
        return password
    return getpass.getpass("Password: ")


def run(coro: Callable[[NhostClient], Awaitable[None]]) -> None:
    """Open a client, run one async command, and map SDK errors to exit codes."""

    async def runner() -> None:
        async with make_client() as nhost:
            try:
                await coro(nhost)
            except FetchError as exc:
                raise SystemExit(f"error: {exc}") from exc

    asyncio.run(runner())


# --- auth


@app.command("signup")
def signup(email: str) -> None:
    """Create an account (and sign in if email verification is off)."""
    password = _read_password()
    run(lambda nhost: cmd_signup(nhost, email, password))


@app.command("login")
def login(email: str) -> None:
    """Sign in with email and a securely supplied password."""
    password = _read_password()
    run(lambda nhost: cmd_login(nhost, email, password))


@app.command("logout")
def logout() -> None:
    """Sign out and clear the saved session."""
    run(cmd_logout)


@app.command("whoami")
def whoami() -> None:
    """Show the currently signed-in user."""
    run(cmd_whoami)


# --- notes


@app.command("new")
def note_new(
    title: str,
    content: str | None = typer.Option(None),
    notebook: str | None = typer.Option(None),
) -> None:
    """Create a note."""
    run(lambda nhost: cmd_note_new(nhost, title, content, notebook))


@app.command("ls")
def note_ls(
    archived: bool = typer.Option(False),
    tag: str | None = typer.Option(None),
) -> None:
    """List your notes."""
    run(lambda nhost: cmd_note_ls(nhost, archived, tag))


@app.command("show")
def note_show(id: str) -> None:
    """Show a single note in full."""
    run(lambda nhost: cmd_note_show(nhost, id))


@app.command("edit")
def note_edit(
    id: str,
    title: str | None = typer.Option(None),
    content: str | None = typer.Option(None),
) -> None:
    """Edit a note's title and/or content."""
    run(lambda nhost: cmd_note_edit(nhost, id, title, content))


@app.command("pin")
def note_pin(id: str) -> None:
    """Pin a note."""
    run(lambda nhost: _update_note(nhost, id, {"is_pinned": True}))


@app.command("unpin")
def note_unpin(id: str) -> None:
    """Unpin a note."""
    run(lambda nhost: _update_note(nhost, id, {"is_pinned": False}))


@app.command("archive")
def note_archive(id: str) -> None:
    """Archive a note."""
    run(lambda nhost: _update_note(nhost, id, {"is_archived": True}))


@app.command("rm")
def note_rm(id: str) -> None:
    """Delete a note."""
    run(lambda nhost: cmd_note_rm(nhost, id))


@app.command("mv")
def note_mv(id: str, notebook_id: str) -> None:
    """Move a note into a notebook."""
    run(lambda nhost: _update_note(nhost, id, {"notebook_id": notebook_id}))


# --- notebooks & tags
#
# The `notebook` and `tag` *entities* are grouped under their own sub-apps
# (registered with `app.add_typer(...)`), so their verbs nest as
# `notebook ls`, `tag new`, ... while the note verbs above stay flat.

notebook_app = typer.Typer(
    help="Manage notebooks",
    add_completion=False,
    no_args_is_help=True,
)

tag_app = typer.Typer(
    help="Manage tags (and tag/untag notes)",
    add_completion=False,
    no_args_is_help=True,
)


@notebook_app.command("new")
def notebook_new(name: str) -> None:
    """Create a notebook."""
    run(lambda nhost: cmd_notebook_new(nhost, name))


@notebook_app.command("ls")
def notebook_ls() -> None:
    """List your notebooks."""
    run(cmd_notebook_ls)


@tag_app.command("ls")
def tag_ls() -> None:
    """List your tags."""
    run(cmd_tag_ls)


@tag_app.command("new")
def tag_new(name: str, color: str = typer.Option("#808080")) -> None:
    """Create a tag."""
    run(lambda nhost: cmd_tag_new(nhost, name, color))


@tag_app.command("add")
def tag_add(note_id: str, tag_name: str) -> None:
    """Add a tag to a note (creates the tag if needed)."""
    run(lambda nhost: cmd_note_tag(nhost, note_id, tag_name))


@tag_app.command("rm")
def tag_rm(note_id: str, tag_name: str) -> None:
    """Remove a tag from a note."""
    run(lambda nhost: cmd_note_untag(nhost, note_id, tag_name))


app.add_typer(notebook_app, name="notebook")
app.add_typer(tag_app, name="tag")


# --- storage / sharing / functions


@app.command("attach")
def attach(note_id: str, file: str) -> None:
    """Upload a file and attach it to a note."""
    run(lambda nhost: cmd_attach(nhost, note_id, file))


@app.command("download")
def download(file_id: str, out_path: str) -> None:
    """Download a file by id."""
    run(lambda nhost: cmd_download(nhost, file_id, out_path))


@app.command("share")
def share(
    note_id: str,
    user_id: str,
    role: Annotated[Role, typer.Option()] = Role.viewer,
) -> None:
    """Share a note with another user."""
    run(lambda nhost: cmd_share(nhost, note_id, user_id, role.value))


@app.command("unshare")
def unshare(note_id: str, user_id: str) -> None:
    """Remove a collaborator from a note."""
    run(lambda nhost: cmd_unshare(nhost, note_id, user_id))


@app.command("export")
def export() -> None:
    """Export your notes via a serverless function."""
    run(cmd_export)


def main() -> None:
    app()


if __name__ == "__main__":
    main()
