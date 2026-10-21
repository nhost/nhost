# CI building blocks

Linux jobs use ephemeral runners labelled `nhost-<arch>-<cpus>c<memory>g`.
Sizes are workload-specific, not inherited from the previous runner provider.
Native macOS cache warming remains on `macos-15`. npm publishing stays on
GitHub-hosted Ubuntu because npm trusted publishing rejects self-hosted runners.

## Runner sizing

The label denotes a tier, not fixed resources: `1c1g` provides 1–2 vCPUs / 1–2
GiB, `2c2g` 2–4 / 2–4, `2c4g` 2–4 / 4–8, `4c8g` 4–8 / 8–16, and `8c16g`
8–16 / 16–32. Size against the lower end, without assuming cached outputs are
always present. Both architectures also support `16c32g`; no current job needs
that tier by inspection.

| Tier | Workloads | Reason |
| --- | --- | --- |
| `1c1g` | Approval/label/path checks, final-status polling, release metadata, changelogs, version-ref bumps, registry publishing | Git/API operations and streaming existing artifacts; no compilation or service containers |
| `2c2g` | Secret scanning, small Stripe SDK checks/builds, Functions image assembly, nixops release image assembly | Bounded scanning or small JS/image packaging; no integration stack |
| `2c4g` | Ordinary Go/SDK builds and checks, CLI cross-compilation, security updates, remote AI review | Compiler/type-analysis or package-manager headroom without running a service stack; AI inference is remote |
| `2c4g` | Docs/landing Vercel builds; remote dashboard browser suites | Actual frontend/browser work, but no local Nhost stack |
| `4c8g` | AI/auth/storage/constellation/nhost-js integration checks and CLI new-project tests | Databases, GraphQL, auth/storage and other containers coexist with compilation/lint/tests |
| `4c8g` | Functions integration checks | Six runtime/package-manager containers, not just image packaging |
| `4c8g` | Dashboard Next.js builds, multi-app example builds, local dashboard browser suite | Frontend build workers or the local Nhost stack need more memory |
| `4c8g` | PostgreSQL builds/checks; CodeQL | Native/Rust extension builds and DB tests, or whole-repo extraction/query analysis |
| `8c16g` | Linux nixops cache warming; scheduled flake/dependency refresh | Can compile missing custom toolchains and dependencies after a lockfile update, unlike release image assembly |

In `wf_check.yaml`, the base `RUNNER_SIZE` is `2c4g`.
`CHECK_RUNNER_SIZE` only overrides the matrix leg that actually runs checks;
secondary architecture builds and build-only releases do not inherit a larger
integration-test machine. Functions use `2c2g` for packaging and `4c8g` only for
the Node 22 integration leg. Most release builds use `2c4g`; dashboard and
PostgreSQL explicitly retain `4c8g` because those jobs really compile heavy code.

`wf_deploy_vercel.yaml` defaults to `2c4g` for docs/landing, with an explicit
`4c8g` dashboard override. Browser suites against remote deployments use `2c4g`;
only the suite starting a local Nhost stack uses `4c8g`.

These are code-based starting allocations, not measured peak-memory claims.
Use workflow telemetry and cold-cache runs to tune individual exceptions.

## Shared check/build workflow

`workflows/wf_check.yaml` replaces the separate check and artifact workflows.
Its core interface matches the backend repo: `NAME`, `PROJECT`, `GIT_REF`,
`BUILD`, `VERSION`, `ARCHS`, and `DOCKER`. Repository-specific variants are kept
in callers, not duplicated workflows:

```yaml
uses: ./.github/workflows/wf_check.yaml
with:
  NAME: auth
  PROJECT: services/auth
  GIT_REF: ${{ github.event.pull_request.head.sha || github.sha }}
  BUILD: true
  DOCKER: true
  CHECK_RUNNER_SIZE: "4c8g"
```

Supply the workflow's declared secrets and retain the existing approval and
change-detection dependencies. Secret-bearing `pull_request_target` calls must
pass the **approved head SHA**, never a moving PR ref.

- `BUILD` defaults to false; check-only callers need just the core project inputs.
- `CHECKS` defaults to true. Release callers set `BUILD: true, CHECKS: false`.
- `CACHE_TARGET` defaults to `.#packages.{system}.nixops`; `{system}` expands to
  the native Nix system. Other repositories can select a target such as
  `.#devShells.{system}.cache` without changing the shared workflow or action.
  Set `SKIP_CACHE_CHECK: true` on the caller that builds and uploads a custom
  cache target during bootstrap or refresh; other callers retain the gate.
- `LOGIN_ECR` defaults to false; enable it when integration dependencies need
  authenticated Docker access to ECR.
- `ARCHS` defaults to `["aarch64", "x86_64"]`. Each architecture uses its native
  runner; checks run alongside the first architecture only. Check-only calls
  also run on the first `ARCHS` entry. Single-platform projects set `ARCHS`
  explicitly.
- `RUNNER_SIZE` defaults to `2c4g`. Optional `CHECK_RUNNER_SIZE` applies only to
  the leg that runs checks; `RUNNER` overrides the label for native macOS.
