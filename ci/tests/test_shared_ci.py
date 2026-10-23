"""Portable shared CI interfaces, without cloud credentials or Docker access."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]


def load(path):
    return yaml.safe_load((REPO / path).read_text())


def workflow_inputs(workflow):
    return workflow.get("on", workflow.get(True))["workflow_call"]["inputs"]


class SharedInterfacesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.tools = self.directory / "tools"
        self.tools.mkdir()
        self.log = self.directory / "events.jsonl"
        self.env = {
            **os.environ,
            "PATH": str(self.tools) + os.pathsep + os.environ["PATH"],
            "TEST_LOG": str(self.log),
            "RUNNER_TEMP": str(self.directory),
        }

    def tool(self, name, body):
        path = self.tools / name
        path.write_text(f"#!{sys.executable}\n" + body)
        path.chmod(0o755)

    def execute(self, script, env):
        bash = shutil.which("bash")
        if bash is None:
            raise RuntimeError("bash is required by the shared CI checks")
        return subprocess.run(
            [bash, "-euo", "pipefail", "-c", script],
            env={**self.env, **env},
            cwd=self.directory,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_cache_target_defaults_and_workflow_forwarding(self):
        action = load(".github/actions/setup-nix/action.yml")
        inputs = action["inputs"]
        self.assertEqual(
            inputs["CACHE_TARGET"]["default"], ".#packages.{system}.nixops"
        )
        self.assertEqual(inputs["SKIP_CACHE_CHECK"]["default"], "false")
        workflow = load(".github/workflows/wf_check.yaml")
        defaults = workflow_inputs(workflow)
        self.assertEqual(
            defaults["CACHE_TARGET"]["default"], inputs["CACHE_TARGET"]["default"]
        )
        self.assertEqual(defaults["SKIP_CACHE_CHECK"]["type"], "boolean")
        self.assertIs(defaults["SKIP_CACHE_CHECK"]["default"], False)
        self.assertFalse(defaults["LOGIN_ECR"]["default"])
        steps = {step["name"]: step for step in workflow["jobs"]["tests"]["steps"]}
        self.assertEqual(
            steps["Setup Nix with Cache"]["with"]["CACHE_TARGET"],
            "${{ inputs.CACHE_TARGET }}",
        )
        self.assertEqual(
            steps["Setup Nix with Cache"]["with"]["SKIP_CACHE_CHECK"],
            "${{ inputs.SKIP_CACHE_CHECK }}",
        )
        self.assertEqual(
            steps["Login to Amazon ECR"]["if"],
            "inputs.LOGIN_ECR && env.RUN_CHECKS == 'true'",
        )
        self.assertIn("inputs.SKIP_CACHE_CHECK", action["runs"]["steps"][-1]["if"])

    def test_runner_matrix_uses_caller_labels_verbatim(self):
        workflow = load(".github/workflows/wf_check.yaml")
        defaults = workflow_inputs(workflow)
        self.assertEqual(defaults["RUNS_ON"]["type"], "string")
        self.assertEqual(
            json.loads(defaults["RUNS_ON"]["default"]),
            [
                "blacksmith-2vcpu-ubuntu-2404",
                "blacksmith-2vcpu-ubuntu-2404-arm",
            ],
        )
        for removed in ["ARCHS", "RUNNER", "RUNNER_SIZE", "CHECK_RUNNER_SIZE"]:
            self.assertNotIn(removed, defaults)
        job = workflow["jobs"]["tests"]
        self.assertEqual(
            job["strategy"]["matrix"],
            {"runner": "${{ fromJSON(inputs.RUNS_ON) }}"},
        )
        self.assertEqual(job["runs-on"], "${{ matrix.runner }}")
        self.assertEqual(
            " ".join(job["env"]["RUN_CHECKS"].split()),
            "${{ inputs.CHECKS && matrix.runner == fromJSON(inputs.RUNS_ON)[0] }}",
        )

    def test_artifact_platform_comes_from_the_actual_runner(self):
        workflow = load(".github/workflows/wf_check.yaml")
        step = next(
            step for step in workflow["jobs"]["tests"]["steps"]
            if step["name"] == "Compute artifact version"
        )
        output = self.directory / "github-output"
        for arch, runner_os, platform in [
            ("X64", "Linux", "linux-x86_64"),
            ("ARM64", "Linux", "linux-aarch64"),
            ("ARM64", "macOS", "macos-aarch64"),
        ]:
            with self.subTest(platform=platform):
                output.write_text("")
                result = self.execute(
                    step["run"],
                    {
                        "REQUESTED_VERSION": "0.0.0-dev",
                        "RUNNER_ARCH": arch,
                        "RUNNER_OS": runner_os,
                        "GITHUB_OUTPUT": str(output),
                    },
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                values = dict(
                    line.split("=", 1) for line in output.read_text().splitlines()
                )
                self.assertEqual(values["PLATFORM"], platform)

    def test_cache_probe_uses_native_target_and_preserves_failures(self):
        action = load(".github/actions/setup-nix/action.yml")
        script = action["runs"]["steps"][-1]["run"]
        self.tool("uname", "import os\nprint(os.environ['TEST_ARCH'])\n")
        self.tool(
            "nix",
            """import json, os, sys
from pathlib import Path
Path(os.environ['TEST_LOG']).write_text(json.dumps(sys.argv[1:]))
if os.environ['TEST_PROBE'] == 'failure':
    print('probe evaluation failed', file=sys.stderr)
    sys.exit(2)
if os.environ['TEST_PROBE'] == 'missing':
    print('this derivation will be built', file=sys.stderr)
