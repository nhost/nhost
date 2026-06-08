//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// makeObjects builds a minimal introspection.Objects holding a single
// "public.users" table with columns id+name and (optionally) a function and
// enum-values entry. Used as the baseline for table-driven reconcile tests.
func makeObjects(opts ...func(*introspection.Objects)) *introspection.Objects {
	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": {
				Schema:       "public",
				Name:         "users",
				IsView:       false,
				IsInsertable: true,
				IsUpdatable:  true,
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
					{Name: "name", Type: "text"},
				}, //nolint:exhaustruct,lll
				PrimaryKeys:       []string{"id"},
				ForeignKeys:       nil,
				UniqueConstraints: nil,
			},
		},
	}

	for _, opt := range opts {
		opt(objs)
	}

	return objs
}

func withEnumValues(schema, table string, values ...string) func(*introspection.Objects) {
	return func(objs *introspection.Objects) {
		evs := make([]introspection.EnumValue, 0, len(values))
		for _, v := range values {
			evs = append(evs, introspection.EnumValue{Value: v, Comment: ""})
		}

		objs.EnumValues[schema+"."+table] = evs
	}
}

func withTable(schema, table string, columns ...string) func(*introspection.Objects) {
	return func(objs *introspection.Objects) {
		s, ok := objs.Schemas[schema]
		if !ok {
			s = &introspection.Schema{Tables: map[string]*introspection.Table{}}
			objs.Schemas[schema] = s
		}

		cols := make([]introspection.Column, 0, len(columns))
		for _, c := range columns {
			cols = append(cols, introspection.Column{Name: c, Type: "text"}) //nolint:exhaustruct
		}

		s.Tables[table] = &introspection.Table{ //nolint:exhaustruct
			Schema: schema, Name: table, IsInsertable: true, IsUpdatable: true,
			Columns:     cols,
			PrimaryKeys: nil,
		}
	}
}

// withFunction registers a function that returns the canonical
// "public.users" table from makeObjects. Use this helper when the test only
// cares that the function is present in introspection; tests that need a
// non-table return type or a different base table should construct the
// introspection.Function inline.
func withFunction(schema, name string) func(*introspection.Objects) {
	return func(objs *introspection.Objects) {
		objs.Functions[schema+"."+name] = &introspection.Function{ //nolint:exhaustruct
			Arguments: nil,
			ReturnType: introspection.FunctionReturnType{
				Type:        "",
				IsSetOf:     true,
				TableSchema: "public",
				TableName:   "users",
			},
		}
	}
}

// TestReconcileMetadata_DropsMissingTable verifies the source's missing-table
// case: a metadata entry whose schema.table does not exist in the
// introspected objects is dropped and recorded as a "table" inconsistency,
// while a sibling existing table keeps serving.
func TestReconcileMetadata_DropsMissingTable(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
			{Table: metadata.TableSource{Schema: "public", Name: "ghost"}},
		},
	}

	inc := metadata.NewInconsistencies()

	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	if len(out.Tables) != 1 || out.Tables[0].Table.Name != "users" {
		t.Fatalf(
			"expected only users to survive, got %+v",
			tableNames(out.Tables),
		)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindTable,
		"public.ghost", "table not found")
}

