---
name: setup
description: Set up an Nhost project for development. Covers installing the Nhost CLI, checking Docker, creating a project with `nhost init`, starting the local stack with `nhost up`, local service URLs, linking or pulling an Nhost Cloud project (`nhost login`, `nhost link`, `nhost init --remote`), deploying, and connecting and verifying the Nhost CLI MCP server (`nhost mcp start`, `.nhost/mcp-nhost.toml`). Use when starting a new Nhost app, when Docker isn't available, when the user wants to deploy, host, publish or put an Nhost app live (Nhost Cloud), when `nhost` commands fail, when local services are not reachable, or when the Nhost MCP tools are missing or not working.
---

# Nhost setup

Goal: a running local Nhost project that the agent can inspect, with the Nhost MCP server connected if the host supports MCP.

## 1. Prerequisites

1. Check the CLI with `nhost --version`. If it's missing, install it with one of the documented methods ([CLI quickstart](https://docs.nhost.io/getting-started/local-development/cli)):
   - `npm install -g @nhost/cli`
   - `brew install nhost/tap/nhost`
   - `curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash`

   It can also run without installing: `npx @nhost/cli@latest <command>`. When the agent installs the CLI itself, prefer npm or Homebrew: the curl script moves the binary into `/usr/local/bin` with `sudo`, which needs the user's password.
2. Supported platforms are macOS and Linux. **Windows works only through WSL2**, so don't try a native Windows install.
3. The local stack needs **Docker**. Check with `docker info`. If Docker isn't installed or isn't running, stop and give the user two options: install or start Docker for local development, or build against a hosted Nhost Cloud project, which needs no Docker. With Cloud, the user signs up and creates a project at https://app.nhost.io, and the agent prepares the SQL and permission rules for the user to apply in the Nhost dashboard. The CLI can't apply them without Docker. Details: [references/cloud.md](references/cloud.md). Let the user choose, and don't try to work around a missing Docker.

## 2. Create a local project

Run these from the app's root folder.

1. **Before `nhost init` in a folder that already has files:** `nhost init` writes its template files over existing ones. That includes `.gitignore` (replaced with just `.nhost` and `.secrets`) and `functions/package.json`. Copy those files aside first, then merge them back, so entries such as `node_modules` and `.env` stay ignored. Check `git status` before committing.
2. `nhost init` creates `nhost/` (with `nhost.toml`, `metadata/`, `migrations/`, `seeds/`, `emails/`), `functions/`, and `.secrets`.
3. Run `nhost up` right after `nhost init`, before writing any migrations or metadata. `init` leaves `nhost/metadata/` empty, and the first `up` fills it with the base files that later changes build on. `nhost up` starts Postgres, the GraphQL API, Auth, Storage, Functions, the dashboard and Mailhog in Docker. It prints the service URLs when ready. Also on every start, it applies migrations and metadata from `nhost/`.
4. `nhost logs` shows logs and `nhost down` stops the stack.

Local endpoints (subdomain `local`, region `local`):

| Service | URL |
|---|---|
| GraphQL | `https://local.graphql.local.nhost.run/v1` |
| Auth | `https://local.auth.local.nhost.run/v1` |
| Storage | `https://local.storage.local.nhost.run/v1` |
| Functions | `https://local.functions.local.nhost.run` |
| Dashboard | `https://local.dashboard.local.nhost.run` |
| Mailhog (local email inbox) | `https://local.mailhog.local.nhost.run` |
| Postgres | `postgres://postgres:postgres@localhost:5432/local` |

Check it's up: `curl https://local.auth.local.nhost.run/v1/version`.

If port 443 or 5432 is already taken (often by another Nhost project), stop the other stack with `nhost down` in its folder, or start this one on other ports: `nhost up --http-port 8443 --postgres-port 5433`. Port flags are listed in the [CLI reference](https://docs.nhost.io/reference/cli/commands).

## 3. Connect the Nhost MCP server

First check whether Nhost MCP tools (`get-schema`, `graphql-query`, `manage-graphql`, `search`) are already available. The server may already be registered with the agent.

- With **no config file**, `nhost mcp start` targets the local project (`subdomain = "local"`) with the local admin secret and metadata management on, and Nhost Cloud access is off. That's the right setup for local development, and nothing else is needed.
- To make it explicit or to add projects, create `.nhost/mcp-nhost.toml` (or run `nhost mcp config`, which is interactive). See [references/mcp.md](references/mcp.md) for the file, how to register the server by hand, and how to verify it.
- If the host has no MCP support, skip this step. Every Nhost skill also works through the CLI and project files.

**Never** add a production project to the MCP config with an admin secret or `allow_mutations = ["*"]`. The admin secret bypasses all permissions.

## 4. Nhost Cloud (only when the user wants it)

When the user wants to deploy, share or go live, read [references/cloud.md](references/cloud.md): account and project, connecting GitHub, and deploying. The user signs up and creates the project at https://app.nhost.io.

These commands are interactive and need the user's credentials. Ask the user to run them in their own terminal. Never type passwords or tokens on their behalf.

- `nhost login`: signs in to Nhost Cloud. Not needed for local-only work.
- `nhost init --remote`: starts a local project from an existing cloud project (config, migrations, metadata).
- `nhost link`: links an existing local project to a cloud project.

To deploy, connect a GitHub repository to the project in the Nhost dashboard and push. Nhost Cloud applies the committed `nhost/` folder and `functions/`. See [Local Development → Deploy](https://docs.nhost.io/platform/cli/local-development). Confirm with the user before any push or deploy.

## Done when

- `nhost up` has printed the service URLs, and the Auth `/version` check responds.
- If MCP is available, `get-schema` for subdomain `local` returns a schema.
- The user knows the dashboard and Mailhog URLs.

Next: the `database` skill for tables and permissions, and the `auth` skill for sign-up.

The user's instructions take precedence over this skill.