""",
        )
        for arch, runner_os, system, target in [
            ("aarch64", "Linux", "aarch64-linux", ".#packages.{system}.nixops"),
            ("x86_64", "Linux", "x86_64-linux", ".#devShells.{system}.cache"),
            ("arm64", "macOS", "aarch64-darwin", ".#devShells.{system}.cache"),
        ]:
            for probe in ["cached", "missing", "failure"]:
                with self.subTest(system=system, probe=probe):
                    result = self.execute(
                        script,
                        {
                            "TEST_ARCH": arch,
                            "RUNNER_OS": runner_os,
                            "CACHE_TARGET": target,
                            "TEST_PROBE": probe,
                        },
                    )
                    self.assertEqual(
                        json.loads(self.log.read_text()),
                        ["build", "--dry-run", target.replace("{system}", system)],
                    )
                    self.assertEqual(
                        result.returncode == 0,
                        probe == "cached",
                        result.stdout + result.stderr,
                    )

    def test_publisher_defaults_and_architecture_selection(self):
        workflow = load(".github/workflows/wf_docker_push_image_ecr.yaml")
        defaults = workflow_inputs(workflow)
        self.assertEqual(
            json.loads(defaults["ARCHS"]["default"]), ["x86_64", "aarch64"]
        )
        self.assertEqual(defaults["AWS_REGION"]["default"], "eu-central-1")
        steps = {
            step["name"]: step for step in workflow["jobs"]["push-to-registry"]["steps"]
        }
        self.assertEqual(
            steps["Check out repository"]["with"]["ref"], "${{ inputs.GIT_REF }}"
        )
        script = steps["Push docker image to ECR"]["run"]
        recorder = """import json, os, sys
from pathlib import Path
with Path(os.environ['TEST_LOG']).open('a') as output:
    output.write(json.dumps([Path(sys.argv[0]).name, sys.argv[1:]]) + '\\n')
"""
        self.tool(
            "skopeo",
            """import sys
from pathlib import Path
source = next(arg[4:] for arg in sys.argv[1:] if arg.startswith('dir:'))
if not (Path(source) / 'manifest.json').is_file():
    sys.exit('missing image manifest: ' + source)
"""
            + recorder,
        )
        self.tool("docker", recorder)
        cases = [
            (["aarch64"], "flattened", ""),
            (["x86_64"], "flattened", ""),
            (["aarch64"], "nested", ""),
            (["x86_64", "aarch64"], "nested", ""),
            (["aarch64"], "flattened", "-variant"),
            (["x86_64", "aarch64"], "nested", "-variant"),
            ([], "nested", ""),
            (["unsupported"], "nested", ""),
        ]
        for index, (architectures, layout, suffix) in enumerate(cases):
            with self.subTest(
                architectures=architectures, layout=layout, suffix=suffix
            ):
                self.log.unlink(missing_ok=True)
                directory = self.directory / str(index)
                images = []
                for arch in architectures:
                    image = directory / "artifacts"
                    if layout == "nested":
                        image /= f"example-docker-image{suffix}-linux-{arch}-release-sha"
                    image.mkdir(parents=True, exist_ok=True)
                    (image / "manifest.json").write_text("{}\n")
                    images.append(image)
                result = self.execute(
                    script,
                    {
                        "NAME": "example",
                        "VERSION": "release-sha",
                        "CONTAINER_REGISTRY": "registry.example.test",
                        "ARTIFACT_SUFFIX": suffix,
                        "ARCHS": json.dumps(architectures),
                        "RUNNER_TEMP": str(directory),
                    },
                )
                if not architectures or "unsupported" in architectures:
                    self.assertNotEqual(result.returncode, 0)
                    self.assertFalse(self.log.exists())
                    continue
                self.assertEqual(result.returncode, 0, result.stderr)
                events = [
                    json.loads(line) for line in self.log.read_text().splitlines()
                ]
                copies = [args for name, args in events if name == "skopeo"]
                self.assertEqual(len(copies), len(architectures))
                for image, args in zip(images, copies, strict=True):
                    self.assertIn(f"dir:{image}", args)
                manifest = next(
                    args
                    for name, args in events
                    if name == "docker" and args[:2] == ["manifest", "create"]
                )
                self.assertEqual(manifest.count("--amend"), len(architectures))

    def test_publisher_rejects_missing_image_manifests(self):
        workflow = load(".github/workflows/wf_docker_push_image_ecr.yaml")
        script = next(
            step["run"]
            for step in workflow["jobs"]["push-to-registry"]["steps"]
            if step["name"] == "Push docker image to ECR"
        )
        for tool in ["skopeo", "docker"]:
            self.tool(tool, "raise AssertionError('must not publish missing images')\n")
        cases = [
            (["aarch64"], "missing"),
            (["aarch64"], "empty-nested"),
            (["x86_64", "aarch64"], "flattened"),
        ]
        for index, (architectures, layout) in enumerate(cases):
            with self.subTest(architectures=architectures, layout=layout):
                directory = self.directory / str(index)
                artifacts = directory / "artifacts"
                artifacts.mkdir(parents=True)
                if layout != "missing":
                    (artifacts / "manifest.json").write_text("{}\n")
                if layout == "empty-nested":
                    (
                        artifacts / "example-docker-image-linux-aarch64-release-sha"
                    ).mkdir()
                result = self.execute(
                    script,
                    {
                        "NAME": "example",
                        "VERSION": "release-sha",
                        "CONTAINER_REGISTRY": "registry.example.test",
                        "ARTIFACT_SUFFIX": "",
                        "ARCHS": json.dumps(architectures),
                        "RUNNER_TEMP": str(directory),
                    },
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("::error::Missing image manifest", result.stderr)
                self.assertNotIn("must not publish missing images", result.stderr)


if __name__ == "__main__":
    unittest.main()
