# nhost-mcp

> The Nhost CLI ships an MCP server that connects an AI assistant to an Nhost project so it can read the GraphQL schema, run queries and mutations, and manage Hasura metadata and migrations. It works against a local project started with `nhost up` and against a project on Nhost Cloud.

STOP FIRST: If all I want is to ask questions about my organizations, projects and deployments, do not use this file. Tell me to add <https://mcp.nhost.io> as a remote connector in my client and sign in when prompted. That server is hosted by Nhost and needs no CLI, no config file and no token, but it is read-only and cannot reach a project's own data or change anything. Ask me which I want before continuing. Everything below is for reaching a project's own data and schema, or for write access.

I want you to set up the Nhost MCP server for me. Work through the phases in order. Phase 1 collects every decision, so ask all of its questions before you run a command or write a file.

OBJECTIVE: Configure the Nhost CLI MCP server against the project I name and register it with my AI assistant, granting nothing I did not explicitly ask for.

DONE WHEN: My AI assistant lists the Nhost MCP tools and `get-schema` returns the schema of the project I named.

## Credential rules

These apply to every phase and override any step that looks like it asks otherwise.

- Never print, echo, `cat` or repeat a credential value: not in your reply, not in a command you run, not in a file inside the repository. Assume everything you output is written to a log that I cannot redact afterwards.
- Never open or print a file that can hold a credential. That includes an existing `.nhost/mcp-nhost.toml`, which may already hold a hardcoded token, and every client configuration file, which holds real values by design: `~/.claude.json`, `~/.codex/config.toml`, `~/.gemini/settings.json`, `.gemini/settings.json`, `.cursor/mcp.json` and the Cursor user settings. If you need to know what is in one of them, ask me and let me look.
- Never run `nhost mcp config dump`. It resolves `$VAR` references against the environment and prints the real values, so it leaks a credential even when the file itself stores it correctly. The same goes for any client command that prints a server's environment, such as `claude mcp get`.
- In `mcp-nhost.toml`, a credential is always a `$VAR` reference and never a literal value.
- When a command needs a real value, write `"$VAR"` and let the shell expand it, so the literal never appears in the command you run.
- To check a variable is set, test it without revealing it:

  ```bash
  [ -n "${NHOST_PROJECT_PAT:-}" ] && echo set || echo unset
  ```

- If a command you run returns something that looks like a credential, do not repeat it back to me. Say which command it came from and that you are not quoting it.
- If a step cannot be completed without a literal credential passing through you, stop and give me the exact command to run myself.

## TODO

- [ ] Phase 1: collect every decision
- [ ] Phase 2: check prerequisites and any existing configuration
- [ ] Phase 3: confirm the credentials are in the environment
- [ ] Phase 4: agree the configuration before writing it
- [ ] Phase 5: write it, register the server, verify
- [ ] Phase 6: report back

## Phase 1. Collect every decision

Ask all of the questions that apply before you run a command or write a file. Do not start work after the first answer.

1. Is this a local project, a project on Nhost Cloud, or both?

   - Local: a project running on my machine through `nhost up`. Full access is fine, nothing there is real.
   - Nhost Cloud: a hosted project that may hold real data. Access is scoped and credentials are involved.
   - Both: two `[[projects]]` entries in one configuration. Ask the cloud questions below as well.

   If I said local only, skip to question 6.

2. Which cloud project? I need to give you its subdomain and region.

3. Should the assistant be able to change that project's data? Default to read-only.

4. Should the assistant be able to change that project's schema, metadata and permissions? Default to no. This requires an admin secret, which bypasses every permission rule, so it is only appropriate for a throwaway or staging project.

5. Should the assistant be able to manage the Nhost Cloud platform, meaning list organizations and projects and read and change project configuration? Default to no.

   Before I answer, tell me what read access to the platform actually includes: every project's environment variables and secrets, in plaintext, for every project my account can see, including the Hasura admin secret. Setting `enable_mutations = false` does not reduce that. It blocks writes only, and the entire platform schema stays readable, so an assistant with platform access can read the admin secret of a production project and use it elsewhere. Only say yes if I want that. If I do, ask separately whether mutations should be enabled, and default to no.

6. Which client am I registering this with? Detect it if you can and confirm with me. Claude Code, Codex CLI, Gemini CLI and Cursor have known setups; anything else that takes an `mcpServers` JSON block works like Cursor.

Then restate my answers as a short list: which projects, what each one may read and write, whether platform access is on, and which client. Wait for me to confirm that list before moving to phase 2. Everything after this point follows the list and adds nothing to it.

## Phase 2. Prerequisites and existing configuration

Run `nhost --version` to check the CLI is installed. If it is missing, either install it with `curl -sSL https://raw.githubusercontent.com/nhost/nhost/main/cli/get.sh | bash`, or plan to run it through `npx -y @nhost/cli@latest` and use that form everywhere below.

For a local project, make sure the stack is running with `nhost up`. This requires Docker. The local GraphQL endpoint is `https://local.graphql.local.nhost.run/v1`.

