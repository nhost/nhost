# Hasura metadata-test → Constellation porting map

Triage of Hasura's PostgreSQL metadata tests for parity porting (task #1).
Each Hasura case is mapped to a Constellation op (`BuildMutation` in
`metadata/source/ops_postgres.go`) and classified:

> **Harness location:** the offline replay harness lives in the **`controller`**
> package (`controller/metadata_parity_replay_internal_test.go`), not
> `metadata/source` as task #2 originally suggested. The HTTP-layer error→code
> mapping (`classifyMutationError`), the 200-vs-400 / idempotency decision
> (`finishMutation`), and the bulk dispatchers all live in `controller`;
> replaying through `buildMutationRouter` exercises the exact wire bytes a client
> receives. Case files live next to this map under
> `controller/testdata/hasura/<family>/*.yaml`.

- **OFFLINE** — portable into the in-process replay harness (task #2). Covers
  arg/structural validation, idempotency codes, dependency-error, bulk dispatch
  semantics, and whole-metadata round-trips. No live Hasura / data DB needed.
- **LIVE** — needs DB introspection (FK-constraint existence, enum-table
  validity, column types) or an SDL-surface diff; goes into the live two-engine
  parity harness `integration/metadata_parity_cases_test.go` (task #10).
- **SKIP** — op or sub-feature we do not implement on this branch, or tested at a
  different layer (auth/middleware). Reason given inline.

## Grounding facts (verified against this branch)

- Our metadata ops are **pure metadata transforms**: `BuildMutation` has no DB
  handle. Anything that requires reading the data DB (FK graph, column types,
  enum validity) cannot be asserted offline → LIVE.
- Error codes are produced by `controller/metadata_mutations.go:classifyMutationError`.
  Codes we emit: `conflict`, `not-exists`, `dependency-error`, `already-exists`,
  `already-untracked`, `already-tracked` (idempotency, `ops_postgres.go`),
  `not-supported`, `validation-failed`.
- Wire form is **source-aware `pg_*`** with `source` + `table:{schema,name}`.
  Legacy `tests-py` cases use the non-source shorthand (`type: track_table`,
  `table: author`) and must be rewritten on port.
- **No `access-denied` / `permission-denied` code** in our metadata layer — the
  `/v1/metadata` endpoint is admin-gated in middleware. All "as not admin"
  cases are **SKIP** here (auth is covered by middleware tests).
- **Not implemented on this branch** (→ SKIP): `drop_inconsistent_metadata`,
  `pg_add_source` / `rename_source` / multi-source, `allow_warnings` / the
  warnings result object, `get_table_info` / `list_source_kinds`.
  Implemented: `clear_metadata`, `export_metadata`, `reload_metadata`,
  `replace_metadata`, `get_inconsistent_metadata`, `pg_suggest_relationships`,
  `pg_get_viewdef`.

---

## track / untrack tables → task #3 (OFFLINE) / #10 (LIVE)

Source: `tests-py/queries/v1/track_table/`, api-tests `TrackTablesSpec`,
`UntrackTablesSpec`, `TablesSpec`.

| Case | Op | Pinned result | Class |
|---|---|---|---|
| `track_untrack_table.yaml` (track) | pg_track_table | 200 `message: success` | OFFLINE |
| `track_untrack_table.yaml` (re-track) | pg_track_table | 400 `already-tracked` `view/table already tracked: "author"` path `$.args` | OFFLINE |
| `track_untrack_table.yaml` (untrack) | pg_untrack_table | 200 success | OFFLINE |
| `track_untrack_table.yaml` (re-untrack) | pg_untrack_table | 400 `already-untracked` `view/table already untracked: "author"` | OFFLINE |
| `track_untrack_materialized_view.yaml` | pg_track_table/untrack | same codes as above for a matview | OFFLINE (track/untrack arms only; the `__type` introspection + select arms are SKIP) |
| `track_untrack_table_non_public_schema.yaml` | pg_track_table | 200; schema `hge_tests` | OFFLINE |
| `track_untrack_table_deps.yaml` (untrack w/ deps) | pg_untrack_table | 400 `dependency-error` `cannot drop due to the following dependent objects: relationship article.author in source "default"` | OFFLINE (cascade logic already in `ops_untrack_cascade_internal_test.go`; this adds the wire wording) |
| `track_untrack_table_deps.yaml` (untrack cascade) | pg_untrack_table `cascade:true` | 200 success | OFFLINE |
| `track_non_graphql_compliant_table.yaml` | pg_track_table | 200 (name `users address`) | OFFLINE |
| `track_function_table_same_name.yaml` | pg_track_table (table name == tracked function) | 400 `not-supported` `function with name "test1" already exists` | OFFLINE — *verify our impl enforces this; if not, follow-up bug, do not relax* |
| `track_table_function_same_name.yaml` | pg_track_function (== tracked table) | 400 `not-supported` `table with name "test1" already exists` | OFFLINE — *verify; else follow-up* |
| `track_untrack_table_as_not_admin_error.yaml` | — | 400 `access-denied` | SKIP (auth layer) |
| `TablesSpec` "Returns the source tables" / "Gets the table info" | get_source_tables / get_table_info | — | SKIP (not implemented) |
| `TablesSpec` "Returns null for an invalid table" | get_table_info | — | SKIP (not implemented) |
| `TrackTablesSpec` / `UntrackTablesSpec` warnings arms (success-with-warnings, fail-when-disallowed) | pg_track_tables `allow_warnings` | warnings object | LIVE *and* depends on warnings feature → SKIP until `allow_warnings` is implemented; record as follow-up |
| `UntrackTablesSpec` "cascade to remove dependents" | pg_untrack_tables cascade | success | LIVE (multi-table batch + DB deps) |

## relationships → task #4 (OFFLINE) / #10 (LIVE)

Source: `tests-py/queries/v1/relationships/`, api-tests `BulkAtomicSpec`.

| Case | Op | Pinned result | Class |
|---|---|---|---|
| `array_relationship_manual.yaml` (create) | pg_create_array_relationship manual_configuration | 200 success | OFFLINE |
| `array_relationship_manual.yaml` (rename) | pg_rename_relationship | 200 success | OFFLINE |
| `array_relationship_manual.yaml` (drop) | pg_drop_relationship | 200 success | OFFLINE |
| `object_relationship_manual.yaml` (create/rename/drop arms) | pg_create_object_relationship manual / rename / drop | 200 success | OFFLINE (the nested-select arms are SKIP) |
| `array_relationship_foreign_key.yaml` (create+drop) | pg_create_array_relationship FK + drop | 200 success | LIVE (FK existence) — drop arm OFFLINE |
| `object_relationship_foreign_key.yaml` (create/rename/drop) | pg_create_object_relationship FK | 200 success | LIVE (FK) — rename/drop arms OFFLINE |
| `*_non_public_schema_foreign_key.yaml` | create_{object,array}_relationship FK non-public | 200 success | LIVE (FK) |
| `array_relationship_col_not_foreign_key_error.yaml` | pg_create_array_relationship on non-FK col | 400 `invalid-configuration` `Inconsistent object: in table "author": in relationship "articles": no foreign constraint exists on the given column(s)` | LIVE |
| `object_relationship_col_not_foreign_key_error.yaml` | pg_create_object_relationship on non-FK col | 400 `invalid-configuration` analogous message | LIVE |
| `object_relationship_one_to_one.yaml` | manual/FK 1:1 | success | LIVE if FK; OFFLINE if manual |
| `create_{array,object}_relationship_as_not_admin_error.yaml` | — | `access-denied` | SKIP (auth) |
| drop / rename of a non-existent relationship | pg_drop_relationship / pg_rename_relationship | `not-exists` | OFFLINE (synthesize from `ErrRelationshipNotFound`) |
| create duplicate relationship | pg_create_*_relationship | `already-exists` (`ErrRelationshipExists`) | OFFLINE (manual config) |
| rename onto an existing relationship name | pg_rename_relationship | conflict/`not-exists` per `ops_tables.go:394` | OFFLINE |
| `BulkAtomicSpec` "Fails on invalid relationships" | bulk_atomic | rollback, error | LIVE (real validation drives rollback) |

## permissions → task #5 (OFFLINE)

Source: `tests-py/queries/v1/permissions/`, api-tests permission setups,
`ops_permissions_internal_test.go`.

| Case | Op | Pinned result | Class |
|---|---|---|---|
| `create_article_permission_role_user.yaml` (create+drop) | pg_create_select_permission / pg_drop_select_permission | 200 success | OFFLINE |
| `create_article_permission_role_admin_error.yaml` | pg_create_select_permission role=admin | 400 `already-exists` `select permission already defined on table "author" with role "admin"` | OFFLINE (duplicate-permission; note admin-implicit-perm nuance — verify our wording) |
| `create_author_insert_permission_long_role.yaml` | pg_create_insert_permission (>63-char role) | 200 success ×2 | OFFLINE |
| drop missing permission | pg_drop_*_permission | `not-exists` (`ErrPermissionNotFound`) | OFFLINE |
| create duplicate permission | pg_create_*_permission | `already-exists` (`ErrPermissionExists`) | OFFLINE |
| update/delete/insert permission create+drop, preset/columns/filter/check round-trip | pg_create_{insert,update,delete}_permission | export shape | OFFLINE (assert exported metadata) |
| pg_create_function_permission / pg_drop_function_permission | function perms | success / not-exists / already-exists | OFFLINE |

## enum + table/function customization → task #6 (OFFLINE) / #10 (LIVE)

Source: `tests-py/queries/v1/set_table_is_enum/`,
`set_table_configuration/`, `set_table_custom_fields/`, api-tests
`Schema/{CustomFieldsSpec,EnumsSpec,ConflictsSpec}`.

| Case | Op | Pinned result | Class |
|---|---|---|---|
| `set_table_is_enum/add_and_remove.yaml` (set/unset arms) | pg_set_table_is_enum true/false | 200 success | OFFLINE (the `__type` enum-surface arms → LIVE in task #10) |
| `set_table_is_enum/add_invalid.yaml` | pg_set_table_is_enum on non-enum table | 400 `invalid-configuration` w/ PK-type + column-count reasons (smart-quoted, `•` bullets) | LIVE |
| `set_table_is_enum/custom_enum_table_name.yaml` | pg_set_table_customization custom_name set/unset | 200 success | OFFLINE (success arms; enum-surface arms LIVE) |
| `set_table_is_enum/relationship_with_inconsistent_enum_table.yaml` | bulk + reload_metadata inconsistency + drop_inconsistent | inconsistent_objects | LIVE (DB enum value validity); `drop_inconsistent_metadata` arm SKIP |
| `set_table_configuration/set_and_unset.yaml` | pg_set_table_customization | 200 success round-trip | OFFLINE |
| `set_table_configuration/column_field_swap.yaml` (set/unset arms) | pg_set_table_customization column_config | 200 success | OFFLINE (graphql-query arms SKIP) |
| `set_table_configuration/fail_conflicting_custom_table_name.yaml` | pg_set_table_customization custom_name collides w/ tracked table | 500 `unexpected` conflicting-definitions message | LIVE (whole-schema conflict detection / SDL) |
| `set_table_configuration/conflict_with_relationship.yaml` | pg_set_table_customization custom col name == relationship | 400 `unexpected` `cannot continue due to new inconsistent metadata` | LIVE (schema-cache rebuild) |
| `set_table_configuration/relationship_conflict_with_custom_column.yaml` | pg_create_array_relationship name collides w/ custom col | 400 `invalid-configuration` `field definition conflicts with custom field name for postgres column "id"` | LIVE |
| `set_table_configuration/{alter_column,rename_original_table_*}.yaml` | pg_set_table_customization | success | OFFLINE for the metadata arms; DDL/query arms SKIP |
| `set_table_configuration/set_invalid_table.yaml` | pg_set_table_customization on untracked table | error | OFFLINE (`not-exists` style) |
| `set_table_custom_fields/*.yaml` (deprecated custom-column API) | set_table_custom_fields | success | OFFLINE if op exists; else SKIP (verify) |
| `pg_set_function_customization` | function customization | success round-trip | OFFLINE |

## bulk / bulk_atomic / bulk_keep_going → task #7 (OFFLINE)

Source: api-tests `BulkAtomicSpec`, `BulkKeepGoingSpec`; existing
`bulk_apply_internal_test.go` + parity case `bulk_atomic_create_permissions_rejected`.
Note: `tests-py/queries/v1/bulk/*.yaml` is **data-plane** bulk (insert/select/run_sql),
not metadata bulk → **SKIP** here.

| Case | Op | Pinned result | Class |
|---|---|---|---|
| ordered multi-op success | bulk | bare array, per-child results in order | OFFLINE |
| `BulkAtomicSpec` add relationships | bulk_atomic | all-or-nothing apply | OFFLINE (manual config children) |
| `BulkAtomicSpec` add+remove | bulk_atomic | success | OFFLINE |
| `BulkAtomicSpec` "Fails on invalid relationships" | bulk_atomic | rollback | LIVE (validation-driven) → also keep an OFFLINE structural-reject case |
| bulk_atomic rejects remote-schema ops / pg_untrack_table up front | bulk_atomic | reject before apply | OFFLINE (already have `bulk_atomic_create_permissions_rejected`) |
| `BulkKeepGoingSpec` last query fails | bulk_keep_going | partial success array, error on failing child | OFFLINE |
| `BulkKeepGoingSpec` first query fails | bulk_keep_going | continues past failure | OFFLINE |

## metadata lifecycle → task #8 (OFFLINE)

Source: `tests-py/queries/v1/metadata/`, api-tests `InconsistentSpec`,
`WarningsSpec`, `TransparentDefaultsSpec`; `ops_snapshot.go`, `inconsistency.go`.

| Case | Op | Pinned result | Class |
|---|---|---|---|
| `export_metadata.yaml` | export_metadata | normalized metadata tree | OFFLINE (deep-equal after normalize; mind JSON v2 ordering) |
| `clear_metadata.yaml` | clear_metadata then export | 200 success → empty | OFFLINE |
| `reload_metadata.yaml` | reload_metadata | `is_consistent: true` `message: success` | OFFLINE |
| `replace_metadata.yaml` / `replace_metadata_v2.yaml` / `replace_metadata_no_tables.yaml` | replace_metadata | 200 success + export round-trip | OFFLINE (remote_schemas arm may need stub; isolate) |
| replace with empty args | replace_metadata | validation error (`errMissingRequiredField` → `validation-failed`) | OFFLINE |
| `replace_metadata_allow_inconsistent*.yaml` | replace_metadata allow_inconsistent | surfaces `inconsistent_objects` | OFFLINE (structural inconsistency) / LIVE (DB-derived inconsistency) — split per case |
| `InconsistentSpec` reload/replace flag-missing-tables | reload/replace | inconsistent_objects | LIVE (missing DB table) |
| `InconsistentSpec` "update source already inconsistent" / "drop source" | source ops | — | SKIP (multi-source not implemented) |
| `WarningsSpec` event-trigger invalid-name warnings | replace_metadata allow_warnings | warnings | SKIP (warnings not implemented; follow-up) |
| `TransparentDefaultsSpec` defaults excluded from export | export_metadata | no defaults | OFFLINE if applicable; else SKIP |
| `dump_internal_state.yaml` | dump_internal_state | — | SKIP (debug endpoint) |

## suggest_relationships / event triggers / remote relationships → task #9 (OFFLINE) / #10 (LIVE)

Source: api-tests `SuggestRelationshipsSpec`, Hasura `EventTriggers/`,
`Schema/RemoteRelationships/`; `ops_event_triggers.go`,
`ops_remote_relationships.go`, `ops_reads.go` (suggest).

| Case | Op | Pinned result | Class |
|---|---|---|---|
| `SuggestRelationshipsSpec` reciprocal/unique-constraint suggestions | pg_suggest_relationships | suggestion list | LIVE (FK introspection) |
| `SuggestRelationshipsSpec` "Omits tracked relationships" | pg_suggest_relationships omit_tracked | filtered list | LIVE |
| `SuggestRelationshipsSpec` "only include listed tables" / "all by default" | pg_suggest_relationships tables filter | list | LIVE (the table-filter *argument handling* can have an OFFLINE arg-validation case) |
| pg_track_function happy path | pg_track_function | 200 success (`metadata/pg_track_function_with_comment_setup.yaml`) | OFFLINE (arg validation + config shape; return-type discovery LIVE) |
| pg_untrack_function / untrack missing | pg_untrack_function | success / `not-exists` (`ErrFunctionNotTracked`) | OFFLINE |
| event-trigger create (metadata-only config) | pg_create_event_trigger | 200 success | OFFLINE (arg validation + config shape; already have parity case `pg_create_event_trigger`) |
| event-trigger delete missing | pg_delete_event_trigger | `not-exists` (`ErrEventTriggerNotFound`) | OFFLINE |
| event-trigger missing required arg | pg_create/delete_event_trigger | `validation-failed` (`errMissingRequiredField`) | OFFLINE |
| `Schema/RemoteRelationships` create/delete | pg_create_remote_relationship / pg_delete_remote_relationship | success / not-exists | OFFLINE (arg validation + config; runtime resolution LIVE) |
| `WarningsSpec` invalid event-trigger name | — | warning | SKIP (warnings) |

---

## Summary of SKIPs (no port; follow-ups noted)

- All `*_as_not_admin_error` (auth layer, no `access-denied` code here).
- `allow_warnings` / warnings result object — **follow-up: implement warnings**.
- `drop_inconsistent_metadata`, `get_table_info`/`get_source_tables`,
  `list_source_kinds`, `pg_add_source`/`rename_source`/multi-source —
  not on this branch.
- Data-plane `tests-py/queries/v1/bulk/*.yaml`, `select`/`insert`/`run_sql`
  arms embedded in metadata YAMLs, and `__type`/graphql introspection arms —
  out of scope for the metadata-op harness (covered by integration query tests).

## Items needing behavior confirmation while porting (do NOT relax tests to pass)

1. `track_*`/`function` same-name collision → does our impl emit `not-supported`
   with Hasura's exact wording? (task #3)
2. `create_select_permission role=admin` → Hasura treats admin as implicitly
   permissioned (`already-exists`); confirm our handling. (task #5)
3. `replace_metadata` remote_schemas round-trip on a single-source branch. (task #8)
4. Conflict detection (`conflict_with_relationship`,
   `fail_conflicting_custom_table_name`) emits `unexpected` in Hasura — confirm
   our code/path for the same input (likely LIVE). (task #6 → #10)