// TestReconcileMetadata_DropsMissingColumns verifies the column-level case:
// references to nonexistent columns in column_config, select/insert/update
// permission column lists, and insert/update set maps are all dropped and
// recorded as separate "column" inconsistencies.
func TestReconcileMetadata_DropsMissingColumns(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				Configuration: metadata.TableConfiguration{ //nolint:exhaustruct
					ColumnConfig: map[string]metadata.ColumnConfig{
						"id":      {CustomName: "userId"},
						"missing": {CustomName: "x"},
					},
				},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role: "user",
						Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
							Columns: []string{"id", "name", "ghost_col"},
						},
					},
				},
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{ //nolint:exhaustruct
							Columns: []string{"name", "vanished"},
							Set:     map[string]any{"id": "x", "phantom": "y"},
						},
					},
				},
				UpdatePermissions: []metadata.UpdatePermission{
					{
						Role: "user",
						Permission: metadata.UpdatePermissionConfig{ //nolint:exhaustruct
							Columns: []string{"name", "absent"},
							Set:     map[string]any{"absent": "z"},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	t0 := out.Tables[0]

	if _, ok := t0.Configuration.ColumnConfig["missing"]; ok {
		t.Error("missing column_config entry was not dropped")
	}

	if !slices.Equal(t0.SelectPermissions[0].Permission.Columns, []string{"id", "name"}) {
		t.Errorf(
			"select_permission.columns not filtered: %v",
			t0.SelectPermissions[0].Permission.Columns,
		)
	}

	if !slices.Equal(t0.InsertPermissions[0].Permission.Columns, []string{"name"}) {
		t.Errorf(
			"insert_permission.columns not filtered: %v",
			t0.InsertPermissions[0].Permission.Columns,
		)
	}

	if _, ok := t0.InsertPermissions[0].Permission.Set["phantom"]; ok {
		t.Error("phantom insert set key was not dropped")
	}

	if !slices.Equal(t0.UpdatePermissions[0].Permission.Columns, []string{"name"}) {
		t.Errorf(
			"update_permission.columns not filtered: %v",
			t0.UpdatePermissions[0].Permission.Columns,
		)
	}

	if t0.UpdatePermissions[0].Permission.Set != nil {
		t.Errorf(
			"update_permission.set should be nil after dropping all keys, got %v",
			t0.UpdatePermissions[0].Permission.Set,
		)
	}

	expectedColumns := []string{
		"public.users.missing",
		"public.users.ghost_col",
		"public.users.vanished",
		"public.users.phantom",
		"public.users.absent",
		"public.users.absent",
	}

	for _, c := range expectedColumns {
		mustHaveInconsistency(t, inc, metadata.InconsistencyKindColumn,
			c, "")
	}
}

func TestReconcileMetadata_ExpandsPermissionAllColumnsShorthand(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role: "user",
						Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
							Columns: []string{permissionAllColumns},
						},
					},
				},
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{ //nolint:exhaustruct
							Columns: []string{permissionAllColumns},
						},
					},
				},
				UpdatePermissions: []metadata.UpdatePermission{
					{
						Role: "user",
						Permission: metadata.UpdatePermissionConfig{ //nolint:exhaustruct
							Columns: []string{permissionAllColumns},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	permissions := []struct {
		name string
		got  []string
	}{
		{
			name: "select_permission.columns",
			got:  out.Tables[0].SelectPermissions[0].Permission.Columns,
		},
		{
			name: "insert_permission.columns",
			got:  out.Tables[0].InsertPermissions[0].Permission.Columns,
		},
		{
			name: "update_permission.columns",
			got:  out.Tables[0].UpdatePermissions[0].Permission.Columns,
		},
	}

	for _, p := range permissions {
		if !slices.Equal(p.got, []string{"id", "name"}) {
			t.Fatalf("%s = %v, want [id name]", p.name, p.got)
		}
	}

	if inc.Len() != 0 {
		t.Fatalf("expected no inconsistencies, got %+v", inc.Snapshot())
	}

	inputColumns := []struct {
		name string
		got  []string
	}{
		{
			name: "select_permission.columns",
			got:  dbMeta.Tables[0].SelectPermissions[0].Permission.Columns,
		},
		{
			name: "insert_permission.columns",
			got:  dbMeta.Tables[0].InsertPermissions[0].Permission.Columns,
		},
		{
			name: "update_permission.columns",
			got:  dbMeta.Tables[0].UpdatePermissions[0].Permission.Columns,
		},
	}

	for _, p := range inputColumns {
		if !slices.Equal(p.got, []string{permissionAllColumns}) {
			t.Fatalf("%s input columns mutated to %v", p.name, p.got)
		}
	}
}

// TestReconcileMetadata_DoesNotMutateInput verifies that reconcileMetadata
// keeps its godoc contract — "returns a filtered copy" — even when filtering
// rewrites permission column lists / set maps. The slice headers we receive
// from the caller share their backing array with our value-copy of each
// TableMetadata, so writing through &t.SelectPermissions[i] (etc.) would
// silently leak into the caller's *metadata.DatabaseMetadata
// (controllerState.metadata is held across hot-reloads). We snapshot the
// input by constructing two structurally identical literals and diff the
// "passed in" copy against the snapshot after the call returns.
func TestReconcileMetadata_DoesNotMutateInput(t *testing.T) {
	t.Parallel()

	build := func() *metadata.DatabaseMetadata {
		return &metadata.DatabaseMetadata{ //nolint:exhaustruct
			Name: "default",
			Tables: []metadata.TableMetadata{ //nolint:exhaustruct
				{
					Table: metadata.TableSource{Schema: "public", Name: "users"},
					Configuration: metadata.TableConfiguration{ //nolint:exhaustruct
						ColumnConfig: map[string]metadata.ColumnConfig{
							"id":      {CustomName: "userId"},
							"missing": {CustomName: "x"},
						},
					},
					SelectPermissions: []metadata.SelectPermission{
						{
							Role: "user",
							Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
								Columns: []string{"id", "name", "ghost_col"},
							},
						},
					},
					InsertPermissions: []metadata.InsertPermission{
						{
							Role: "user",
							Permission: metadata.InsertPermissionConfig{ //nolint:exhaustruct
								Columns: []string{"name", "vanished"},
								Set:     map[string]any{"id": "x", "phantom": "y"},
							},
						},
					},
					UpdatePermissions: []metadata.UpdatePermission{
						{
							Role: "user",
							Permission: metadata.UpdatePermissionConfig{ //nolint:exhaustruct
								Columns: []string{"name", "absent"},
								Set:     map[string]any{"absent": "z"},
							},
						},
					},
				},
			},
		}
	}

	input := build()
	snapshot := build()

	_ = reconcileMetadata(t.Context(), nil, metadata.NewInconsistencies(), input, makeObjects())

	if diff := cmp.Diff(snapshot, input); diff != "" {
		t.Fatalf("reconcileMetadata mutated its input (-want +got):\n%s", diff)
	}
}

// TestReconcileMetadata_DropsEnumWithoutValues verifies the enum-values case
// matches Hasura's behaviour: an is_enum table whose driver did not surface
// enum rows is dropped from the source entirely (not demoted to a regular
// table) so the input contract for FK columns into it is not silently
// widened. A distinct "enum_values" inconsistency makes the failure mode
// filterable apart from generic missing-table drops.
func TestReconcileMetadata_DropsEnumWithoutValues(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{Table: metadata.TableSource{Schema: "public", Name: "orders"}},
			{
				Table:  metadata.TableSource{Schema: "public", Name: "users"},
				IsEnum: true,
			},
		},
	}

	inc := metadata.NewInconsistencies()

	out := reconcileMetadata(
		t.Context(), nil, inc, dbMeta,
		makeObjects(withTable("public", "orders", "id")),
	)

	if names := tableNames(out.Tables); !slices.Equal(names, []string{"orders"}) {
		t.Fatalf(
			"expected only orders to survive the enum drop, got %v",
			names,
		)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindEnumValues,
		"public.users", "cannot be used as an enum")
}

