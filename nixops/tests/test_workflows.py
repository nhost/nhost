"""Offline tests for the hand-maintained build/check workflow and shared Makefile."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
WORKFLOW = REPO / ".github/workflows/wf_check.yaml"

FAKE_TOOL = (
    f"#!{sys.executable}\n"
    + r"""
import json
import os
import re
import sys
from pathlib import Path

name = Path(sys.argv[0]).name
args = sys.argv[1:]
state = json.loads(Path(os.environ["TEST_STATE"]).read_text())
project = Path.cwd()
metadata = (project / "project.nix").read_text()
version = re.search(r'version = "([^"]+)"', metadata)[1]
created = re.search(r'created = "([^"]+)"', metadata)[1]
with open(os.environ["TEST_LOG"], "a") as log:
    log.write(json.dumps([name, args, version]) + "\n")
tags_file = Path(os.environ["TEST_TAGS"])
tags = json.loads(tags_file.read_text())

def output(installable):
    category, platform, package = installable.removeprefix(".#").split(".", 2)
    kind = "image" if package.endswith("-docker-image") else category
    package = package.removesuffix("-docker-image")
    # Image paths vary with the nix2container creation date as well as version.
    stamp = "-" + created.replace(":", "_") if kind == "image" else ""
    basename = "-".join((platform, package, version, kind)) + stamp
    path = Path(os.environ["TEST_STORE"]) / basename
    return path, kind, platform, package

if name == "nix":
    if args[0] == "eval":
        print("aarch64-linux", end="")
    elif args[:3] == ["flake", "archive", "--json"]:
        assert "--dry-run" in args
        print(json.dumps({"path": str(project), "inputs": {
            "nixops": {"path": "/nix/store/locked-nixops-source", "inputs": {
                "systems": {"path": "/nix/store/locked-systems-source"}}},
            "nixpkgs": {"path": "/nix/store/locked-nixpkgs-source"}}}))
    elif args[0] == "path-info":
        if "--derivation" in args:
            for installable in args:
                if installable.startswith(".#"):
                    print(str(output(installable)[0]) + ".drv")
        else:
            print(Path(args[-1]).resolve(strict=True))
    elif args[0] == "develop":
        command = args[args.index("-c") + 1:]
        os.execvpe(command[0], command, os.environ)
    elif args[0] == "build":
        target = next(arg for arg in args if arg.startswith(".#"))
        path, kind, platform, package = output(target)
        if "--dry-run" in args:
            if state.get("dry_run_failure"):
                sys.exit(1)
            if not state.get("checks_cached"):
                print("this derivation will be built", file=sys.stderr)
            print(json.dumps([{"outputs": {"out": str(path)}}]))
        else:
            if kind == "checks":
                expected = "sha256:aarch64-linux:example:" + version
                assert tags.get("example:" + version) == expected, tags
                if state.get("check_failure"):
                    print("deliberate check failure", file=sys.stderr)
                    sys.exit(1)
            path.mkdir(parents=True, exist_ok=True)
            if kind == "image":
                (path / "manifest.json").write_text(json.dumps({
                    "id": "sha256:" + platform + ":" + package + ":" + version,
                    "version": version,
                }))
            elif kind == "packages":
                (path / "bin").mkdir(exist_ok=True)
                (path / "bin" / package).write_text("binary-" + version)
            else:
                (path / "passed").touch()
            link = project / (args[args.index("--out-link") + 1] if "--out-link" in args else "result")
            link.unlink(missing_ok=True)
            link.symlink_to(path, target_is_directory=True)
    else:
        raise AssertionError(args)
elif name == "skopeo":
    source = next(arg.removeprefix("dir:") for arg in args if arg.startswith("dir:"))
    destination = next(arg.removeprefix("docker-daemon:") for arg in args if arg.startswith("docker-daemon:"))
    tags[destination] = json.loads((Path(source) / "manifest.json").read_text())["id"]
    tags_file.write_text(json.dumps(tags))
elif name == "docker":
    if args[:2] == ["image", "inspect"]:
        if args[-1] not in tags:
            sys.exit(1)
        print(tags[args[-1]])
    elif args[0] == "tag":
        tags[args[2]] = tags[args[1]]
        tags_file.write_text(json.dumps(tags))
    else:
        raise AssertionError(args)
