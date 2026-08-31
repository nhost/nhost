# Development

The AI service uses the Nhost monorepo's [Nix](https://nixos.org) flake for a reproducible development environment. From `services/ai`, run `make develop`; from the repository root, run `nix develop .#ai`.

## Testing your changes

From `services/ai`:

1. Start the development environment with `make dev-env-up`. This builds the local `ai:0.0.0-dev` image and starts its dependencies. On macOS, use `VER=0.0.0-dev make dev-env-up`.
2. Run the service checks with `make check`.
3. Stop the environment with `make dev-env-down` when finished.

Go dependencies belong in the repository root `go.mod` and `vendor/`. After changing dependencies, run `go mod tidy` and `go mod vendor` from the repository root.

## Hasura client generation

Generate the Hasura client only against a clean, migrated live development schema. Nix's Git-flake source excludes new untracked files, so mark new source and migration files with `git add -N <paths>` (or stage them) before building the image. On macOS, pass the development version explicitly because the shared Makefile's automatic version lookup uses GNU `grep -P`:

```bash
make dev-env-down
VER=0.0.0-dev make dev-env-up
GOEXPERIMENT= go generate .
git diff -- hasura/client_gen.go hasura/models_gen.go > /tmp/ai-hasura-first.diff
GOEXPERIMENT= go generate .
git diff -- hasura/client_gen.go hasura/models_gen.go > /tmp/ai-hasura-second.diff
cmp /tmp/ai-hasura-first.diff /tmp/ai-hasura-second.diff
```

Review the complete generated diff before keeping it. Do not edit `client_gen.go` or `models_gen.go` by hand. If generation changes the client, rebuild and recreate the AI container before live runtime verification; the pre-generation image exists only to publish the schema used by codegen. A live probe against the pinned Hasura v2.48.10 showed that adding or removing a row from the already-tracked provider enum table did not update GraphQL introspection until the default source metadata was reloaded.

The provider enum is backed by rows in `ai.agent_providers`. Values must be valid GraphQL enum names, so the persisted compatible value is `openai_compatible`. The AI startup path introspects `aiAgentProviders_enum`, reloads only the `default` source when that value is absent, and fails startup if re-introspection still cannot see it. Add provider values with append-only PostgreSQL migrations, then regenerate against the migrated live schema.

The public `openai_compatible` enum may be visible in deployments whose external Nhost Cloud or `nhost.toml` configuration cannot yet inject the compatible endpoint. In that case, compatible agents remain unavailable until the service receives the startup configuration. First-class `nhost dev`, `nhost.toml`, and Nhost Cloud injection is external `nhost/be` follow-up tracked as TBD.

## PostgreSQL migration state

In environments where the Nix-provided all-database `migrate` binary panics during `gosnowflake` initialization (observed on macOS), install a temporary PostgreSQL-only binary before running any migration command in this section or `make migrations-add`. The panic occurs on every invocation in affected environments, including `version`, `down`, `force`, and `up`. Run the remaining commands from the same shell; v4.19.1 matches the Nix-provided binary:

```bash
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
GOBIN="$tmpdir" GOFLAGS=-mod=mod go install -tags postgres \
  github.com/golang-migrate/migrate/v4/cmd/migrate@v4.19.1
export PATH="$tmpdir:$PATH"
```

AI migration state is stored in `ai.schema_migrations`. Every manual `migrate` invocation must reuse one DSN containing `search_path=ai`, including `version`, `down`, `force`, and a later `up`:

```bash
export AI_MIGRATION_DSN='postgres://postgres:postgres@localhost:5432/local?sslmode=disable&search_path=ai'
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" version
```

A migration-8 down is intentionally blocked while `ai.agents` references `openai_compatible`; the foreign key is the final safety boundary and no agents are deleted. A failed `down 1` reports target version 7 as dirty even though the migration-8 row remains. Recover with `force 8`, resolve the references, and retry `down 1` with the same DSN.

## OpenAI-compatible smoke tests