// TestReconcileMetadata_PreservesEnumWithValues verifies the happy path:
// an is_enum table whose driver surfaced enum rows is kept as-is with no
// inconsistency recorded.
func TestReconcileMetadata_PreservesEnumWithValues(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table:  metadata.TableSource{Schema: "public", Name: "users"},
				IsEnum: true,
			},
		},
	}

	inc := metadata.NewInconsistencies()

	out := reconcileMetadata(
		t.Context(), nil, inc, dbMeta,
		makeObjects(withEnumValues("public", "users", "A", "B")),
	)

	if len(out.Tables) != 1 || !out.Tables[0].IsEnum {
		t.Errorf("expected IsEnum to be preserved when values exist, got %+v", out.Tables)
	}

	if inc.Len() != 0 {
		t.Errorf("expected no inconsistencies, got %+v", inc.Snapshot())
	}
}

// TestReconcileMetadata_DropsRelationshipsWithMissingTarget verifies the
// relationship case: object/array relationships whose target table does not
// exist in the source are dropped and recorded as "relationship"
// inconsistencies.
func TestReconcileMetadata_DropsRelationshipsWithMissingTarget(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "ghost_owner",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"owner_id"},
								Table: metadata.TableSource{
									Schema: "public", Name: "ghost_table",
								},
							},
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationship{
					{
						Name: "ghost_orders",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ManualConfiguration: &metadata.ManualConfiguration{ //nolint:exhaustruct
								RemoteTable: metadata.TableSource{
									Schema: "public", Name: "ghost_orders",
								},
							},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	if len(out.Tables[0].ObjectRelationships) != 0 {
		t.Error("expected ghost_owner to be dropped")
	}

	if len(out.Tables[0].ArrayRelationships) != 0 {
		t.Error("expected ghost_orders to be dropped")
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindRelationship,
		"public.users.ghost_owner", "not tracked")
	mustHaveInconsistency(t, inc, metadata.InconsistencyKindRelationship,
		"public.users.ghost_orders", "not tracked")
}

func TestReconcileMetadata_DropsInvalidRemoteRelationshipType(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				RemoteRelationships: []metadata.RemoteRelationship{
					{
						Name: "bad_remote",
						Definition: metadata.RemoteRelationshipDef{ //nolint:exhaustruct
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping:     map[string]string{"id": "id"},
								RelationshipType: "typo",
								Source:           "other",
								Table: metadata.TableSource{
									Schema: "public",
									Name:   "users",
								},
							},
						},
					},
					{
						Name: "good_remote",
						Definition: metadata.RemoteRelationshipDef{ //nolint:exhaustruct
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping:     map[string]string{"id": "id"},
								RelationshipType: metadata.RelationshipTypeArray,
								Source:           "other",
								Table: metadata.TableSource{
									Schema: "public",
									Name:   "users",
								},
							},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	if got := len(out.Tables[0].RemoteRelationships); got != 1 {
		t.Fatalf("surviving remote relationships = %d, want 1", got)
	}

	if got := out.Tables[0].RemoteRelationships[0].Name; got != "good_remote" {
		t.Fatalf("surviving remote relationship = %q, want good_remote", got)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindRelationship,
		"public.users.bad_remote", "invalid to_source relationship_type")
}

// TestReconcileMetadata_KeepsCrossSourceRelationships verifies cross-source
// relationships (ManualConfiguration.Source pointing elsewhere) are not
// dropped: the composer handles those independently.
func TestReconcileMetadata_KeepsCrossSourceRelationships(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "external_owner",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ManualConfiguration: &metadata.ManualConfiguration{ //nolint:exhaustruct
								Source: "other_db",
								RemoteTable: metadata.TableSource{
									Schema: "public", Name: "anyone",
								},
							},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	if len(out.Tables[0].ObjectRelationships) != 1 {
		t.Error("expected cross-source relationship to be preserved")
	}

	if inc.Len() != 0 {
		t.Errorf("expected no inconsistencies, got %+v", inc.Snapshot())
	}
}

// TestReconcileMetadata_KeepsRemoteSchemaRelationships verifies that
// relationships whose ManualConfiguration targets a remote GraphQL schema
// (RemoteSchema != "") are not dropped by the SQL reconciler — they have an
// empty RemoteTable by design and resolve through the remote-schema
// connector, not against this source's table set.
func TestReconcileMetadata_KeepsRemoteSchemaRelationships(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "appSecrets",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ManualConfiguration: &metadata.ManualConfiguration{ //nolint:exhaustruct
								RemoteSchema:  "mimir",
								ColumnMapping: map[string]string{"id": "id"},
							},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, makeObjects())

	if len(out.Tables[0].ObjectRelationships) != 1 {
		t.Errorf(
			"expected remote-schema relationship to be preserved, got %d",
			len(out.Tables[0].ObjectRelationships),
		)
	}

	if inc.Len() != 0 {
		t.Errorf("expected no inconsistencies, got %+v", inc.Snapshot())
	}
}

// TestReconcileMetadata_DropsMissingFunctions verifies the function case:
// metadata entries whose function does not exist in the source are dropped
// and recorded.
func TestReconcileMetadata_DropsMissingFunctions(t *testing.T) {
	t.Parallel()

	// Track the public.users base table that withFunction's default
	// FunctionReturnType points at, so the surviving function passes the
	// "base table is tracked" check.
	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
		Functions: []metadata.FunctionMetadata{ //nolint:exhaustruct
			{Function: metadata.FunctionSource{Schema: "public", Name: "do_thing"}},
			{Function: metadata.FunctionSource{Schema: "public", Name: "vanished"}},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(
		t.Context(), nil, inc, dbMeta,
		makeObjects(withFunction("public", "do_thing")),
	)

	if len(out.Functions) != 1 || out.Functions[0].Function.Name != "do_thing" {
		t.Fatalf("expected only do_thing to survive, got %+v", out.Functions)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindFunction,
		"public.vanished", "function not found")
}

// TestReconcileMetadata_PartialFailureKeepsRestServing combines a missing
// table, a missing column on a surviving table, and a missing function in a
// single source. The reconciler should keep every remaining entity intact
// and record exactly the dropped ones.
func TestReconcileMetadata_PartialFailureKeepsRestServing(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
			{Table: metadata.TableSource{Schema: "public", Name: "orders"}},
			{Table: metadata.TableSource{Schema: "public", Name: "ghost"}},
		},
		Functions: []metadata.FunctionMetadata{ //nolint:exhaustruct
			{Function: metadata.FunctionSource{Schema: "public", Name: "fn_ok"}},
			{Function: metadata.FunctionSource{Schema: "public", Name: "fn_missing"}},
		},
	}

	dbMeta.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{
			Role: "user",
			Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
				Columns: []string{"id", "name", "ghost_col"},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(
		t.Context(), nil, inc, dbMeta,
		makeObjects(
			withTable("public", "orders", "id", "amount"),
			withFunction("public", "fn_ok"),
		),
	)

	if names := tableNames(out.Tables); !slices.Equal(names, []string{"users", "orders"}) {
		t.Errorf("expected [users orders] to survive, got %v", names)
	}

	if len(out.Functions) != 1 || out.Functions[0].Function.Name != "fn_ok" {
		t.Errorf("expected only fn_ok to survive, got %+v", out.Functions)
	}

	if !slices.Equal(
		out.Tables[0].SelectPermissions[0].Permission.Columns,
		[]string{"id", "name"},
	) {
		t.Errorf(
			"select_permission.columns not filtered: %v",
			out.Tables[0].SelectPermissions[0].Permission.Columns,
		)
	}

	snap := inc.Snapshot()
	if len(snap) != 3 {
		t.Fatalf("expected 3 inconsistencies, got %d: %+v", len(snap), snap)
	}
}

// TestReconcileMetadata_DropsReverseFKWithUnmatchedColumn covers the
// reverse-FK introspection mismatch: ForeignKeyConstraint.Columns names a
// column the introspected target table has no foreign key for. queries-side
// build raised errRelationshipReverseFKColumnUnmatched and aborted the whole
// connector — reconcile must drop just the relationship and surface a
// per-relationship inconsistency so the rest of the source keeps serving.
func TestReconcileMetadata_DropsReverseFKWithUnmatchedColumn(t *testing.T) {
	t.Parallel()

	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": { //nolint:exhaustruct
				Schema: "public", Name: "users",
				IsInsertable: true, IsUpdatable: true,
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
				}, //nolint:exhaustruct
				PrimaryKeys: []string{"id"},
			},
			"orders": { //nolint:exhaustruct
				Schema: "public", Name: "orders",
				IsInsertable: true, IsUpdatable: true,
				Columns: []introspection.Column{ //nolint:exhaustruct
					{Name: "id", Type: "uuid"},
					{Name: "other_col", Type: "uuid"},
				},
				PrimaryKeys: []string{"id"},
				// Deliberately: no FK for "user_id" — the metadata names
				// that column on the constraint, but introspection
				// disagrees.
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "other_col",
						ForeignSchema:     "public",
						ForeignTable:      "users",
						ForeignColumnName: "id",
					},
				},
			},
		},
	}

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ArrayRelationships: []metadata.ArrayRelationship{
					{
						Name: "orders",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"user_id"},
								Table: metadata.TableSource{
									Schema: "public", Name: "orders",
								},
							},
						},
					},
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "orders"}},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, objs)

	if len(out.Tables[0].ArrayRelationships) != 0 {
		t.Errorf(
			"expected the reverse-FK relationship to be dropped, got %+v",
			out.Tables[0].ArrayRelationships,
		)
	}

	if names := tableNames(out.Tables); !slices.Equal(names, []string{"users", "orders"}) {
		t.Errorf("expected [users orders] to survive, got %v", names)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindRelationship,
		"public.users.orders", "user_id")
}