- `ENV` is a newline-separated list of environment assignments. `ARTIFACT_SUFFIX`
  keeps Node/Postgres variants' artifacts distinct. Functions run their full
  integration suite only in the Node 22 job; PostgreSQL checks both majors.
- Preserve artifact names: `<name>-artifact<suffix>-<os>-<arch>-<version>` and
  `<name>-docker-image<suffix>-<os>-<arch>-<version>`.

Checks finish before artifact version stamping or packaging. The workflow
records the development check/shell graphs and probes the check; cached checks
skip integration startup. Otherwise, `make dev-env-up` prepares development
images and `make check` runs against the unchanged checkout and fixed development
tags. Project `_check-pre` hooks, including PostgreSQL's container checks, and
`NIX_CHECK_EXTRA_ARGS` evaluation flags are preserved. A failed probe, environment
setup, or check stops the job before it stamps a version or builds artifacts.

After checks pass or hit cache, the workflow finalizes artifact version metadata,
records the artifact graphs, then builds and uploads the requested artifacts.
Build-only release callers skip the entire check phase. Fixed `0.0.0-dev` builds
do not update creation timestamps, so an image/binary already built for the
integration environment is reused from the Nix store. Artifact image builds set
`LOAD_DOCKER_IMAGE=false`: only integration setup imports images into Docker.
No pinned derivations or prebuilt-image handoff are needed between phases.

Independent `result-bin`, `result-image`, `result-dev-env`, and `result-check`
links retain each phase's output. Artifact names and retention are unchanged;
image publishers download only their matching image artifacts.
The shared ECR publisher accepts `ARCHS` as a JSON list, defaulting to
`["x86_64", "aarch64"]`, and optional `GIT_REF` and `AWS_REGION` inputs. This
also supports repositories that publish only one architecture. Publisher runners
must provide `jq` alongside the existing Docker and Skopeo tools.

## Nix cache

`actions/setup-nix` configures both default and `nhost-nix-cache` AWS profiles for
the daemon, including preinstalled Nix on NixOS runners. It initializes
`NIX_CACHE_ROOTS` with locked flake inputs, excluding this repo's per-commit source.
Its ready-cache gate uses `CACHE_TARGET` (default `.#packages.{system}.nixops`).
Cache bootstrap and dependency-refresh jobs can set `SKIP_CACHE_CHECK: "true"`;
the existing `NAME: nixops` bootstrap exemption is retained.

Record derivations **before** executing them, appending to that file:

```sh
make --no-print-directory cache-check-roots >> "$NIX_CACHE_ROOTS"
make --no-print-directory cache-build-roots >> "$NIX_CACHE_ROOTS"
make --no-print-directory cache-image-roots >> "$NIX_CACHE_ROOTS"
```

The workflow records `make cache-check-roots` before probing development checks.
Only after checks finish does it stamp metadata and record artifact graphs.
For custom builds, append `nix path-info --derivation` results using exactly the
same environment and impurity flags as the build. Docker Make targets also record
graphs for auxiliary images built during integration setup.

`actions/cache-nix` takes `ROOTS_FILE: ${{ env.NIX_CACHE_ROOTS }}`. It retains
realized outputs from the recorded derivation graphs, including successful
build-time intermediates after a failed check, plus runtime references and locked
inputs. It does not scan the whole store or upload incidental evaluation sources
and `.drv` files. Only unsigned paths or paths signed exclusively by the Nhost
cache key are probed; paths with an upstream signature are neither probed nor
mirrored, even if they also carry our signature. Missing paths are probed in
parallel before signing/uploading; authentication and upload failures fail the
action. Paths signed only by us but not yet published are retried.

## Synchronizing shared CI files

`packages.<system>.ci-files` contains a verbatim bundle of the shared check/ECR
workflows, setup/cache actions, general/release Makefiles, and portable tests.
`bundle.json` records the source repository, Git revision, and SHA-256 hashes;
payloads live under `files/` at their original source paths.
`apps.<system>.sync-ci` (also a package) installs selected files into another
checkout without running Git commands, staging, committing, or pushing:

```sh
# Replace <commit> with a published commit containing sync-ci.
nix run github:nhost/nhost/<commit>#sync-ci -- --target /path/to/checkout --dry-run
nix run github:nhost/nhost/<commit>#sync-ci -- --target /path/to/checkout
nix run github:nhost/nhost/<commit>#sync-ci -- --target /path/to/checkout --check
```

