# Nhost CLI on npm

Run the [Nhost CLI](https://github.com/nhost/nhost/tree/main/cli) through your package
manager — no curl or brew, version-pinned per project.

## One-off usage

```sh
npx @nhost/cli@latest --version
pnpm dlx @nhost/cli@latest --version
yarn dlx @nhost/cli@latest --version
bunx @nhost/cli@latest --version
```

## Install in a project

```sh
npm install -D @nhost/cli
pnpm add -D @nhost/cli
yarn add -D @nhost/cli
bun add -d @nhost/cli
```

Then run the local binary with your package manager:

```sh
npm exec nhost -- --version
pnpm exec nhost --version
yarn nhost --version
bunx nhost --version
```

Or add scripts to `package.json`:

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

## Supported platforms

macOS (arm64, x64) and Linux (arm64, x64). On Windows, use WSL2 — inside WSL the Linux
binary is selected automatically.
