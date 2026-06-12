# Publishing (maintainers)

## CI (the normal path)

Publishing a `cli@X.Y.Z` GitHub release (what merging the release PR does) triggers
`ci_release.yaml` → `cli_wf_release.yaml`, whose `publish-npm` job runs this same script
once the release binaries are uploaded. Auth is npm trusted publishing (OIDC) — no token
secret; each of the five packages must list this repo's `ci_release.yaml` workflow as a
trusted publisher on npmjs.com, the same setup as `@nhost/nhost-js`.

The script downloads the `cli@<version>` GitHub release assets, verifies checksums,
stages the five packages into `dist/`, smoke-tests the host binary, and publishes the
platform packages before the main package — a live main package with missing platform
packages breaks installs.

A prerelease version (one with a `-` suffix, e.g. `1.50.0-beta.1`) is published under the
`beta` dist-tag, the same channel the other @nhost packages use; everything else goes to
`latest`. npm does not infer this from the version, so without it a prerelease would move
`latest` and reach stable-channel installs.

Already-published versions are skipped, not failed, so re-running the job (or the script)
after a partial failure publishes only what is missing.

## Manual publishing (first release / recovery)

Trusted publishing only works for packages that already exist on the registry, so the
first release of each package — and any publish while CI is down — runs the script
locally.

```sh
npm login
node scripts/publish.mjs --version 1.49.0 --dry-run   # stage + npm publish --dry-run
node scripts/publish.mjs --version 1.49.0 --pack      # stage + local .tgz files only
node scripts/publish.mjs --version 1.49.0             # the real thing
```

Local tarballs from `--pack` can be installed directly for testing
(`pnpm add -D ./dist/main/*.tgz ./dist/<platform>/*.tgz`). Pack with `npm`/the script,
not `pnpm pack` — pnpm strips the binary's executable bit.

Renaming the packages touches the 5 `name` fields (main + 4 platform packages), the 4
`optionalDependencies` keys in the main package.json, and `PKG_PREFIX` in `bin/nhost`;
the script hard-fails if any of these drift.
