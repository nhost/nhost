package integration_test

import "testing"

// TestMetadataParity applies the dashboard-parity metadata ops to both Hasura
// and Constellation and asserts equivalence (see metadata_parity_test.go for the
// layered comparison and how the engines are isolated).
//
// Targets real seeded objects: public.departments (id/name/…), public.user_departments
// (FK department_id -> departments, FK user_id -> auth.users), and the tracked
// function public.get_department_manager(department_id uuid) returning user_departments.
//
// Intentionally NOT covered yet (each needs a fixture or has a known semantic
// gap — documented in docs/user/hasura-metadata-support.md, not silently dropped):
//   - pg_set_table_is_enum: needs an enum-shaped table; Hasura validates the
//     shape while Constellation does not, so a naive case would diverge.
//   - pg_create_remote_relationship / pg_delete_remote_relationship: need a
//     configured second source / remote schema fixture.
//   - pg_suggest_relationships / pg_get_viewdef: read ops use the metadata-DB
//     pool as their queryer, which is the schemaless `cstl` DB here.
//
// Not parallel: metadata is global per engine, so cases mutate shared state and
// run serially (each resets to baseline first).
//
//nolint:paralleltest,maintidx
func TestMetadataParity(t *testing.T) {
	const (
		role   = "paritytest"
		dept   = `{"schema":"public","name":"departments"}`
		udept  = `{"schema":"public","name":"user_departments"}`
		droles = `{"schema":"public","name":"department_roles"}`
		fn     = `{"schema":"public","name":"get_department_manager"}`
	)

	// Reusable setup ops.
	createSelDept := `{"type":"pg_create_select_permission","args":{"source":"default",` +
		`"table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","filter":{}}}}`
	createSelUDept := `{"type":"pg_create_select_permission","args":{"source":"default",` +
		`"table":` + udept + `,"role":"` + role + `","permission":{"columns":"*","filter":{}}}}`
	createObjRel := `{"type":"pg_create_object_relationship","args":{"source":"default",` +
		`"table":` + udept + `,"name":"parity_dept","using":{"foreign_key_constraint_on":"department_id"}}}`
	// Hasura's pg_create_event_trigger API takes the operation specs at the TOP
	// level of args (insert/update/delete/enable_manual), NOT under a definition
	// wrapper. Constellation accepts this real Hasura request shape and stores
	// the canonical nested form.
	createEventTrigger := `{"type":"pg_create_event_trigger","args":{"source":"default",` +
		`"table":` + dept + `,"name":"parity_etrigger","insert":{"columns":"*"},` +
		`"webhook":"https://example.com/hook","retry_conf":{"num_retries":0,"interval_sec":10}}}`
	untrackFn := `{"type":"pg_untrack_function","args":{"source":"default","function":` + fn + `}}`

	// Remote-schema fixtures. The endpoint is the integration functions service,
	// reachable by both engines on the integration_default docker network; the
	// webhook secret is resolved from NHOST_WEBHOOK_SECRET (set on both
	// containers). The functions remote-schema exposes the teams/games schema, so
	// permSDL is a valid subset Hasura's permission subset-validation accepts.
	const rsName = "parity_rs"

	rsDef := `{"url":"http://integration-functions-1:3000/remote-schema",` +
		`"forward_client_headers":true,"headers":[{"name":"x-nhost-webhook-secret",` +
		`"value_from_env":"NHOST_WEBHOOK_SECRET"}]}`
	addRS := `{"type":"add_remote_schema","args":{"name":"` + rsName + `","definition":` + rsDef + `}}`
	permSDL := `schema { query: Query }\ntype Query { teams: [Team!]! }\ntype Team { id: ID! name: String! }`
	addRSPerm := `{"type":"add_remote_schema_permissions","args":{"remote_schema":"` + rsName +
		`","role":"` + role + `","definition":{"schema":"` + permSDL + `"}}}`

	// Remote-schema remote relationships. to_source joins the rs type "Team"
	// into the tracked departments table; to_remote_schema is self-referential
	// (Team.id → the rs's own team(id:) root field), keeping the fixture to a
	// single remote schema while exercising a real, Hasura-valid remote_field path.
	relDept := `{"type":"create_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName +
		`","type_name":"Team","name":"rs_dept","definition":{"to_source":{"source":"default",` +
		`"table":{"schema":"public","name":"departments"},"relationship_type":"object",` +
		`"field_mapping":{"departmentId":"id"}}}}}`
	relSelf := `{"type":"create_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName +
		`","type_name":"Team","name":"rs_self","definition":{"to_remote_schema":{"remote_schema":"` + rsName +
		`","lhs_fields":["id"],"remote_field":{"team":{"arguments":{"id":"$id"}}}}}}}`

	// rsSDLReformat is the remaining round-trip gap once comment is omitempty:
	// Constellation stores permission SDL verbatim while Hasura reformats
	// (pretty-prints) it, so the permissions[].definition.schema leaf differs.
	// See docs/user/hasura-metadata-support.md.
	const rsSDLReformat = "permission SDL stored verbatim by Constellation, " +
		"reformatted (pretty-printed) by Hasura"

	cases := []metadataParityCase{
		// ---- permissions: create + drop for each verb ----
		{
			// Layer D: before the op the paritytest role has no select permission so
			// the `departments` field does not resolve for it; after the op it does,
			// returning the seeded rows identically on both engines.
			name:          "pg_create_select_permission",
			op:            createSelDept,
			affectsSchema: true,
			query:         `query { departments(order_by: {name: asc}) { name } }`,
			queryRole:     role,
		},
		{
			// Layer D mirror image: the setup grants select (the field resolves),
			// then the op drops it, so afterwards the role's query must be rejected
			// by both engines (queryWantErr) — the field is gone, not just empty.
			name:          "pg_drop_select_permission",
			setup:         []string{createSelDept},
			op:            `{"type":"pg_drop_select_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
			affectsSchema: true,
			query:         `query { departments(order_by: {name: asc}) { name } }`,
			queryRole:     role,
			queryWantErr:  true,
		},
		{
			name:          "pg_create_insert_permission",
			op:            `{"type":"pg_create_insert_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","check":{}}}}`,
			affectsSchema: true,
		},
		{
			name: "pg_drop_insert_permission",
			setup: []string{
				`{"type":"pg_create_insert_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","check":{}}}}`,
			},
			op:            `{"type":"pg_drop_insert_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
			affectsSchema: true,
		},
		{
			name:          "pg_create_update_permission",
			op:            `{"type":"pg_create_update_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","filter":{},"check":{}}}}`,
			affectsSchema: true,
		},
		{
			name: "pg_drop_update_permission",
			setup: []string{
				`{"type":"pg_create_update_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","filter":{},"check":{}}}}`,
			},
			op:            `{"type":"pg_drop_update_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
			affectsSchema: true,
		},
		{
			name:          "pg_create_delete_permission",
			op:            `{"type":"pg_create_delete_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"filter":{}}}}`,
			affectsSchema: true,
		},
		{
			name: "pg_drop_delete_permission",
			setup: []string{
				`{"type":"pg_create_delete_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"filter":{}}}}`,
			},
			op:            `{"type":"pg_drop_delete_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `"}}`,
			affectsSchema: true,
		},

		// ---- table customization ----
		{
			name:          "pg_set_table_customization",
			op:            `{"type":"pg_set_table_customization","args":{"source":"default","table":` + dept + `,"configuration":{"custom_name":"ParityDepartments"}}}`,
			affectsSchema: true,
		},

		// ---- relationships ----
		{
			// Layer D: after the op the new `parity_dept` object relationship resolves
			// the parent department on both engines (admin role).
			name:          "pg_create_object_relationship",
			op:            createObjRel,
			affectsSchema: true,
			query:         `query { user_departments(order_by: [{user_id: asc}, {department_id: asc}], limit: 3) { role parity_dept { name } } }`,
		},
		{
			// Layer D mirror image: the setup adds `parity_dept`, the op drops it, so
			// afterwards the nested field no longer resolves on either engine.
			name:          "pg_drop_relationship",
			setup:         []string{createObjRel},
			op:            `{"type":"pg_drop_relationship","args":{"source":"default","table":` + udept + `,"relationship":"parity_dept"}}`,
			affectsSchema: true,
			query:         `query { user_departments(order_by: [{user_id: asc}, {department_id: asc}], limit: 3) { parity_dept { name } } }`,
			queryWantErr:  true,
		},
		{
			name:          "pg_rename_relationship",
			setup:         []string{createObjRel},
			op:            `{"type":"pg_rename_relationship","args":{"source":"default","table":` + udept + `,"name":"parity_dept","new_name":"parity_dept_renamed"}}`,
			affectsSchema: true,
		},
		{
			name:          "pg_create_array_relationship",
			op:            `{"type":"pg_create_array_relationship","args":{"source":"default","table":` + dept + `,"name":"parity_members","using":{"foreign_key_constraint_on":{"table":` + udept + `,"column":"department_id"}}}}`,
			affectsSchema: true,
		},

		// ---- functions ----
		{
			name:          "pg_untrack_function",
			op:            untrackFn,
			affectsSchema: true,
		},
		{
			name:          "pg_track_function",
			setup:         []string{untrackFn},
			op:            `{"type":"pg_track_function","args":{"source":"default","function":` + fn + `}}`,
			affectsSchema: true,
		},
		{
			name:          "pg_set_function_customization",
			op:            `{"type":"pg_set_function_customization","args":{"source":"default","function":` + fn + `,"configuration":{"custom_name":"parityMgr"}}}`,
			affectsSchema: true,
		},
		{
			name:          "pg_create_function_permission",
			setup:         []string{createSelUDept},
			op:            `{"type":"pg_create_function_permission","args":{"source":"default","function":` + fn + `,"role":"` + role + `"}}`,
			affectsSchema: true,
		},
		{
			name: "pg_drop_function_permission",
			setup: []string{
				createSelUDept,
				`{"type":"pg_create_function_permission","args":{"source":"default","function":` + fn + `,"role":"` + role + `"}}`,
			},
			op:            `{"type":"pg_drop_function_permission","args":{"source":"default","function":` + fn + `,"role":"` + role + `"}}`,
			affectsSchema: true,
		},

		// ---- event triggers (metadata-only: no schema surface) ----
		// Both engines accept the flat Hasura request shape; the harness's
		// unconditional non-error 2xx check pins that Constellation stores the
		// trigger successfully. The exported entry still diverges — Hasura
		// normalizes it (fills enable_manual, cleanup_config, header defaults;
		// re-shapes retry_conf) while Constellation round-trips the submitted
		// config verbatim — so that part is an accepted, logged divergence.
		{
			name:            "pg_create_event_trigger",
			op:              createEventTrigger,
			knownDivergence: "event-trigger export normalization: Hasura fills defaults / reshapes the stored entry; Constellation stores the submitted config verbatim",
		},

		// ---- bulk wrappers ----
		{
			name: "bulk_create_permissions",
			op: `{"type":"bulk","args":[` +
				createSelDept + `,` +
				`{"type":"pg_create_insert_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","check":{}}}}` +
				`]}`,
			affectsSchema: true,
		},
		{
			// bulk_atomic accepts only Hasura's narrow whitelist (relationship
			// create/drop, delete remote relationship, ...). Permission commands
			// are rejected by BOTH engines. Hasura raises an internal 500 ("Bulk
			// atomic does not support this command"); Constellation matches the
			// whitelist but surfaces the rejection through its op-level 400
			// not-supported channel, so the status/code wording differs.
			name: "bulk_atomic_create_permissions_rejected",
			op: `{"type":"bulk_atomic","args":[` +
				createSelDept + `,` +
				`{"type":"pg_create_delete_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"filter":{}}}}` +
				`]}`,
			wantErr:               true,
			allowStatusDivergence: true,
			knownDivergence:       "bulk_atomic rejects permission commands on both engines; Hasura returns 500 internal, Constellation returns 400 not-supported",
		},
		{
			// Nested bulk: an outer bulk whose second child is itself a bulk.
			// Hasura runs the nested children against the same in-flight
			// metadata under one write; the resulting metadata must match.
			name: "bulk_nested",
			op: `{"type":"bulk","args":[` +
				createSelDept + `,` +
				`{"type":"bulk","args":[` +
				`{"type":"pg_create_insert_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"columns":"*","check":{}}}}` +
				`]}` +
				`]}`,
			affectsSchema: true,
		},

		// ---- idempotent re-apply: Constellation returns 200 + idempotency code
		// where Hasura returns 4xx; the resulting metadata must still match. ----
		{
			name:                  "pg_track_table_idempotent_reapply",
			op:                    `{"type":"pg_track_table","args":{"source":"default","table":` + dept + `}}`,
			allowStatusDivergence: true,
		},

		// ---- error parity: both engines must reject with the same code ----
		{
			name:    "pg_untrack_table_missing",
			op:      `{"type":"pg_untrack_table","args":{"source":"default","table":{"schema":"public","name":"parity_does_not_exist"}}}`,
			wantErr: true,
		},
		{
			// Cascade must drop reverse dependents in OTHER tables that point at
			// the untracked table (here the parity_members array relationship on
			// departments, keyed on foreign_key_constraint_on:{table: user_departments}),
			// matching Hasura. Setup creates that reverse dependent; the op untracks
			// user_departments with cascade=true; Layer B asserts both engines'
			// exports agree the relationship is gone.
			name: "pg_untrack_table_cascade_reverse_dependents",
			setup: []string{
				`{"type":"pg_create_array_relationship","args":{"source":"default","table":` + dept +
					`,"name":"parity_members","using":{"foreign_key_constraint_on":{"table":` + udept +
					`,"column":"department_id"}}}}`,
			},
			op:            `{"type":"pg_untrack_table","args":{"source":"default","table":` + udept + `,"cascade":true}}`,
			affectsSchema: true,
		},
		{
			// Known divergence: Hasura returns "permission-denied" when dropping a
			// non-existent permission (a Hasura quirk); Constellation returns the
			// clearer "not-exists". Both reject the op.
			name:            "pg_drop_select_permission_missing",
			op:              `{"type":"pg_drop_select_permission","args":{"source":"default","table":` + dept + `,"role":"ghost_role"}}`,
			wantErr:         true,
			knownDivergence: "Hasura returns permission-denied for dropping a missing permission; Constellation returns not-exists",
		},

		// ---- pg_set_table_is_enum ----
		// MATCHING: department_roles is enum-shaped (text PK `value` + `comment`)
		// and is marked is_enum in the baseline, so UNsetting it is a valid op both
		// engines accept, and the resulting export matches. affectsSchema is left
		// unset deliberately: the GraphQL-surface (Layer C) effect of toggling an
		// enum is left for live validation; Layer A (status) + Layer B (export)
		// parity is the high-confidence assertion.
		{
			name: "pg_set_table_is_enum_unset_valid",
			op: `{"type":"pg_set_table_is_enum","args":{"source":"default",` +
				`"table":` + droles + `,"is_enum":false}}`,
		},
		// DIVERGENCE: departments is NOT enum-shaped (uuid PK, 7 columns). Hasura
		// validates the shape at op time and rejects with invalid-configuration;
		// Constellation's metadata op is a pure transform that accepts it (the
		// invalidity surfaces only at schema build / reconcile). See
		// KNOWN_DIFFERENCES.md "Op-time validation is deferred".
		{
			name:                "pg_set_table_is_enum_invalid_shape",
			op:                  `{"type":"pg_set_table_is_enum","args":{"source":"default","table":` + dept + `,"is_enum":true}}`,
			wantConstellationOK: true,
			knownDivergence: "Hasura rejects a non-enum-shaped table with invalid-configuration at op time; " +
				"Constellation defers structural validation to schema build (see KNOWN_DIFFERENCES.md)",
		},
		// DIVERGENCE: `description` is a plain column on departments with no foreign
		// key. Hasura rejects the relationship at op time (no foreign constraint
		// exists); Constellation accepts the metadata and surfaces the invalidity
		// only at schema build / reconcile. See KNOWN_DIFFERENCES.md.
		{
			name: "pg_create_object_relationship_non_fk_column",
			op: `{"type":"pg_create_object_relationship","args":{"source":"default",` +
				`"table":` + dept + `,"name":"parity_bad_rel",` +
				`"using":{"foreign_key_constraint_on":"description"}}}`,
			wantConstellationOK: true,
			knownDivergence: "Hasura rejects a relationship on a non-FK column with invalid-configuration at " +
				"op time; Constellation defers FK validation to schema build (see KNOWN_DIFFERENCES.md)",
		},
		// --- Remote schemas ---
		{
			// Enforced: with comment omitempty the export matches Hasura exactly.
			name:          "add_remote_schema",
			op:            addRS,
			affectsSchema: true,
		},
		{
			// Enforced: after remove the schema is gone on both engines, so the
			// round-trip gap leaves no leaves to diverge.
			name:          "remove_remote_schema",
			setup:         []string{addRS},
			op:            `{"type":"remove_remote_schema","args":{"name":"` + rsName + `"}}`,
			affectsSchema: true,
		},
		{
			// Enforced: update_remote_schema replaces the definition and DROPS the
			// schema's remote relationships (verified against Hasura). Seeding
			// relDept lets Layer B confirm rs_dept is gone on both engines after the
			// definition-only update, and Layer D confirms the dropped field no
			// longer resolves. (Permission preservation is covered by the store unit
			// test and the add/drop-permission cases; seeding a permission here would
			// only re-trigger the documented SDL-reformat divergence.)
			name:          "update_remote_schema",
			setup:         []string{addRS, relDept},
			op:            `{"type":"update_remote_schema","args":{"name":"` + rsName + `","definition":{"url":"http://integration-functions-1:3000/remote-schema","timeout_seconds":30,"forward_client_headers":true,"headers":[{"name":"x-nhost-webhook-secret","value_from_env":"NHOST_WEBHOOK_SECRET"}]}}}`,
			affectsSchema: true,
			query:         `query { teams { id rs_dept { id } } }`,
			queryWantErr:  true,
		},
		{
			name:            "add_remote_schema_permissions",
			setup:           []string{addRS},
			op:              addRSPerm,
			affectsSchema:   true,
			knownDivergence: rsSDLReformat,
		},
		{
			name:  "drop_remote_schema_permissions",
			setup: []string{addRS, addRSPerm},
			// Enforced: after the permission is dropped the schema matches Hasura.
			op:            `{"type":"drop_remote_schema_permissions","args":{"remote_schema":"` + rsName + `","role":"` + role + `"}}`,
			affectsSchema: true,
		},
		{
			// Enforced: a read op mutates nothing, so both exports stay identical.
			name:  "introspect_remote_schema",
			setup: []string{addRS},
			op:    `{"type":"introspect_remote_schema","args":{"name":"` + rsName + `"}}`,
		},
		{
			// Enforced: reload mutates nothing; both engines return success.
			name:  "reload_remote_schema",
			setup: []string{addRS},
			op:    `{"type":"reload_remote_schema","args":{"name":"` + rsName + `"}}`,
		},
		{
			// Enforced: both engines reject removing an absent schema with not-exists.
			name:    "remove_remote_schema_missing",
			op:      `{"type":"remove_remote_schema","args":{"name":"parity_rs_does_not_exist"}}`,
			wantErr: true,
		},
		{
			// Enforced: both engines reject dropping an absent role with not-exists.
			name:    "drop_remote_schema_permissions_missing",
			setup:   []string{addRS},
			op:      `{"type":"drop_remote_schema_permissions","args":{"remote_schema":"` + rsName + `","role":"ghost_role"}}`,
			wantErr: true,
		},
		{
			name:                  "add_remote_schema_duplicate",
			setup:                 []string{addRS},
			op:                    addRS,
			allowStatusDivergence: true,
			knownDivergence:       "Hasura returns 400 already-exists; Constellation treats a duplicate add as an idempotent 200",
		},
		{
			// Enforced: rs→db remote relationship; export matches Hasura.
			// Layer D queries the rs_dept field to prove the rs→source join
			// resolves identically (teams come back in the endpoint's fixed order).
			name:          "create_remote_schema_remote_relationship_to_source",
			setup:         []string{addRS},
			op:            relDept,
			affectsSchema: true,
			query:         `query { teams { id rs_dept { id name } } }`,
		},
		{
			// Enforced: rs→rs (self-referential) remote relationship. Layer D
			// queries the rs_self field to prove the rs→rs stitch resolves and
			// returns Hasura-identical data, not just a matching schema.
			name:          "create_remote_schema_remote_relationship_to_remote_schema",
			setup:         []string{addRS},
			op:            relSelf,
			affectsSchema: true,
			query:         `query { teams { id name rs_self { id name } } }`,
		},
		{
			// Enforced: object→array reshape. Layer D queries rs_dept (now an array
			// relationship) to prove both engines resolve it as a list identically.
			name:          "update_remote_schema_remote_relationship",
			setup:         []string{addRS, relDept},
			op:            `{"type":"update_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName + `","type_name":"Team","name":"rs_dept","definition":{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},"relationship_type":"array","field_mapping":{"departmentId":"id"}}}}}`,
			affectsSchema: true,
			query:         `query { teams { id rs_dept { id name } } }`,
		},
		{
			// Enforced: after delete the relationship is gone on both engines. Layer D
			// asserts the rs_dept field no longer resolves on either engine (queryWantErr).
			name:          "delete_remote_schema_remote_relationship",
			setup:         []string{addRS, relDept},
			op:            `{"type":"delete_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName + `","type_name":"Team","name":"rs_dept"}}`,
			affectsSchema: true,
			query:         `query { teams { id rs_dept { id } } }`,
			queryWantErr:  true,
		},
		{
			// Enforced: both engines reject updating an absent relationship with not-exists.
			name:    "update_remote_schema_remote_relationship_missing",
			setup:   []string{addRS},
			op:      `{"type":"update_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName + `","type_name":"Team","name":"ghost","definition":{"to_source":{"source":"default","table":{"schema":"public","name":"departments"},"relationship_type":"object","field_mapping":{"departmentId":"id"}}}}}`,
			wantErr: true,
		},
		{
			// Enforced: both engines treat deleting an absent relationship as an
			// idempotent success (200, no metadata change).
			name:  "delete_remote_schema_remote_relationship_missing",
			setup: []string{addRS},
			op:    `{"type":"delete_remote_schema_remote_relationship","args":{"remote_schema":"` + rsName + `","type_name":"Team","name":"ghost"}}`,
		},
		{
			// Enforced: both engines reject an unreachable upstream with
			// remote-schema-error (Constellation maps remoteschema.ErrIntrospection).
			name:    "add_remote_schema_unreachable",
			op:      `{"type":"add_remote_schema","args":{"name":"parity_rs_unreachable","definition":{"url":"http://integration-functions-1:3999/nope"}}}`,
			wantErr: true,
		},
	}

	runMetadataParityTests(t, cases)
}
