"""Offline tests for checks-first CI, artifact packaging, and shared Make targets."""

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

def record(tool, arguments):
    with open(os.environ["TEST_LOG"], "a") as log:
        log.write(json.dumps([tool, arguments, version]) + "\n")

record(name, args)
tags_file = Path(os.environ["TEST_TAGS"])
tags = json.loads(tags_file.read_text())

def output(installable):
    category, platform, package = installable.removeprefix(".#").split(".", 2)
    kind = "image" if package.endswith("-docker-image") else category
    package = package.removesuffix("-docker-image")
    stamp = "-" + created.replace(":", "_") if kind == "image" else ""
    path = Path(os.environ["TEST_STORE"]) / (
        "-".join((platform, package, version, kind)) + stamp)
    return path, kind, platform, package

def realize(path, kind, platform, package):
    if path.exists():
        return
    # Model the binary dependency of an image: subsequent `make build` must
    # reuse it when the version is unchanged, rather than compile it again.
    if kind == "image":
        realize(*output(".#packages." + platform + "." + package))
    record("realize", [str(path), kind])
    path.mkdir(parents=True)
    if kind == "image":
        (path / "manifest.json").write_text(json.dumps({
            "id": "sha256:" + platform + ":" + package + ":" + version,
            "version": version,
        }))
    elif kind == "packages":
        (path / "bin").mkdir()
        (path / "bin" / package).write_text("binary-" + version)
    else:
        (path / "passed").touch()