else:
    raise AssertionError(name)
"""
)


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.steps = yaml.safe_load(WORKFLOW.read_text())["jobs"]["tests"]["steps"]
        self.by_name = {step["name"]: step for step in self.steps}
        setup = yaml.safe_load(
            (REPO / ".github/actions/setup-nix/action.yml").read_text()
        )
        self.by_name.update({step["name"]: step for step in setup["runs"]["steps"]})
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.project = self.directory / "services/example"
        self.project.mkdir(parents=True)
        (self.directory / "build/makefiles").mkdir(parents=True)
        for name in ["general.makefile", "release.makefile"]:
            shutil.copyfile(
                REPO / "build/makefiles" / name,
                self.directory / "build/makefiles" / name,
            )
        (self.project / "Makefile").write_text(
            f"SHELL := {shutil.which('bash')}\n"
            "ARCH ?= aarch64\nOS ?= linux\n"
            "ROOT_DIR := $(abspath ../..)\n"
            "include $(ROOT_DIR)/build/makefiles/general.makefile\n"
            ".PHONY: _dev-env-build _dev-env-up\n"
            "_dev-env-build: build-docker-image\n"
            "_dev-env-up:\n\t@docker image inspect example:$(VERSION) >/dev/null\n"
        )
        (self.project / "project.nix").write_text(
            '{\n  version = "0.0.0-dev";\n  created = "1970-01-01T00:00:00Z";\n}\n'
        )
        tools = self.directory / "tools"
        tools.mkdir()
        for name in ["nix", "docker", "skopeo"]:
            tool = tools / name
            tool.write_text(FAKE_TOOL)
            tool.chmod(0o755)
        self.state_file = self.directory / "state.json"
        self.tags_file = self.directory / "tags.json"
        self.tags_file.write_text("{}")
        self.log = self.directory / "events.jsonl"
        self.github_env = self.directory / "github-env"
        self.github_env.touch()
        self.state = {}
        self.outputs = {}
        self.env = {
            **os.environ,
            "PATH": str(tools) + os.pathsep + os.environ["PATH"],
            "TEST_STATE": str(self.state_file),
            "TEST_TAGS": str(self.tags_file),
            "TEST_STORE": str(self.directory / "store"),
            "TEST_LOG": str(self.log),
            "GITHUB_ENV": str(self.github_env),
            "RUNNER_TEMP": str(self.directory),
            "NAME": "example",
            "RUNNER_ARCH": "ARM64",
            "RUNNER_OS": "Linux",
            "RUN_CHECKS": "true",
        }
        for key in [
            "MAKEFLAGS",
            "MFLAGS",
            "NIX_CACHE_ROOTS",
            "PREBUILT_DOCKER_IMAGE_PATH",
            "PREBUILT_DOCKER_IMAGE_ID",
        ]:
            self.env.pop(key, None)
        self.requested_version = "release-sha"
        self.docker = True

    def resolve_env(self, value):
        bindings = {
            "${{ inputs.VERSION }}": self.requested_version,
            "${{ inputs.DOCKER }}": str(self.docker).lower(),
            "${{ steps.verify-checks.outputs.BUILD_NEEDED == 'yes' }}": str(
                self.outputs.get("verify-checks", {}).get("BUILD_NEEDED") == "yes"
            ).lower(),
            "${{ steps.vars.outputs.VERSION }}": self.outputs.get("vars", {}).get(
                "VERSION", ""
            ),
            "${{ env.RUN_CHECKS == 'true' && '0.0.0-dev' || '' }}": "0.0.0-dev"
            if self.env["RUN_CHECKS"] == "true"
            else "",
            "${{ steps.build-image.outputs.STORE_PATH }}": self.outputs.get(
                "build-image", {}
            ).get("STORE_PATH", ""),
            "${{ steps.build-image.outputs.IMAGE_ID }}": self.outputs.get(
                "build-image", {}
            ).get("IMAGE_ID", ""),
        }
        if "${{" in str(value):
            return bindings[value]
        return str(value)

    def run_step(self, name, success=True):
        step = self.by_name[name]
        output_file = self.directory / "github-output"
        output_file.write_text("")
        self.state_file.write_text(json.dumps(self.state))
        env = {**self.env, "GITHUB_OUTPUT": str(output_file)}
        env.update(
            {key: self.resolve_env(value) for key, value in step.get("env", {}).items()}
        )
        result = subprocess.run(
            ["bash", "-euo", "pipefail", "-c", step["run"]],
            cwd=self.project,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        if success:
            self.assertEqual(
                result.returncode, 0, name + "\n" + result.stdout + result.stderr
            )
        else:
            self.assertNotEqual(result.returncode, 0, name)
        for line in self.github_env.read_text().splitlines():
            key, value = line.split("=", 1)
            self.env[key] = value
        if "id" in step:
            self.outputs[step["id"]] = dict(
                line.split("=", 1) for line in output_file.read_text().splitlines()
            )
        return result

    def run_builds(self):
        for name in [
            "Initialize Nix cache roots",
            "Compute artifact version",
            "Verify if checks need to run",
            "Record artifact cache roots",
            "Build artifact",
            "Build Docker image",
        ]:
            if name == "Build Docker image" and not self.docker:
                continue
            self.run_step(name)

    def events(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def test_ordering_and_publication_gates(self):
        names = [step["name"] for step in self.steps]
        expected = [
            "Compute artifact version",
            "Verify if checks need to run",
            "Record artifact cache roots",
            "Grant Nix builds access to the Docker socket",
            "Build artifact",
            "Build Docker image",
            "Start containers for integration tests",
            "Run checks",
            "Push artifact to artifact repository",
            "Push Docker image to artifact repository",
            "Store Nix cache",
        ]
        self.assertEqual([name for name in names if name in expected], expected)
        self.assertEqual(self.by_name["Compute artifact version"]["if"], "inputs.BUILD")
        self.assertEqual(
            self.by_name["Verify if checks need to run"]["if"],
            "env.RUN_CHECKS == 'true'",
        )
        self.assertEqual(self.by_name["Build artifact"]["if"], "inputs.BUILD")
        self.assertEqual(
            self.by_name["Build Docker image"]["if"],
            "inputs.BUILD && inputs.DOCKER && runner.os != 'macOS'",
        )
        for name in ["Start containers for integration tests", "Run checks"]:
            self.assertEqual(
                self.by_name[name]["if"],
                "steps.verify-checks.outputs.BUILD_NEEDED == 'yes'",
            )
        self.assertEqual(
            self.by_name["Push artifact to artifact repository"]["if"], "inputs.BUILD"
        )
        image_upload = self.by_name["Push Docker image to artifact repository"]
        self.assertEqual(
            image_upload["if"], "inputs.BUILD && inputs.DOCKER && runner.os != 'macOS'"
        )
        self.assertEqual(
            image_upload["with"]["path"], "${{ inputs.PROJECT }}/result-image"
        )
        self.assertIn("always()", self.by_name["Store Nix cache"]["if"])

    def test_cache_roots_record_locked_inputs_but_not_self(self):
        self.run_step("Initialize Nix cache roots")
        roots = Path(self.env["NIX_CACHE_ROOTS"]).read_text().splitlines()
        self.assertEqual(
            roots,
            [
                "/nix/store/locked-nixops-source",
                "/nix/store/locked-systems-source",
                "/nix/store/locked-nixpkgs-source",
            ],
        )
        self.assertNotIn(str(self.project), roots)

    def test_built_outputs_survive_environment_and_checks(self):
        self.requested_version = "v1.2.3/topic"
        self.run_builds()
        self.run_step("Start containers for integration tests")
        self.run_step("Run checks")
        version = self.outputs["vars"]["VERSION"]
        self.assertEqual(version, "1.2.3_topic")
        self.assertNotIn('created = "1970-', (self.project / "project.nix").read_text())
        with zipfile.ZipFile(self.project / "result.zip") as archive:
            self.assertEqual(archive.read("result/bin/example"), b"binary-1.2.3_topic")
            self.assertFalse(
                any(name.startswith("result-bin") for name in archive.namelist())
            )
        image = json.loads((self.project / "result-image/manifest.json").read_text())
        self.assertEqual(image["version"], version)
        self.assertEqual(
            (self.project / "result-bin/bin/example").read_text(), "binary-" + version
        )
        self.assertTrue((self.project / "result-check/passed").exists())
        self.assertFalse((self.project / "result").exists())
        self.assertEqual(sum(name == "skopeo" for name, _, _ in self.events()), 1)
        self.assertTrue(
            all(
                value == version
                for name, args, value in self.events()
                if not (name == "nix" and args[0] in ["eval", "flake"])
            )
        )
        tags = json.loads(self.tags_file.read_text())
        self.assertIn("example:" + version, tags)
        roots = Path(self.env["NIX_CACHE_ROOTS"]).read_text()
        self.assertNotIn("0.0.0-dev", roots)
        self.assertIn(version + "-checks.drv", roots)

    def test_dev_image_derivation_is_stable_and_reused_for_checks(self):
        self.requested_version = "0.0.0-dev"
        project_nix = self.project / "project.nix"
        original_metadata = project_nix.read_text()

        self.run_builds()
        first_roots = Path(self.env["NIX_CACHE_ROOTS"]).read_text()
        first_image = self.outputs["build-image"]["STORE_PATH"]
        self.assertEqual(self.outputs["vars"]["VERSION"], "0.0.0-dev")
        self.assertEqual(project_nix.read_text(), original_metadata)
        self.assertIn(first_image + ".drv", first_roots)
        self.run_step("Start containers for integration tests")
        self.run_step("Run checks")
        self.assertEqual(sum(name == "skopeo" for name, _, _ in self.events()), 1)

        self.run_builds()
        self.assertEqual(project_nix.read_text(), original_metadata)
        self.assertEqual(Path(self.env["NIX_CACHE_ROOTS"]).read_text(), first_roots)
        self.assertEqual(self.outputs["build-image"]["STORE_PATH"], first_image)
        imports = sum(name == "skopeo" for name, _, _ in self.events())
        self.run_step("Start containers for integration tests")
        self.assertEqual(sum(name == "skopeo" for name, _, _ in self.events()), imports)

    def test_binary_only_artifacts_can_still_prepare_an_image_for_checks(self):
        self.docker = False
        self.run_builds()
        self.run_step("Start containers for integration tests")
        self.run_step("Run checks")
        self.assertTrue((self.project / "result.zip").exists())
        self.assertFalse((self.project / "result-image").exists())
        self.assertEqual(sum(name == "skopeo" for name, _, _ in self.events()), 1)

    def test_secondary_architecture_build_does_not_run_native_checks(self):
        self.env["RUN_CHECKS"] = "false"
        self.env["RUNNER_ARCH"] = "X64"
        self.env["ARCH"] = "x86_64"
        for name in [
            "Initialize Nix cache roots",
            "Compute artifact version",
            "Record artifact cache roots",
            "Build artifact",
            "Build Docker image",
        ]:
            self.run_step(name)
        image = json.loads((self.project / "result-image/manifest.json").read_text())
        self.assertTrue(image["id"].startswith("sha256:x86_64-linux:"))
        self.assertEqual(self.outputs["vars"]["PLATFORM"], "linux-x86_64")
        self.assertNotIn("verify-checks", self.outputs)
        self.assertFalse((self.project / "result-dev-env").exists())
        self.assertNotIn("example:0.0.0-dev", json.loads(self.tags_file.read_text()))

    def test_cached_checks_still_build_artifacts_without_starting_the_environment(self):
        self.state["checks_cached"] = True
        self.run_builds()
        self.assertEqual(self.outputs["verify-checks"]["BUILD_NEEDED"], "no")
        self.assertTrue((self.project / "result.zip").exists())
        self.assertTrue((self.project / "result-image/manifest.json").exists())
        self.assertFalse((self.project / "result-dev-env").exists())
        self.assertFalse((self.project / "result-check").exists())

    def test_failed_probe_is_not_mistaken_for_a_cache_hit(self):
        self.state["dry_run_failure"] = True
        self.run_step("Initialize Nix cache roots")
        self.run_step("Verify if checks need to run", success=False)
        self.assertNotIn("BUILD_NEEDED", self.outputs["verify-checks"])
        self.assertTrue(Path(self.env["NIX_CACHE_ROOTS"]).is_file())

    def test_failed_checks_keep_prebuilt_outputs(self):
        self.state["check_failure"] = True
        self.run_builds()
        self.run_step("Start containers for integration tests")
        result = self.run_step("Run checks", success=False)
        self.assertIn("deliberate check failure", result.stderr)
        self.assertTrue((self.project / "result-image/manifest.json").exists())
        with zipfile.ZipFile(self.project / "result.zip") as archive:
            self.assertIn("result/bin/example", archive.namelist())
        self.assertTrue(Path(self.env["NIX_CACHE_ROOTS"]).is_file())

    def test_check_only_environment_still_builds_its_own_image(self):
        self.run_step("Initialize Nix cache roots")
        self.run_step("Verify if checks need to run")
        self.run_step("Start containers for integration tests")
        self.run_step("Run checks")
        self.assertTrue((self.project / "result-check/passed").exists())
        self.assertFalse((self.project / "result.zip").exists())
        self.assertEqual(sum(name == "skopeo" for name, _, _ in self.events()), 1)

    def test_prebuilt_reuse_requires_matching_store_path_and_image_id(self):
        self.run_builds()
        for mismatch in ["store-path", "image-id", "missing-tag", "architecture"]:
            with self.subTest(mismatch=mismatch):
                image = self.outputs["build-image"].copy()
                tags = {"example:release-sha": image["IMAGE_ID"]}
                if mismatch == "store-path":
                    image["STORE_PATH"] = "/nix/store/different-image"
                elif mismatch == "image-id":
                    tags["example:release-sha"] = "sha256:stale"
                elif mismatch == "missing-tag":
                    tags = {}
                self.tags_file.write_text(json.dumps(tags))
                self.outputs["build-image"] = image
                previous = sum(name == "skopeo" for name, _, _ in self.events())
                if mismatch == "architecture":
                    self.run_make(
                        "build-docker-image",
                        "ARCH=x86_64",
                        "OUT_LINK=result-dev-env",
                        env={
                            "PREBUILT_DOCKER_IMAGE_PATH": image["STORE_PATH"],
                            "PREBUILT_DOCKER_IMAGE_ID": image["IMAGE_ID"],
                        },
                    )
                else:
                    self.run_step("Start containers for integration tests")
                self.assertEqual(
                    sum(name == "skopeo" for name, _, _ in self.events()), previous + 1
                )
                # Restore the recorded main image for the next independent case.
                self.outputs["build-image"] = {
                    "STORE_PATH": str((self.project / "result-image").resolve()),
                    "IMAGE_ID": "sha256:aarch64-linux:example:release-sha",
                }

    def run_make(self, *args, env=None):
        self.state_file.write_text(json.dumps(self.state))
        result = subprocess.run(
            ["make", *args],
            cwd=self.project,
            env={**self.env, **(env or {})},
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_auxiliary_images_are_not_skipped(self):
        self.run_builds()
        image = self.outputs["build-image"]
        self.run_make(
            "build-docker-image",
            "NAME=auxiliary",
            "OUT_LINK=result-dev-env",
            env={
                "PREBUILT_DOCKER_IMAGE_PATH": image["STORE_PATH"],
                "PREBUILT_DOCKER_IMAGE_ID": image["IMAGE_ID"],
                "DOCKER_DEV_TAG": "0.0.0-dev",
            },
        )
        self.assertEqual(sum(name == "skopeo" for name, _, _ in self.events()), 2)
        self.assertIn("auxiliary:release-sha", json.loads(self.tags_file.read_text()))

    def test_local_default_and_parallel_environment_startup(self):
        with (self.project / "Makefile").open("a") as makefile:
            makefile.write(
                "\n.PHONY: startup-dependency\n"
                "_dev-env-up: startup-dependency\n"
                "startup-dependency:\n"
                "\t@docker image inspect example:0.0.0-dev >/dev/null\n"
            )
        self.run_make("-j2", "dev-env-up")
        self.assertTrue((self.project / "result/manifest.json").exists())
        events = self.events()
        loaded = next(i for i, (name, _, _) in enumerate(events) if name == "skopeo")
        started = next(
            i
            for i, (name, args, _) in enumerate(events)
            if name == "docker" and args[-1] == "example:0.0.0-dev"
        )
        self.assertLess(loaded, started)


if __name__ == "__main__":
    unittest.main()