For a cloud project, run `nhost login` so the CLI has credentials for the Nhost Cloud platform. If an interactive login is not possible, I will set a personal access token as `NHOST_PAT` in the environment instead, and you confirm it in phase 3 rather than asking me to paste it. I create that token under "Personal Access Tokens" at <https://app.nhost.io/account>.

Then check whether `.nhost/mcp-nhost.toml` exists. Test for its presence only:

```bash
[ -f .nhost/mcp-nhost.toml ] && echo exists || echo absent
```

If it is absent, say so and go to phase 3.

If it exists, do not open it, do not print it, and do not try to summarise it. It may hold a hardcoded token or admin secret, and any attempt to filter the file as you read it will leak the cases you did not anticipate. Ask me instead:

- Open `.nhost/mcp-nhost.toml` yourself and confirm that every `pat` and `admin_secret` value is a `$VAR` reference rather than a literal. Tell me yes or no. Do not paste the file.
- Tell me which projects it already configures, by subdomain, and whether it has a `[cloud]` section.

If I say no, or if I am not sure, stop. Tell me to move the value into an environment variable and rotate the credential that was sitting in the file, and do not continue until I say so.

If I say yes, add my new entry alongside what is there rather than rewriting the file, so you never need its contents. Appending does not require reading it.

## Phase 3. Confirm the credentials are in the environment

A local project needs no credentials. Its `admin_secret` is `nhost-admin-secret`, the CLI's fixed local value, which is not a secret. If I asked for a local project only, go to phase 4.

For a cloud project, tell me which variables the configuration will name, based on my phase 1 answers:

- `NHOST_PROJECT_PAT` for project access through a PAT, which is the default.
- `NHOST_ADMIN_SECRET` instead, if I said yes to managing schema and metadata.
- `NHOST_PAT` as well, if I said yes to platform access and `nhost login` was not possible.

Ask me to export each one in the shell you run commands in, then confirm it is set without printing it:

```bash
for v in NHOST_PROJECT_PAT NHOST_ADMIN_SECRET NHOST_PAT; do
  eval "val=\${$v:-}"
  [ -n "$val" ] && echo "$v: set" || echo "$v: unset"
done
```

Only report set or unset. Do not print a length, a prefix, a suffix or any other part of a value.

If I need a project PAT and do not have one, tell me how to create one and let me run it myself. It is made against that project's own Auth service, using the access token of a signed-in user of that project:

```bash
curl -X POST https://<subdomain>.auth.<region>.nhost.run/v1/pat \
  -H "Authorization: Bearer <access-token>" \
  -H "Content-Type: application/json" \
  -d '{"expiresAt":"2027-01-01T00:00:00Z","metadata":{"name":"mcp"}}'
```

If a variable I asked for stays unset, do not work around it and do not write the value into the configuration. Say which one is missing and wait.

## Phase 4. Agree the configuration before writing it

Build the exact configuration from my phase 1 answers, show it to me, and wait for me to confirm before writing anything. If phase 2 found an existing file, show only the entry you intend to append, not a rewritten file.

For a local project:

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

Full access is appropriate here only because `subdomain = "local"` names a stack running on my machine. Never use this template with a real subdomain and region.

For a cloud project, start from this, which grants read access to one project's data and nothing else, and widen it only where my answers said to:

```toml
[[projects]]
subdomain = "MY_SUBDOMAIN"
region = "MY_REGION"
description = "Describe the project here, including whether it holds production data"
pat = "$NHOST_PROJECT_PAT"
allow_queries = ["*"]
allow_mutations = []
```

Adjust it as follows:

- If I said the assistant may change project data, fill in `allow_mutations`. Prefer naming the mutations, as in `allow_mutations = ["insertComment"]`, over `["*"]`.
- If I said yes to managing schema and metadata, replace `pat` with `admin_secret = "$NHOST_ADMIN_SECRET"` and add `manage_metadata = true`.
- If I said yes to platform access, and only then, add a `[cloud]` section:

  ```toml
  [cloud]
  enable_mutations = false
  ```

  Set `enable_mutations = true` only if I separately said yes to that. This is the section that exposes every project's secrets and admin secret to the assistant, so leave it out unless I asked for it.
- If I asked for both a local and a cloud project, the file holds two `[[projects]]` entries, one of each.

Two things about the `$VAR` form, which both branches depend on:

- The syntax is `$VAR`, not `${VAR}`. Braces are not supported and the whole `${VAR}` would be sent literally as the credential.
- An unset variable interpolates to an empty string rather than raising an error, so the server starts and registers every tool either way. That is why phase 3 confirms the variables first.

When you show me the file, list which environment variables it names. Phase 5 has to put those same variables into my client's configuration.

## Phase 5. Write it, register the server, verify

Write the agreed configuration to `.nhost/mcp-nhost.toml` in the project root, appending to the file if phase 2 found one.

The file holds only `$VAR` references, so it is safe to commit, but check whether it is tracked and tell me what you find, because anyone who later replaces a reference with a literal would be committing a credential:

```bash
git check-ignore -q .nhost/mcp-nhost.toml && echo ignored || echo "not ignored"
```

Then register the server with the client I named in phase 1.