if name == "nix":
    if args[:3] == ["flake", "archive", "--json"]:
        assert "--dry-run" in args
        print(json.dumps({"path": str(project), "inputs": {
            "nixops": {"path": "/nix/store/locked-nixops-source", "inputs": {
                "systems": {"path": "/nix/store/locked-systems-source"}}},
            "nixpkgs": {"path": "/nix/store/locked-nixpkgs-source"}}}))
    elif args[:2] == ["path-info", "--derivation"]:
        for installable in args:
            if installable.startswith(".#"):
                print(str(output(installable)[0]) + ".drv")
    elif args[0] == "develop":
        assert args[1].startswith((".#", "#")), args
        command = args[args.index("-c") + 1:]
        os.execvpe(command[0], command, os.environ)
    elif args[0] == "build":
        target = next(arg for arg in args if arg.startswith(".#"))
        path, kind, platform, package = output(target)
        if "--dry-run" in args:
            if state.get("dry_run_failure"):
                print("deliberate probe failure", file=sys.stderr)
                sys.exit(1)
            if not (state.get("checks_cached") or path.exists()):
                print("this derivation will be built", file=sys.stderr)
            print(json.dumps([{"outputs": {"out": str(path)}}]))
        else:
            if kind == "checks":
                assert version == "0.0.0-dev", version
                expected = "sha256:" + platform + ":example:0.0.0-dev"
                assert tags.get("example:0.0.0-dev") == expected, tags
                if state.get("check_failure"):
                    print("deliberate check failure", file=sys.stderr)
                    sys.exit(1)
            if kind == "packages" and state.get("artifact_failure") and version != "0.0.0-dev":
                print("deliberate artifact failure", file=sys.stderr)
                sys.exit(1)
            realize(path, kind, platform, package)
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
    assert args[:2] == ["image", "inspect"], args
    if state.get("environment_failure") or args[-1] not in tags:
        sys.exit(1)
    print(tags[args[-1]])
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
            # Real integration environments use fixed development image tags.
            "_dev-env-up:\n\t@docker image inspect example:0.0.0-dev >/dev/null\n"
        )
        (self.project / "project.nix").write_text(
            '{\n  version = "0.0.0-dev";\n  created = "1970-01-01T00:00:00Z";\n}\n'
        )
        self.original_metadata = (self.project / "project.nix").read_text()
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
        for key in ["MAKEFLAGS", "MFLAGS", "NIX_CACHE_ROOTS", "LOAD_DOCKER_IMAGE"]:
            self.env.pop(key, None)
        self.requested_version = "release-sha"
        self.build = True
        self.docker = True

    def resolve_env(self, value):
        bindings = {
            "${{ inputs.VERSION }}": self.requested_version,
            "${{ inputs.DOCKER }}": str(self.docker).lower(),
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

    def run_job(self, failure=None):
        self.run_step("Initialize Nix cache roots")
        names = {
            "Verify if checks need to run",
            "Start containers for integration tests",
            "Run checks",
            "Compute artifact version",
            "Record artifact cache roots",
            "Build artifact",
            "Build Docker image",
        }
        conditions = {
            "inputs.BUILD": lambda: self.build,
            "env.RUN_CHECKS == 'true'": lambda: self.env["RUN_CHECKS"] == "true",
            "steps.verify-checks.outputs.BUILD_NEEDED == 'yes'": lambda: (
                self.outputs.get("verify-checks", {}).get("BUILD_NEEDED") == "yes"
            ),
            "inputs.BUILD && inputs.DOCKER && runner.os != 'macOS'": lambda: (
                self.build and self.docker and self.env["RUNNER_OS"] != "macOS"
            ),
        }
        # Execute real run blocks in YAML order, respecting their actual gates.
        # Infrastructure/actions are validated separately, not executed here.
        for step in self.steps:
            if step["name"] not in names or not conditions[step["if"]]():
                continue
            result = self.run_step(step["name"], success=step["name"] != failure)
            if step["name"] == failure:
                return result
        self.assertIsNone(failure, f"Expected failure step was skipped: {failure}")
        return None

    def events(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def imports(self):
        return [args for name, args, _ in self.events() if name == "skopeo"]

    def assert_no_artifacts_or_stamp(self):
        self.assertEqual(
            (self.project / "project.nix").read_text(), self.original_metadata
        )
        self.assertNotIn("vars", self.outputs)
        for name in ["result-bin", "result-image", "result.zip"]:
            self.assertFalse((self.project / name).exists(), name)

    def test_ordering_and_publication_gates(self):
        expected = [
            "Verify if checks need to run",
            "Grant Nix builds access to the Docker socket",
            "Start containers for integration tests",
            "Run checks",
            "Compute artifact version",
            "Record artifact cache roots",
            "Build artifact",
            "Build Docker image",
            "Push artifact to artifact repository",
            "Push Docker image to artifact repository",
            "Store Nix cache",
        ]
        names = [step["name"] for step in self.steps]
        self.assertEqual([name for name in names if name in expected], expected)
        for name in [
            "Compute artifact version",
            "Record artifact cache roots",
            "Build artifact",
        ]:
            self.assertEqual(self.by_name[name]["if"], "inputs.BUILD")
        self.assertEqual(
            self.by_name["Verify if checks need to run"]["if"],
            "env.RUN_CHECKS == 'true'",
        )
        for name in [
            "Grant Nix builds access to the Docker socket",
            "Start containers for integration tests",
            "Run checks",
        ]:
            self.assertEqual(
                self.by_name[name]["if"],
                "steps.verify-checks.outputs.BUILD_NEEDED == 'yes'",
            )
        self.assertEqual(
            self.by_name["Push artifact to artifact repository"]["if"], "inputs.BUILD"
        )
        for name in ["Build Docker image", "Push Docker image to artifact repository"]:
            self.assertEqual(
                self.by_name[name]["if"],
                "inputs.BUILD && inputs.DOCKER && runner.os != 'macOS'",
            )
        self.assertEqual(
            self.by_name["Push Docker image to artifact repository"]["with"]["path"],
            "${{ inputs.PROJECT }}/result-image",
        )
        for name in ["Record artifact cache roots", "Build Docker image"]:
            self.assertEqual(self.by_name[name]["env"]["LOAD_DOCKER_IMAGE"], "false")
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

    def test_development_checks_precede_versioned_artifacts(self):
        self.requested_version = "v1.2.3/topic"
        self.run_job()
        version = self.outputs["vars"]["VERSION"]
        self.assertEqual(version, "1.2.3_topic")
        checks = [
            (args, value)
            for name, args, value in self.events()
            if name == "nix"
            and args[0] == "build"
            and any(arg.startswith(".#checks.") for arg in args)
        ]
        self.assertEqual(len(checks), 2)
        self.assertIn("--dry-run", checks[0][0])
        self.assertNotIn("--dry-run", checks[1][0])
        self.assertTrue(all(value == "0.0.0-dev" for _, value in checks))
        with zipfile.ZipFile(self.project / "result.zip") as archive:
            self.assertEqual(archive.read("result/bin/example"), b"binary-1.2.3_topic")
            self.assertFalse(
                any(name.startswith("result-bin") for name in archive.namelist())
            )
        self.assertEqual(
            json.loads((self.project / "result-image/manifest.json").read_text())[
                "version"
            ],
            version,
        )
        self.assertEqual(
            json.loads((self.project / "result-dev-env/manifest.json").read_text())[
                "version"
            ],
            "0.0.0-dev",
        )
        self.assertTrue((self.project / "result-check/passed").exists())
        self.assertNotIn('created = "1970-', (self.project / "project.nix").read_text())
        self.assertEqual(len(self.imports()), 1)
        self.assertEqual(
            set(json.loads(self.tags_file.read_text())), {"example:0.0.0-dev"}
        )
        roots = Path(self.env["NIX_CACHE_ROOTS"]).read_text()
        for root in [
            "0.0.0-dev-checks.drv",
            "0.0.0-dev-devShells.drv",
            "0.0.0-dev-image",
            version + "-packages.drv",
            version + "-image",
        ]:
            self.assertIn(root, roots)
        self.assertNotIn(version + "-checks.drv", roots)
        self.assertFalse((self.project / "result").exists())

    def test_dev_artifact_build_reuses_integration_image_and_binary(self):
        self.requested_version = "0.0.0-dev"
        self.run_job()
        self.assertEqual(
            (self.project / "project.nix").read_text(), self.original_metadata
        )
        self.assertEqual(
            (self.project / "result-image").resolve(),
            (self.project / "result-dev-env").resolve(),
        )
        for kind in ["image", "packages"]:
            self.assertEqual(
                sum(
                    name == "realize" and args[1] == kind
                    for name, args, _ in self.events()
                ),
                1,
            )
        self.assertEqual(len(self.imports()), 1)

    def test_binary_only_artifacts_can_still_prepare_an_image_for_checks(self):
        self.docker = False
        self.run_job()
        self.assertTrue((self.project / "result.zip").exists())
        self.assertFalse((self.project / "result-image").exists())
        self.assertTrue((self.project / "result-dev-env/manifest.json").exists())
        self.assertEqual(len(self.imports()), 1)

    def test_secondary_architecture_skips_checks_and_image_import(self):
        self.env.update(RUN_CHECKS="false", RUNNER_ARCH="X64", ARCH="x86_64")
        self.run_job()
        image = json.loads((self.project / "result-image/manifest.json").read_text())
        self.assertTrue(image["id"].startswith("sha256:x86_64-linux:"))
        self.assertEqual(self.outputs["vars"]["PLATFORM"], "linux-x86_64")
        self.assertNotIn("verify-checks", self.outputs)
        self.assertFalse((self.project / "result-dev-env").exists())
        self.assertEqual(self.imports(), [])
        self.assertEqual(json.loads(self.tags_file.read_text()), {})

    def test_build_only_release_does_not_import_image_or_evaluate_checks(self):
        self.env["RUN_CHECKS"] = "false"
        self.run_job()
        self.assertTrue((self.project / "result-image/manifest.json").exists())
        self.assertEqual(self.imports(), [])
        self.assertEqual(json.loads(self.tags_file.read_text()), {})
        self.assertFalse((self.project / "result-check").exists())
        self.assertNotIn("verify-checks", self.outputs)
        roots = Path(self.env["NIX_CACHE_ROOTS"]).read_text()
        self.assertNotIn("-checks.drv", roots)
        self.assertNotIn("-devShells.drv", roots)

    def test_cached_checks_build_artifacts_without_environment_or_import(self):
        self.state["checks_cached"] = True
        self.run_job()
        self.assertEqual(self.outputs["verify-checks"]["BUILD_NEEDED"], "no")
        self.assertTrue((self.project / "result.zip").exists())
        self.assertTrue((self.project / "result-image/manifest.json").exists())
        self.assertFalse((self.project / "result-dev-env").exists())
        self.assertFalse((self.project / "result-check").exists())
        self.assertEqual(self.imports(), [])
        self.assertEqual(json.loads(self.tags_file.read_text()), {})

    def test_failed_probe_does_not_report_a_cache_hit_or_stamp_artifacts(self):
        self.state["dry_run_failure"] = True
        result = self.run_job(failure="Verify if checks need to run")
        assert result is not None
        self.assertIn("deliberate probe failure", result.stderr)
        self.assertNotIn("BUILD_NEEDED", self.outputs["verify-checks"])
        self.assert_no_artifacts_or_stamp()
        self.assertTrue(Path(self.env["NIX_CACHE_ROOTS"]).is_file())

    def test_failed_checks_leave_dev_outputs_without_stamping_artifacts(self):
        self.state["check_failure"] = True
        result = self.run_job(failure="Run checks")
        assert result is not None
        self.assertIn("deliberate check failure", result.stderr)
        self.assert_no_artifacts_or_stamp()
        self.assertTrue((self.project / "result-dev-env/manifest.json").exists())
        self.assertIn("0.0.0-dev-image", Path(self.env["NIX_CACHE_ROOTS"]).read_text())

    def test_failed_environment_does_not_stamp_or_build_artifacts(self):
        self.state["environment_failure"] = True
        self.run_job(failure="Start containers for integration tests")
        self.assert_no_artifacts_or_stamp()
        self.assertFalse((self.project / "result-check").exists())

    def test_failed_artifact_build_retains_both_cache_graphs(self):
        self.state["artifact_failure"] = True
        self.run_job(failure="Build artifact")
        self.assertTrue((self.project / "result-check/passed").exists())
        self.assertFalse((self.project / "result.zip").exists())
        roots = Path(self.env["NIX_CACHE_ROOTS"]).read_text()
        self.assertIn("0.0.0-dev-checks.drv", roots)
        self.assertIn("0.0.0-dev-image", roots)
        self.assertIn("release-sha-packages.drv", roots)

    def test_check_only_job_does_not_stamp_or_package_artifacts(self):
        self.build = False
        self.run_job()
        self.assert_no_artifacts_or_stamp()
        self.assertTrue((self.project / "result-check/passed").exists())
        self.assertEqual(len(self.imports()), 1)

    def test_project_pre_check_hooks_run(self):
        with (self.project / "Makefile").open("a") as makefile:
            makefile.write("\n_check-pre:\n\t@touch pre-check-ran\n")
        self.run_job()
        self.assertTrue((self.project / "pre-check-ran").exists())
        self.assertTrue((self.project / "result-check/passed").exists())

    def test_failed_project_pre_check_stops_checks_and_artifacts(self):
        with (self.project / "Makefile").open("a") as makefile:
            makefile.write("\n_check-pre:\n\t@touch pre-check-ran\n\t@false\n")
        self.run_job(failure="Run checks")
        self.assertTrue((self.project / "pre-check-ran").exists())
        self.assertFalse((self.project / "result-check").exists())
        self.assert_no_artifacts_or_stamp()
        checks = [
            args
            for name, args, _ in self.events()
            if name == "nix"
            and args[0] == "build"
            and any(arg.startswith(".#checks.") for arg in args)
        ]
        self.assertEqual(len(checks), 1)
        self.assertIn("--dry-run", checks[0])

    def test_project_specific_evaluation_flags_are_preserved(self):
        with (self.project / "Makefile").open("a") as makefile:
            makefile.write("\nNIX_CHECK_EXTRA_ARGS=--impure\n")
        self.build = False
        self.run_job()
        commands = [
            args
            for name, args, _ in self.events()
            if name == "nix"
            and args[0] in {"path-info", "build"}
            and any(arg.startswith(".#checks.") for arg in args)
        ]
        self.assertEqual(len(commands), 3)
        for args in commands:
            self.assertIn("--impure", args)

    def run_make(self, *args):
        self.state_file.write_text(json.dumps(self.state))
        result = subprocess.run(
            ["make", *args],
            cwd=self.project,
            env=self.env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_auxiliary_images_keep_their_local_import(self):
        self.run_job()
        self.run_make(
            "build-docker-image", "NAME=auxiliary", "OUT_LINK=result-auxiliary"
        )
        self.assertEqual(len(self.imports()), 2)
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
        started = next(i for i, (name, _, _) in enumerate(events) if name == "docker")
        self.assertLess(loaded, started)

    def test_macos_build_only_does_not_evaluate_or_build_a_linux_image(self):
        self.env.update(RUN_CHECKS="false", RUNNER_OS="macOS", OS="darwin")
        self.run_job()
        self.assertEqual(self.outputs["vars"]["PLATFORM"], "macos-aarch64")
        self.assertTrue((self.project / "result.zip").exists())
        self.assertFalse((self.project / "result-image").exists())
        self.assertEqual(self.imports(), [])
        self.assertNotIn("-image", Path(self.env["NIX_CACHE_ROOTS"]).read_text())


if __name__ == "__main__":
    unittest.main()
