# Action parity coverage

This document maps every class and test in graphql-engine's
`server/tests-py/test_actions.py` (the upstream Action acceptance suite) to its
Constellation counterpart, so the gap between the two is explicit rather than
implicit. Each upstream item is one of:

- ✅ **covered** — an equivalent live parity test (runs against both engines).
- 🔁 **ported (unit)** — the behaviour is pinned by a Go unit test rather than a
  live two-engine parity test (usually because it needs no engine comparison,
  or the comparison is a pure response-shape/error-mapping concern).
- ⏭️ **skipped (justified)** — intentionally not ported; reason given.
- ⚠️ **divergence** — Constellation intentionally behaves differently; reason
  given and documented in [hasura-metadata-support.md](../user/hasura-metadata-support.md).

Constellation tests live in two places:

- **Live parity** — `services/constellation/integration/action_*_test.go`
  (`Test…Parity`), run by `make check` once `make dev-env-up` has brought up the
  integration env + the parity Constellation on `:8001` (see the note at the end).
- **Unit** — `connector/action/*_test.go`,
  `connector/action/transform/*_test.go`, `controller/relationships/*_test.go`.

## CI wiring

The action and inherited-role integration tests are **already wired into CI**:
they live in the `integration` package, carry no build tags, and are therefore
compiled and run by `make check` (the hermetic `go.check` over `./...`). CI runs
`make dev-env-up` first, which freshly builds the Docker image and starts the
parity Constellation on `:8001` from the current tree, so the parity tests run
against current code rather than skipping. No per-test CI registration exists or
is needed; adding a new `integration/action_*_test.go` is sufficient.

## Coverage map

### TestActionsSyncWebsocket
| Upstream method | Status | Constellation |
|---|---|---|
| `test_create_user_success` / `_fail`, `test_create_users_success` / `_fail` | ✅ | `TestActionExecutionParity` (synchronous reflect/fail buckets) over HTTP. |
| `test_create_user_relationship` / `_fail` | 🔁 | Action output → DB relationship: `controller/relationships` registration + composer injection unit tests (the `to_source` feature). |
| (websocket transport) | ⏭️ | Actions are resolved by the same code path regardless of transport; the GraphQL-over-WS transport is exercised by the subscription suite, not re-tested per action. |

### TestActionsRelationshipsBasic
| `test_query_with_relationships` | 🔁 | Action `to_source` relationship — composer field injection + planner routing unit tests; live join shares the proven db→db / rs→db resolver. |

### TestActionsSync (response shape & nullability matrix)
| Upstream method | Status | Constellation |
|---|---|---|
| `test_expecting_object_response_got_null` | ✅ | `TestActionExecutionParity/object_got_null_nonnull_output` |
| `test_omitted_field_response_for_nullable_field` | ✅ | `.../nullable_field_omitted` |
| `test_expecting_object_response_got_array` | ✅ | `.../object_got_array` |
| `test_expecting_array_response_got_object` | ✅ | `.../array_got_object` |
| `test_expecting_array_response_got_null` | ✅ | `.../array_got_null_nonnull_output` |
| object/array success | ✅ | `.../object_success`, `.../array_success` |
| `test_expecting_scalar_output_type_success` | ✅ | `.../scalar_success` |
| `test_expecting_scalar_string_output_type_got_object` | ✅ | `.../scalar_got_object` (both engines reject) |
| `test_expecting_object_output_type_got_scalar_string` | ✅ | `.../object_got_scalar` (both engines reject) |
| `test_expecting_object_response_with_nested_null` (+ wrong field) | ✅ | `.../nested_null_ok`, `.../nested_null_violation` |
| `test_null_response`, jsonb/custom-scalar output, `test_scalar_array_*` | 🔁 | `connector/action`: `TestExecuteMapsActionErrorsAndNullability`, `TestExecuteShapesNestedAliasesFragmentsAndScalars`. jsonb / custom-scalar output overlaps the pg-scalar live case (`TestActionCustomTypesParity/pg_scalar_uuid`); the scalar-array nullability matrix stays unit-level (no two-engine comparison needed). |
| `test_*_transformed_output_success` (scalar/object/list) | 🔁 | `connector/action`: `TestExecuteAppliesRequestAndResponseTransforms`; transform builders in `connector/action/transform`. |
| `test_mirror_headers` | 🔁 | `connector/action`: `TestExecuteBuildsPayloadAndSecureHeaders`, `TestHTTPClientHardening`. |
| `test_create_users_output_type` | ✅ | custom-types reuse — `TestActionCustomTypesParity`. |

