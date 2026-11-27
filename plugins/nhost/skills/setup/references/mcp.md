# Nhost CLI MCP server

Sources: [Development Setup](https://docs.nhost.io/platform/cli/mcp/development-setup), [Configuration](https://docs.nhost.io/platform/cli/mcp/configuration), [MCP Clients](https://docs.nhost.io/platform/cli/mcp/clients), [Troubleshooting](https://docs.nhost.io/platform/cli/mcp/troubleshooting).

This is the MCP server built into the Nhost CLI. It runs on the developer's machine over stdio and authenticates as the developer. It is different from the Backend MCP Server (`products/ai/mcp`), which an app deploys for its own end users.

## Config file: `.nhost/mcp-nhost.toml`

The server reads `.nhost/mcp-nhost.toml` from the directory it starts in (override with `--config-file`). `nhost init` adds `.nhost` to `.gitignore`.

Local development (the same as the built-in default when no file exists):

```toml
[[projects]]
subdomain = "local"
region = "local"
description = "Local development project running via the Nhost CLI"
admin_secret = "nhost-admin-secret"
manage_metadata = true
allow_queries = ["*"]
allow_mutations = ["*"]
```

`nhost-admin-secret` is the CLI's fixed default admin secret for the **local** stack only. It is not a real credential. Never use it, or any real admin secret, in frontend code.

Other options:

- `[cloud]` with `enable_mutations = true|false`: turns on the `cloud-graphql-query` tool for Nhost Cloud (organizations, projects, configuration). It uses the credentials from `nhost login`. Leave it out unless the user asks for Cloud access.
- A Cloud project entry should use a project `pat`, not an admin secret, and name specific operations in `allow_queries` / `allow_mutations`, for example `allow_mutations = []` for read-only access. `manage_metadata` requires `admin_secret`, so keep it for local projects.
- Values can come from environment variables: `admin_secret = "${NHOST_ADMIN_SECRET}"`. Never write real secrets into the file.

The docs warn: "Never point this configuration at a production project."

## Registering the server by hand

If the host didn't register the server automatically, use the host's MCP command:

| Client | Command |
|---|---|
| Claude Code | `claude mcp add nhost nhost mcp start` |
| Codex CLI | `codex mcp add nhost -- nhost mcp start` |
| Gemini CLI | `gemini mcp add nhost nhost mcp start` |
| JSON `mcpServers` clients | `{"mcpServers": {"nhost": {"command": "nhost", "args": ["mcp", "start"]}}}` |

Start the host from the project root so the server finds `.nhost/mcp-nhost.toml`.

## Verify

The client should list the tools `get-schema`, `graphql-query`, `manage-graphql` and `search` (plus `read_page` and `list` for docs, and `cloud-graphql-query` when `[cloud]` is set). Without a client, test the server directly with the stack running:

```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"local","role":"admin","summary":true}},"id":1}' | nhost mcp start
```

Common failures:

- **The tools work but calls fail**: the local stack isn't running. Run `nhost up`.
- **`project does not allow metadata management`**: set `manage_metadata = true` and `admin_secret` for that project.
- **The server doesn't start**: run `nhost --version`. With a config file present, a parse error prints "Please, run `nhost mcp config`".