A registry alias can shorten this to `nix run nhost#sync-ci`, but use an explicit
commit for reproducible updates. `--target` defaults to the current directory.
The receiving checkout owns `build/shared-ci.json`. Receivers running
`actionlint` on synced workflows must declare their `nhost-<arch>-<size>` runner
labels (including the ECR publisher's `nhost-aarch64-1c1g`) under
`self-hosted-runner.labels` in their own `.github/actionlint.yaml`; this
repository's `.github/actionlint.yaml` is an example. Install the following
exports together to use the shared check workflow (and its ECR publisher):

```json
{
  "repository": "nhost/nhost",
  "files": [
    {
      "source": ".github/workflows/wf_check.yaml",
      "path": ".github/workflows/wf_check.yaml"
    },
    {
      "source": ".github/workflows/wf_docker_push_image_ecr.yaml",
      "path": ".github/workflows/wf_docker_push_image_ecr.yaml"
    },
    {
      "source": ".github/actions/setup-nix/action.yml",
      "path": ".github/actions/setup-nix/action.yml"
    },
    {
      "source": ".github/actions/cache-nix/action.yml",
      "path": ".github/actions/cache-nix/action.yml"
    },
    {
      "source": ".github/actions/cache-nix/cache.sh",
      "path": ".github/actions/cache-nix/cache.sh"
    },
    {
      "source": ".github/actions/cache-nix/test_cache.py",
      "path": ".github/actions/cache-nix/test_cache.py"
    },
    {
      "source": "build/makefiles/general.makefile",
      "path": "build/makefiles/general.makefile"
    },
    {
      "source": "build/makefiles/release.makefile",
      "path": "build/makefiles/release.makefile"
    },
    {
      "source": "ci/tests/test_workflows.py",
      "path": "nix/tests/test_workflows.py"
    },
    {
      "source": "ci/tests/test_shared_ci.py",
      "path": "nix/tests/test_shared_ci.py"
    }
  ]
}
```

Keep workflows, actions (including `cache.sh` and its sibling test), and both
Makefiles at their source paths: the workflow calls the actions by fixed paths,
the cache action runs its sibling script, and `general.makefile` includes
`release.makefile`. The two `ci/tests` exports may move together to another
location exactly two directories below the receiver root (as `nix/tests` above);
they read workflows, actions, and Makefiles relative to that root. Run the
portable tests from the receiver root, including `test_cache.py`, whose Makefile
test uses the current directory:

```sh
python3 .github/actions/cache-nix/test_cache.py
python3 -m unittest discover -s nix/tests -p 'test_*.py'
```

These tests require Python with PyYAML, bash, GNU make/sed/grep/coreutils, jq,
and zip (as provided by `checks.<system>.ci`). `sync-ci` copies only manifest
entries: it does not enforce these co-installation or path constraints. New
upstream exports are never installed implicitly. Absent destinations can be
bootstrapped without recorded hashes. Existing files must match their recorded
hashes/executable flags or already match the desired bundle exactly. Hash-only
manifests from manual copying are supported; synchronization adds executable
flags. Locally customized files, unexported sources, duplicate/overlapping
paths, symlinks, path traversal, and destinations inside `.git` are rejected
before any writes. Backend-specific wrappers and callers remain untouched
unless explicitly mapped.

The app updates the manifest's revision, hashes, and executable flags, preserving
other receiver metadata. Replacements are atomic per file, with the manifest
written last; rerun an interrupted copy to finish it safely. Do not concurrently
edit managed files. Review the resulting diff and run the receiving repo's checks
before committing: synchronization does not adapt callers to interface changes.
`--check` returns 0 when current, 1 when synchronization is needed, and 2 on
invalid/unsafe inputs. `--dry-run` never writes.

Applying or checking requires a clean Git-backed source with an exact revision.
Dirty and `path:` flakes have no reliable Git pin, so they permit previews only:

```sh
nix run path:.#sync-ci -- --target /path/to/checkout --dry-run
```

## Validation

```sh
system=$(nix eval --impure --raw --expr builtins.currentSystem)
nix build "path:.#checks.$system.ci" --no-link --print-build-logs
nix build "path:.#checks.$system.nixops" --no-link --print-build-logs
```

The `path:` form includes new files before they are tracked. The Nix CI check
provides PyYAML and the `CI_FILES`/`SYNC_CI` fixtures needed by the Python suite;
a bare host `python3 -m unittest discover -s ci/tests` may lack them. The
receiver-only fixture uses a synthetic revision so `sync-ci` can exercise apply
and check; the published app still requires a real, clean Git revision. This
check is also included in `checks.<system>.nixops`; workflow/action changes
trigger that project as well as other project checks that use those shared files.
Changes confined to the dedicated `ci/` provisioning directory trigger nixops
checks without invalidating the shared `packages.<system>.nixops` toolchain cache
gate or matching other project-check path filters. The legacy stripe-graphql-js
check has no `merge_group` path filter and runs on every merge queue event
regardless of which files changed. Tests cover cache selection and failures,
reusable-call contracts, PR approval/SHA gates, runner exceptions, variant matrices,
development image tags, checks-before-stamping order, skipped artifact image
imports, cached output reuse, project hooks, parallel Make startup ordering,
bundle fidelity, safe manifest-driven synchronization, and interrupted-copy
recovery. They run offline with mocked Nix/AWS/Docker interfaces; a real CI run
remains necessary to validate runner availability, OIDC, registry access, and
platform integration tests.

For targeted runs, use a Nix Python interpreter built with PyYAML; adding
`nixpkgs#python3Packages.pyyaml` alone to `nix shell` does not extend Python's
import path.
