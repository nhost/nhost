# CI building blocks

The shared workflow's Linux jobs use `blacksmith-2vcpu-ubuntu-2404` (x86_64) or
`blacksmith-2vcpu-ubuntu-2404-arm` (aarch64). Other jobs use GitHub-hosted
`ubuntu-latest`/`ubuntu-slim` or Blacksmith runners. Native macOS cache warming
uses `macos-15`. npm trusted publishing uses GitHub-hosted `ubuntu-latest`
because it rejects self-hosted runners.

## Shared check/build workflow

`workflows/wf_check.yaml` runs project checks and optionally builds and uploads
artifacts. Project-specific options belong in callers:

```yaml
uses: ./.github/workflows/wf_check.yaml
with:
  NAME: auth
  PROJECT: services/auth
  GIT_REF: ${{ github.event.pull_request.head.sha || github.sha }}
  BUILD: true
  DOCKER: true
```

Supply the workflow's declared secrets and caller change-detection dependencies.
Secret-bearing `pull_request_target` callers must depend on `check-permissions`
and pass the **approved head SHA**, never a moving PR ref.

- `BUILD` defaults to false; `CHECKS` defaults to true. Release callers set
  `BUILD: true` and `CHECKS: false`.
- `VERSION` defaults to `0.0.0-dev`; `DOCKER` defaults to false.
- `CACHE_TARGET` defaults to `.#packages.{system}.nixops`; `{system}` expands to
  the native Nix system. Receivers can select another cached installable, such
  as `.#devShells.{system}.cache`. Bootstrap/refresh callers that build and upload
  the target set `SKIP_CACHE_CHECK: true` to bypass the ready-cache gate.
- `LOGIN_ECR` defaults to false; enable it for authenticated ECR access during
  integration checks.
- `ARCHS` defaults to `["aarch64", "x86_64"]`. Each architecture uses its native
  runner; checks run only on the first architecture. Check-only calls also use
  the first entry. Single-platform projects set `ARCHS` explicitly.
- `RUNNER` overrides the runner label, including for native macOS.
  `RUNNER_SIZE` and `CHECK_RUNNER_SIZE` are accepted but do not affect selection.
- `ENV` is a newline-separated list of environment assignments.
  `ARTIFACT_SUFFIX` distinguishes Node/Postgres variants. Functions run integration
  checks only on Node 22; PostgreSQL checks both majors.
- Artifact names are `<name>-artifact<suffix>-<os>-<arch>-<version>` and
  `<name>-docker-image<suffix>-<os>-<arch>-<version>`, with 7-day retention.

The checks leg records check/dev-shell derivations and dry-runs the check.
Unless the check is cached, it runs `make dev-env-up` followed by `make check`,
including project `_check-pre` hooks and `NIX_CHECK_EXTRA_ARGS`. Any failure
stops version stamping and artifact builds; the cache step still runs.

Artifact builds then stamp version metadata, record artifact derivations, build,
and upload. `0.0.0-dev` builds skip stamping so integration outputs can be reused.
Image packaging sets `LOAD_DOCKER_IMAGE=false`; only integration setup loads
images into Docker. Build-only callers skip the check phase. Separate
`result-bin`, `result-image`, `result-dev-env`, and `result-check` links retain
each phase's output.

Image publishers download only matching image artifacts. The ECR publisher runs
on `ubuntu-latest` and accepts `ARCHS` (default `["x86_64", "aarch64"]`), optional
`GIT_REF`, and `AWS_REGION` (default `eu-central-1`). Single-architecture
publishing is supported.

## Nix cache

`actions/setup-nix` initializes `NIX_CACHE_ROOTS` with locked flake inputs,
excluding this repository's per-commit source. It verifies that `CACHE_TARGET`
needs no local build, except for `NAME: nixops` or `SKIP_CACHE_CHECK: "true"`
(the string form for direct action callers).

Record derivations **before** executing them:

```sh
make --no-print-directory cache-check-roots >> "$NIX_CACHE_ROOTS"
make --no-print-directory cache-build-roots >> "$NIX_CACHE_ROOTS"
make --no-print-directory cache-image-roots >> "$NIX_CACHE_ROOTS"
```

Use the check roots before probing development checks, and artifact roots after
checks and version stamping. Custom builds append `nix path-info --derivation`
results with the same environment and impurity flags as the build. Docker Make
targets also record auxiliary image graphs during integration setup.

`actions/cache-nix` takes `ROOTS_FILE: ${{ env.NIX_CACHE_ROOTS }}`. It uploads
realized outputs reachable from those graphs, including successful intermediates
of failed checks, runtime references, and locked inputs. It does not scan the
whole store or upload incidental evaluation sources or `.drv` files. Only
unsigned paths or paths signed exclusively by the Nhost key are probed and
uploaded; paths with upstream signatures are neither probed nor mirrored.
Missing paths are probed in parallel before signing/uploading. Paths signed
only by Nhost are retried if an earlier upload did not publish them.

