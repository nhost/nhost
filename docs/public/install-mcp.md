# nhost-mcp

> The Nhost CLI ships an MCP server that connects an AI assistant to an Nhost project so it can read the GraphQL schema, run queries and mutations, and manage Hasura metadata and migrations. It works against a local project started with `nhost up` and against a project on Nhost Cloud.

STOP FIRST: If all I want is to ask questions about my organizations, projects and deployments, do not use this file. Tell me to add <https://mcp.nhost.io> as a remote connector in my client and sign in when prompted. That server is hosted by Nhost and needs no CLI, no config file and no token, but it is read-only and cannot reach a project's own data or change anything. Ask me which I want before continuing. Everything below is for reaching a project's own data and schema, or for write access.

I want you to set up the Nhost MCP server for me. Ask me the question in step 1 first, then follow only the branch that matches my answer. Stop to ask me whenever a step needs a decision or a value only I have.

OBJECTIVE: Configure the Nhost CLI MCP server against the project I name and register it with my AI assistant, granting nothing I did not explicitly ask for.

DONE WHEN: My AI assistant lists the Nhost MCP tools and `get-schema` returns the schema of the project I named.

## TODO

- [ ] Ask whether this is a local project or a project on Nhost Cloud
- [ ] Confirm the Nhost CLI is installed and the prerequisites for that branch are met
- [ ] Cloud only: ask which project and which kind of access I want
- [ ] Check for an existing config file, then create `.nhost/mcp-nhost.toml`
- [ ] Register the MCP server with my AI assistant
- [ ] Verify the tools are available and `get-schema` works

## Steps

1. Ask me which kind of project this is, and do not write anything until I answer:

   - **Local** — a project running on my machine through `nhost up`. Full access is fine; nothing here is real.
   - **Nhost Cloud** — a hosted project that may hold real data. Access is scoped, and credentials are involved.

   Everything below is split into a **Local** and a **Cloud** branch. Follow only the one I chose. If I want both in one configuration, do the Local branch first and then work through steps 4 and 5 in full for the cloud half, adding it as a second `[[projects]]` entry instead of replacing the local one. Do not skip those steps: they carry the access questions and the credential rules, and neither is optional just because a local project is already configured.

2. **Local branch.** Confirm prerequisites. Run `nhost --version` to check the CLI is installed. If it is missing, install it with `curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash`. Then make sure the local stack is running with `nhost up` (this requires Docker). The local GraphQL endpoint is `https://local.graphql.local.nhost.run/v1`.

3. **Local branch.** Check whether `.nhost/mcp-nhost.toml` already exists before writing anything. If it is there, show me what it holds and ask before overwriting it, and offer to keep both by adding the local project as another `[[projects]]` entry.

   Then create the config file at `.nhost/mcp-nhost.toml` in the project root with the following contents. This grants full access, which is appropriate only because `subdomain = "local"` names a stack running on my machine. Never use this template with a real subdomain and region; that is what the Cloud branch is for.

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

   No credentials are involved: `nhost-admin-secret` is the CLI's fixed local value, not a secret.

   If I asked for a local project only, skip to step 6. If I asked for both, continue to step 4 now and do the cloud half before registering anything.

4. **Cloud branch.** Confirm prerequisites. Run `nhost --version`. If the CLI is missing, either install it with `curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash`, or plan to run it through `npx -y @nhost/cli@latest` and use that form everywhere below. Then run `nhost login` so the CLI has credentials for the Nhost Cloud platform. If an interactive login is not possible, ask me for a personal access token and use it as `NHOST_PAT` in the environment rather than writing it to a file. I create that token under "Personal Access Tokens" at <https://app.nhost.io/account>.

   IMPORTANT, for this branch only: this points at real data. Do not widen access beyond what I ask for. Never write a real token or admin secret into `mcp-nhost.toml`, or into any other file inside the repository. In the config file use `$VAR` interpolation, which the server expands at startup. Note the syntax is `$VAR` and not `${VAR}`; braces are not supported and would be sent literally as the credential. The real value belongs in my client's own configuration (step 6) and nowhere else. Never commit credentials. Read-only is not the same as harmless: platform read access exposes secrets in plaintext, so treat the second question below as a real decision rather than a safe default.

5. **Cloud branch.** Ask me these questions before writing anything:

   - Which project? I need to give you its subdomain and region.
   - Should the assistant be able to manage the Nhost Cloud platform (list organizations and projects, read and change project configuration)? Default to no. Before I answer, tell me what read access to the platform actually includes: every project's environment variables and secrets, in plaintext, for every project my account can see, including the Hasura admin secret. Setting `enable_mutations = false` does not reduce that. It blocks writes only, and the entire platform schema stays readable, so an assistant with platform access can read the admin secret of a production project and use it elsewhere. Only say yes if I want that. If I do, ask separately whether mutations should be enabled, and default to no.
   - Should the assistant be able to change project data? Default to read-only.
   - Should the assistant be able to change the project's schema, metadata, and permissions? Default to no. This requires an admin secret and is only appropriate for a throwaway or staging project.

   Then check whether `.nhost/mcp-nhost.toml` already exists before writing anything. If it is there, show me what it holds and ask before overwriting it, and offer to keep both by adding the cloud project as another `[[projects]]` entry.

   Create the config file at `.nhost/mcp-nhost.toml`. Start from this template, which grants project access only, and adjust it to match my answers:

   ```toml
   [[projects]]
   subdomain = "MY_SUBDOMAIN"
   region = "MY_REGION"
   description = "Describe the project here, including whether it holds production data"
   pat = "$NHOST_PROJECT_PAT"
   allow_queries = ["*"]
   allow_mutations = []
   ```

   Notes:

   - Add a `[cloud]` section only if I explicitly said yes to platform access, and only then:

     ```toml
     [cloud]
     enable_mutations = false
     ```

     This is the section that exposes every project's secrets and admin secret to the assistant, so leave it out unless I asked for it.
   - `pat` is a project PAT, created against that project's own Auth service. If I do not have one, tell me how to create it: `curl -X POST https://<subdomain>.auth.<region>.nhost.run/v1/pat -H "Authorization: Bearer <access-token>" -H "Content-Type: application/json" -d '{"expiresAt":"2027-01-01T00:00:00Z","metadata":{"name":"mcp"}}'`, using the access token of a signed-in user of that project.
   - Use `admin_secret = "$NHOST_ADMIN_SECRET"` in place of `pat` only if I asked for schema/metadata management, and add `manage_metadata = true` in that case. An admin secret bypasses all permissions.
   - Keep the `$VAR` form and note which variables the file names. The server interpolates them from its own environment at startup, and an unset variable becomes an empty string instead of an error, so step 6 has to put them there.
   - If I asked for specific write access, prefer naming the mutations (`allow_mutations = ["insertComment"]`) over `["*"]`.

