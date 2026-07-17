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

> The steps below are a quick reference. For a guided walkthrough, see the [CLI Quickstart](https://docs.nhost.io/getting-started/local-development/cli).

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

The local dashboard runs at <https://local.dashboard.local.nhost.run>. Stop the stack with `nhost down` and follow logs with `nhost logs`.

## MCP Server

The Nhost cli ships with an MCP server that lets you interact with your Nhost projects through AI assistants using the Model Context Protocol. It provides secure, controlled access to your GraphQL data, project configuration, and documentation—with granular permissions that let you specify exactly which queries and mutations an LLM can execute. For development, it streamlines your workflow by enabling AI-assisted schema management, metadata changes, and migrations, while providing direct access to your GraphQL schema for intelligent query building.

You can read more about the MCP server in the [MCP Server documentation](https://docs.nhost.io/platform/cli/mcp).

## Documentation

- [CLI Quickstart](https://docs.nhost.io/getting-started/local-development/cli)
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

### Regenerate local TLS certificates

The certificate script now requires an explicit Kubernetes target. This is a
deliberate breaking change for operators who previously ran it without arguments.
From the repository root, enter the CLI development shell and run:

```sh
nix develop .#cli
cd cli && ./cert.sh <namespace> <deployment>
```

The runtime needs Certbot and its Route53 plugin, `kubectl`, `jq`, and `dig`;
`shellcheck` is included for linting the scripts but is not a runtime dependency.
Equivalent host tools may be used instead of the Nix shell. The operator needs
working AWS credentials for the Route53 certificate and an active Kubernetes
context with Deployment `get`, `patch`, and rollout status/watch access. The script
never selects or changes a kubectl context.

The wildcard authentication hook patches the existing `ACME_CHALLENGE_*`
environment variables in the Deployment. Each of the nine supported variables
must occur exactly once as a direct, non-empty `value` in one container; duplicate
variables, `valueFrom`, or a changed Deployment layout fail closed. Rapid challenge
publication can cause intermediate rollout churn. Only the final invoked hook waits
for the final generation and DNS readiness. Challenge values are intentionally
retained. If Certbot reuses every cached authorization, it invokes no hook and
publication is a valid no-op; if only some are cached, the final hook also validates
every retained value.

The rollout timeout, global DNS timeout, and DNS poll interval default to 300, 300,
and 2 seconds. Override them with `ACME_ROLLOUT_TIMEOUT_SECONDS`,
`ACME_DNS_TIMEOUT_SECONDS`, and `ACME_DNS_POLL_INTERVAL_SECONDS`. The worst case is
therefore roughly ten minutes after the quick patches. DNS uses the system resolver
by default. Set `ACME_DNS_SERVER` to a hostname or IPv4 resolver on standard port 53;
an authoritative or suitable public resolver is preferred when recursive negative
caching delays a new TXT record.

Do not run concurrent certificate requests against the same Deployment: its
environment can store only one value for each service. A rollout-time UID or
generation change also aborts the run. Validation values are public DNS data and
`kubectl set env` necessarily exposes the current value in that process's argument
list; the hook suppresses value-bearing command output and does not create token
state files, so operators should still restrict local process inspection and
command tracing.

The Route53 certificate, certificate copy destinations, and final cleanup remain
unchanged. Run the command from `cli/` so its existing relative output paths continue
to resolve.

## Dependencies

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [curl](https://curl.se/)
- [Git](https://git-scm.com/downloads)

## Supported Platforms

- macOS
- Linux
- Windows WSL2
