# Nhost CLI on npm

Run the [Nhost CLI](https://github.com/nhost/nhost/tree/main/cli) through your package
manager — no curl or brew, version-pinned per project.

## Usage

One-off:

```sh
npx @nhost/cli@latest --version
```

In a project:

```sh
pnpm add -D @nhost/cli   # or: npm install -D / bun add -d
npx nhost --version      # resolves node_modules/.bin/nhost
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

## Supported platforms

macOS (arm64, x64) and Linux (arm64, x64). On Windows, use WSL2 — inside WSL the Linux
binary is selected automatically.

