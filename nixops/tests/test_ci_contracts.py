"""Offline checks for callers, native runners, and repository-specific variants."""

import json
import subprocess
import unittest
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
WORKFLOWS = REPO / ".github/workflows"


def load(path):
    return yaml.safe_load(path.read_text())


def triggers(workflow):
    # PyYAML's YAML 1.1 loader interprets the Actions `on` key as a boolean.
    return workflow.get("on", workflow.get(True, {}))


class ContractsTests(unittest.TestCase):
    def test_all_local_workflow_and_action_inputs_are_valid(self):
        for path in sorted(WORKFLOWS.glob("*")):
            workflow = load(path)
            for job in workflow["jobs"].values():
                calls = [job] if "uses" in job else job.get("steps", [])
                for call in calls:
                    target = call.get("uses", "")
                    if not target.startswith("./"):
                        continue
                    with self.subTest(workflow=path.name, target=target):
                        local = REPO / target
                        if local.is_dir():
                            local = next(local.glob("action.y*ml"))
                            inputs = load(local).get("inputs", {})
                        else:
                            inputs = triggers(load(local))["workflow_call"].get(
                                "inputs", {}
                            )
                        supplied = call.get("with", {})
                        self.assertFalse(set(supplied) - set(inputs))
                        for name, specification in inputs.items():
                            if specification.get("required"):
                                self.assertIn(name, supplied)

    def test_secret_bearing_pr_checks_preserve_approval_and_exact_sha(self):
        for path in WORKFLOWS.glob("*checks.yaml"):
            workflow = load(path)
            if "pull_request_target" not in triggers(workflow):
                continue
            for job in workflow["jobs"].values():
                if job.get("uses") != "./.github/workflows/wf_check.yaml":
                    continue
                with self.subTest(workflow=path.name):
                    self.assertIn("check-permissions", job["needs"])
                    self.assertIn(
                        "github.event.pull_request.head.sha", job["with"]["GIT_REF"]
                    )
                    self.assertNotIn("refs/pull/", job["with"]["GIT_REF"])

    def test_runner_and_artifact_contracts(self):
        for path in WORKFLOWS.glob("*"):
            text = path.read_text()
            self.assertNotIn("blacksmith-", text, path.name)
            self.assertNotIn("wf_build_artifacts.yaml", text, path.name)
            self.assertNotIn("/home/runner", text, path.name)
            for name, job in load(path)["jobs"].items():
                runner = job.get("runs-on", "")
                if not runner or "${{" in runner:
                    continue
                if (path.name, name) in {
                    ("cli_wf_release.yaml", "publish-npm"),
                    ("wf_release_npm.yaml", "release"),
                }:
                    self.assertEqual(runner, "ubuntu-latest")
                else:
                    self.assertRegex(runner, r"^nhost-(aarch64|x86_64)-\d+c\d+g$")
        inputs = triggers(load(WORKFLOWS / "wf_check.yaml"))["workflow_call"]["inputs"]
        self.assertEqual(json.loads(inputs["ARCHS"]["default"]), ["aarch64", "x86_64"])
        mac = load(WORKFLOWS / "nixops_checks.yaml")["jobs"]["cache-macos"]["with"]
        self.assertEqual(mac["RUNNER"], "macos-15")
        self.assertFalse(mac["CHECKS"])
        self.assertFalse(mac["DOCKER"])

    def test_variants_and_release_build_only_calls_are_preserved(self):
        functions = load(WORKFLOWS / "functions_checks.yaml")["jobs"]["tests"]
        self.assertEqual(functions["strategy"]["matrix"]["node"], ["22", "24", "26"])
        self.assertEqual(functions["with"]["CHECKS"], "${{ matrix.node == '22' }}")
        postgres = load(WORKFLOWS / "postgres_checks.yaml")["jobs"]["tests"]
        self.assertEqual(postgres["strategy"]["matrix"]["postgresql"], ["17", "18"])
        for path in WORKFLOWS.glob("*wf_release.yaml"):
            for job in load(path)["jobs"].values():
                if job.get("uses") == "./.github/workflows/wf_check.yaml":
                    with self.subTest(workflow=path.name):
                        self.assertTrue(job["with"]["BUILD"])
                        self.assertFalse(job["with"]["CHECKS"])

    def test_shared_action_changes_trigger_pr_and_merge_queue_checks(self):
        for path in WORKFLOWS.glob("*checks.yaml"):
            workflow = load(path)
            if not any(
                job.get("uses") == "./.github/workflows/wf_check.yaml"
                for job in workflow["jobs"].values()
            ):
                continue
            with self.subTest(workflow=path.name):
                paths = triggers(workflow)["pull_request_target"]["paths"]
                for action in ["setup-nix", "cache-nix"]:
                    self.assertIn(f".github/actions/{action}/**", paths)
                    detect = workflow["jobs"].get("detect-changes")
                    if detect:
                        self.assertIn(
                            f".github/actions/{action}/**",
                            detect["with"]["patterns"].splitlines(),
                        )

    def test_variant_makefiles_use_shared_out_links_and_cache_roots(self):
        for project, variable, expected in [
            ("functions", "NODE_VERSION=24", "functions-node24-docker-image"),
            ("postgres", "POSTGRES_VERSION=17", "postgres-pg17-as-dir"),
            ("postgres", "POSTGRES_VERSION=18", "postgres-pg18-as-dir"),
        ]:
            with self.subTest(project=project, variable=variable):
                result = subprocess.run(
                    [
                        "make",
                        "-n",
                        "--no-print-directory",
                        "-C",
                        str(REPO / "services" / project),
                        "cache-build-roots",
                        "cache-image-roots",
                        "build-docker-image",
                        "ARCH=aarch64",
                        "VER=0.0.0-dev",
                        variable,
                        "POSTGRES_FULL_VERSION=18.3",
                        "OUT_LINK=result-image",
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(expected, result.stdout)
                self.assertIn('--out-link "result-image"', result.stdout)
                self.assertIn('"dir:result-image"', result.stdout)
                if project == "postgres":
                    self.assertIn("postgres-pg" + variable[-2:], result.stdout)


if __name__ == "__main__":
    unittest.main()