### TestActionsSyncWithRemoteJoins
| `test_action_with_remote_joins` | 🔁 | Action output → DB join (`to_source`), as TestActionsRelationshipsBasic above. Action → remote-schema relationships do **not** exist in Hasura and are intentionally not built (see [action relationships](#notes)). |

### TestQueryActions
| Upstream method | Status | Constellation |
|---|---|---|
| `test_query_action_success_output_object` / `_nested_object` / `_list` | ✅ | `TestActionExecutionParity` exercises query- and mutation-kind reflect actions through the same shaping path. |
| `test_query_action_success_output_nested_join` | 🔁 | `to_source` relationship on a query action — relationships unit tests. |
| `test_query_action_extensions_code_*_fail`, `test_query_action_fail` | 🔁 | Webhook error → GraphQL error mapping: `connector/action` `TestExecuteMapsActionErrorsAndNullability`, `TestGraphQLErrorCopies`. |
| `test_query_action_with_relationship`, `_recursive_output` | 🔁 | relationships unit tests. |

### TestActionsSyncResponseHeaders
| `test_set_cookie_header` | 🔁 | `connector/action` `TestExecuteForwardsSetCookieResponseHeaders` (#13). |

### TestActionsAsync
| Upstream method | Status | Constellation |
|---|---|---|
| `test_create_user_success` / `_fail`, `test_create_user_nested_success` | ✅ | `TestActionAsyncExecutionParity` (`object_success`, `array_success`, `nullable_field_omitted`). |
| `test_async_actions_error_response_user_role` / `_admin_role`, webhook failure | ✅ | `TestActionAsyncExecutionParity/webhook_error`. |
| `test_create_user_roles` (permission-scoped async query/authorization) | 🔁 | `connector/action` `TestAsyncActionMutationQueryAndAuthorization`. |
| `test_create_user_transformed_success` | 🔁 | transform unit tests + async worker tests. |
| worker lifecycle (requeue / fresh-context / close) | 🔁 | `connector/action` `TestAsyncWorkerPersistsDeadlineErrors…`, `…CloseRequeuesUnstartedBatchEntries`, `…CloseRequeuesInFlightAction`. |

### TestCreateActionNestedTypeWithRelation
| `test_create_sync_action_with_nested_output_and_nested_relation` | 🔁 | nested output type + `to_source` relationship — relationships + custom-types unit tests. |
| `test_create_async_action_with_nested_output_and_relation_fail` | 🔁 | covered by the same validation path. |

### TestSetCustomTypes
| Upstream method | Status | Constellation |
|---|---|---|
| `test_reuse_pgscalars`, `test_create_action_pg_scalar` | ✅ | `TestActionCustomTypesParity/pg_scalar_uuid`, `/valid_enum_input_object_scalar`. |
| `test_reuse_unknown_pgscalar` | ⚠️ | `TestActionCustomTypesParity/unknown_type_reference` — accepted divergence: Hasura rejects an undefined type reference (400), Constellation accepts it (no custom-types validation), recorded as a `knownDivergence`. |
| `test_list_type_relationship`, `test_drop_relationship` | 🔁 | relationships unit tests. |

### TestActionsMetadata
| `test_recreate_permission` | ✅ | `TestActionMetadataParity/permission_create_drop_recreate`. |
| `test_create_with_headers` | ✅ | `TestActionMetadataParity/hasura_graphql_env_header_guard` (also asserts the `HASURA_GRAPHQL_*` `value_from_env` security guard) + `TestActionMetadataLifecycle`. |

### TestActionIntrospection
| `test_introspection_query`, `test_output_types` | ⚠️ | `TestActionMetadataLifecycle` documents that action-type GraphQL introspection is rejected ("Schema does not support introspection") on the action endpoint — an accepted divergence; action types are still validated and exposed for execution. |

### TestFunctionReturnTypeIntrospection
| `test_function_return_type` | ⏭️ | Not action-specific (Postgres-function return-type introspection); covered by the SQL connector's schema-generation tests, out of scope for the action suite. |

### TestActionTimeout
| `test_action_timeout_fail` | ✅ | `TestActionExecutionParity/sync_timeout` (`slowReflect`, #12). |

## Notes

- **Action → remote-schema relationships do not exist in Hasura** and are
  intentionally not built; Hasura's `TypeRelationshipDefinition` is
  Postgres-source-only (verified against graphql-engine). The only
  action-relationship feature is `to_source`.
- **Async parity requires the worker**: `make parity-env-up` starts `:8001`
  with `CONSTELLATION_ASYNC_ACTION_WORKER_ENABLED=true` and exclusive ownership
  of an isolated `cstl` action-log store.
- **Slow Hasura ops**: `create_action` makes Hasura re-validate remote schemas,
  and inherited-role ops trigger a schema-cache rebuild (tens of seconds). The
  parity harness uses a 90s per-request timeout and strips remote schemas from
  the reset baseline to stay fast.
