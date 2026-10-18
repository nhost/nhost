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
| `2c4g` | Ordinary Go/SDK builds and checks, CLI cross-compilation, dependency/security updates, remote AI review | Compiler/type-analysis or package-manager headroom without running a service stack; AI inference is remote |
| `2c4g` | Docs/landing Vercel builds; remote dashboard browser suites | Actual frontend/browser work, but no local Nhost stack |
| `4c8g` | AI/auth/storage/constellation integration checks and CLI new-project tests | Databases, GraphQL, auth/storage and other containers coexist with compilation/lint/tests |
| `4c8g` | Functions integration checks | Six runtime/package-manager containers, not just image packaging |
| `4c8g` | Dashboard Next.js builds, multi-app example builds, local dashboard browser suite | Frontend build workers or the local Nhost stack need more memory |
| `4c8g` | PostgreSQL builds/checks; CodeQL | Native/Rust extension builds and DB tests, or whole-repo extraction/query analysis |
| `8c16g` | Linux nixops cache warming | Can compile missing custom toolchains and dependencies, unlike release image assembly |

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
- `ARCHS` defaults to `["aarch64", "x86_64"]`. Each architecture uses its native
  runner; checks run alongside the first architecture only. Single-platform
  projects set `ARCHS` explicitly.
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

## Nix cache

`actions/setup-nix` configures both default and `nhost-nix-cache` AWS profiles for
the daemon, including preinstalled Nix on NixOS runners. It initializes
`NIX_CACHE_ROOTS` with locked flake inputs, excluding this repo's per-commit source.

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
and `.drv` files. Upstream-signed outputs are not mirrored. Missing paths are
probed in parallel before signing/uploading; authentication and upload failures
fail the action. Previously signed but unpublished paths are retried.

## Validation

```sh
system=$(nix eval --impure --raw --expr builtins.currentSystem)
nix build ".#checks.$system.ci" --print-build-logs
```

Use `path:.#checks.<system>.ci` while new files are untracked. This check is
also included in `checks.<system>.nixops`; workflow/action changes trigger that
project. Tests cover cache selection and failures, reusable-call contracts, PR
approval/SHA gates, runner exceptions, variant matrices, development image tags,
checks-before-stamping order, skipped artifact image imports, cached output reuse,
project hooks, and parallel Make startup ordering. They run offline with mocked
Nix/AWS/Docker interfaces; a real CI run remains necessary to validate runner
availability, OIDC, registry access, and platform integration tests.
