# nhost-mcp

> The Nhost CLI ships an MCP server that connects an AI assistant to your local Nhost project so it can read the GraphQL schema, run queries and mutations, and manage Hasura metadata and migrations.

I want you to set up the Nhost MCP server for local development for me. Execute all the steps below autonomously, and only stop to ask me something if a step cannot be completed.

OBJECTIVE: Configure the Nhost CLI MCP server against my local project and register it with my AI assistant.

DONE WHEN: My AI assistant lists the Nhost MCP tools (`graphql-query`, `get-schema`, `manage-graphql`, `search`) and `get-schema` returns my local project's schema.

## TODO

- [ ] Confirm the Nhost CLI is installed and my local project is running
- [ ] Create the MCP config file `.nhost/mcp-nhost.toml`
- [ ] Register the MCP server with my AI assistant
- [ ] Verify the tools are available and `get-schema` works

## Steps

1. Confirm prerequisites. Run `nhost --version` to check the CLI is installed. If it is missing, install it with `curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash`. Then make sure the local stack is running with `nhost up` (this requires Docker). The local GraphQL endpoint is `https://local.graphql.local.nhost.run/v1`.

2. Create the config file at `.nhost/mcp-nhost.toml` in the project root with the following contents. This grants the assistant full access to the local project only — never point this at a production project.

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

3. Register the MCP server with my AI assistant. Detect which client I use and apply the matching setup:

   - **Claude Code**: run `claude mcp add nhost nhost mcp start`
   - **Cursor** (or any client using an `mcpServers` JSON block): add this entry:

     ```json
     {
       "mcpServers": {
         "nhost": {
           "command": "nhost",
           "args": ["mcp", "start"]
         }
       }
     }
     ```

   The server reads `.nhost/mcp-nhost.toml` automatically, so no extra flags are needed.

4. Verify the setup. Confirm the client lists the `nhost` server and its tools. If the client is unavailable, run this directly to confirm the server responds with the local schema:

   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"local","role":"admin","summary":true}},"id":1}' | nhost mcp start
   ```

EXECUTE NOW: Complete the TODO list above so my AI assistant lists the Nhost MCP tools and `get-schema` returns my local project's schema.

For configuration options, client examples, and troubleshooting, see <https://docs.nhost.io/platform/cli/mcp>.
