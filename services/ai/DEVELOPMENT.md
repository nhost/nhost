# Development

The AI service uses the Nhost monorepo's [Nix](https://nixos.org) flake for a reproducible development environment. From `services/ai`, run `make develop`; from the repository root, run `nix develop .#ai`.

## Testing your changes

From `services/ai`:

1. Start the development environment with `make dev-env-up`. This builds the local `ai:0.0.0-dev` image and starts its dependencies.
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

The public `openai_compatible` enum may be visible in deployments whose external Nhost Cloud or `nhost.toml` configuration cannot yet inject the compatible endpoint. In that case, compatible agents remain unavailable until the service receives the startup configuration.

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