// TestReconcileMetadata_DropsForwardFKWithoutIntrospectedTarget covers the
// forward `ForeignKeyColumns` shortcut whose target is resolved through
// introspection. When the parent table has no FK for any of the listed
// columns, queries-side build raised
// errRelationshipTargetTableIntrospectionNotFound. Reconcile must drop the
// relationship and record an inconsistency.
func TestReconcileMetadata_DropsForwardFKWithoutIntrospectedTarget(t *testing.T) {
	t.Parallel()

	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"orders": { //nolint:exhaustruct
				Schema: "public", Name: "orders",
				IsInsertable: true, IsUpdatable: true,
				Columns: []introspection.Column{ //nolint:exhaustruct
					{Name: "id", Type: "uuid"},
					{Name: "user_id", Type: "uuid"},
				},
				PrimaryKeys: []string{"id"},
				// No FK on user_id — the forward shortcut cannot resolve a
				// target table from introspection.
				ForeignKeys: nil,
			},
		},
	}

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "orders"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "user",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ForeignKeyColumns: []string{"user_id"},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, objs)

	if len(out.Tables[0].ObjectRelationships) != 0 {
		t.Errorf(
			"expected the forward-FK relationship to be dropped, got %+v",
			out.Tables[0].ObjectRelationships,
		)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindRelationship,
		"public.orders.user", "no matching foreign key")
}

