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
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

from nhost import FetchError, FileStorage, NhostClientOptions, create_client
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


def make_client():
    return create_client(
        NhostClientOptions(
            subdomain=os.environ.get("NHOST_SUBDOMAIN", "local"),
            region=os.environ.get("NHOST_REGION", "local"),
            storage=FileStorage(session_path()),
        )
    )


async def gql(nhost, query: str, variables: dict | None = None) -> dict:
    """Run a GraphQL operation and return the ``data`` map."""
    resp = await nhost.graphql.request(query, variables=variables)
    return resp.body.data or {}


def tag_list(note: dict) -> str:
    tags = [nt["tag"]["name"] for nt in note.get("noteTags", [])]
    return "  " + " ".join(f"#{t}" for t in tags) if tags else ""


# --- auth -------------------------------------------------------------------


async def cmd_login(nhost, args) -> None:
    await nhost.auth.sign_in_email_password(
        SignInEmailPasswordRequest(email=args.email, password=args.password)
    )
    print("logged in as", args.email)


async def cmd_signup(nhost, args) -> None:
    await nhost.auth.sign_up_email_password(
        SignUpEmailPasswordRequest(email=args.email, password=args.password)
    )
    if nhost.get_user_session() is not None:
        print("signed up and logged in as", args.email)
    else:
        print("signed up; verify your email, then `login`")


async def cmd_logout(nhost, _args) -> None:
    session = nhost.get_user_session()
    if session is not None:
        try:
            await nhost.auth.sign_out(SignOutRequest(refresh_token=session.refresh_token))
        except FetchError:
            pass
    nhost.clear_session()
    print("logged out")


async def cmd_whoami(nhost, _args) -> None:
    session = nhost.get_user_session()
    if session is None or session.user is None:
        raise SystemExit("not logged in")
    print(f"{session.user.email} ({session.user.id})")


# --- notes ------------------------------------------------------------------


async def cmd_note_new(nhost, args) -> None:
    obj: dict = {"title": args.title, "content": args.content or ""}
    if args.notebook:
        obj["notebook_id"] = args.notebook
    data = await gql(
        nhost,
        """
        mutation NewNote($obj: notes_insert_input!) {
          insert_notes_one(object: $obj) { id }
        }""",
        {"obj": obj},
    )
    print("created", data["insert_notes_one"]["id"])


async def cmd_note_ls(nhost, args) -> None:
    where: dict = {"is_archived": {"_eq": bool(args.archived)}}
    if args.tag:
        where["noteTags"] = {"tag": {"name": {"_eq": args.tag}}}
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


async def cmd_note_show(nhost, args) -> None:
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
        {"id": args.id},
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


async def _update_note(nhost, note_id: str, set_: dict) -> None:
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


async def cmd_note_edit(nhost, args) -> None:
    set_: dict = {}
    if args.title is not None:
        set_["title"] = args.title
    if args.content is not None:
        set_["content"] = args.content
    if not set_:
        raise SystemExit("nothing to update (pass --title and/or --content)")
    await _update_note(nhost, args.id, set_)


async def cmd_note_pin(nhost, args) -> None:
    await _update_note(nhost, args.id, {"is_pinned": args.pinned})


async def cmd_note_archive(nhost, args) -> None:
    await _update_note(nhost, args.id, {"is_archived": True})


async def cmd_note_mv(nhost, args) -> None:
    await _update_note(nhost, args.id, {"notebook_id": args.notebook})


async def cmd_note_rm(nhost, args) -> None:
    data = await gql(
        nhost,
        "mutation Del($id: uuid!) { delete_notes_by_pk(id: $id) { id } }",
        {"id": args.id},
    )
    if not data.get("delete_notes_by_pk"):
        raise SystemExit("note not found or not permitted")
    print("deleted", args.id)


async def cmd_note_tag(nhost, args) -> None:
    tag_id = await upsert_tag(nhost, args.tag, None)
    await gql(
        nhost,
        """
        mutation TagNote($noteId: uuid!, $tagId: uuid!) {
          insert_note_tags_one(
            object: {note_id: $noteId, tag_id: $tagId}
            on_conflict: {constraint: note_tags_pkey, update_columns: []}
          ) { note_id }
        }""",
        {"noteId": args.id, "tagId": tag_id},
    )
    print(f"tagged {args.id} with #{args.tag}")


async def cmd_note_untag(nhost, args) -> None:
    await gql(
        nhost,
        """
        mutation Untag($noteId: uuid!, $name: String!) {
          delete_note_tags(where: {note_id: {_eq: $noteId}, tag: {name: {_eq: $name}}}) {
            affected_rows
          }
        }""",
        {"noteId": args.id, "name": args.tag},
    )
    print(f"removed #{args.tag} from {args.id}")


# --- notebooks & tags -------------------------------------------------------


async def cmd_notebook_new(nhost, args) -> None:
    data = await gql(
        nhost,
        """
        mutation NewNotebook($name: String!) {
          insert_notebooks_one(object: {name: $name}) { id }
        }""",
        {"name": args.name},
    )
    print("created", data["insert_notebooks_one"]["id"])


async def cmd_notebook_ls(nhost, _args) -> None:
    data = await gql(nhost, "query { notebooks(order_by: {name: asc}) { id name } }")
    for nb in data.get("notebooks", []):
        print(f"{nb['id']}  {nb['name']}")


async def upsert_tag(nhost, name: str, color: str | None) -> str:
    obj: dict = {"name": name}
    update: list[str] = []
    if color:
        obj["color"] = color
        update = ["color"]
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
    return data["insert_tags_one"]["id"]


async def cmd_tag_new(nhost, args) -> None:
    print("created", await upsert_tag(nhost, args.name, args.color))


