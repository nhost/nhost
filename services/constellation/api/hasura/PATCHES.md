# `metadata.openapi.json` — local patches

`api/hasura/metadata.openapi.json` is a vendored copy of
`third-party/hasura/graphql-engine/metadata.openapi.json` (Apache-2.0). It
provides the 334 component schemas that describe `/v1/metadata` request and
response bodies. `api/hasura/types.cfg.yaml` codegens Go types from it into
this directory so they're available when we migrate metadata operations off
Hasura.

The vendored copy is modified to be parsable by `kin-openapi` /
`oapi-codegen` 2.5.1. None of the changes alter semantics — they remove or
normalise expressions that the upstream spec generator emits but our toolchain
cannot consume.

## Patches applied vs upstream

1. **`maximum: <Float64.MaxValue>` removed** (2 occurrences, both under
   `Limit_MaxTime`). `kin-openapi` overflows decoding a number larger than
   `float64`. With `minimum: 0` retained and no upper bound, the schema
   admits exactly the same values as before.

2. **`{"type": "null"}` standalone schemas replaced with `{}`** (6
   occurrences, mostly `items: {type: null}` under `BackendMap_*`). `type:
   null` as a standalone OpenAPI 3.0 type isn't supported by `oapi-codegen`;
   `{}` (empty schema) preserves the "no constraint" intent.

3. **`{"type": "null"}` removed from `anyOf` members** (2 occurrences, both
   under `GraphQLValue_Name`). Same reason as above; the union still admits
   all primitive GraphQL values.

4. **Duplicate `anyOf` / `oneOf` / `allOf` members deduped** (21 occurrences,
   e.g. `BigQueryConnSourceConfig.service_account.anyOf` listed
   `BigQueryServiceAccount` twice). `oapi-codegen` emits one
   `As/From/Merge<T>` method per member, so duplicates produce duplicate
   methods and a compile error.

## Re-syncing from upstream

When `third-party/hasura/graphql-engine/metadata.openapi.json` updates:

1. `bash nhost/services/constellation/api/hasura/sync.sh` — copies the
   upstream file into this directory and re-applies the four scrubs.
2. `cd nhost/services/constellation && go generate ./...`
3. `go build ./...`