// TestReconcileMetadata_DropsForwardFKWithResolvedButUntrackedTarget covers
// the second failure branch of dropIfForwardFKBroken: the parent table's
// introspected ForeignKeys resolve the forward shortcut to a target
// (schema, table) pair, but that target is absent from the introspected
// Objects (e.g. the table was dropped between the FK catalogue read and the
// table introspection, or lives in a schema the connector does not surface).
// Without the second guard, objects.GetTable would later be called on a
// missing entry downstream; reconcile must drop the relationship and record
// an inconsistency naming the missing target.
func TestReconcileMetadata_DropsForwardFKWithResolvedButUntrackedTarget(t *testing.T) {
	t.Parallel()

	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"orders": { //nolint:exhaustruct
				Schema: "public", Name: "orders",
				IsInsertable: true, IsUpdatable: true,
				Columns: []introspection.Column{ //nolint:exhaustruct
					{Name: "id", Type: "uuid"},
					{Name: "user_id", Type: "uuid"},
				},
				PrimaryKeys: []string{"id"},
				// LookupForwardFKTarget resolves user_id -> public.users,
				// but public.users is deliberately absent from objs.Schemas
				// so objects.GetTable("public", "users") returns false.
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "user_id",
						ForeignSchema:     "public",
						ForeignTable:      "users",
						ForeignColumnName: "id",
					},
				},
			},
		},
	}

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{
				Table: metadata.TableSource{Schema: "public", Name: "orders"},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "user",
						Using: metadata.RelationshipUsing{ //nolint:exhaustruct
							ForeignKeyColumns: []string{"user_id"},
						},
					},
				},
			},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, objs)

	if len(out.Tables[0].ObjectRelationships) != 0 {
		t.Errorf(
			"expected the forward-FK relationship to be dropped, got %+v",
			out.Tables[0].ObjectRelationships,
		)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindRelationship,
		"public.orders.user", "not found in source introspection")
}

