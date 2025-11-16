<div align="center">
  <h1 style="font-size: 3em; font-weight: bold;">Nhost CLI</h1>
</div>

[Nhost](http://nhost.io) is an open-source Firebase alternative with GraphQL.

The Nhost CLI is used to set up a local development environment. This environment will automatically track database migrations and Hasura metadata.

It's recommended to use the Nhost CLI and the [Nhost GitHub Integration](https://docs.nhost.io/platform/github-integration) to develop locally and automatically deploy changes to production with a git-based workflow (similar to Netlify & Vercel).

## Services

- [Nhost Dashboard](https://github.com/nhost/nhost/tree/main/dashboard)
- [Postgres Database](https://www.postgresql.org/)
- [GraphQL Engine](https://github.com/hasura/graphql-engine)
- [Auth](https://github.com/nhost/nhost/main/auth)
- [Storage](https://github.com/nhost/nhost/main/storage)
- [Nhost Serverless Functions](https://github.com/nhost/functions)
- [Minio S3](https://github.com/minio/minio)
- [Mailhog](https://github.com/mailhog/MailHog)

## Get Started

### Install the Nhost CLI

```bash
sudo curl -L https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash
```

### Initialize a project

```bash
nhost init
```

### Initialize a project with a remote project as a starting point

```bash
nhost init --remote
```

### Start the development environment

```bash
nhost up
```

### Use the Nhost Dashboard

```bash
nhost up --ui nhost
```

## MCP Server

The Nhost cli ships with an MCP server that lets you interact with your Nhost projects through AI assistants using the Model Context Protocol. It provides secure, controlled access to your GraphQL data, project configuration, and documentation—with granular permissions that let you specify exactly which queries and mutations an LLM can execute. For development, it streamlines your workflow by enabling AI-assisted schema management, metadata changes, and migrations, while providing direct access to your GraphQL schema for intelligent query building.

You can read more about the MCP server in the [MCP Server documentation](https://docs.nhost.io/platform/cli/mcp/overview).

## Documentation

- [Get started with Nhost CLI (longer version)](https://docs.nhost.io/platform/overview/get-started-with-nhost-cli)
- [Nhost CLI](https://docs.nhost.io/platform/cli)
- [Reference](https://docs.nhost.io/reference/cli)
- [MCP Server](https://docs.nhost.io/platform/cli/mcp/overview)

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

- MacOS
- Linux
- Windows WSL2
