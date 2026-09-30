#!/usr/bin/env bash
# Fails when the frontend/backend CI matrix in
# .github/workflows/templates_checks.yaml does not build every template.
#
# The `frontend` and `backend` jobs take the templates they run against from
# their own `strategy.matrix.template` (or an `include:` entry naming one),
# not from discovering templates/*/ the way this repo's other guards do. A
# template landing without an entry in a job's matrix ships green there while
# that job runs zero times for it: never installed, never codegen-verified,
# never linted, never tested, never built (frontend), or never type-checked
# and never metadata-parsed (backend). check-agent-context.sh cannot see this
# gap - it verifies the duplicated agent-context Markdown, not what CI
# actually executes - so this is a separate check for a separate concern.
#
# Usage: ./templates/check-ci-matrix.sh
set -uo pipefail

cd "$(dirname "$0")/.." || exit 1

workflow_file=.github/workflows/templates_checks.yaml

if [ ! -f "$workflow_file" ]; then
    printf '::error::%s not found; the CI matrix cannot be checked.\n' "$workflow_file" >&2
    exit 1
fi

# The matrix lists template names as plain YAML scalars, in a flow sequence
# (`[a, b]`), a block sequence, or an `include:` entry - all of which parse
# identically to a real YAML reader and none of which a line-oriented
# extractor can be trusted to recognize uniformly. PyYAML is not optional
# tooling introduced here: the `backend` job in this same workflow already
# imports it to parse metadata, so failing loudly rather than skipping is
# what keeps this guard from becoming the thing it is meant to prevent.
if ! python3 -c 'import yaml' 2>/dev/null; then
    printf '::error::python3 -c "import yaml" failed; PyYAML is required to parse %s. Install it (the %s job in this workflow already depends on it) rather than skipping this check.\n' "$workflow_file" "backend" >&2
    exit 1
fi

templates=()
for template in templates/*/; do
    template=${template%/}
    [ -f "$template/frontend/package.json" ] || continue
    templates+=("${template#templates/}")
done

if [ ${#templates[@]} -eq 0 ]; then
    printf '::error::no templates found under templates/*/; this guard checked nothing.\n' >&2
    exit 1
fi

# The jobs required to carry a per-template matrix, named explicitly rather
# than inferred from the workflow's job list. `agent-context` discovers
# templates itself and has no matrix at all, so it must not be assumed to
# need one just because it is a job in this file.
matrix_jobs=(frontend backend)

python3 - "$workflow_file" "${matrix_jobs[@]}" -- "${templates[@]}" <<'PY'
import sys

import yaml

args = sys.argv[1:]
workflow_file = args[0]
sep = args.index("--")
matrix_jobs = args[1:sep]
templates = args[sep + 1 :]

with open(workflow_file, encoding="utf-8") as fh:
    try:
        doc = yaml.safe_load(fh)
    except yaml.YAMLError as err:
        print(f"::error file={workflow_file}::{err}")
        sys.exit(1)

jobs = (doc or {}).get("jobs") or {}
failed = False

for job_name in matrix_jobs:
    job = jobs.get(job_name)
    if job is None:
        print(
            f"::error::`{job_name}` is not a job in {workflow_file}; it may "
            "have been renamed, and this guard's matrix_jobs list needs "
            "updating to match."
        )
        failed = True
        continue

    matrix = (job.get("strategy") or {}).get("matrix") or {}
    covered = set()

    tmpl = matrix.get("template")
    if isinstance(tmpl, list):
        covered.update(str(t) for t in tmpl)

    for entry in matrix.get("include") or []:
        if isinstance(entry, dict) and "template" in entry:
            covered.add(str(entry["template"]))

    if not covered:
        print(
            f"::error::the `{job_name}` job's strategy.matrix has no "
            f"template entries in {workflow_file}; it would run for no "
            "template."
        )
        failed = True
        continue

    for template in templates:
        if template not in covered:
            print(
                f"::error::{template} ships a frontend, but the "
                f"`{job_name}` job's strategy.matrix.template in "
                f"{workflow_file} does not include it; it would be skipped "
                "by that job."
            )
            failed = True

if not failed:
    print(
        "templates: CI matrix builds every template in "
        f"{', '.join(matrix_jobs)} ({len(templates)} template(s), "
        f"{len(matrix_jobs)} job(s) checked)"
    )

sys.exit(1 if failed else 0)
PY