6. **Both branches.** Register the MCP server with my AI assistant. Detect which client I use and apply the matching setup.

   On the Local branch there are no credentials to pass, so use the plain form:

   - Claude Code: `claude mcp add nhost nhost mcp start`
   - Codex CLI: `codex mcp add nhost -- nhost mcp start`
   - Gemini CLI: `gemini mcp add -s user nhost nhost mcp start`
   - Cursor (or any client using an `mcpServers` JSON block):

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

   On the Cloud branch, pass the credential variables through the client's own server definition: the server reads them from the environment of the process the client spawns, and exporting them in my shell only reaches that process if I launch the client from the same shell, which is never the case for Cursor or any other GUI client.

   - Claude Code: `claude mcp add nhost -e NHOST_PROJECT_PAT=<token> -- nhost mcp start`
   - Codex CLI: `codex mcp add nhost --env NHOST_PROJECT_PAT=<token> -- nhost mcp start`
   - Gemini CLI: `gemini mcp add -s user -e NHOST_PROJECT_PAT=<token> nhost nhost mcp start`
   - Cursor (or any client using an `mcpServers` JSON block):

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

   The CLI-based clients refuse to overwrite a server that already exists rather than updating it, so if `nhost` was registered earlier, remove it first with `claude mcp remove nhost`, `codex mcp remove nhost`, or `gemini mcp remove -s user nhost`, then run the command above again.

   If you are running the CLI through `npx`, swap the command inside those same registrations. The `--` separator is not optional: without it the client CLI parses `-y` as one of its own flags instead of passing it to `npx`.

   - Claude Code: `claude mcp add nhost -- npx -y @nhost/cli@latest mcp start`
   - Codex CLI: `codex mcp add nhost -- npx -y @nhost/cli@latest mcp start`
   - Gemini CLI: `gemini mcp add -s user nhost npx -- -y @nhost/cli@latest mcp start`, or with a credential on the Cloud branch, `gemini mcp add -s user -e NHOST_PROJECT_PAT=<token> nhost npx -- -y @nhost/cli@latest mcp start`. Gemini takes the command as a positional argument, so the separator goes after `npx` rather than before it; putting it before makes Gemini reject the command for a missing argument.
   - Cursor (or any client using an `mcpServers` JSON block): set `"command": "npx"` with `"args": ["-y", "@nhost/cli@latest", "mcp", "start"]`.

   Add the credential flags or the `env` object to those `npx` forms too if I am on the Cloud branch.

   The server reads `.nhost/mcp-nhost.toml` relative to the directory it starts in. If my client launches it somewhere else, add `--config-file=<absolute path>` to the arguments.

7. **Both branches.** Verify the setup. Confirm the client lists the `nhost` server and its tools.

   On the Cloud branch the tool list alone does not prove the credentials arrived: an unset variable interpolates to an empty string, so the server starts and registers every tool either way. A call that fails with an authentication error while the tool list looks correct means the variable did not reach the server, so check step 6 before you suspect the token itself.

   If the client is unavailable, run the project check directly. On the Local branch:

   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"local","role":"admin","summary":true}},"id":1}' | nhost mcp start
   ```

   On the Cloud branch, substituting my subdomain. This runs in my own shell rather than the one the client spawns, so export the variables the config file names first (for example `export NHOST_PROJECT_PAT=<token>`), or it will fail on auth for that reason alone:

   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"MY_SUBDOMAIN","role":"user","summary":true}},"id":1}' | nhost mcp start
   ```

   Run the next one only if I said yes to platform access and you added a `[cloud]` section. Otherwise skip it: `cloud-graphql-query` is registered only when `[cloud]` is present, so without that section the call returns `tool 'cloud-graphql-query' not found`, which is the expected result rather than something to debug. This command authenticates from my CLI session (`nhost login`) or `NHOST_PAT`, not from the config file, so the exports above do not apply to it:

   ```bash
   echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"cloud-graphql-query","arguments":{"query":"{ apps { id subdomain name } }"}},"id":1}' | nhost mcp start
   ```

8. **Both branches.** Report back what you configured: which branch, which project, which credential type if any, whether mutations and metadata management are on, which environment variables the config file reads, and which client configuration file now holds their values.

EXECUTE NOW: Work through the TODO list above, asking me the question in step 1 first.

For configuration options, client examples, and the rules for scoping access, see <https://docs.nhost.io/platform/cli/mcp> and <https://docs.nhost.io/platform/cli/mcp/cloud-setup>.
