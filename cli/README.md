<div align="center">
  <h1 style="font-size: 3em; font-weight: bold;">Nhost CLI</h1>
</div>

[Nhost](http://nhost.io) is an open-source Firebase alternative with GraphQL.

The Nhost CLI is used to set up a local development environment. This environment will automatically track database migrations and Hasura metadata.

It's recommended to use the Nhost CLI and the [Nhost GitHub Integration](https://docs.nhost.io/platform/cloud/deployments) to develop locally and automatically deploy changes to production with a git-based workflow (similar to Netlify & Vercel).

## Services

- [Nhost Dashboard](https://github.com/nhost/nhost/tree/main/dashboard)
- [Postgres Database](https://www.postgresql.org/)
- [GraphQL Engine](https://github.com/hasura/graphql-engine)
- [Auth](https://github.com/nhost/nhost/tree/main/services/auth)
- [Storage](https://github.com/nhost/nhost/tree/main/services/storage)
- [Nhost Serverless Functions](https://github.com/nhost/functions)
- [Minio S3](https://github.com/minio/minio)
- [Mailhog](https://github.com/mailhog/MailHog)

## Install

### Homebrew

```sh
brew install nhost/tap/nhost
```

### Nix

If you have flakes enabled:

```sh
nix profile install github:nhost/nhost#cli
```

Or run it directly without installing:

```sh
nix run github:nhost/nhost#cli
```

### npm / pnpm / Yarn / Bun

Install the CLI in a project to pin the version for the whole team:

```sh
npm install -D @nhost/cli
pnpm add -D @nhost/cli
yarn add -D @nhost/cli
bun add -d @nhost/cli
```

Or run it without installing:

```sh
npx @nhost/cli@latest --version
pnpm dlx @nhost/cli@latest --version
yarn dlx @nhost/cli@latest --version
bunx @nhost/cli@latest --version
```

### Quick install (Linux / macOS)

```sh
curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash
```

Or specify a version:

```sh
curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash -s 1.38.0
```

## Get Started

> The steps below are a quick reference. For a guided walkthrough, see the [CLI Quickstart](https://docs.nhost.io/getting-started/quickstart/cli).

### Authenticate

Only needed to pull configuration from an existing Nhost Cloud project or to deploy — skip it for purely local work.

```bash
nhost login
```

### Initialize a project

Scaffolds a `nhost/` directory (backend configuration, version-controlled in Git) and a `functions/` directory.

```bash
nhost init
```

Or start from an existing Nhost Cloud project:

```bash
nhost init --remote
```

### Start the development environment

Spins up the full stack (Postgres, GraphQL, Auth, Storage, Functions) with Docker and prints the local service URLs.

```bash
nhost up
```

The local dashboard runs at https://local.dashboard.local.nhost.run. Stop the stack with `nhost down` and follow logs with `nhost logs`.

## MCP Server

The Nhost cli ships with an MCP server that lets you interact with your Nhost projects through AI assistants using the Model Context Protocol. It provides secure, controlled access to your GraphQL data, project configuration, and documentation—with granular permissions that let you specify exactly which queries and mutations an LLM can execute. For development, it streamlines your workflow by enabling AI-assisted schema management, metadata changes, and migrations, while providing direct access to your GraphQL schema for intelligent query building.

You can read more about the MCP server in the [MCP Server documentation](https://docs.nhost.io/platform/cli/mcp).

## Documentation

- [CLI Quickstart](https://docs.nhost.io/getting-started/quickstart/cli)
- [Nhost CLI](https://docs.nhost.io/platform/cli)
- [Reference](https://docs.nhost.io/reference/cli/commands)
- [MCP Server](https://docs.nhost.io/platform/cli/mcp)

## Build from Source

Make sure you have [Go](https://golang.org/doc/install) 1.18 or later installed.

The source code includes a self-signed certificate for testing purposes. Nhost workers with configured access to AWS may use the `cert.sh` script to generate a real certificate from Let's Encrypt.

```bash
go build -o /usr/local/bin/nhost
```

This will build the binary available as the `nhost` command in the terminal.

## Dependencies

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [curl](https://curl.se/)
- [Git](https://git-scm.com/downloads)

## Supported Platforms

- macOS
- Linux
- Windows WSL2