These procedures exercise the real AI SSE route, not only Ollama or Cloudflare directly. Run them from `services/ai` in a Nix development shell. Keep credentials in an approved secret store/environment, disable shell tracing with `set +x`, and never copy tokens, header JSON, upstream bodies, or raw service logs into release evidence.

### Ollama streamed text and tool smoke

The recorded local smoke succeeded with Ollama `0.33.2` and `qwen3:0.6b` (model digest `7df6b6e09427a769808717c0a93cadc4ae99ed4eb8bf5ca557c90846becea435`). Ollama reported that model's `completion`, `tools`, and `thinking` capabilities. If Ollama is installed locally:

```bash
ollama serve
ollama pull qwen3:0.6b
```

A disposable Docker alternative matching the recorded smoke is shown below. Check capacity first: Docker Desktop's VM can be full even when the host filesystem has free space. `docker system df` and `docker exec ai-dev-postgres-1 df -h /var/lib/postgresql/data` expose that condition; stop rather than pulling or writing when capacity is exhausted. If appropriate for the workstation, removing unused build cache with `docker builder prune` can recover space without deleting named development volumes.

```bash
docker volume create nhost-ai-ollama-smoke-data
docker run -d --name nhost-ai-ollama-smoke \
  -p 127.0.0.1:11434:11434 \
  -v nhost-ai-ollama-smoke-data:/root/.ollama \
  ollama/ollama:0.33.2
docker exec nhost-ai-ollama-smoke ollama pull qwen3:0.6b
curl --fail --silent http://localhost:11434/api/tags | jq .
```

Start only the AI dependencies. If a previous full environment is running, stop its composed AI service first so port 8090 is free:

```bash
docker compose -f build/dev/docker/docker-compose.yaml --project-name ai-dev stop ai
make dev-env-up-short
```

Run the AI binary on the host so host-local Ollama is reachable as `localhost`. No compatible headers are configured, which proves zero-auth operation. Native OpenAI configuration is explicitly empty:

```bash
OPENAI_API_KEY= \
OPENAI_ORG= \
OPENAI_COMPATIBLE_BASE_URL='http://localhost:11434/v1' \
OPENAI_COMPATIBLE_HEADERS='{}' \
POSTGRES_CONNECTION='postgres://postgres:postgres@localhost:5432/local?sslmode=disable' \
NHOST_GRAPHQL_URL='http://localhost:8080/v1/graphql' \
HASURA_GRAPHQL_ADMIN_SECRET='nhost-admin-secret' \
AI_WEBHOOK_SECRET='ai-secret' \
AI_BASE_URL='http://localhost:8090' \
SYNCH_PERIOD='5m' \
go run . serve --bind='127.0.0.1:8090'
```

In a second terminal, create temporary text and tool fixtures. This direct SQL is only for the disposable local smoke; normal applications create agents and sessions through Hasura with their configured permissions.

```bash
export AI_SMOKE_DSN='postgres://postgres:postgres@localhost:5432/local?sslmode=disable'
export AI_SMOKE_MODEL='qwen3:0.6b'

TEXT_AGENT_ID="$(
  psql "$AI_SMOKE_DSN" -v model="$AI_SMOKE_MODEL" -Atq -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO ai.agents
  (name, description, instructions, provider, model, tools_config)
VALUES
  ('ollama-text-smoke', 'temporary smoke fixture',
   'Answer briefly and directly.', 'openai_compatible', :'model', '{}'::jsonb)
RETURNING id;
SQL
)"
TEXT_SESSION_ID="$(
  psql "$AI_SMOKE_DSN" -v agent_id="$TEXT_AGENT_ID" -Atq -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO ai.agent_sessions (agent_id) VALUES (:'agent_id') RETURNING id;
SQL
)"

curl --fail-with-body --no-buffer --silent --show-error \
  --header 'Content-Type: application/json' \
  --header 'X-Hasura-Admin-Secret: nhost-admin-secret' \
  --data '{"message":"/no_think Reply with exactly: ollama text smoke passed"}' \
  "http://localhost:8090/v1/agents/sessions/$TEXT_SESSION_ID/messages" \
  | tee /tmp/ollama-text-smoke.sse
```

