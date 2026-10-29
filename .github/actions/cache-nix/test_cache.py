"""Offline regression tests for cache selection and upload failure handling."""

import copy
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("cache.sh")
CHECK = "/nix/store/check-output"
DEP = "/nix/store/dependency-output"
SOURCE = "/nix/store/evaluation-source"
LOCKED = "/nix/store/locked-input-source"
MISSING = "/nix/store/missing-input-source"
RUNTIME = "/nix/store/runtime-source"
UPSTREAM = "/nix/store/upstream-output"
DRV = "/nix/store/check.drv"

# Model only Nix/AWS interfaces; execute the real selection, signing, compression,
# narinfo generation, parallelism and shell error handling in cache.sh.
FAKE_TOOL = (
    f"#!{sys.executable}\n"
    + r"""import json
import os
from pathlib import Path
import sys

name = Path(sys.argv[0]).name
args = sys.argv[1:]
state = json.loads(Path(os.environ["TEST_STATE"]).read_text())
stdin = sys.stdin.read() if "--stdin" in args or name == "zstd" or args[:3] == ["s3", "cp", "-"] else ""
with open(os.environ["TEST_LOG"], "a") as log:
    log.write(json.dumps([name, args, stdin]) + "\n")
if name == "nix-store":
    if args[0] == "--check-validity":
        sys.exit(0 if args[1] in state.get("valid_sources", []) else 1)
    if state.get("query_failure"):
        sys.exit(1)
    key = "declared" if "--outputs" in args else "reachable"
    print("\n".join(state[key]))
elif name == "nix":
    if args[0] == "path-info" and "--json" in args:
        if state["json_format"]:
            assert args[args.index("--json-format") + 1] == "1"
        else:
            assert "--json-format" not in args
    if args[:2] == ["path-info", "--help"]:
        if state.get("help_failure"):
            sys.exit(1)
        print("--json-format VERSION" if state["json_format"] else "--json")
    elif args[:2] == ["path-info", "--derivation"]:
        assert args[2:] == [".#packages.aarch64-linux.example-docker-image", ".#devShells.aarch64-linux.skopeo"]
        print("/nix/store/integration-image.drv\n/nix/store/skopeo.drv")
    elif args[0] == "eval":
        print("aarch64-linux")
    elif args[0] in ["build", "develop"]:
        pass
    elif "--recursive" in args:
        assert set(stdin.splitlines()) == set(state["realized"])
        print(json.dumps(state["metadata"]))
    elif args[0] == "path-info":
        path = args[-1]
        info = state["metadata"][path].copy()
        info["signatures"] = ["test-key:signed"]
        print(json.dumps({path: info}))
    elif args[:2] == ["store", "sign"]:
        if state.get("sign_failure"):
            sys.exit(1)
    elif args[0] == "hash":
        print("narhash")
    elif args[:2] == ["nar", "pack"]:
        print("NAR")
    else:
        raise AssertionError(args)
elif name == "aws":
    assert "AWS_SESSION_TOKEN" not in os.environ
    if args[0] == "s3api":
        if state.get("head_failure"):
            print("An error occurred (403): Forbidden", file=sys.stderr)
            sys.exit(1)
        key = args[args.index("--key") + 1]
        if key not in state.get("cached", []):
            print("An error occurred (404): Not Found", file=sys.stderr)
            sys.exit(1)
    elif state.get("upload_failure"):
        sys.exit(1)
elif name == "nix-hash":
    print("filehash")
elif name == "zstd":
    print(stdin, end="")
else:
    raise AssertionError(name)
"""
)