Probe, authentication, signing, and upload errors fail the cache action.
This fails `wf_check`; cache steps after publication in `wf_release_npm.yaml`
and `cli_wf_release.yaml` use `continue-on-error: true` so cache errors do not
fail published releases.

### Hosts with preinstalled Nix

On these hosts, `cachix/install-nix-action` skips `extra_nix_config`.
`setup-nix` writes the daemon's default and `nhost-nix-cache` AWS profiles and
restarts it, but does not write `nix.conf`. The host must enable `nix-command`
and `flakes`, `fallback = true`, and `sandbox = relaxed`, and configure the R2
substituter and `NIX_CACHE_PUB_KEY` alongside `cache.nixos.org` and its key.
A trusted runner user with `accept-flake-config = true` can use the flake's
sandbox and substituter settings instead.

Provide a GitHub `access-tokens` entry readable by the runner's Nix clients.
Use a token with no repository or organization permissions, only to raise public
fetch rate limits. Keep it outside the world-readable Nix store (for example,
in an included file, not `nix.settings`) and never print it.

Custom hosts must also provide tools used directly by their jobs: `jq`, AWS CLI,
`zstd`, `zip`/`unzip`, Skopeo, Docker with Compose, `gh`, GNU make, git, OpenSSL,
awk, passwordless sudo, and standard bash/GNU utilities including `grep -P`.
`setup-nix` does not install these tools.

## Synchronizing shared CI files

`packages.<system>.ci-files` bundles the shared check/ECR workflows, setup/cache
actions, general/release Makefiles, and portable tests verbatim. `bundle.json`
records the repository, Git revision, and SHA-256 hashes; payloads live under
`files/` at their source paths. `apps.<system>.sync-ci` installs selected exports
without running Git commands, staging, committing, or pushing.

The receiving checkout owns `build/shared-ci.json`. Install these exports
together for the shared check workflow and ECR publisher:

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

Keep non-test exports at their source paths: workflows call fixed action paths,
`cache.sh` and its test are siblings, and `general.makefile` includes
`release.makefile`. The two `ci/tests` exports may move together to a directory
exactly two levels below the receiver root, such as `nix/tests` above.
`sync-ci` copies manifest entries only; it does not enforce these installation
constraints or implicitly install new exports.

Pin updates to a published commit; `--target` defaults to the current directory:

```sh
nix run github:nhost/nhost/<commit>#sync-ci -- --target /path/to/checkout --dry-run
nix run github:nhost/nhost/<commit>#sync-ci -- --target /path/to/checkout
nix run github:nhost/nhost/<commit>#sync-ci -- --target /path/to/checkout --check
```

Absent destinations need no recorded hash. Existing files must match their
recorded hash/executable flag or already match the desired bundle. Hash-only
manifests are supported; synchronization adds executable flags. Local
modifications, unexported sources, duplicate/overlapping paths, symlinks,
path traversal, and destinations inside `.git` are rejected before writes.
Unmapped wrappers and callers are untouched.

The app sets the manifest's `revision`, `status`, hashes, and executable flags;
other metadata is preserved. Replacements are atomic per file, with the manifest
written last. Rerun interrupted copies safely; do not concurrently edit managed
files. Review the diff and run receiver checks before committing: synchronization
does not adapt callers to interface changes. `--check` returns 0 when current,
1 when updates are needed, and 2 for invalid/unsafe inputs. `--dry-run` never writes.

Apply/check requires a clean Git-backed source with an exact revision. Dirty
and `path:` sources support previews only:

```sh
nix run path:.#sync-ci -- --target /path/to/checkout --dry-run
```

Run the portable tests from the receiver root (`test_cache.py` uses the current
directory):

```sh
python3 .github/actions/cache-nix/test_cache.py
python3 -m unittest discover -s nix/tests -p 'test_*.py'
```

They require Python with PyYAML, bash, GNU make/sed/grep/coreutils, findutils, jq,
and zip, as supplied by `checks.<system>.ci`.

## Validation

```sh
system=$(nix eval --impure --raw --expr builtins.currentSystem)
nix build "path:.#checks.$system.ci" --no-link --print-build-logs
nix build "path:.#checks.$system.nixops" --no-link --print-build-logs
```

`path:` includes untracked files. The CI check supplies PyYAML and the
`CI_FILES`/`SYNC_CI` fixtures; a bare host Python invocation may lack them.
It is also part of the nixops check. `ci/`-only changes trigger nixops checks
without changing the shared `packages.<system>.nixops` toolchain cache gate.
Tests run offline with mocked Nix/AWS/Docker interfaces; they do not exercise
runner availability, OIDC, registry access, or platform integration tests.

For targeted Python runs, use a Nix interpreter built with PyYAML; adding
`nixpkgs#python3Packages.pyyaml` to `nix shell` alone does not extend its import path.