async def cmd_tag_ls(nhost, _args) -> None:
    data = await gql(nhost, "query { tags(order_by: {name: asc}) { id name color } }")
    for t in data.get("tags", []):
        print(f"{t['id']}  {t['name']:<16} {t['color']}")


# --- storage / sharing / functions -----------------------------------------


async def cmd_attach(nhost, args) -> None:
    raw = Path(args.file).read_bytes()
    name = Path(args.file).name
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
        {"noteId": args.id, "fileId": file_id},
    )
    print(f"attached {name} (file {file_id}) to {args.id}")


async def cmd_download(nhost, args) -> None:
    resp = await nhost.storage.get_file(args.file_id)
    Path(args.out).write_bytes(resp.body)
    print(f"wrote {len(resp.body)} bytes to {args.out}")


async def cmd_share(nhost, args) -> None:
    await gql(
        nhost,
        """
        mutation Share($noteId: uuid!, $userId: uuid!, $role: String!) {
          insert_note_collaborators_one(
            object: {note_id: $noteId, user_id: $userId, role: $role}
            on_conflict: {constraint: note_collaborators_pkey, update_columns: [role]}
          ) { note_id role }
        }""",
        {"noteId": args.id, "userId": args.user_id, "role": args.role},
    )
    print(f"shared {args.id} with {args.user_id} as {args.role}")


async def cmd_unshare(nhost, args) -> None:
    await gql(
        nhost,
        """
        mutation Unshare($noteId: uuid!, $userId: uuid!) {
          delete_note_collaborators_by_pk(note_id: $noteId, user_id: $userId) { note_id }
        }""",
        {"noteId": args.id, "userId": args.user_id},
    )
    print(f"unshared {args.id} from {args.user_id}")


async def cmd_export(nhost, _args) -> None:
    resp = await nhost.functions.post("/notes/export", {})
    print(json.dumps(resp.body, indent=2))


# --- CLI wiring -------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="notes-cli", description="Nhost Python SDK demo")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add(name, fn, setup=None):
        sp = sub.add_parser(name)
        sp.set_defaults(func=fn)
        if setup:
            setup(sp)
        return sp

    for name in ("login", "signup"):
        add(
            name,
            cmd_login if name == "login" else cmd_signup,
            lambda sp: (sp.add_argument("email"), sp.add_argument("password")),
        )
    add("logout", cmd_logout)
    add("whoami", cmd_whoami)

    note = sub.add_parser("note")
    nsub = note.add_subparsers(dest="note_cmd", required=True)

    def nadd(name, fn, setup=None):
        sp = nsub.add_parser(name)
        sp.set_defaults(func=fn)
        if setup:
            setup(sp)

    def new_setup(sp):
        sp.add_argument("title")
        sp.add_argument("--content")
        sp.add_argument("--notebook")

    nadd("new", cmd_note_new, new_setup)
    nadd(
        "ls",
        cmd_note_ls,
        lambda sp: (sp.add_argument("--archived", action="store_true"), sp.add_argument("--tag")),
    )
    nadd("show", cmd_note_show, lambda sp: sp.add_argument("id"))
    nadd(
        "edit",
        cmd_note_edit,
        lambda sp: (sp.add_argument("id"), sp.add_argument("--title"), sp.add_argument("--content")),
    )
    nadd("pin", cmd_note_pin, lambda sp: (sp.add_argument("id"), sp.set_defaults(pinned=True)))
    nadd("unpin", cmd_note_pin, lambda sp: (sp.add_argument("id"), sp.set_defaults(pinned=False)))
    nadd("archive", cmd_note_archive, lambda sp: sp.add_argument("id"))
    nadd("rm", cmd_note_rm, lambda sp: sp.add_argument("id"))
    nadd("mv", cmd_note_mv, lambda sp: (sp.add_argument("id"), sp.add_argument("notebook")))
    nadd("tag", cmd_note_tag, lambda sp: (sp.add_argument("id"), sp.add_argument("tag")))
    nadd("untag", cmd_note_untag, lambda sp: (sp.add_argument("id"), sp.add_argument("tag")))

    notebook = sub.add_parser("notebook")
    bsub = notebook.add_subparsers(dest="notebook_cmd", required=True)
    bnew = bsub.add_parser("new")
    bnew.set_defaults(func=cmd_notebook_new)
    bnew.add_argument("name")
    bls = bsub.add_parser("ls")
    bls.set_defaults(func=cmd_notebook_ls)

    tag = sub.add_parser("tag")
    tsub = tag.add_subparsers(dest="tag_cmd", required=True)
    tnew = tsub.add_parser("new")
    tnew.set_defaults(func=cmd_tag_new)
    tnew.add_argument("name")
    tnew.add_argument("--color", default="#808080")
    tls = tsub.add_parser("ls")
    tls.set_defaults(func=cmd_tag_ls)

    add(
        "attach",
        cmd_attach,
        lambda sp: (sp.add_argument("id"), sp.add_argument("file")),
    )
    add(
        "download",
        cmd_download,
        lambda sp: (sp.add_argument("file_id"), sp.add_argument("out")),
    )
    add(
        "share",
        cmd_share,
        lambda sp: (
            sp.add_argument("id"),
            sp.add_argument("user_id"),
            sp.add_argument("--role", default="viewer", choices=["viewer", "editor"]),
        ),
    )
    add(
        "unshare",
        cmd_unshare,
        lambda sp: (sp.add_argument("id"), sp.add_argument("user_id")),
    )
    add("export", cmd_export)
    return p


async def main_async(args) -> None:
    async with make_client() as nhost:
        try:
            await args.func(nhost, args)
        except FetchError as e:
            raise SystemExit(f"error: {e}")


def main() -> None:
    args = build_parser().parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    sys.exit(main())