A successful text smoke contains streamed `content_delta` events spelling `ollama text smoke passed`, followed by `event: done`. Create and exercise the GraphQL tool fixture:

```bash
TOOL_AGENT_ID="$(
  psql "$AI_SMOKE_DSN" -v model="$AI_SMOKE_MODEL" -Atq -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO ai.agents
  (name, description, instructions, provider, model, tools_config)
VALUES
  ('ollama-tool-smoke', 'temporary smoke fixture',
   'For provider values, call graphql_query before answering. Do not guess.',
   'openai_compatible', :'model', '{"graphql":{}}'::jsonb)
RETURNING id;
SQL
)"
TOOL_SESSION_ID="$(
  psql "$AI_SMOKE_DSN" -v agent_id="$TOOL_AGENT_ID" -Atq -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO ai.agent_sessions (agent_id) VALUES (:'agent_id') RETURNING id;
SQL
)"

curl --fail-with-body --no-buffer --silent --show-error \
  --header 'Content-Type: application/json' \
  --header 'X-Hasura-Admin-Secret: nhost-admin-secret' \
  --data '{"message":"/no_think Use graphql_query to run: query { aiAgentProviders { value } }. Then say whether openai_compatible is present."}' \
  "http://localhost:8090/v1/agents/sessions/$TOOL_SESSION_ID/messages" \
  | tee /tmp/ollama-tool-smoke.sse

psql "$AI_SMOKE_DSN" -v text_id="$TEXT_SESSION_ID" -v tool_id="$TOOL_SESSION_ID" \
  -P pager=off <<'SQL'
SELECT session_id, role, content, tool_name, tool_call_id, tool_calls
FROM ai.agent_messages
WHERE session_id IN (:'text_id', :'tool_id')
ORDER BY session_id, seq;
SQL
```

Success requires `tool_use_start`, `tool_call`, and `tool_result` events for `graphql_query`, a final streamed answer confirming `openai_compatible`, and `event: done`. The persisted rows must include the assistant tool call, matching tool result, and final assistant text. Clean the fixture and disposable Ollama resources when finished:

```bash
psql "$AI_SMOKE_DSN" -v text_id="$TEXT_AGENT_ID" -v tool_id="$TOOL_AGENT_ID" \
  -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM ai.agents WHERE id IN (:'text_id', :'tool_id');
SQL
docker rm --force nhost-ai-ollama-smoke
docker volume rm nhost-ai-ollama-smoke-data
```

Stop the host `go run` process with Ctrl-C, then restore the shared development environment:

```bash
docker compose -f build/dev/docker/docker-compose.yaml --project-name ai-dev \
  up -d --wait --wait-timeout 120 ai
```

Starting the composed AI service reruns its Hasura setup with Compose's `AI_BASE_URL=http://ai:8090`. This replaces the auto-embeddings event-trigger webhook that the host smoke set to `http://localhost:8090`; leaving that host URL in shared Compose would make Hasura call itself rather than the AI container.

If the composed AI container is used instead of the host binary, configure `OPENAI_COMPATIBLE_BASE_URL=http://host.docker.internal:11434/v1`; do not use `localhost` from inside that container.

### Cloudflare `/compat` release smoke

Credentialed Cloudflare execution belongs to an authorized release maintainer and is required before release, but missing credentials do not block compilation or local quality gates. Streamed text and tool evidence is still pending. The gateway must be named, have an OpenAI provider key stored in Cloudflare, and expose a tool-capable model whose exact `openai/{model}` ID is recorded in the evidence.

Populate the following variables through the approved secret/environment mechanism. The commands validate presence without printing values, let `jq` read the exported token from its environment rather than its process arguments, and validate that the generated JSON contains exactly one `Authorization` header:

