"""Validate caller-owned runner lists and workload-specific CI capacity."""

import json
import unittest

from test_ci_contracts import REPO, WORKFLOWS, load, triggers

DEFAULT_RUNNERS = [
    "blacksmith-4vcpu-ubuntu-2404-arm",
    "blacksmith-2vcpu-ubuntu-2404",
]
HEAVY_BUILD_RUNNERS = [
    "blacksmith-32vcpu-ubuntu-2404-arm",
    "blacksmith-8vcpu-ubuntu-2404",
]


def job(workflow, name):
    return load(WORKFLOWS / workflow)["jobs"][name]


def inputs(workflow):
    return triggers(load(WORKFLOWS / workflow))["workflow_call"]["inputs"]


def runners(workflow, name):
    default = inputs("wf_check.yaml")["RUNS_ON"]["default"]
    return json.loads(job(workflow, name)["with"].get("RUNS_ON", default))


class RunnerSizingTests(unittest.TestCase):
    def test_shared_check_callers_select_literal_runner_lists(self):
        labels = load(REPO / ".github/actionlint.yaml")["self-hosted-runner"]["labels"]
        self.assertEqual(
            set(labels),
            {
                *DEFAULT_RUNNERS,
                *HEAVY_BUILD_RUNNERS,
                "blacksmith-2vcpu-ubuntu-2404-arm",
                "blacksmith-6vcpu-macos-latest",
            },
        )
        default = inputs("wf_check.yaml")["RUNS_ON"]["default"]
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
                    selected = json.loads(settings.get("RUNS_ON", default))
                    self.assertIsInstance(selected, list)
                    self.assertTrue(selected)
                    self.assertEqual(len(selected), len(set(selected)))
                    for runner in selected:
                        self.assertIn(runner, labels)
                    if not settings.get("BUILD", False):
                        self.assertIn("RUNS_ON", settings)
                        self.assertEqual(selected, ["blacksmith-2vcpu-ubuntu-2404"])

    def test_api_metadata_and_transfer_jobs_keep_original_runners(self):
        expected = {
            "check-permissions": "ubuntu-latest",
            "detect": "ubuntu-latest",
            "final-status": "blacksmith-2vcpu-ubuntu-2404",
            "bump-refs": "blacksmith-2vcpu-ubuntu-2404",
        }
        for path in WORKFLOWS.glob("*"):
            for name, current in load(path)["jobs"].items():
                if "uses" in current:
                    continue
                if name in expected:
                    self.assertEqual(current["runs-on"], expected[name], path.name)
        for workflow, name, runner in [
            ("ci_release.yaml", "extract-project", "blacksmith-2vcpu-ubuntu-2404"),
            ("ci_create_release.yaml", "create-release", "blacksmith-2vcpu-ubuntu-2404"),
            ("ci_update_changelog.yaml", "update-changelog", "blacksmith-2vcpu-ubuntu-2404"),
            ("wf_docker_push_image.yaml", "push-to-registry", "ubuntu-latest"),
            ("wf_docker_push_image_ecr.yaml", "push-to-registry", "ubuntu-latest"),
            ("mcp_wf_release.yaml", "publish-mcp-registry", "ubuntu-latest"),
        ]:
            with self.subTest(workflow=workflow):
                self.assertEqual(job(workflow, name)["runs-on"], runner)

    def test_project_builds_keep_main_runner_sizes(self):
        for project in [
            "ai", "auth", "cli", "constellation", "storage", "functions", "nhost-js",
            "mcp", "codegen", "configdocs", "ghactivity", "govulncheck-wrapper",
            "stripe-graphql-js",
        ]:
            with self.subTest(project=project):
                self.assertEqual(
                    runners(project + "_checks.yaml", "tests"), DEFAULT_RUNNERS
                )

    def test_release_builds_keep_main_default_sizes(self):
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
            "blacksmith-2vcpu-ubuntu-2404",
        )

    def test_frontend_builds_and_browser_suites_are_sized_separately(self):
        for project in [
            "dashboard", "examples_demos", "examples_guides", "examples_tutorials"
        ]:
            with self.subTest(project=project):
                self.assertEqual(
                    runners(project + "_checks.yaml", "tests"),
                    ["blacksmith-2vcpu-ubuntu-2404"],
                )
        self.assertEqual(
            inputs("wf_deploy_vercel.yaml")["RUNNER_SIZE"]["default"], "2c4g"
        )
        for path in WORKFLOWS.glob("*"):
            for current in load(path)["jobs"].values():
                if current.get("uses") == "./.github/workflows/wf_deploy_vercel.yaml":
                    settings = current["with"]
                    expected = "4c8g" if settings["NAME"] == "dashboard" else "2c4g"
                    self.assertEqual(settings.get("RUNNER_SIZE", "2c4g"), expected)
        e2e = job("dashboard_wf_e2e_staging.yaml", "tests")
        self.assertEqual(
            {
                suite["suite"]: suite["runner-size"]
                for suite in e2e["strategy"]["matrix"]["include"]
            },
            {"main": "2c4g", "onboarding": "2c4g", "local": "4c8g"},
        )
        self.assertEqual(e2e["runs-on"], "blacksmith-2vcpu-ubuntu-2404")

    def test_analysis_and_cache_warming_keep_workload_specific_runners(self):
        for workflow, name, runner in [
            ("ci_betterleaks.yaml", "scan", "blacksmith-2vcpu-ubuntu-2404"),
            (
                "gen_nhost_code_review.yaml",
                "nhost-code-review",
                "blacksmith-2vcpu-ubuntu-2404-arm",
            ),
            ("gen_schedule_update_deps.yaml", "run", "ubuntu-latest"),
            ("gen_security_updates.yaml", "run", "blacksmith-2vcpu-ubuntu-2404"),
            ("gen_codeql-analysis.yml", "analyze", "ubuntu-latest"),
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
            runners("nixops_checks.yaml", "cache-macos"),
            ["blacksmith-6vcpu-macos-latest"],
        )


if __name__ == "__main__":
    unittest.main()
