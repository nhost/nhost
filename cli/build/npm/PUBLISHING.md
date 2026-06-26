# Publishing (maintainers)

## CI (the normal path)

Publishing a `cli@X.Y.Z` GitHub release (what merging the release PR does)
triggers `ci_release.yaml` → `cli_wf_release.yaml`. The `build-multiplatform`
job builds the release binaries and stores them in the Nix cache. After that
succeeds, the inline `publish-npm` job checks out the same release ref, computes
the sanitized release version with `make get-version`, and runs `make build-npm`
to rebuild the `cli-npm` staging output from the cached Nix release binaries.

The publish job runs the same Make targets maintainers use locally:
`make validate-npm` checks the staged `build/npm/dist` packages before any
publish, then `make publish-npm` publishes them. Validation verifies all five
package versions match the sanitized release version, the main package
`optionalDependencies` points at the four platform packages, package names keep
the expected `@nhost/cli` prefix, and the packaged binaries are executable. npm
is provided by the repository's Nix toolchain, so CI does not depend on an
unpinned Node/npm installation.

## npm trusted publishing setup

Auth is npm trusted publishing (OIDC) — no npm token secret is used by CI.
Configure all five npm packages on npmjs.com:

- `@nhost/cli`
- `@nhost/cli-darwin-arm64`
- `@nhost/cli-darwin-x64`
- `@nhost/cli-linux-arm64`
- `@nhost/cli-linux-x64`

Each package's trusted publisher must target this repository's
`.github/workflows/cli_wf_release.yaml` workflow and its `publish-npm` job. Do
not point these CLI packages at `.github/workflows/wf_release_npm.yaml`; that
shared workflow is for JS/SDK npm releases.

A live prerelease/beta release is the final integration test for npm's
trusted-publisher claim matching. Dry runs can validate package contents and
tooling, but npm only proves that the OIDC claims match the configured
workflow/job during an actual publish.

## Publish order, dist-tags, and reruns

The CI job publishes platform packages before the main package:

1. `@nhost/cli-darwin-arm64`
2. `@nhost/cli-darwin-x64`
3. `@nhost/cli-linux-arm64`
4. `@nhost/cli-linux-x64`
5. `@nhost/cli`

Keep this order for manual publishing too. A live main package with missing
platform packages can break installs, while published platform packages are
harmless until the main package references them.

Versions containing `alpha`, `beta`, `dev`, or `rc` (for example,
`1.50.0-beta.1`) use the `beta` dist-tag; all other versions use `latest`.
`make publish-npm` computes that tag from the staged version by default; pass
`NPM_TAG=<tag>` only when you intentionally need an override. Before publishing
each package, the publish target runs `npm view name@version`. If that exact
version already exists on npm, the job skips it and continues, so rerunning after
a partial failure publishes only the missing packages. If an incorrect package
was already published, npm package versions are immutable; cut and publish a new
version instead of rerunning the same one.

## Manual bootstrap and recovery

Trusted publishing requires the package names to exist on npm before CI can
publish them. Use a manual first publish to bootstrap the five packages, or use
the same flow if CI is unavailable. Run these commands from the repository root
and publish platform packages first, then the main package:

```sh
nix develop .#pnpm -c npm login

VERSION=$(make -C cli get-version VER=1.49.0)
make -C cli build-npm
make -C cli validate-npm
make -C cli publish-npm
git -C cli checkout -- project.nix
```

`make get-version` stamps `cli/project.nix`; restore it after staging unless you
are preparing a release branch that should keep the stamped version.

For recovery from a partial CI publish, prefer fixing the issue and rerunning
`cli_wf_release.yaml`. The workflow uses the same `make publish-npm` target as
manual publishing, including platform-first order and skip logic for exact
versions that already exist on npm.

Renaming the packages touches the five `name` fields (main plus four platform
packages), the four `optionalDependencies` keys in the main `package.json`, and
`PKG_PREFIX` in `bin/nhost`. Keep all of them in sync; `make build-npm` and the
CI publish job validate that the staged package names, dependency keys, versions,
and shim prefix still agree.