```bash
set +x
: "${CLOUDFLARE_ACCOUNT_ID:?set through the approved environment}"
: "${CLOUDFLARE_GATEWAY_ID:?set through the approved environment}"
: "${CLOUDFLARE_API_TOKEN:?set through the approved secret environment}"
: "${CLOUDFLARE_SMOKE_MODEL:?set the exact tool-capable openai/model ID}"

export CLOUDFLARE_API_TOKEN
export OPENAI_COMPATIBLE_BASE_URL="https://gateway.ai.cloudflare.com/v1/${CLOUDFLARE_ACCOUNT_ID}/${CLOUDFLARE_GATEWAY_ID}/compat"
export OPENAI_COMPATIBLE_HEADERS="$(
  jq -nc '{"Authorization":("Bearer " + env.CLOUDFLARE_API_TOKEN)}'
)"
printf '%s\n' "$OPENAI_COMPATIBLE_HEADERS" |
  jq -e '
    type == "object" and
    (keys == ["Authorization"]) and
    (.Authorization |
      (type == "string" and startswith("Bearer ") and (length > 7)))
  ' > /dev/null
unset CLOUDFLARE_API_TOKEN
export AI_SMOKE_MODEL="$CLOUDFLARE_SMOKE_MODEL"
```

With `make dev-env-up-short` running, start the host AI binary. The exported compatible variables are inherited without placing the header JSON in a process argument:

```bash
OPENAI_API_KEY= \
OPENAI_ORG= \
POSTGRES_CONNECTION='postgres://postgres:postgres@localhost:5432/local?sslmode=disable' \
NHOST_GRAPHQL_URL='http://localhost:8080/v1/graphql' \
HASURA_GRAPHQL_ADMIN_SECRET='nhost-admin-secret' \
AI_WEBHOOK_SECRET='ai-secret' \
AI_BASE_URL='http://localhost:8090' \
SYNCH_PERIOD='5m' \
go run . serve --bind='127.0.0.1:8090'
```

Use the text and GraphQL tool fixture commands above with `AI_SMOKE_MODEL` unchanged. The planned stored-provider-key `/compat` smoke has exactly one configured header: `Authorization: Bearer <Cloudflare API token>`.

If the named `/compat` smoke returns `401` while Authenticated Gateway is enabled, stop and record a non-secret `BLOCKED` reason describing that gateway policy. Do not add `cf-aig-authorization` or any other ad-hoc header to this planned smoke. Resolve the named gateway's policy or stored-key configuration through the authorized owner, then rerun with exactly the `Authorization` rule above.

The account endpoint `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1` is another compatible base URL but was not separately tested.

After the smoke, unset the credential-bearing variables and remove the fixtures. If the smoke used the host AI binary, stop it and run the composed-AI restoration command from the Ollama procedure so the shared event-trigger webhook returns to `http://ai:8090`.

```bash
unset OPENAI_COMPATIBLE_HEADERS CLOUDFLARE_API_TOKEN
unset OPENAI_COMPATIBLE_BASE_URL CLOUDFLARE_ACCOUNT_ID CLOUDFLARE_GATEWAY_ID
unset CLOUDFLARE_SMOKE_MODEL AI_SMOKE_MODEL
```

### Secret-free PR evidence

Record evidence in the PR description, never in a committed secret or raw log. Include:

- AI commit/version and UTC timestamp;
- target kind (`Ollama /v1` or named Cloudflare `/compat`) without credentials;
- exact Ollama version/model/digest or exact Cloudflare `openai/{model}`;
- text outcome: multiple `content_delta` events, final sanitized text, and `done`;
- tool outcome: tool name, `tool_call`, sanitized result category, final text, and `done`;
- confirmation that the call passed through the Nhost AI SSE endpoint and persisted the expected message roles;
- explicit `PASS`, or `BLOCKED` plus the non-secret blocker.

Do not include tokens, header JSON, account/gateway identifiers if organizational policy treats them as sensitive, request URLs containing such identifiers, raw upstream errors, or service environment dumps. A placeholder procedure is not successful evidence.

## Deployment fence

Migration-running AI replicas publish the new Hasura enum before every old replica can decode it. Before the first new replica starts, pause creation and use of `openai_compatible` agents. Deploy the migration-running version, then verify every replica directly:

