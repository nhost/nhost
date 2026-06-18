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
func TestMetadataParity(t *testing.T) { //nolint:paralleltest
	const (
		role  = "paritytest"
		dept  = `{"schema":"public","name":"departments"}`
		udept = `{"schema":"public","name":"user_departments"}`
		fn    = `{"schema":"public","name":"get_department_manager"}`
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
		// Both engines accept the flat Hasura request shape, so this case
		// hard-asserts (wantConstellationOK) that Constellation stores the
		// trigger successfully. The exported entry still diverges — Hasura
		// normalizes it (fills enable_manual, cleanup_config, header defaults;
		// re-shapes retry_conf) while Constellation round-trips the submitted
		// config verbatim — so that part is an accepted, logged divergence.
		{
			name:                "pg_create_event_trigger",
			op:                  createEventTrigger,
			wantConstellationOK: true,
			knownDivergence:     "event-trigger export normalization: Hasura fills defaults / reshapes the stored entry; Constellation stores the submitted config verbatim",
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
			// Known divergence: Hasura's bulk_atomic rejects permission commands
			// (500 "Bulk atomic does not support this command"); Constellation
			// supports bulk_atomic for them — a superset, not a bug.
			name: "bulk_atomic_create_permissions",
			op: `{"type":"bulk_atomic","args":[` +
				createSelDept + `,` +
				`{"type":"pg_create_delete_permission","args":{"source":"default","table":` + dept + `,"role":"` + role + `","permission":{"filter":{}}}}` +
				`]}`,
			// Hard-assert Constellation actually accepts the bulk_atomic permission
			// op (2xx) rather than only logging Hasura's 500 and dropping the case;
			// without this the case would pass even if the superset support
			// regressed entirely.
			wantConstellationOK: true,
			knownDivergence:     "Hasura's bulk_atomic does not support permission commands; Constellation does (superset)",
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
	}

	RunMetadataParityTests(t, cases)
}
