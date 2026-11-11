"""Validate supported Nhost fleets and workload-specific CI capacity."""

import json
import unittest

from test_ci_contracts import REPO, WORKFLOWS, load, triggers

RUNNER_PROFILES = ["1c1g", "2c2g", "2c4g", "4c8g", "8c16g", "16c32g"]
LINUX_RUNNERS = {
    f"nhost-{arch}-{profile}"
    for arch in ["aarch64", "x86_64"]
    for profile in RUNNER_PROFILES
}
MACOS_RUNNER = "blacksmith-6vcpu-macos-latest"
DEFAULT_RUNNERS = ["nhost-aarch64-4c8g", "nhost-x86_64-4c8g"]
HEAVY_BUILD_RUNNERS = ["nhost-aarch64-16c32g", "nhost-x86_64-8c16g"]
NPM_JOBS = {
    ("cli_wf_release.yaml", "publish-npm"),
    ("wf_release_npm.yaml", "release"),
}
DYNAMIC_RUNNERS = {
    ("wf_check.yaml", "tests"): "${{ matrix.runner }}",
    ("wf_deploy_vercel.yaml", "deploy-vercel"): "${{ inputs.RUNS_ON }}",
    ("dashboard_wf_e2e_staging.yaml", "tests"): "${{ matrix.runner }}",
}


def job(workflow, name):
    return load(WORKFLOWS / workflow)["jobs"][name]


def inputs(workflow):
    return triggers(load(WORKFLOWS / workflow))["workflow_call"]["inputs"]


def runners(workflow, name):
    return json.loads(job(workflow, name)["with"]["RUNS_ON"])


