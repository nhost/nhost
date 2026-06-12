# Nhost CLI on npm

> **Preview**: published under a placeholder name from a personal account while the
> distribution is validated. The package name will change for the official release;
> the `nhost` bin name will not.

Run the [Nhost CLI](https://github.com/nhost/nhost/tree/main/cli) through your package
manager — no curl or brew, version-pinned per project.

## Usage

One-off:

```sh
npx nhost-cli-preview@latest --version
```

In a project:

```sh
pnpm add -D nhost-cli-preview   # or: npm install -D / bun add -d
npx nhost --version             # resolves node_modules/.bin/nhost
```

```json
{
  "scripts": {
    "backend:up": "nhost up",
    "backend:down": "nhost down"
  }
}
```

The package version matches the CLI release version (`cli@X.Y.Z` on GitHub), so pinning
the package pins the CLI for the whole team.

## How it works

The `nhost` bin is a small Node shim (~30–50 ms overhead) that executes the real Go
binary. The binary ships in per-platform packages selected at install time via
`optionalDependencies` (`os`/`cpu` fields) — the same pattern as esbuild, Biome, and
Turbo. No install scripts, no downloads outside the npm registry, and the binaries are
covered by lockfile integrity checks.

## Supported platforms

macOS (arm64, x64) and Linux (arm64, x64). On Windows, use WSL2 — inside WSL the Linux
binary is selected automatically.

## Troubleshooting

**`nhost: no binary available for <platform>-<arch>`** — your package manager skipped
optional dependencies (`--no-optional` / `--omit=optional`), or the lockfile was created
by an old npm that dropped foreign-platform optional dependencies
([npm/cli#4828](https://github.com/npm/cli/issues/4828)). Reinstall with optional
dependencies enabled, or regenerate the lockfile.

## Publishing (maintainers)

```sh
npm login   # personal account during the preview phase
node scripts/publish.mjs --version 1.49.0 --dry-run   # stage + npm publish --dry-run
node scripts/publish.mjs --version 1.49.0 --pack      # stage + local .tgz files only
node scripts/publish.mjs --version 1.49.0             # the real thing
```

Local tarballs from `--pack` can be installed directly for testing
(`pnpm add -D ./dist/main/*.tgz ./dist/<platform>/*.tgz`). Pack with `npm`/the script,
not `pnpm pack` — pnpm strips the binary's executable bit.

The script downloads the `cli@<version>` GitHub release assets (requires an
authenticated `gh`), verifies checksums, stages the five packages into `dist/`,
smoke-tests the host binary, and publishes the platform packages before the main
package — a live main package with missing platform packages breaks installs.
