"""Synchronize a pinned CI bundle using the receiving repository's mappings."""

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

REPOSITORY = "nhost/nhost"
MANIFEST = "build/shared-ci.json"


class SyncError(Exception):
    """An invalid input or unsafe destination; no preflight changes are applied."""


def relative_path(value):
    if (
        not isinstance(value, str)
        or not value
        or "\\" in value
        or any(ord(character) < 32 or ord(character) == 127 for character in value)
    ):
        raise SyncError(f"invalid relative path: {value!r}")
    path = PurePosixPath(value)
    if (
        path.is_absolute()
        or str(path) != value
        or any(part.casefold() in ("..", ".git") for part in path.parts)
        or not path.parts
    ):
        raise SyncError(f"unsafe relative path: {value!r}")
    return path


def safe_file(root, name):
    path = root
    parts = relative_path(name).parts
    for index, part in enumerate(parts):
        path = path / part
        if path.is_symlink():
            raise SyncError(f"refusing symlink: {path}")
        if path.exists():
            valid = path.is_file() if index == len(parts) - 1 else path.is_dir()
            if not valid:
                raise SyncError(f"unexpected file type: {path}")
    return path


def decode_object(data, path):
    try:
        value = json.loads(data)
    except ValueError as error:
        raise SyncError(f"invalid JSON in {path}: {error}") from error
    if not isinstance(value, dict):
        raise SyncError(f"expected a JSON object: {path}")
    return value


def read_object(path):
    return decode_object(path.read_bytes(), path)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def valid_digest(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


@dataclass(frozen=True)
class Content:
    data: bytes
    executable: bool


def content(path):
    if not path.exists():
        return None
    return Content(path.read_bytes(), bool(path.stat().st_mode & 0o111))


@dataclass(frozen=True)
class Change:
    name: str
    before: Content | None
    after: Content


def plan(bundle, target):
    catalog = read_object(safe_file(bundle, "bundle.json"))
    if catalog.get("repository") != REPOSITORY:
        raise SyncError("bundle repository must be nhost/nhost")
    revision = catalog.get("revision")
    if revision is not None and (
        not isinstance(revision, str) or re.fullmatch(r"[0-9a-f]{40}", revision) is None
    ):
        raise SyncError("bundle revision must be a full Git commit or null")
    exports = catalog.get("files")
    if not isinstance(exports, dict) or not exports:
        raise SyncError("bundle must export files")

    manifest_path = safe_file(target, MANIFEST)
    before_manifest = content(manifest_path)
    if before_manifest is None:
        raise SyncError(
            f"create {MANIFEST} with the desired source/path mappings first"
        )
    manifest = decode_object(before_manifest.data, manifest_path)
    if manifest.get("repository") != REPOSITORY:
        raise SyncError("receiving manifest repository must be nhost/nhost")
    entries = manifest.get("files")
    if not isinstance(entries, list) or not entries:
        raise SyncError("receiving manifest must contain file mappings")

    # Validate every destination before reading or writing any mapped files.
    names = {MANIFEST.casefold()}
    for entry in entries:
        if not isinstance(entry, dict):
            raise SyncError("file mapping must be an object")
        name = str(relative_path(entry.get("path")))
        source = str(relative_path(entry.get("source")))
        if name.casefold() in names:
            raise SyncError(f"duplicate or reserved destination: {name}")
        names.add(name.casefold())
        if source not in exports or not valid_digest(exports[source]):
            raise SyncError(f"source is not exported by this bundle: {source}")
        if "sha256" in entry and not valid_digest(entry["sha256"]):
            raise SyncError(f"invalid recorded hash: {name}")
        if "executable" in entry and not isinstance(entry["executable"], bool):
            raise SyncError(f"invalid recorded executable flag: {name}")
    for name in names:
        if any(str(parent) in names for parent in PurePosixPath(name).parents):
            raise SyncError(f"overlapping destinations: {name}")

    changes = []
    updated_entries = []
    for entry in entries:
        name = entry["path"]
        source = entry["source"]
        # Keep the files/ prefix inside safe_file so it cannot be a symlink either.
        desired = content(safe_file(bundle, "files/" + source))
        if desired is None or digest(desired.data) != exports[source]:
            raise SyncError(f"bundle content does not match its hash: {source}")
        current = content(safe_file(target, name))
        if current is not None and current != desired:
            if digest(current.data) != entry.get("sha256") or (
                "executable" in entry and current.executable != entry["executable"]
            ):
                raise SyncError(f"refusing locally modified or unrecorded file: {name}")
        if current != desired:
            changes.append(Change(name, current, desired))
        updated_entries.append(
            {**entry, "sha256": exports[source], "executable": desired.executable}
        )

    updated = {
        **manifest,
        "revision": revision,
        "status": "pinned verbatim copies",
        "files": updated_entries,
    }
    if updated != manifest:
        changes.append(
            Change(
                MANIFEST,
                before_manifest,
                Content(
                    (json.dumps(updated, indent=2) + "\n").encode(),
                    before_manifest.executable,
                ),
            )
        )
    return revision, changes


def atomic_write(path, desired):
    path.parent.mkdir(parents=True, exist_ok=True)
    # Preserve receiver read/write permissions, especially on private manifests.
    permissions = path.stat().st_mode & 0o666 if path.exists() else 0o644
    permissions |= 0o111 if desired.executable else 0
    fd, temporary = tempfile.mkstemp(prefix=".sync-ci-", dir=path.parent)
    try:
        with os.fdopen(fd, "wb") as output:
            output.write(desired.data)
            output.flush()
            os.fchmod(output.fileno(), permissions)
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)


def synchronize(bundle, target, *, check=False, dry_run=False):
    revision, changes = plan(bundle, target)
    print(f"Source: {REPOSITORY}@{revision or 'unpublished'}")
    if revision is None and not dry_run:
        raise SyncError(
            "source has no clean Git revision; use a pinned github: or clean git+file: "
            "flake (path: and dirty sources permit --dry-run only)"
        )
    for change in changes:
        print(f"{'create' if change.before is None else 'update'} {change.name}")
    if dry_run:
        if revision is None:
            print("Preview only: publish a clean Git revision before applying.")
        return 0
    if check:
        return 1 if changes else 0

    # Check again before the first write. Do not concurrently edit managed files.
    for change in changes:
        if content(safe_file(target, change.name)) != change.before:
            raise SyncError(f"destination changed during preflight: {change.name}")
    # Each replacement is atomic; update the manifest last. Already-copied files
    # are accepted on a retry, so an interrupted synchronization is recoverable.
    for change in changes:
        atomic_write(safe_file(target, change.name), change.after)
    print(f"Synchronized {len(changes)} file(s).")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("bundle", type=Path, help=argparse.SUPPRESS)
    parser.add_argument(
        "--target", type=Path, default=Path.cwd(), help="receiving checkout"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--check", action="store_true", help="exit 1 if synchronization is needed"
    )
    mode.add_argument("--dry-run", action="store_true", help="preview without writing")
    args = parser.parse_args()
    try:
        target = args.target.resolve(strict=True)
        if not target.is_dir():
            raise SyncError(f"target is not a directory: {target}")
        if any(part.casefold() == ".git" for part in target.parts):
            raise SyncError("target cannot be inside Git metadata")
        return synchronize(
            args.bundle.resolve(strict=True),
            target,
            check=args.check,
            dry_run=args.dry_run,
        )
    except (SyncError, OSError, ValueError) as error:
        print(f"sync-ci: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
