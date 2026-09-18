# nhost-mcp-cloud

> The Nhost CLI ships an MCP server that connects an AI assistant to Nhost Cloud, so it can query a cloud project's data and schema and manage organizations and project configuration. This file sets it up against a **cloud** project. For a local project started with `nhost up`, use <https://docs.nhost.io/install-mcp> instead.

I want you to set up the Nhost MCP server against my Nhost Cloud account. Execute the steps below, and stop to ask me whenever a step needs a decision or a value only I have.

OBJECTIVE: Configure the Nhost CLI MCP server against my Nhost Cloud project and register it with my AI assistant, with read-only access unless I explicitly ask for more.

DONE WHEN: My AI assistant lists the Nhost MCP tools and `get-schema` returns the schema of the cloud project I named.

IMPORTANT: This points at real data. Do not widen access beyond what I ask for. Never write a real token or admin secret into `mcp-nhost.toml`, or into any other file inside the repository — in the config file use `$VAR` interpolation, which the server expands at startup. Note the syntax is `$VAR` and not `${VAR}`; braces are not supported and would be sent literally as the credential. The real value belongs in my client's own configuration (step 4) and nowhere else. Never commit credentials.

## TODO

- [ ] Confirm the Nhost CLI is available and I am authenticated
- [ ] Ask me which project and which kind of access I want
- [ ] Create the MCP config file `.nhost/mcp-nhost.toml`
- [ ] Register the MCP server with my AI assistant
- [ ] Verify the tools are available and `get-schema` works

## Steps

1. Confirm prerequisites. Run `nhost --version`. If the CLI is missing, either install it with `curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash`, or plan to run it through `npx -y @nhost/cli@latest` and use that form everywhere below. Then run `nhost login` so the CLI has credentials for the Nhost Cloud platform. If an interactive login is not possible, ask me for a personal access token and use it as `NHOST_PAT` in the environment rather than writing it to a file. I create that token under "Personal Access Tokens" at <https://app.nhost.io/account>.

2. Ask me these questions before writing anything:

   - Which project? I need to give you its **subdomain** and **region**.
   - Should the assistant be able to manage the Nhost Cloud platform (list organizations and projects, read and change project configuration)? If yes, ask whether mutations should be enabled, and default to no.
   - Should the assistant be able to change project **data**? Default to read-only.
   - Should the assistant be able to change the project's **schema, metadata, and permissions**? Default to no. This requires an admin secret and is only appropriate for a throwaway or staging project.

3. Create the config file at `.nhost/mcp-nhost.toml`. Start from this read-only template and adjust it only to match my answers:

   ```toml
   [cloud]
   enable_mutations = false

   [[projects]]
   subdomain = "MY_SUBDOMAIN"
   region = "MY_REGION"
   description = "Describe the project here, including whether it holds production data"
   pat = "$NHOST_PROJECT_PAT"
   allow_queries = ["*"]
   allow_mutations = []
   ```

   Notes:

   - Drop the `[cloud]` section entirely if I said no to platform access.
   - `pat` is a project PAT, created against that project's own Auth service. If I do not have one, tell me how to create it: `curl -X POST https://<subdomain>.auth.<region>.nhost.run/v1/pat -H "Authorization: Bearer <access-token>" -H "Content-Type: application/json" -d '{"expiresAt":"2027-01-01T00:00:00Z","metadata":{"name":"mcp"}}'`, using the access token of a signed-in user of that project.
   - Use `admin_secret = "$NHOST_ADMIN_SECRET"` in place of `pat` only if I asked for schema/metadata management, and add `manage_metadata = true` in that case. An admin secret bypasses all permissions.
   - Keep the `$VAR` form and note which variables the file names. The server interpolates them from its own environment at startup, and an unset variable becomes an empty string instead of an error, so step 4 has to put them there.
   - If I asked for specific write access, prefer naming the mutations (`allow_mutations = ["insertComment"]`) over `["*"]`.

4. Register the MCP server with my AI assistant. Pass the credential variables through the client's own server definition: the server reads them from the environment of the process the client spawns, and exporting them in my shell only reaches that process if I launch the client from the same shell, which is never the case for Cursor or any other GUI client. Detect which client I use and apply the matching setup:

   - **Claude Code**: `claude mcp add nhost -e NHOST_PROJECT_PAT=<token> -- nhost mcp start`
   - **Codex CLI**: `codex mcp add nhost --env NHOST_PROJECT_PAT=<token> -- nhost mcp start`
   - **Gemini CLI**: `gemini mcp add -s user -e NHOST_PROJECT_PAT=<token> nhost nhost mcp start`
   - **Cursor** (or any client using an `mcpServers` JSON block):

     ```json
     {
       "mcpServers": {
         "nhost": {
           "command": "nhost",
           "args": ["mcp", "start"],
           "env": {
             "NHOST_PROJECT_PAT": "<token>"
           }
         }
       }
     }
     ```

   Repeat the flag or the key for every variable the config file names, including `NHOST_PAT` and `NHOST_ADMIN_SECRET` if I used those, and drop them if it names none. This is the one place the real credential gets written, so use the client's user-level configuration rather than a project-local file such as `.cursor/mcp.json` that lives in the repository, and never commit it. `-s user` is required for Gemini and not cosmetic: `gemini mcp add` defaults to `-s project`, which puts the token in `.gemini/settings.json` inside the working directory.

   If you are running the CLI through `npx`, swap the command inside those same registrations. The `--` separator is not optional: without it the client CLI parses `-y` as one of its own flags instead of passing it to `npx`.

   - **Claude Code**: `claude mcp add nhost -e NHOST_PROJECT_PAT=<token> -- npx -y @nhost/cli@latest mcp start`
   - **Codex CLI**: `codex mcp add nhost --env NHOST_PROJECT_PAT=<token> -- npx -y @nhost/cli@latest mcp start`
   - **Gemini CLI**: `gemini mcp add -s user -e NHOST_PROJECT_PAT=<token> nhost npx -- -y @nhost/cli@latest mcp start`. Gemini takes the command as a positional argument, so the separator goes after `npx` rather than before it; putting it before makes Gemini reject the command for a missing argument.
   - **Cursor** (or any client using an `mcpServers` JSON block): keep the `env` object and set `"command": "npx"` with `"args": ["-y", "@nhost/cli@latest", "mcp", "start"]`.

   The server reads `.nhost/mcp-nhost.toml` relative to the directory it starts in. If my client launches it somewhere else, add `--config-file=<absolute path>` to the arguments.

5. Verify the setup. Confirm the client lists the `nhost` server and its tools. With `[cloud]` configured, `cloud-graphql-query` should be among them. The tool list alone does not prove the credentials arrived: an unset variable interpolates to an empty string, so the server starts and registers every tool either way. A call that fails with an authentication error while the tool list looks correct means the variable did not reach the server, so check step 4 before you suspect the token itself. If the client is unavailable, run these directly:

   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"MY_SUBDOMAIN","role":"user","summary":true}},"id":1}' | nhost mcp start
   ```

   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"cloud-graphql-query","arguments":{"query":"{ apps { id subdomain name } }"}},"id":1}' | nhost mcp start
   ```

6. Report back what you configured: which project, which credential type, whether mutations and metadata management are on, which environment variables the config file reads, and which client configuration file now holds their values.

EXECUTE NOW: Work through the TODO list above, asking me the questions in step 2 first.

For configuration options, client examples, and the rules for scoping access, see <https://docs.nhost.io/platform/cli/mcp/cloud-setup>.
