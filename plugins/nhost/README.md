# Nhost plugin for AI coding agents

The official [Nhost](https://nhost.io) plugin for Claude Code and Codex. It teaches the agent to build apps on Nhost with current APIs, and it connects the agent to your local Nhost project through the Nhost CLI's MCP server.

Nhost is a backend made of Postgres, a GraphQL API with role-based permissions, Auth, Storage and serverless Functions.

## What's inside

**Skills**

| Skill | What it covers |
|---|---|
| `nhost` | What Nhost is, how to look up current docs, safety rules, and which skill to use next |
| `setup` | Install the CLI, `nhost init`, `nhost up`, linking to Nhost Cloud, connecting the MCP server |
| `database` | Tables, relationships, migrations, and least-privilege GraphQL permissions |
| `auth` | Email sign-up and sign-in with `@nhost/nhost-js`, email verification, sessions, roles, JWT claims |
| `storage` | Buckets, file uploads, and file permissions |
| `functions` | Serverless functions, secrets, and calling functions from the app |
| `frontend` | Using `@nhost/nhost-js` with React, Next.js, Vue, SvelteKit and React Native |

**MCP server** ([docs](https://docs.nhost.io/platform/cli/mcp))

The plugin starts the Nhost CLI's MCP server with `npx -y @nhost/cli@latest mcp start`. Its tools:

- `get-schema`, `graphql-query`: read the GraphQL schema and run queries on your project.
- `manage-graphql`: create migrations and change permissions on a local project.
- `search`, `read_page`, `list`: search and read the Nhost docs.
- `cloud-graphql-query`: manage Nhost Cloud projects. Off unless you enable it.

## Requirements

- macOS or Linux. On Windows, use WSL2.
- Node.js 18+, which the MCP server launcher needs.
- Docker, for the local Nhost stack.
- The Nhost CLI. The `setup` skill installs it if it's missing, or see the [CLI quickstart](https://docs.nhost.io/getting-started/local-development/cli).

## Install

### Claude Code

```bash
claude plugin marketplace add nhost/nhost --sparse .claude-plugin plugins/nhost
claude plugin install nhost@nhost
```

### Codex

```bash
codex plugin marketplace add nhost/nhost --sparse .agents/plugins --sparse plugins/nhost
codex plugin add nhost@nhost
```

The `--sparse` options download only the plugin, not the whole `nhost/nhost` repository.

To add only the MCP server, without the skills, use `codex mcp add nhost -- nhost mcp start`.

### Try it

Open an empty folder and ask:

> Build a simple todo app with email sign-up where each user only sees their own todos, using Nhost.

## What the MCP server can access

With no configuration file, the server connects only to your **local** Nhost project (`nhost up`), using the local development admin secret. On that local project it can:

- read the schema
- run queries and mutations
- create migrations and permissions

It has no access to Nhost Cloud unless you add a `[cloud]` section to `.nhost/mcp-nhost.toml`.

To add Cloud projects or limit what the agent can run, see [MCP configuration](https://docs.nhost.io/platform/cli/mcp/configuration).

## Security

- **Never point an MCP configuration with an admin secret at a production project.** The admin secret bypasses all permissions. For Cloud projects, use a project PAT with specific `allow_queries` / `allow_mutations`.
- The skills tell the agent to keep the admin secret out of frontend code, to use deny-by-default permissions, and to check ownership with `X-Hasura-User-Id`. Still review generated permissions before you deploy.
- The plugin collects no data and contains no secrets.
- The MCP server is the Nhost CLI. `npx` downloads it from npm (`@nhost/cli`) the first time it starts. Because the plugin asks for `@latest`, npx may check npm for a newer version on later starts.
- Once running, the MCP server connects to your local Nhost project, plus any Nhost Cloud projects you add to `.nhost/mcp-nhost.toml`. Its docs search runs offline: the docs are built into the CLI.

To report a vulnerability, see [SECURITY.md](SECURITY.md).

## Support

- Docs: https://docs.nhost.io
- Discord: https://discord.com/invite/9V7Qb2U
- Issues: https://github.com/nhost/nhost/issues

## License

[MIT](LICENSE)