1. `GET /healthz` succeeds and `GET /v1/version` reports the intended version.
2. Hasura introspection contains `openai_compatible` in `aiAgentProviders_enum`.
3. The intended compatible base URL/header configuration is present through the deployment's secret/config mechanism without dumping its value.
4. A release smoke has passed through a known upgraded replica.

Lift the fence only after all replicas pass. Existing native agents are unaffected during rollout, but an older generated client can fail when it loads an `openai_compatible` agent.

## Migration 8 rollback

Freeze compatible-agent creation and use before rollback. Do not deploy the old binary first: its generated Hasura client does not know `openai_compatible`. Before migrating down, prevent every new-version AI replica from starting or restarting. The safest procedure is to scale the new-version deployment or replica set to zero while PostgreSQL and Hasura remain available. If the platform cannot do that, prevent restarts and complete the old-version rollout immediately after the down migration. Any new-version replica that starts will run startup migrations and re-apply migration 8.

Use one DSN with `search_path=ai` for every migration command:

```bash
export AI_MIGRATION_DSN='postgres://user@host/database?sslmode=require&search_path=ai'
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" version

psql "$AI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -P pager=off -c \
  "SELECT id, name, model FROM ai.agents WHERE provider = 'openai_compatible' ORDER BY id;"
```

If the preflight returns rows, deliberately reassign them to a valid native provider/model or delete them according to the application's data-retention decision. The down migration never cascades agent deletion. Run the preflight again and proceed only when it returns zero rows:

```bash
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" down 1
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" version
psql "$AI_MIGRATION_DSN" -v ON_ERROR_STOP=1 -c \
  'TABLE ai.schema_migrations;'
```

If `down 1` fails because a reference raced the preflight, migration state is target version 7 dirty while the migration-8 enum row remains. Do not run `up 1`. Restore the accurate clean version marker, resolve all references, and retry down with the same DSN:

```bash
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" force 8
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" version
# Re-run the reference query and resolve every returned row.
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" down 1
```

Reload only the default Hasura source and re-introspect. Each `printf` is a shell builtin that feeds the admin-secret header to curl over standard input, keeping it out of both process arguments and temporary files. This also preserves the temporary migrate binary's existing `EXIT` cleanup instead of replacing its trap:

```bash
set +x
: "${HASURA_HTTP_URL:?set the Hasura origin, without /v1 paths}"
: "${HASURA_GRAPHQL_ADMIN_SECRET:?set through the approved secret environment}"

printf 'x-hasura-admin-secret: %s\n' "$HASURA_GRAPHQL_ADMIN_SECRET" |
  curl --fail-with-body --silent --show-error \
    --header @- \
    --header 'Content-Type: application/json' \
    --data '{"type":"reload_metadata","args":{"reload_sources":["default"],"reload_remote_schemas":false,"recreate_event_triggers":false,"reload_data_connectors":false}}' \
    "$HASURA_HTTP_URL/v1/metadata" > /dev/null

printf 'x-hasura-admin-secret: %s\n' "$HASURA_GRAPHQL_ADMIN_SECRET" |
  curl --fail-with-body --silent --show-error \
    --header @- \
    --header 'Content-Type: application/json' \
    --data '{"query":"query { __type(name: \"aiAgentProviders_enum\") { enumValues { name } } }"}' \
    "$HASURA_HTTP_URL/v1/graphql" | jq .
```

Verify that introspection no longer contains `openai_compatible` and compatible use remains fenced, then deploy the older binary promptly. After the old binary is live, verify its health and version endpoint, and re-check the migration version:

```bash
migrate -path ./migrations/postgres -database "$AI_MIGRATION_DSN" version
```

The result must still be clean version 7. If it reports version 8, a new-version replica restarted and re-applied the migration; scale new-version replicas to zero and repeat the reference preflight, down migration, and Hasura verification before proceeding. If rollback is cancelled after a successful down to clean version 7, restore migration 8 with `up 1`, reload/re-introspect Hasura, deploy the new binary, and repeat the mixed-replica verification before lifting the fence.