class RunnerSizingTests(unittest.TestCase):
    def test_supported_labels_match_the_twelve_linux_fleets_and_macos(self):
        labels = load(REPO / ".github/actionlint.yaml")["self-hosted-runner"]["labels"]
        self.assertEqual(set(labels), LINUX_RUNNERS | {MACOS_RUNNER})
        self.assertEqual(len(labels), len(set(labels)))

    def test_all_jobs_use_supported_runners_with_only_npm_hosted_exceptions(self):
        for path in WORKFLOWS.glob("*"):
            for name, current in load(path)["jobs"].items():
                if "uses" in current:
                    continue
                with self.subTest(workflow=path.name, job=name):
                    # NixOS runner Node helpers cannot run inside job containers.
                    self.assertNotIn("container", current)
                    runner = current["runs-on"]
                    key = (path.name, name)
                    if key in NPM_JOBS:
                        self.assertEqual(runner, "ubuntu-latest")
                    elif key in DYNAMIC_RUNNERS:
                        self.assertEqual(runner, DYNAMIC_RUNNERS[key])
                    else:
                        self.assertIn(runner, LINUX_RUNNERS | {MACOS_RUNNER})

    def test_shared_check_callers_select_explicit_unique_platforms(self):
        default = inputs("wf_check.yaml")["RUNS_ON"]["default"]
        self.assertEqual(json.loads(default), DEFAULT_RUNNERS)
        for path in WORKFLOWS.glob("*"):
            for name, current in load(path)["jobs"].items():
                if current.get("uses") != "./.github/workflows/wf_check.yaml":
                    continue
                with self.subTest(workflow=path.name, job=name):
                    settings = current["with"]
                    for removed in [
                        "ARCHS", "RUNNER", "RUNNER_SIZE", "CHECK_RUNNER_SIZE"
                    ]:
                        self.assertNotIn(removed, settings)
                    self.assertIn("RUNS_ON", settings)
                    selected = json.loads(settings["RUNS_ON"])
                    self.assertIsInstance(selected, list)
                    self.assertTrue(selected)
                    # One runner per OS/architecture keeps artifact names unique.
                    platforms = [runner.rsplit("-", 1)[0] for runner in selected]
                    self.assertEqual(len(platforms), len(set(platforms)))
                    for runner in selected:
                        self.assertIn(runner, LINUX_RUNNERS | {MACOS_RUNNER})
                    if not settings.get("BUILD", False):
                        self.assertEqual(selected, ["nhost-aarch64-4c8g"])

    def test_api_metadata_and_transfer_jobs_use_small_arm_fleets(self):
        expected = {
            "check-permissions", "detect", "final-status", "bump-refs",
            "extract-project", "approve", "label-external", "push-to-registry",
            "publish-mcp-registry",
        }
        for path in WORKFLOWS.glob("*"):
            for name, current in load(path)["jobs"].items():
                if "uses" not in current and name in expected:
                    with self.subTest(workflow=path.name, job=name):
                        self.assertEqual(current["runs-on"], "nhost-aarch64-1c1g")
        for workflow, name in [
            ("ci_create_release.yaml", "create-release"),
            ("ci_update_changelog.yaml", "update-changelog"),
        ]:
            with self.subTest(workflow=workflow):
                self.assertEqual(job(workflow, name)["runs-on"], "nhost-aarch64-2c2g")

    def test_project_builds_keep_both_native_linux_architectures(self):
        for project in [
            "ai", "auth", "cli", "constellation", "storage", "functions", "nhost-js",
            "mcp", "codegen", "configdocs", "ghactivity", "govulncheck-wrapper",
            "stripe-graphql-js",
        ]:
            with self.subTest(project=project):
                self.assertEqual(
                    runners(project + "_checks.yaml", "tests"), DEFAULT_RUNNERS
                )

    def test_release_builds_keep_both_native_linux_architectures(self):
        for project in [
            "ai", "auth", "cli", "constellation", "mcp", "storage", "functions",
            "dashboard", "nixops", "postgres",
        ]:
            with self.subTest(project=project):
                workflow = project + "_wf_release.yaml"
                self.assertFalse(job(workflow, "build_artifacts")["with"]["CHECKS"])
                self.assertEqual(runners(workflow, "build_artifacts"), DEFAULT_RUNNERS)
        self.assertEqual(
            job("cli_wf_release.yaml", "build-multiplatform")["runs-on"],
            "nhost-aarch64-4c8g",
        )

    def test_frontend_builds_use_explicit_runner_labels(self):
        for project in [
            "dashboard", "examples_demos", "examples_guides", "examples_tutorials"
        ]:
            with self.subTest(project=project):
                self.assertEqual(
                    runners(project + "_checks.yaml", "tests"),
                    ["nhost-x86_64-4c8g"],
                )

    def test_vercel_callers_pass_full_runner_labels(self):
        declared = inputs("wf_deploy_vercel.yaml")
        self.assertNotIn("RUNNER_SIZE", declared)
        self.assertEqual(declared["RUNS_ON"]["type"], "string")
        self.assertTrue(declared["RUNS_ON"]["required"])
        self.assertNotIn("default", declared["RUNS_ON"])
        for path in WORKFLOWS.glob("*"):
            for name, current in load(path)["jobs"].items():
                if current.get("uses") != "./.github/workflows/wf_deploy_vercel.yaml":
                    continue
                with self.subTest(workflow=path.name, job=name):
                    settings = current["with"]
                    self.assertNotIn("RUNNER_SIZE", settings)
                    selected = settings["RUNS_ON"]
                    expected = (
                        "nhost-x86_64-4c8g" if settings["NAME"] == "dashboard"
                        else "nhost-x86_64-2c4g"
                    )
                    self.assertEqual(selected, expected)
                    self.assertIn(selected, LINUX_RUNNERS)

    def test_browser_suites_select_full_runner_labels(self):
        e2e = job("dashboard_wf_e2e_staging.yaml", "tests")
        suites = e2e["strategy"]["matrix"]["include"]
        self.assertEqual(
            {suite["suite"]: suite["runner"] for suite in suites},
            {
                "main": "nhost-x86_64-2c4g",
                "onboarding": "nhost-x86_64-2c4g",
                "local": "nhost-x86_64-4c8g",
            },
        )
        for suite in suites:
            self.assertNotIn("runner-size", suite)
            self.assertIn(suite["runner"], LINUX_RUNNERS)

    def test_cli_artifact_consumer_stays_on_x86_64(self):
        current = job("cli_wf_test_new_project.yaml", "tests")
        self.assertEqual(current["runs-on"], "nhost-x86_64-4c8g")
        scripts = "\n".join(step.get("run", "") for step in current["steps"])
        self.assertIn("cli-docker-image-linux-x86_64-0.0.0-dev", scripts)
        self.assertIn("cli-artifact-linux-x86_64-0.0.0-dev", scripts)

    def test_analysis_and_cache_warming_use_workload_specific_fleets(self):
        for workflow, name, runner in [
            ("ci_betterleaks.yaml", "scan", "nhost-aarch64-2c2g"),
            ("gen_nhost_code_review.yaml", "nhost-code-review", "nhost-aarch64-4c8g"),
            ("gen_schedule_update_deps.yaml", "run", "nhost-aarch64-2c2g"),
            ("gen_security_updates.yaml", "run", "nhost-aarch64-2c2g"),
            ("gen_codeql-analysis.yml", "analyze", "nhost-x86_64-8c16g"),
        ]:
            with self.subTest(workflow=workflow):
                self.assertEqual(job(workflow, name)["runs-on"], runner)
        self.assertEqual(
            job("gen_schedule_update_deps.yaml", "run")["timeout-minutes"], 240
        )
        for project in ["nixops", "postgres"]:
            with self.subTest(project=project):
                self.assertEqual(
                    runners(project + "_checks.yaml", "tests"), HEAVY_BUILD_RUNNERS
                )
        self.assertEqual(
            runners("nixops_checks.yaml", "cache-macos"), [MACOS_RUNNER]
        )


if __name__ == "__main__":
    unittest.main()
