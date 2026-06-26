# Publishing (maintainers)

## CI (the normal path)

Publishing a `cli@X.Y.Z` GitHub release (what merging the release PR does)
triggers `ci_release.yaml` → `cli_wf_release.yaml`. The `build-multiplatform`
job builds the release binaries and stores them in the Nix cache. After that
succeeds, the inline `publish-npm` job checks out the same release ref, computes
the sanitized release version with `make get-version`, and runs `make build-npm`
to rebuild the `cli-npm` staging output from the cached Nix release binaries.

The publish job validates the staged `build/npm/dist` packages before any publish:
all five package versions must match the sanitized release version, the main
package `optionalDependencies` must point at the four platform packages, package
names must keep the expected `@nhost/cli` prefix, and the packaged binaries must
be executable. npm is provided by the repository's Nix toolchain and must be at
least `11.5.1`; publishing runs through
`nix develop .#pnpm -c npm publish` so CI does not depend on an unpinned Node/npm
installation.

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
Before publishing each package, CI runs `npm view name@version`. If that exact
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
git -C cli checkout -- project.nix

TAG=latest
# Use TAG=beta for alpha/beta/dev/rc prereleases.

for d in \
  cli/build/npm/dist/darwin-arm64 \
  cli/build/npm/dist/darwin-x64 \
  cli/build/npm/dist/linux-arm64 \
  cli/build/npm/dist/linux-x64 \
  cli/build/npm/dist/main
do
  name=$(nix develop .#pnpm -c node -p "require('./$d/package.json').name")
  version=$(nix develop .#pnpm -c node -p "require('./$d/package.json').version")
  published=$(nix develop .#pnpm -c npm view \
    "$name@$version" version 2>/dev/null || true)

  if [ "$published" = "$version" ]; then
    echo "--> skipping $name@$version (already published)"
    continue
  fi

  nix develop .#pnpm -c npm publish "$d" --access public --tag "$TAG"
done
```

`make get-version` stamps `cli/project.nix`; restore it after staging unless you
are preparing a release branch that should keep the stamped version.

For recovery from a partial CI publish, prefer fixing the issue and rerunning
`cli_wf_release.yaml`. The workflow uses the same platform-first order and skip
logic as the manual loop above.

Renaming the packages touches the five `name` fields (main plus four platform
packages), the four `optionalDependencies` keys in the main `package.json`, and
`PKG_PREFIX` in `bin/nhost`. Keep all of them in sync; `make build-npm` and the
CI publish job validate that the staged package names, dependency keys, versions,
and shim prefix still agree.