// TestReconcileMetadata_DropsFunctionWithUntrackedBaseTable covers the
// pre-existing errBaseTableForFunctionNotFound BuildRoots path: a function
// whose declared return-table is not tracked in metadata used to abort the
// connector. Reconcile must drop the function and surface a function
// inconsistency instead.
func TestReconcileMetadata_DropsFunctionWithUntrackedBaseTable(t *testing.T) {
	t.Parallel()

	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": { //nolint:exhaustruct
				Schema: "public", Name: "users",
				IsInsertable: true, IsUpdatable: true,
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
				}, //nolint:exhaustruct
				PrimaryKeys: []string{"id"},
			},
		},
	}
	objs.Functions["public.search_orders"] = &introspection.Function{ //nolint:exhaustruct
		ReturnType: introspection.FunctionReturnType{
			Type:        "",
			IsSetOf:     true,
			TableSchema: "public",
			TableName:   "orders", // not tracked
		},
		Volatility: introspection.VolatilityStable,
	}

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
		Functions: []metadata.FunctionMetadata{ //nolint:exhaustruct
			{Function: metadata.FunctionSource{Schema: "public", Name: "search_orders"}},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, objs)

	if len(out.Functions) != 0 {
		t.Errorf("expected the function to be dropped, got %+v", out.Functions)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindFunction,
		"public.search_orders", "base table")
}

