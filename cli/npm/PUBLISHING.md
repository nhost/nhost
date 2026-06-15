# Publishing (maintainers)

## CI (the normal path)

Publishing a `cli@X.Y.Z` GitHub release (what merging the release PR does) triggers
`ci_release.yaml` → `cli_wf_release.yaml`. Its `build-multiplatform` job builds the
release binaries, then stages the five npm packages with the `cli-npm` Nix derivation
(`make build-npm` → `result/dist`) — reusing the exact binaries it just built — and
uploads them as the `cli-npm-dist` artifact. The `publish-npm` job hands that artifact
to the shared `wf_release_npm.yaml` (the same workflow that publishes `@nhost/nhost-js`),
which downloads the staged packages and runs `npm publish`.

Auth is npm trusted publishing (OIDC) — no token secret. Because the CLI now publishes
through the same `wf_release_npm.yaml` as `@nhost/nhost-js`, each of the five packages
needs the same trusted-publisher configuration as `@nhost/nhost-js` on npmjs.com.

The job publishes the four platform packages before the main package — a live main
package with missing platform packages breaks installs. A prerelease version (one with a
`-` suffix, e.g. `1.50.0-beta.1`) goes to the `beta` dist-tag, the same channel the other
@nhost packages use; everything else goes to `latest`. Versions already on the registry
are skipped, not failed, so re-running the job after a partial failure publishes only what
is missing.

## Manual publishing (first release / recovery)

Trusted publishing only works for packages that already exist on the registry, so the
first release of each package — and any publish while CI is down — runs locally. The same
`cli-npm` derivation stages the packages, so there is no separate publish script:

```sh
npm login

# Stage the version you are publishing (mutates cli/project.nix in place):
make get-version VER=1.49.0
make build-npm          # -> ./result/dist/{main,darwin-arm64,darwin-x64,linux-arm64,linux-x64}
git checkout project.nix  # restore the dev version

# Publish platform packages first, then main (add --tag beta for prereleases):
for d in result/dist/*/; do
  [ "$d" = result/dist/main/ ] && continue
  ( cd "$d" && npm publish --access public )
done
( cd result/dist/main && npm publish --access public )
```

Publishing straight from `result/dist` preserves the binary's executable bit (the Nix
store keeps it `0755`), so no `chmod` is needed on this path.

Renaming the packages touches the five `name` fields (main + 4 platform packages), the
four `optionalDependencies` keys in the main `package.json`, and `PKG_PREFIX` in
`bin/nhost`; keep all of them in sync — the `cli-npm` derivation stamps versions but does
not check the names.
