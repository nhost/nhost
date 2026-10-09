#!/usr/bin/env bash
# Fails when the CI matrix in .github/workflows/templates_checks.yaml does not
# build every template, delete-proof every sign-in method, or build every UI
# and navigation system, or names one that does not exist.
#
# The jobs take what they run against from their own `strategy.matrix`, not
# from discovering templates/*/ the way this repo's other guards do. A template,
# a method directory under the template's own auth/, a UI system under ui/ or a
# navigation system under navigation/ landing without a matching combination
# ships green while CI runs zero times for it: never installed, never linted, never tested, never built, and never
# proven to survive deleting a sign-in method. check-agent-context.sh cannot
# see this gap - it verifies the duplicated agent-context Markdown, not what CI
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

# The matrix lists its values as plain YAML scalars, in a flow sequence
# (`[a, b]`), a block sequence, or an `include:` entry - all of which parse
# identically to a real YAML reader and none of which a line-oriented
# extractor can be trusted to recognize uniformly. PyYAML ships on the GitHub
# runner image; failing loudly rather than skipping is what keeps this guard
# from becoming the thing it is meant to prevent.
if ! python3 -c 'import yaml' 2>/dev/null; then
	printf '::error::python3 -c "import yaml" failed; PyYAML is required to parse %s. Install it rather than skipping this check.\n' "$workflow_file" >&2
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

python3 - "$workflow_file" "${templates[@]}" <<'PY'
import itertools
import os
import sys

import yaml

workflow_file = sys.argv[1]
templates = sys.argv[2:]


def subdirs(path):
    if not os.path.isdir(path):
        return []
    return sorted(
        e.name for e in os.scandir(path) if e.is_dir() and not e.name.startswith(".")
    )


def auth_dir(template):
    """Where a template keeps its sign-in method directories.

    A framework decides its own layout: the App Router's is src/app/auth, and
    nothing says the next template's will be. Naming one here would make this
    guard silently check nothing for every other template, which is the exact
    failure it exists to prevent, so the directory is found rather than named.
    """
    root = f"templates/{template}/frontend/src"
    matches = [
        os.path.join(dirpath, name)
        for dirpath, dirnames, _ in os.walk(root)
        for name in dirnames
        if name == "auth"
    ]

    if len(matches) != 1:
        print(
            f"::error::expected exactly one `auth` directory under {root}, "
            f"found {len(matches)}: {', '.join(sorted(matches)) or 'none'}. "
            "This guard cannot tell which holds the sign-in methods."
        )
        return None

    return matches[0]


auth_dirs = {t: auth_dir(t) for t in templates}

if any(d is None for d in auth_dirs.values()):
    sys.exit(1)


# Each job, named explicitly rather than inferred from the workflow's job list,
# with the axes its matrix must cover and every combination of them that exists
# on disk. `agent-context` discovers templates itself and has no matrix at all,
# so it must not be assumed to need one just because it is a job in this file.
required = {
    "frontend": (("template",), {(t,) for t in templates}),
    "delete-method": (
        ("template", "method"),
        {(t, m) for t in templates for m in subdirs(auth_dirs[t])},
    ),
    "ui-system": (
        ("template", "ui"),
        {(t, u) for t in templates for u in subdirs(f"templates/{t}/ui")},
    ),
    "navigation": (
        ("template", "navigation", "method"),
        {
            (t, n, m)
            for t in templates
            for n in subdirs(f"templates/{t}/navigation")
            for m in subdirs(auth_dirs[t])
        },
    ),
}


def runs_of(job_name, matrix):
    """The combinations GitHub runs, or None when they cannot be read.

    GitHub expands the cross product of the list axes, drops every combination
    an `exclude:` entry matches, then applies `include:`, which `exclude:` never
    touches. An `include:` entry updates every remaining original combination
    whose axis values it does not contradict, overwriting keys an earlier entry
    added, and only becomes a combination of its own when it matches none. So
    `include:` entries that repeat an axis value collapse into one run rather
    than adding one each. A matrix, axis or `include:` written as an expression
    such as `fromJSON` is refused rather than guessed at.
    """
    where = f"the `{job_name}` job's strategy.matrix in {workflow_file}"

    if not isinstance(matrix, dict):
        print(f"::error::{where} is not a mapping; this guard cannot see what it runs.")
        return None

    axes = {k: v for k, v in matrix.items() if k not in ("include", "exclude")}
    for axis, values in axes.items():
        if not isinstance(values, list):
            print(f"::error::`{axis}` in {where} is not a list; this guard cannot see what it runs.")
            return None

    for key in ("exclude", "include"):
        entries = matrix.get(key) or []
        if not isinstance(entries, list) or not all(isinstance(e, dict) for e in entries):
            print(f"::error::`{key}` in {where} is not a list of mappings.")
            return None

    originals = []
    if axes:
        originals = [dict(zip(axes, combo)) for combo in itertools.product(*axes.values())]

    for entry in matrix.get("exclude") or []:
        originals = [o for o in originals if any(o.get(k) != v for k, v in entry.items())]

    added = [{} for _ in originals]
    standalone = []
    for entry in matrix.get("include") or []:
        matched = False
        for original, extra in zip(originals, added):
            if all(original.get(k, v) == v for k, v in entry.items()):
                extra.update((k, v) for k, v in entry.items() if k not in original)
                matched = True
        if not matched:
            standalone.append(dict(entry))

    return [{**extra, **original} for original, extra in zip(originals, added)] + standalone


with open(workflow_file, encoding="utf-8") as fh:
    try:
        doc = yaml.safe_load(fh)
    except yaml.YAMLError as err:
        print(f"::error file={workflow_file}::{err}")
        sys.exit(1)

jobs = (doc or {}).get("jobs") or {}
failed = False

for job_name, (axes, expected) in required.items():
    job = jobs.get(job_name)
    if job is None:
        print(
            f"::error::`{job_name}` is not a job in {workflow_file}; it may "
            "have been renamed, and this guard's required table needs "
            "updating to match."
        )
        failed = True
        continue

    runs = runs_of(job_name, (job.get("strategy") or {}).get("matrix") or {})
    if runs is None:
        failed = True
        continue

    covered = {tuple(str(r[a]) for a in axes) for r in runs if all(a in r for a in axes)}
    label = ", ".join(axes)

    if not covered:
        print(
            f"::error::no run of the `{job_name}` job in {workflow_file} sets "
            f"all of {label}; it would run for nothing."
        )
        failed = True
        continue

    for combo in sorted(expected - covered):
        print(
            f"::error::no run of the `{job_name}` job in {workflow_file} has "
            f"{label} = {', '.join(combo)}; it exists on disk, and that job "
            "would skip it."
        )
        failed = True

    for combo in sorted(covered - expected):
        print(
            f"::error::the `{job_name}` job in {workflow_file} runs {label} = "
            f"{', '.join(combo)}, which does not exist on disk. Remove it, or "
            "drop the crossed axes and list each combination as its own "
            "`include:` entry."
        )
        failed = True

if not failed:
    print(
        "templates: CI matrix covers every template, sign-in method and UI "
        f"system in {', '.join(required)} ({len(templates)} template(s), "
        f"{len(required)} job(s) checked)"
    )

sys.exit(1 if failed else 0)
PY