// TestReconcileMetadata_DropsFunctionWithNonTableReturnType covers the
// errFunctionDoesNotReturnTableType BuildRoots path: a function whose
// introspected return type is not a table type (scalar, RECORD, etc.) used
// to abort the connector. Reconcile must drop the function and surface a
// function inconsistency instead.
func TestReconcileMetadata_DropsFunctionWithNonTableReturnType(t *testing.T) {
	t.Parallel()

	objs := introspection.NewObjects()
	objs.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"users": { //nolint:exhaustruct
				Schema: "public", Name: "users",
				IsInsertable: true, IsUpdatable: true,
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
				}, //nolint:exhaustruct
				PrimaryKeys: []string{"id"},
			},
		},
	}
	// Scalar-returning function: TableSchema and TableName are empty so
	// IsTableType() returns false.
	objs.Functions["public.scalar_fn"] = &introspection.Function{ //nolint:exhaustruct
		ReturnType: introspection.FunctionReturnType{
			Type:        "integer",
			IsSetOf:     false,
			TableSchema: "",
			TableName:   "",
		},
		Volatility: introspection.VolatilityStable,
	}

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
		Tables: []metadata.TableMetadata{ //nolint:exhaustruct
			{Table: metadata.TableSource{Schema: "public", Name: "users"}},
		},
		Functions: []metadata.FunctionMetadata{ //nolint:exhaustruct
			{Function: metadata.FunctionSource{Schema: "public", Name: "scalar_fn"}},
		},
	}

	inc := metadata.NewInconsistencies()
	out := reconcileMetadata(t.Context(), nil, inc, dbMeta, objs)

	if len(out.Functions) != 0 {
		t.Errorf("expected the function to be dropped, got %+v", out.Functions)
	}

	if names := tableNames(out.Tables); !slices.Equal(names, []string{"users"}) {
		t.Errorf("expected sibling users table to survive, got %v", names)
	}

	mustHaveInconsistency(t, inc, metadata.InconsistencyKindFunction,
		"public.scalar_fn", "does not return a table type")
}

// mustHaveInconsistency asserts that inc has at least one entry matching the
// kind/name (always under source="default", which is what every test in this
// file uses) and whose Reason contains reasonSubstr if non-empty.
func mustHaveInconsistency(
	t *testing.T,
	inc *metadata.Inconsistencies,
	kind, name, reasonSubstr string,
) {
	t.Helper()

	const wantSource = "default"

	for _, it := range inc.Snapshot() {
		if it.Kind != kind || it.Source != wantSource || it.Name != name {
			continue
		}

		if reasonSubstr != "" && !strings.Contains(it.Reason, reasonSubstr) {
			continue
		}

		return
	}

	t.Fatalf(
		"expected inconsistency kind=%q name=%q reason~%q; got %+v",
		kind, name, reasonSubstr, inc.Snapshot(),
	)
}

func tableNames(tables []metadata.TableMetadata) []string {
	names := make([]string, 0, len(tables))
	for i := range tables {
		names = append(names, tables[i].Table.Name)
	}

	return names
}
