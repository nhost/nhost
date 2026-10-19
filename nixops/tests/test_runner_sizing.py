"""Keep cheap orchestration separate from compilation and integration workloads."""

import re
import unittest

from test_ci_contracts import REPO, WORKFLOWS, load, triggers

SIZES = {"1c1g", "2c2g", "2c4g", "4c8g", "8c16g", "16c32g"}


def job(workflow, name):
    return load(WORKFLOWS / workflow)["jobs"][name]


def inputs(workflow):
    return triggers(load(WORKFLOWS / workflow))["workflow_call"]["inputs"]


class RunnerSizingTests(unittest.TestCase):
    def test_available_tiers_and_all_selected_sizes_are_valid(self):
        labels = load(REPO / ".github/actionlint.yaml")["self-hosted-runner"]["labels"]
        self.assertEqual(
            set(labels),
            {
                f"nhost-{arch}-{size}"
                for arch in ["aarch64", "x86_64"]
                for size in SIZES
            },
        )
        for path in WORKFLOWS.glob("*"):
            for current in load(path)["jobs"].values():
                for key in ["RUNNER_SIZE", "CHECK_RUNNER_SIZE"]:
                    size = current.get("with", {}).get(key)
                    if size:
                        self.assertIn(size, SIZES, path.name)

    def test_api_metadata_and_transfer_jobs_use_the_smallest_tier(self):
        for path in WORKFLOWS.glob("*"):
            for name, current in load(path)["jobs"].items():
                if "uses" in current:
                    continue
                if name in {"check-permissions", "detect", "final-status", "bump-refs"}:
                    self.assertEqual(
                        current["runs-on"], "nhost-aarch64-1c1g", path.name
                    )
        for workflow, name in [
            ("ci_release.yaml", "extract-project"),
            ("ci_create_release.yaml", "create-release"),
            ("ci_update_changelog.yaml", "update-changelog"),
            ("wf_docker_push_image.yaml", "push-to-registry"),
            ("wf_docker_push_image_ecr.yaml", "push-to-registry"),
            ("mcp_wf_release.yaml", "publish-mcp-registry"),
        ]:
            with self.subTest(workflow=workflow):
                self.assertEqual(job(workflow, name)["runs-on"], "nhost-aarch64-1c1g")

    def test_shared_workflow_only_upsizes_the_leg_that_runs_checks(self):
        defaults = inputs("wf_check.yaml")
        self.assertEqual(defaults["RUNNER_SIZE"]["default"], "2c4g")
        self.assertEqual(defaults["CHECK_RUNNER_SIZE"]["default"], "")
        actual = job("wf_check.yaml", "tests")["runs-on"]
        expected = """${{ inputs.RUNNER || format('nhost-{0}-{1}',
          matrix.platform == 'native' && fromJSON(inputs.ARCHS)[0] ||
          matrix.platform,
          (inputs.CHECKS &&
            (!inputs.BUILD || matrix.platform == fromJSON(inputs.ARCHS)[0]) &&
            inputs.CHECK_RUNNER_SIZE) || inputs.RUNNER_SIZE) }}"""
        self.assertEqual(re.sub(r"\s+", " ", actual), re.sub(r"\s+", " ", expected))
        for project in ["ai", "auth", "cli", "constellation", "storage", "functions"]:
            with self.subTest(project=project):
                settings = job(project + "_checks.yaml", "tests")["with"]
                self.assertEqual(settings["CHECK_RUNNER_SIZE"], "4c8g")
                self.assertIn(settings.get("RUNNER_SIZE", "2c4g"), {"2c2g", "2c4g"})

    def test_release_builds_do_not_inherit_integration_test_sizes(self):
        expected = {
            "ai": "2c4g",
            "auth": "2c4g",
            "cli": "2c4g",
            "constellation": "2c4g",
            "mcp": "2c4g",
            "storage": "2c4g",
            "functions": "2c2g",
            "nixops": "2c2g",
            # These build Next.js or PostgreSQL/native extensions, not just tags.
            "dashboard": "4c8g",
            "postgres": "4c8g",
        }
        for project, size in expected.items():
            with self.subTest(project=project):
                settings = job(project + "_wf_release.yaml", "build_artifacts")["with"]
                self.assertFalse(settings["CHECKS"])
                self.assertEqual(settings.get("RUNNER_SIZE", "2c4g"), size)
        self.assertEqual(
            job("cli_wf_release.yaml", "build-multiplatform")["runs-on"],
            "nhost-x86_64-2c4g",
        )

    def test_frontend_builds_and_browser_suites_are_sized_separately(self):
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
        self.assertIn("matrix.runner-size", e2e["runs-on"])

    def test_analysis_and_cache_warming_keep_workload_specific_headroom(self):
        for workflow, name, runner in [
            ("ci_betterleaks.yaml", "scan", "nhost-aarch64-2c2g"),
            ("gen_nhost_code_review.yaml", "nhost-code-review", "nhost-aarch64-2c4g"),
            ("gen_schedule_update_deps.yaml", "run", "nhost-aarch64-8c16g"),
            ("gen_security_updates.yaml", "run", "nhost-aarch64-2c4g"),
            ("gen_codeql-analysis.yml", "analyze", "nhost-x86_64-4c8g"),
        ]:
            with self.subTest(workflow=workflow):
                self.assertEqual(job(workflow, name)["runs-on"], runner)
        self.assertEqual(
            job("gen_schedule_update_deps.yaml", "run")["timeout-minutes"], 240
        )
        self.assertEqual(
            job("nixops_checks.yaml", "tests")["with"]["RUNNER_SIZE"], "8c16g"
        )
        self.assertEqual(
            job("postgres_checks.yaml", "tests")["with"]["RUNNER_SIZE"], "4c8g"
        )


if __name__ == "__main__":
    unittest.main()
