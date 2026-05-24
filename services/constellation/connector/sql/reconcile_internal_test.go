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

func withFunction(schema, name string) func(*introspection.Objects) {
	return func(objs *introspection.Objects) {
		objs.Functions[schema+"."+name] = &introspection.Function{ //nolint:exhaustruct
			Arguments: nil,
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
								Column: "owner_id",
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

// TestReconcileMetadata_DropsMissingFunctions verifies the function case:
// metadata entries whose function does not exist in the source are dropped
// and recorded.
func TestReconcileMetadata_DropsMissingFunctions(t *testing.T) {
	t.Parallel()

	dbMeta := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default",
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