With no credentials, which is the local-only case, use the plain form:

- Claude Code: `claude mcp add nhost nhost mcp start`
- Codex CLI: `codex mcp add nhost -- nhost mcp start`
- Gemini CLI: `gemini mcp add -s user nhost nhost mcp start`
- Cursor, or any client using an `mcpServers` JSON block:

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

With credentials, pass them through the client's own server definition. The server reads them from the environment of the process the client spawns, and exporting them in my shell only reaches that process if I launch the client from the same shell, which is never the case for Cursor or any other GUI client.

Write the variable, not the value, and let the shell expand it, so the literal never appears in the command you run:

- Claude Code: `claude mcp add nhost -e NHOST_PROJECT_PAT="$NHOST_PROJECT_PAT" -- nhost mcp start`
- Codex CLI: `codex mcp add nhost --env NHOST_PROJECT_PAT="$NHOST_PROJECT_PAT" -- nhost mcp start`
- Gemini CLI: `gemini mcp add -s user -e NHOST_PROJECT_PAT="$NHOST_PROJECT_PAT" nhost nhost mcp start`

For Cursor and other JSON clients the value has to be written into the file. Do not do that yourself, because it would mean putting the literal in your output. Give me the block to fill in and tell me where it goes:

```json
{
  "mcpServers": {
    "nhost": {
      "command": "nhost",
      "args": ["mcp", "start"],
      "env": {
        "NHOST_PROJECT_PAT": "<paste your project PAT here>"
      }
    }
  }
}
```

Repeat the flag or the key for every variable the configuration file names, including `NHOST_PAT` and `NHOST_ADMIN_SECRET` if I used those. This is the one place the real credential gets written, so use the client's user-level configuration rather than a project-local file such as `.cursor/mcp.json` that lives in the repository, and never commit it. `-s user` is required for Gemini and not cosmetic: `gemini mcp add` defaults to `-s project`, which puts the token in `.gemini/settings.json` inside the working directory.

The CLI-based clients refuse to overwrite a server that already exists rather than updating it, so if `nhost` was registered earlier, remove it first with `claude mcp remove nhost`, `codex mcp remove nhost` or `gemini mcp remove -s user nhost`, then run the command again.

If I am running the CLI through `npx`, swap the command inside those same registrations. The `--` separator is not optional: without it the client CLI parses `-y` as one of its own flags instead of passing it to `npx`.

- Claude Code: `claude mcp add nhost -- npx -y @nhost/cli@latest mcp start`
- Codex CLI: `codex mcp add nhost -- npx -y @nhost/cli@latest mcp start`
- Gemini CLI: `gemini mcp add -s user nhost npx -- -y @nhost/cli@latest mcp start`. Gemini takes the command as a positional argument, so the separator goes after `npx` rather than before it; putting it before makes Gemini reject the command for a missing argument.
- Cursor, or any client using an `mcpServers` JSON block: set `"command": "npx"` with `"args": ["-y", "@nhost/cli@latest", "mcp", "start"]`.

Add the credential flags or the `env` object to those `npx` forms too.

The server reads `.nhost/mcp-nhost.toml` relative to the directory it starts in. If my client launches it somewhere else, add `--config-file=<absolute path>` to the arguments.

Then verify. Confirm the client lists the `nhost` server and its tools. For a cloud project the tool list alone does not prove the credentials arrived, because an unset variable interpolates to an empty string and the server registers every tool either way. A call that fails with an authentication error while the tool list looks correct means the variable did not reach the server, so check the registration before suspecting the token.

If the client is unavailable, run the check directly. For a local project:

```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"local","role":"admin","summary":true}},"id":1}' | nhost mcp start
```

For a cloud project, substituting my subdomain. This runs in your own shell rather than the one the client spawns, so it uses the variables confirmed in phase 3:

```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"get-schema","arguments":{"subdomain":"MY_SUBDOMAIN","role":"user","summary":true}},"id":1}' | nhost mcp start
```

Run the next one only if I said yes to platform access and you added a `[cloud]` section. Otherwise skip it: `cloud-graphql-query` is registered only when `[cloud]` is present, so without that section the call returns `tool 'cloud-graphql-query' not found`, which is the expected result rather than something to debug. This command authenticates from my CLI session or `NHOST_PAT`, not from the configuration file:

```bash
echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"cloud-graphql-query","arguments":{"query":"{ apps { id subdomain name } }"}},"id":1}' | nhost mcp start
```

## Phase 6. Report back

Tell me what you configured: which projects, which credential type each one uses, whether mutations and metadata management are on, whether `[cloud]` is present, which environment variables the configuration file reads, and which client configuration file now holds their values. Name the variables, never their values.

Then tell me what is left for me to do, including anything you stopped on: a plaintext credential found in phase 2, a variable that stayed unset, or a JSON client block I still have to fill in.

EXECUTE NOW: Start with phase 1 and ask every question that applies before you run a command or write a file.

For configuration options, client examples, and the rules for scoping access, see <https://docs.nhost.io/platform/cli/mcp> and <https://docs.nhost.io/platform/cli/mcp/cloud-setup>.