def metadata(signatures=None, references=None):
    return {
        "signatures": signatures or [],
        "references": references or [],
        "narHash": "sha256:hash",
        "narSize": 42,
    }


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        tools = self.directory / "bin"
        tools.mkdir()
        for name in ["nix", "nix-store", "aws", "nix-hash", "zstd"]:
            tool = tools / name
            tool.write_text(FAKE_TOOL)
            tool.chmod(0o755)
        self.roots = self.directory / "roots"
        self.roots.write_text(DRV + "\n")
        self.state = {
            "json_format": True,
            "reachable": [DRV, "/nix/store/dependency.drv", SOURCE, CHECK, DEP],
            "declared": [CHECK, DEP, "/nix/store/unbuilt-output"],
            "realized": [CHECK, DEP],
            "metadata": {
                CHECK: metadata(references=[DEP, RUNTIME, UPSTREAM]),
                DEP: metadata(),
                RUNTIME: metadata(),
                UPSTREAM: metadata(signatures=["cache.nixos.org-1:upstream"]),
                # Even a derivation retained by an output must not be uploaded.
                DRV: metadata(),
            },
        }
        self.env = {
            **os.environ,
            "PATH": str(tools) + os.pathsep + os.environ["PATH"],
            "TEST_STATE": str(self.directory / "state.json"),
            "TEST_LOG": str(self.directory / "log.jsonl"),
            "ROOTS_FILE": str(self.roots),
            "NIX_CACHE_PRIV_KEY": "test-key:secret",
            "AWS_SESSION_TOKEN": "must-be-unset",
        }

    def run_cache(self, success=True):
        Path(self.env["TEST_STATE"]).write_text(json.dumps(self.state))
        result = subprocess.run(
            ["bash", str(SCRIPT)],
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )
        if success:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        else:
            self.assertNotEqual(result.returncode, 0)
        log = Path(self.env["TEST_LOG"])
        events = (
            [json.loads(line) for line in log.read_text().splitlines()]
            if log.exists()
            else []
        )
        self.assertFalse(any("--all" in args for _, args, _ in events))
        return events

    def uploaded(self, events):
        return {
            args[3].removeprefix("s3://nhost-nix-cache/")
            for name, args, _ in events
            if name == "aws" and args[:3] == ["s3", "cp", "-"]
        }

    def probed(self, events):
        return {
            args[args.index("--key") + 1]
            for name, args, _ in events
            if name == "aws" and args[:2] == ["s3api", "head-object"]
        }

    def test_only_workflow_outputs_and_runtime_references_are_uploaded(self):
        events = self.run_cache()
        self.assertEqual(
            self.probed(events),
            {"check.narinfo", "dependency.narinfo", "runtime.narinfo"},
        )
        self.assertEqual(
            self.uploaded(events),
            {"check.narinfo", "dependency.narinfo", "runtime.narinfo"},
        )
        for name, args, stdin in events:
            if name == "aws" and args[:3] == ["s3", "cp", "-"]:
                self.assertIn("Compression: zstd", stdin)
                self.assertIn("Sig: test-key:signed", stdin)
                self.assertNotIn("test-key:secret", stdin)

    def test_explicit_locked_source_is_uploaded_without_scanning_self(self):
        self.roots.write_text(DRV + "\n" + LOCKED + "\n" + MISSING + "\n")
        self.state["valid_sources"] = [LOCKED]
        self.state["realized"].append(LOCKED)
        self.state["metadata"][LOCKED] = metadata()
        events = self.run_cache()
        self.assertEqual(
            self.uploaded(events),
            {
                "check.narinfo",
                "dependency.narinfo",
                "runtime.narinfo",
                "locked.narinfo",
            },
        )
        self.assertFalse(
            any(
                SOURCE in str(event) or MISSING in str(event)
                for event in events
                if event[0] == "aws"
            )
        )

    def test_only_source_roots_work_without_derivations(self):
        self.roots.write_text(LOCKED + "\n")
        self.state["valid_sources"] = [LOCKED]
        self.state["realized"] = [LOCKED]
        self.state["metadata"] = {LOCKED: metadata()}
        events = self.run_cache()
        self.assertEqual(self.uploaded(events), {"locked.narinfo"})
        self.assertFalse(
            any(name == "nix-store" and "--query" in args for name, args, _ in events)
        )

    def test_json_format_is_selected_once_and_supported_by_all_queries(self):
        for supported in [True, False]:
            with self.subTest(json_format=supported):
                self.state["json_format"] = supported
                Path(self.env["TEST_LOG"]).unlink(missing_ok=True)
                events = self.run_cache()
                queries = [args for name, args, _ in events if name == "nix"]
                self.assertEqual(queries.count(["path-info", "--help"]), 1)
                metadata_queries = [
                    args
                    for args in queries
                    if args[0] == "path-info" and "--json" in args
                ]
                self.assertEqual(len(metadata_queries), 4)
                for args in metadata_queries:
                    if supported:
                        self.assertEqual(args[args.index("--json-format") + 1], "1")
                    else:
                        self.assertNotIn("--json-format", args)
                self.assertEqual(
                    self.uploaded(events),
                    {"check.narinfo", "dependency.narinfo", "runtime.narinfo"},
                )

    def test_successful_intermediate_is_cached_after_failed_check(self):
        self.state["reachable"].remove(CHECK)
        self.state["realized"] = [DEP]
        self.state["metadata"] = {DEP: metadata()}
        self.assertEqual(self.uploaded(self.run_cache()), {"dependency.narinfo"})

    def test_our_only_signatures_are_probed_and_retried_if_missing(self):
        self.state["metadata"][DEP]["signatures"] = ["test-key:old-signature"]
        for cached in [False, True]:
            with self.subTest(cached=cached):
                self.state["cached"] = ["dependency.narinfo"] if cached else []
                Path(self.env["TEST_LOG"]).unlink(missing_ok=True)
                events = self.run_cache()
                self.assertEqual(
                    self.probed(events),
                    {"check.narinfo", "dependency.narinfo", "runtime.narinfo"},
                )
                expected = {"check.narinfo", "runtime.narinfo"}
                if not cached:
                    expected.add("dependency.narinfo")
                self.assertEqual(self.uploaded(events), expected)

    def test_mixed_signatures_are_never_probed_or_mirrored(self):
        self.state["metadata"][DEP]["signatures"] = [
            "cache.nixos.org-1:upstream",
            "test-key:old-signature",
        ]
        for cached in [False, True]:
            with self.subTest(cached=cached):
                self.state["cached"] = ["dependency.narinfo"] if cached else []
                Path(self.env["TEST_LOG"]).unlink(missing_ok=True)
                events = self.run_cache()
                self.assertEqual(
                    self.probed(events), {"check.narinfo", "runtime.narinfo"}
                )
                self.assertEqual(
                    self.uploaded(events), {"check.narinfo", "runtime.narinfo"}
                )

    def test_cached_paths_are_not_signed_or_uploaded(self):
        self.state["cached"] = [
            "check.narinfo",
            "dependency.narinfo",
            "runtime.narinfo",
        ]
        events = self.run_cache()
        self.assertEqual(self.uploaded(events), set())
        self.assertFalse(
            any(
                name == "nix" and args[:2] == ["store", "sign"]
                for name, args, _ in events
            )
        )

    def test_empty_or_missing_roots_do_not_scan_the_store(self):
        for exists in [True, False]:
            with self.subTest(exists=exists):
                if exists:
                    self.roots.write_text("")
                else:
                    self.roots.unlink()
                self.assertEqual(self.run_cache(), [])

    def test_make_records_images_built_during_integration_setup(self):
        Path(self.env["TEST_STATE"]).write_text(json.dumps(self.state))
        self.roots.write_text("")
        env = {**self.env, "NIX_CACHE_ROOTS": str(self.roots)}
        project = self.directory / "project"
        project.mkdir()
        (project / "Makefile").write_text(
            f"include {Path.cwd()}/build/makefiles/general.makefile\n"
        )
        result = subprocess.run(
            [
                "make",
                "-C",
                str(project),
                "build-docker-image",
                "ARCH=aarch64",
                "OS=linux",
                "NAME=example",
                "VER=0.0.0-dev",
                f"ROOT_DIR={Path.cwd()}",
                f"SHELL={shutil.which('bash')}",
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(
            self.roots.read_text().splitlines(),
            ["/nix/store/integration-image.drv", "/nix/store/skopeo.drv"],
        )

    def test_no_realized_outputs_is_a_noop(self):
        self.state["reachable"] = [DRV, SOURCE]
        self.assertEqual(self.uploaded(self.run_cache()), set())

    def test_failures_propagate_and_do_not_publish_narinfo(self):
        original = copy.deepcopy(self.state)
        for failure in [
            "query_failure",
            "help_failure",
            "head_failure",
            "sign_failure",
            "upload_failure",
        ]:
            with self.subTest(failure=failure):
                self.state = {**copy.deepcopy(original), failure: True}
                Path(self.env["TEST_LOG"]).unlink(missing_ok=True)
                self.assertEqual(self.uploaded(self.run_cache(success=False)), set())


if __name__ == "__main__":
    unittest.main()
