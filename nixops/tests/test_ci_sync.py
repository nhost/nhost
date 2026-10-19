"""Offline tests for the packaged CI bundle and manifest-driven synchronization."""

import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from unittest.mock import patch

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "nixops/sync_ci.py"
SPEC = importlib.util.spec_from_file_location("sync_ci", SCRIPT)
assert SPEC is not None and SPEC.loader is not None
sync_ci = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = sync_ci
SPEC.loader.exec_module(sync_ci)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def snapshot(root):
    result = {}
    for path in root.rglob("*"):
        name = str(path.relative_to(root))
        if path.is_symlink():
            result[name] = ("symlink", str(path.readlink()))
        elif path.is_dir():
            result[name] = ("directory",)
        else:
            result[name] = (
                "file",
                path.read_bytes(),
                bool(path.stat().st_mode & 0o111),
            )
    return result


class SyncTests(unittest.TestCase):
    def setUp(self):
        self.fixture()

    def fixture(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.bundle = self.directory / "bundle"
        self.target = self.directory / "checkout"
        self.target.mkdir()
        self.sources = {
            "assets/first": b"published first\x00\xff\n",
            "assets/second": b"published second\n",
        }
        self.destinations = [".github/workflows/shared.yaml", "nix/tests/shared.py"]
        self.manifest = {
            "repository": "nhost/nhost",
            "revision": "a" * 40,
            "status": "pinned verbatim copies",
            "notes": "receiver-owned metadata",
            "files": [],
        }
        for index, (source, data) in enumerate(self.sources.items()):
            path = self.bundle / "files" / source
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            path.chmod(0o755 if index else 0o644)
            destination = self.target / self.destinations[index]
            destination.parent.mkdir(parents=True, exist_ok=True)
            old = f"old {index}\n".encode()
            destination.write_bytes(old)
            destination.chmod(0o644)
            self.manifest["files"].append(
                {
                    "source": source,
                    "path": self.destinations[index],
                    "sha256": sha(old),
                    "executable": False,
                    "purpose": "receiver-owned field",
                }
            )
        self.catalog = {
            "repository": "nhost/nhost",
            "revision": "b" * 40,
            "files": {source: sha(data) for source, data in self.sources.items()},
        }
        write_json(self.bundle / "bundle.json", self.catalog)
        self.save_manifest()
        for name in ["build/Makefile", ".git/HEAD", ".git/index"]:
            path = self.target / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("not managed by sync-ci\n")

    def save_manifest(self):
        write_json(self.target / sync_ci.MANIFEST, self.manifest)

    def invoke(self, *args):
        return subprocess.run(
            [
                sys.executable,
                str(SCRIPT),
                str(self.bundle),
                "--target",
                str(self.target),
                *args,
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    def test_apply_updates_hashes_pin_and_modes_and_is_idempotent(self):
        before = snapshot(self.target)
        bundle_before = snapshot(self.bundle)
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = json.loads((self.target / sync_ci.MANIFEST).read_text())
        self.assertEqual(manifest["revision"], "b" * 40)
        self.assertEqual(manifest["notes"], self.manifest["notes"])
        for index, entry in enumerate(manifest["files"]):
            path = self.target / entry["path"]
            self.assertEqual(path.read_bytes(), self.sources[entry["source"]])
            self.assertEqual(entry["sha256"], sha(path.read_bytes()))
            self.assertEqual(entry["purpose"], "receiver-owned field")
            self.assertEqual(entry["executable"], bool(index))
            self.assertEqual(bool(path.stat().st_mode & 0o111), bool(index))
            self.assertTrue(path.stat().st_mode & 0o200)
        after = snapshot(self.target)
        for name in ["build/Makefile", ".git/HEAD", ".git/index"]:
            self.assertEqual(after[name], before[name])
        self.assertEqual(snapshot(self.bundle), bundle_before)
        self.assertEqual(self.invoke("--check").returncode, 0)
        self.assertEqual(self.invoke().returncode, 0)
        self.assertEqual(snapshot(self.target), after)
        self.assertFalse(list(self.target.rglob(".sync-ci-*")))

    def test_receiver_read_write_permissions_are_preserved(self):
        manifest = self.target / sync_ci.MANIFEST
        manifest.chmod(0o600)
        first = self.target / self.destinations[0]
        first.chmod(0o640)
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(manifest.stat().st_mode & 0o777, 0o600)
        self.assertEqual(first.stat().st_mode & 0o777, 0o640)

    def test_read_only_modes_report_drift_without_writes(self):
        before = snapshot(self.target)
        for args, expected in [("--check", 1), ("--dry-run", 0)]:
            with self.subTest(mode=args):
                result = self.invoke(args)
                self.assertEqual(result.returncode, expected, result.stderr)
                self.assertIn("update build/shared-ci.json", result.stdout)
                self.assertEqual(snapshot(self.target), before)

    def test_unpublished_sources_can_only_preview(self):
        self.catalog["revision"] = None
        write_json(self.bundle / "bundle.json", self.catalog)
        before = snapshot(self.target)
        for args in [[], ["--check"], ["--dry-run"]]:
            with self.subTest(args=args):
                result = self.invoke(*args)
                self.assertEqual(result.returncode, 0 if args == ["--dry-run"] else 2)
                self.assertEqual(snapshot(self.target), before)

    def test_local_content_and_mode_edits_prevent_all_writes(self):
        for kind in ["content", "mode", "unrecorded"]:
            with self.subTest(kind=kind):
                self.fixture()
                # The second mapping fails: the first must not be copied early.
                path = self.target / self.destinations[1]
                if kind == "content":
                    path.write_text("local customization\n")
                elif kind == "mode":
                    path.chmod(0o755)
                else:
                    del self.manifest["files"][1]["sha256"]
                    self.save_manifest()
                before = snapshot(self.target)
                result = self.invoke()
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("locally modified or unrecorded", result.stderr)
                self.assertEqual(snapshot(self.target), before)

    def test_bootstrap_missing_files_and_legacy_hash_only_entries(self):
        for entry in self.manifest["files"]:
            (self.target / entry["path"]).unlink()
            del entry["sha256"]
            del entry["executable"]
        self.save_manifest()
        self.assertEqual(self.invoke().returncode, 0)
        self.assertEqual(self.invoke("--check").returncode, 0)
        self.fixture()
        for entry in self.manifest["files"]:
            del entry["executable"]
        self.save_manifest()
        self.assertEqual(self.invoke().returncode, 0)

    def test_preview_of_new_destinations_does_not_create_directories(self):
        for index, entry in enumerate(self.manifest["files"]):
            entry["path"] = f"fresh/directory/{index}"
            del entry["sha256"]
        self.save_manifest()
        before = snapshot(self.target)
        for option, expected in [("--dry-run", 0), ("--check", 1)]:
            with self.subTest(option=option):
                result = self.invoke(option)
                self.assertEqual(result.returncode, expected, result.stderr)
                self.assertEqual(snapshot(self.target), before)

    def test_paths_are_data_not_shell_commands(self):
        self.manifest["files"][0]["path"] = "directory/with spaces; $(not-a-command)"
        del self.manifest["files"][0]["sha256"]
        self.save_manifest()
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            (self.target / self.manifest["files"][0]["path"]).read_bytes(),
            self.sources["assets/first"],
        )

    def test_unsafe_destinations_are_rejected(self):
        for name in [
            "../escape",
            "/tmp/escape",
            "a/../escape",
            "a//escape",
            "a/./escape",
            ".git/config",
            ".GIT/config",
            "a/.git/config",
            ".",
            "",
            None,
            1,
            "a\\escape",
            "a\x00escape",
            "a\nescape",
            "a\x7fescape",
            sync_ci.MANIFEST,
            "BUILD/shared-ci.json",
        ]:
            with self.subTest(path=name):
                self.manifest["files"][0]["path"] = name
                self.save_manifest()
                before = snapshot(self.target)
                result = self.invoke()
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertEqual(snapshot(self.target), before)

    def test_git_metadata_cannot_be_the_target_root(self):
        self.target = self.target / ".git"
        self.save_manifest()
        before = snapshot(self.target)
        result = self.invoke()
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("inside Git metadata", result.stderr)
        self.assertEqual(snapshot(self.target), before)

    def test_invalid_sources_and_destination_collisions_are_rejected(self):
        for first, second, source in [
            ("same", "same", "assets/first"),
            ("Same", "same", "assets/first"),
            ("parent", "parent/child", "assets/first"),
            ("build", "other", "assets/first"),
            ("first", "second", "not-exported"),
            ("first", "second", "../outside"),
        ]:
            with self.subTest(first=first, second=second, source=source):
                self.manifest["files"][0].update(path=first, source=source)
                self.manifest["files"][1]["path"] = second
                self.save_manifest()
                before = snapshot(self.target)
                self.assertEqual(self.invoke().returncode, 2)
                self.assertEqual(snapshot(self.target), before)

    def test_symlinked_files_and_parents_are_rejected(self):
        for location in [
            "destination",
            "destination-parent",
            "manifest",
            "manifest-parent",
            "source",
            "source-parent",
        ]:
            with self.subTest(location=location):
                self.fixture()
                path = {
                    "destination": self.target / self.destinations[0],
                    "destination-parent": self.target / ".github",
                    "manifest": self.target / sync_ci.MANIFEST,
                    "manifest-parent": self.target / "build",
                    "source": self.bundle / "files/assets/first",
                    "source-parent": self.bundle / "files",
                }[location]
                outside = self.directory / "outside"
                path.rename(outside)
                path.symlink_to(outside, target_is_directory=outside.is_dir())
                before = snapshot(self.target)
                result = self.invoke()
                self.assertEqual(result.returncode, 2, result.stderr)
                self.assertIn("symlink", result.stderr)
                self.assertEqual(snapshot(self.target), before)

    def test_invalid_metadata_and_corrupt_bundle_fail_without_writes(self):
        for kind in [
            "repository",
            "revision",
            "hash",
            "bytes",
            "json",
            "mappings",
            "executable",
        ]:
            with self.subTest(kind=kind):
                self.fixture()
                if kind in ["repository", "revision"]:
                    self.catalog[kind] = "invalid"
                    write_json(self.bundle / "bundle.json", self.catalog)
                elif kind == "hash":
                    self.catalog["files"]["assets/first"] = "0" * 64
                    write_json(self.bundle / "bundle.json", self.catalog)
                elif kind == "bytes":
                    (self.bundle / "files/assets/first").write_bytes(b"corrupt")
                elif kind == "json":
                    (self.target / sync_ci.MANIFEST).write_text("not json")
                else:
                    if kind == "mappings":
                        self.manifest["files"] = []
                    else:
                        self.manifest["files"][0]["executable"] = "false"
                    self.save_manifest()
                before = snapshot(self.target)
                self.assertEqual(self.invoke().returncode, 2)
                self.assertEqual(snapshot(self.target), before)

    def test_interrupted_copy_can_be_retried_with_manifest_written_last(self):
        original = sync_ci.atomic_write
        manifest_before = (self.target / sync_ci.MANIFEST).read_bytes()

        def fail_second(path, desired):
            if path == self.target / self.destinations[1]:
                raise OSError("simulated write failure")
            original(path, desired)

        with (
            patch.object(sync_ci, "atomic_write", side_effect=fail_second),
            redirect_stdout(StringIO()),
        ):
            with self.assertRaises(OSError):
                sync_ci.synchronize(self.bundle, self.target)
        self.assertEqual((self.target / sync_ci.MANIFEST).read_bytes(), manifest_before)
        self.assertEqual(self.invoke().returncode, 0)
        self.assertEqual(self.invoke("--check").returncode, 0)

    def test_changes_during_preflight_are_not_overwritten(self):
        original = sync_ci.plan
        first = (self.target / self.destinations[0]).read_bytes()

        def racing_plan(bundle, target):
            result = original(bundle, target)
            (target / self.destinations[1]).write_bytes(b"concurrent edit")
            return result

        with (
            patch.object(sync_ci, "plan", side_effect=racing_plan),
            redirect_stdout(StringIO()),
        ):
            with self.assertRaisesRegex(sync_ci.SyncError, "changed during preflight"):
                sync_ci.synchronize(self.bundle, self.target)
        self.assertEqual((self.target / self.destinations[0]).read_bytes(), first)
        self.assertEqual(
            (self.target / self.destinations[1]).read_bytes(), b"concurrent edit"
        )


class PackageTests(unittest.TestCase):
    def test_nix_bundle_is_exactly_the_shared_source_files(self):
        bundle = Path(os.environ["CI_FILES"])
        catalog = json.loads((bundle / "bundle.json").read_text())
        expected = {
            ".github/workflows/wf_check.yaml",
            ".github/workflows/wf_docker_push_image_ecr.yaml",
            ".github/actions/setup-nix/action.yml",
            ".github/actions/cache-nix/action.yml",
            ".github/actions/cache-nix/cache.sh",
            ".github/actions/cache-nix/test_cache.py",
            "build/makefiles/general.makefile",
            "build/makefiles/release.makefile",
            "nixops/tests/test_workflows.py",
            "nixops/tests/test_shared_ci.py",
        }
        self.assertEqual(catalog["repository"], "nhost/nhost")
        self.assertEqual(set(catalog["files"]), expected)
        self.assertEqual(
            {
                str(p.relative_to(bundle / "files"))
                for p in (bundle / "files").rglob("*")
                if p.is_file()
            },
            expected,
        )
        for source in expected:
            with self.subTest(source=source):
                packaged = bundle / "files" / source
                original = REPO / source
                self.assertEqual(packaged.read_bytes(), original.read_bytes())
                self.assertEqual(sha(packaged.read_bytes()), catalog["files"][source])
                self.assertEqual(
                    bool(packaged.stat().st_mode & 0o111),
                    bool(original.stat().st_mode & 0o111),
                )

    def test_packaged_command_previews_real_bundle_without_writes(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            write_json(
                target / sync_ci.MANIFEST,
                {
                    "repository": "nhost/nhost",
                    "files": [
                        {
                            "source": "build/makefiles/general.makefile",
                            "path": "new/shared/general.makefile",
                        }
                    ],
                },
            )
            before = snapshot(target)
            result = subprocess.run(
                [os.environ["SYNC_CI"], "--target", str(target), "--dry-run"],
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("create new/shared/general.makefile", result.stdout)
            self.assertEqual(snapshot(target), before)

    def test_packaged_command_help(self):
        result = subprocess.run(
            [os.environ["SYNC_CI"], "--help"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        for option in ["--target", "--check", "--dry-run"]:
            self.assertIn(option, result.stdout)


if __name__ == "__main__":
    unittest.main()
