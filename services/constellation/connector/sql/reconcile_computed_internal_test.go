//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"reflect"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func computedReconcileFixture() (*metadata.DatabaseMetadata, *introspection.Objects) {
	objects := makeObjects(withTable("public", "posts", "id"))
	objects.ComputedFunctions = map[introspection.ComputedTable]map[string]introspection.ComputedFunctionLookup{
		{Schema: "public", Name: "users"}: {
			"label": {Function: &introspection.ComputedFunction{ //nolint:exhaustruct
				Schema:      "public",
				Name:        "user_label",
				RowArgument: 0,
				Arguments: []introspection.ComputedFunctionArgument{
					{Mode: "i"},
				}, //nolint:exhaustruct
				ReturnType: introspection.PostgreSQLType{
					Schema: "pg_catalog",
					Name:   "text",
					Kind:   "b",
				}, //nolint:exhaustruct
				Volatility: introspection.VolatilityStable,
			}},
			"posts_for_user": {Function: &introspection.ComputedFunction{ //nolint:exhaustruct
				Schema:      "public",
				Name:        "posts_for_user",
				RowArgument: 0,
				Arguments: []introspection.ComputedFunctionArgument{
					{Mode: "i"},
				}, //nolint:exhaustruct
				ReturnType: introspection.PostgreSQLType{
					Schema: "public",
					Name:   "posts",
					Kind:   "c",
				}, //nolint:exhaustruct
				ReturnRelOID: 1,
				ReturnSet:    true,
				Volatility:   introspection.VolatilityStable,
			}},
			"broken": {Reason: "overloaded functions are not supported"}, //nolint:exhaustruct
		},
	}
	md := &metadata.DatabaseMetadata{ //nolint:exhaustruct
		Name: "default", Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{ //nolint:exhaustruct
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ComputedFields: []metadata.ComputedField{
					{
						Name: "label",
						Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
						},
					},
					{
						Name: "posts_for_user",
						Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{
								Schema: "public",
								Name:   "posts_for_user",
							},
						},
					},
					{
						Name: "broken",
						Definition: metadata.ComputedFieldDefinition{
							Function: metadata.FunctionSource{Schema: "public", Name: "broken"},
						},
					},
				},
			},
			{Table: metadata.TableSource{Schema: "public", Name: "posts"}}, //nolint:exhaustruct
		},
	}

	return md, objects
}

func TestReconcileComputedFieldPermissions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		filter  map[string]any
		grant   []string
		invalid []metadata.InvalidComputedFieldGrant
		kept    bool
	}{
		{"valid gated scalar grant", nil, []string{"label"}, nil, true},
		{"invalid function grant", nil, []string{"broken"}, nil, false},
		{"manual table grant", nil, []string{"posts_for_user"}, nil, false},
		{
			"malformed grant",
			nil,
			nil,
			[]metadata.InvalidComputedFieldGrant{{DecodeError: "not a list"}},
			false,
		},
		{
			"executable scalar predicate",
			map[string]any{"label": map[string]any{"_eq": "a"}},
			nil,
			nil,
			true,
		},
		{
			"invalid scalar operator",
			map[string]any{"label": map[string]any{"_unknown": "a"}},
			nil,
			nil,
			false,
		},
		{
			"nested invalid function",
			map[string]any{
				"_and": []any{
					map[string]any{
						"_or": []any{
							map[string]any{
								"_not": map[string]any{"broken": map[string]any{"_eq": true}},
							},
						},
					},
				},
			},
			nil,
			nil,
			false,
		},
		{
			"unknown ordinary key",
			map[string]any{"missing_column": map[string]any{"_eq": 1}},
			nil,
			nil,
			true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			md.Tables[0].SelectPermissions = []metadata.SelectPermission{
				{Role: "affected", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
					Columns: []string{"id"}, Filter: tt.filter, ComputedFields: tt.grant,
					InvalidComputedFields: tt.invalid,
				}},
				{
					Role:       "unaffected",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				}, //nolint:exhaustruct
			}
			inc := metadata.NewInconsistencies()

			got := reconcileMetadata(t.Context(), nil, inc, md, objects)
			if len(got.Tables) != 2 || len(got.Tables[0].SelectPermissions) != 1+boolInt(tt.kept) {
				t.Fatalf("source or unaffected grant removed: %#v", got.Tables)
			}

			if len(md.Tables[0].SelectPermissions) != 2 ||
				!reflect.DeepEqual(md.Tables[0].SelectPermissions[0].Permission.Filter, tt.filter) {
				t.Fatal("input metadata mutated")
			}

			if !tt.kept &&
				!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
				t.Fatalf("missing permission inconsistency: %+v", inc.Snapshot())
			}

			if !hasComputedInconsistency(inc, metadata.InconsistencyKindComputedField) {
				t.Fatalf("missing field inconsistency: %+v", inc.Snapshot())
			}
		})
	}
}

func boolInt(b bool) int {
	if b {
		return 1
	}

	return 0
}

func hasComputedInconsistency(inc *metadata.Inconsistencies, kind string) bool {
	for _, entry := range inc.Snapshot() {
		if entry.Kind == kind {
			return true
		}
	}

	return false
}

func TestReconcileExecutableComputedPermissionKinds(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name      string
		predicate map[string]any
		kept      bool
	}{
		{"valid scalar", map[string]any{"label": map[string]any{"_eq": "visible"}}, true},
		{"unknown operator", map[string]any{"label": map[string]any{"_unhandled": "visible"}}, false},
		{"invalid function", map[string]any{"broken": map[string]any{"_eq": "visible"}}, false},
		{"deferred table", map[string]any{"posts_for_user": map[string]any{"id": map[string]any{"_eq": 1}}}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			md.Tables[0].SelectPermissions = []metadata.SelectPermission{
				{Role: "guard", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, Filter: tt.predicate,
				}},
			}
			md.Tables[0].InsertPermissions = []metadata.InsertPermission{
				{Role: "guard", Permission: metadata.InsertPermissionConfig{Check: tt.predicate}},
			}
			md.Tables[0].UpdatePermissions = []metadata.UpdatePermission{
				{
					Role: "guard",
					Permission: metadata.UpdatePermissionConfig{
						Filter: tt.predicate,
						Check:  tt.predicate,
					},
				},
			}
			md.Tables[0].DeletePermissions = []metadata.DeletePermission{
				{Role: "guard", Permission: metadata.DeletePermissionConfig{Filter: tt.predicate}},
			}
			inc := metadata.NewInconsistencies()
			out := reconcileMetadata(t.Context(), nil, inc, md, objects)

			got := out.Tables[0]
			if (len(got.SelectPermissions) == 1) != tt.kept ||
				(len(got.InsertPermissions) == 1) != tt.kept ||
				(len(got.UpdatePermissions) == 1) != tt.kept ||
				(len(got.DeletePermissions) == 1) != tt.kept {
				t.Fatalf(
					"whole permissions not reconciled: %+v, inconsistencies %+v",
					got,
					inc.Snapshot(),
				)
			}

			if !tt.kept {
				for _, kind := range []string{
					metadata.InconsistencyKindSelectPermission, metadata.InconsistencyKindInsertPermission,
					metadata.InconsistencyKindUpdatePermission, metadata.InconsistencyKindDeletePermission,
				} {
					if !hasComputedInconsistency(inc, kind) {
						t.Errorf("missing %s inconsistency", kind)
					}
				}
			}
		})
	}
}

func TestComputedPredicateRelationshipTraversal(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		predicate map[string]any
	}{
		{
			name: "local relationship",
			predicate: map[string]any{
				"posts": map[string]any{"post_label": map[string]any{"_eq": "a"}},
			},
		},
		{
			name: "exists across table",
			predicate: map[string]any{"_exists": map[string]any{
				"_table": map[string]any{"schema": "public", "name": "posts"},
				"_where": map[string]any{"post_label": map[string]any{"_eq": "a"}},
			}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			md.Tables[0].ArrayRelationships = []metadata.ArrayRelationship{
				{ //nolint:exhaustruct
					Name: "posts",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{ //nolint:exhaustruct
							RemoteTable: metadata.TableSource{Schema: "public", Name: "posts"},
						},
					},
				},
			}
			md.Tables[1].ComputedFields = []metadata.ComputedField{
				{Name: "post_label"},
			} //nolint:exhaustruct
			objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "posts"}] = map[string]introspection.ComputedFunctionLookup{
				"post_label": {Reason: "missing"}, //nolint:exhaustruct
			}
			md.Tables[0].SelectPermissions = []metadata.SelectPermission{
				{Role: "guard", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
					Columns: []string{"id"}, Filter: tt.predicate,
				}},
			}
			inc := metadata.NewInconsistencies()

			out := reconcileMetadata(t.Context(), nil, inc, md, objects)
			if len(out.Tables[0].SelectPermissions) != 0 ||
				!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
				t.Fatalf("computed dependency not found: %+v", inc.Snapshot())
			}
		})
	}
}

func TestComputedGrantIdentifiesPredicateAcrossRoles(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{Role: "grant", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
			Columns: []string{"id"}, ComputedFields: []string{"missing_definition"},
		}},
		{Role: "predicate", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
			Columns: []string{"id"},
			Filter:  map[string]any{"missing_definition": map[string]any{"_eq": "value"}},
		}},
		{Role: "ordinary", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
			Columns: []string{"id"},
			Filter:  map[string]any{"unknown_key": map[string]any{"_eq": "value"}},
		}},
	}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[0].SelectPermissions) != 1 ||
		got.Tables[0].SelectPermissions[0].Role != "ordinary" {
		t.Fatalf("granted computed name was not isolated: %+v", got.Tables[0].SelectPermissions)
	}

	var permissionFailures int
	for _, entry := range inc.Snapshot() {
		if entry.Kind == metadata.InconsistencyKindSelectPermission {
			permissionFailures++
		}
	}

	if permissionFailures != 2 {
		t.Fatalf("expected two whole-permission failures, got %+v", inc.Snapshot())
	}
}

func TestComputedPredicateReverseFK(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	posts, _ := objects.GetTable("public", "posts")
	posts.Columns = append(
		posts.Columns,
		introspection.Column{Name: "user_id", Type: "uuid"},
	) //nolint:exhaustruct
	posts.ForeignKeys = []introspection.ForeignKey{
		{
			ColumnName:        "user_id",
			ForeignSchema:     "public",
			ForeignTable:      "users",
			ForeignColumnName: "id",
		},
	}
	md.Tables[0].ArrayRelationships = []metadata.ArrayRelationship{
		{ //nolint:exhaustruct
			Name: "posts",
			Using: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Schema: "public", Name: "posts"},
				},
			},
		},
	}
	md.Tables[1].ComputedFields = []metadata.ComputedField{
		{Name: "post_label"},
	} //nolint:exhaustruct
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{Role: "reader", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
			Columns: []string{"id"},
			Filter: map[string]any{"posts": map[string]any{
				"post_label": map[string]any{"_eq": "value"},
			}},
		}},
	}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[0].SelectPermissions) != 0 ||
		!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf("reverse relationship dependency was not isolated: %+v", inc.Snapshot())
	}
}

func TestReconcileComputedMalformedFields(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		fields []metadata.ComputedField
		grant  string
	}{
		{
			name: "lost name",
			fields: []metadata.ComputedField{
				{DecodeError: "field entry must be an object"},
			}, //nolint:exhaustruct
			grant: "",
		},
		{
			name: "empty name",
			fields: []metadata.ComputedField{
				{Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
				}},
			}, //nolint:exhaustruct
			grant: "",
		},
		{
			name:   "duplicate name",
			fields: []metadata.ComputedField{{Name: "label"}, {Name: "label"}}, //nolint:exhaustruct
			grant:  "label",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			md.Tables[0].ComputedFields = tt.fields
			md.Tables[0].SelectPermissions = []metadata.SelectPermission{
				{
					Role:       "reader",
					Permission: metadata.SelectPermissionConfig{ComputedFields: []string{tt.grant}},
				},
			} //nolint:exhaustruct
			inc := metadata.NewInconsistencies()

			out := reconcileMetadata(t.Context(), nil, inc, md, objects)
			if len(out.Tables[0].ComputedFields) != 0 ||
				len(out.Tables[0].SelectPermissions) != 0 ||
				!hasComputedInconsistency(inc, metadata.InconsistencyKindComputedField) ||
				!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
				t.Fatalf(
					"invalid field/grant survived: fields=%+v grants=%+v inc=%+v",
					out.Tables[0].ComputedFields,
					out.Tables[0].SelectPermissions,
					inc.Snapshot(),
				)
			}
		})
	}
}

func TestReconcileComputedPredicateContexts(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	md.Tables[0].ArrayRelationships = []metadata.ArrayRelationship{
		{ //nolint:exhaustruct
			Name: "posts",
			Using: metadata.RelationshipUsing{
				ManualConfiguration: &metadata.ManualConfiguration{ //nolint:exhaustruct
					RemoteTable: metadata.TableSource{Schema: "public", Name: "posts"},
				},
			},
		},
	}
	md.Tables[1].ComputedFields = []metadata.ComputedField{
		{Name: "post_label"},
	} //nolint:exhaustruct
	objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "posts"}] = map[string]introspection.ComputedFunctionLookup{
		"post_label": {Reason: "missing"}, //nolint:exhaustruct
	}
	predicate := map[string]any{"posts_aggregate": map[string]any{"count": map[string]any{
		"filter":    map[string]any{"post_label": map[string]any{"_eq": "yes"}},
		"predicate": map[string]any{"_gt": 0},
	}}}
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{Role: "ok", Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}}},
		{Role: "aggregate_arg", Permission: metadata.SelectPermissionConfig{ //nolint:exhaustruct
			Columns: []string{"id"},
			Filter: map[string]any{"posts_aggregate": map[string]any{"bool_and": map[string]any{
				"arguments": "post_label", "predicate": map[string]any{"_eq": true},
			}}},
		}},
	} //nolint:exhaustruct
	md.Tables[0].InsertPermissions = []metadata.InsertPermission{
		{Role: "guard", Permission: metadata.InsertPermissionConfig{Check: predicate}},
	} //nolint:exhaustruct
	md.Tables[0].UpdatePermissions = []metadata.UpdatePermission{
		{Role: "guard_check", Permission: metadata.UpdatePermissionConfig{Check: predicate}},
		{Role: "guard_filter", Permission: metadata.UpdatePermissionConfig{Filter: predicate}},
	} //nolint:exhaustruct
	md.Tables[0].DeletePermissions = []metadata.DeletePermission{
		{Role: "guard", Permission: metadata.DeletePermissionConfig{Filter: predicate}},
	} //nolint:exhaustruct
	inc := metadata.NewInconsistencies()

	out := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(out.Tables[0].SelectPermissions) != 1 || len(out.Tables[0].InsertPermissions) != 0 ||
		len(out.Tables[0].UpdatePermissions) != 0 || len(out.Tables[0].DeletePermissions) != 0 {
		t.Fatalf("aggregate predicate permissions not isolated: %+v", out.Tables[0])
	}

	for _, kind := range []string{metadata.InconsistencyKindSelectPermission, metadata.InconsistencyKindInsertPermission, metadata.InconsistencyKindUpdatePermission, metadata.InconsistencyKindDeletePermission} {
		if !hasComputedInconsistency(inc, kind) {
			t.Fatalf("missing %s", kind)
		}
	}
}

func TestComputedNameCollisionPreservesOrdinaryFilters(t *testing.T) {
	t.Parallel()

	for _, tt := range []struct {
		name         string
		field        string
		filter       map[string]any
		relationship string
		grantOnly    bool
	}{
		{name: "column", field: "id", filter: map[string]any{"id": map[string]any{"_eq": 1}}},
		{name: "custom column", field: "label", relationship: "custom column", filter: map[string]any{
			"label": map[string]any{"_eq": 1},
		}},
		{name: "object relationship", field: "posts", relationship: "object", filter: map[string]any{
			"posts": map[string]any{"id": map[string]any{"_eq": 1}},
		}},
		{name: "array relationship", field: "posts", relationship: "array", filter: map[string]any{
			"posts": map[string]any{"id": map[string]any{"_eq": 1}},
		}},
		{
			name: "aggregate relationship definition", field: "posts_aggregate", relationship: "array",
			filter: map[string]any{"posts_aggregate": map[string]any{"count": map[string]any{
				"predicate": map[string]any{"_gt": 0},
			}}},
		},
		{
			name: "aggregate relationship grant only", field: "posts_aggregate", relationship: "array",
			grantOnly: true, filter: map[string]any{"posts_aggregate": map[string]any{
				"count": map[string]any{"predicate": map[string]any{"_gt": 0}},
			}},
		},
		{name: "remote relationship", field: "elsewhere", relationship: "remote", filter: nil},
	} {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()

			if !tt.grantOnly {
				md.Tables[0].ComputedFields = []metadata.ComputedField{{
					Name: tt.field,
					Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
					},
				}}
			}

			configureComputedCollision(&md.Tables[0], tt.relationship, tt.field)

			md.Tables[0].SelectPermissions = []metadata.SelectPermission{
				{Role: "filtered", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, Filter: tt.filter,
				}},
				{Role: "invalid_grant", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, ComputedFields: []string{tt.field},
				}},
			}
			inc := metadata.NewInconsistencies()

			got := reconcileMetadata(t.Context(), nil, inc, md, objects)
			// The fixture also contains a broken field; check the colliding name itself.
			collisionRecorded := false
			for _, entry := range inc.Snapshot() {
				if entry.Kind == metadata.InconsistencyKindComputedField &&
					entry.Name == "public.users."+tt.field {
					collisionRecorded = true

					if !strings.Contains(entry.Reason, "conflicts with") {
						t.Errorf("definition never reached name collision: %q", entry.Reason)
					}
				}
			}

			if len(got.Tables[0].ComputedFields) != 2*boolInt(tt.grantOnly) ||
				len(got.Tables[0].SelectPermissions) != 1 ||
				got.Tables[0].SelectPermissions[0].Role != "filtered" ||
				!reflect.DeepEqual(
					got.Tables[0].SelectPermissions[0].Permission.Filter,
					tt.filter,
				) ||
				collisionRecorded == tt.grantOnly ||
				!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
				t.Fatalf(
					"collision changed ordinary permission: metadata=%+v inconsistent=%+v",
					got.Tables[0],
					inc.Snapshot(),
				)
			}
		})
	}
}

func configureComputedCollision(table *metadata.TableMetadata, kind, field string) {
	using := metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
		RemoteTable: metadata.TableSource{Schema: "public", Name: "posts"},
	}}
	switch kind {
	case "custom column":
		table.Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
			"id": {CustomName: field},
		}
	case "object":
		table.ObjectRelationships = []metadata.ObjectRelationship{{Name: "posts", Using: using}}
	case "array":
		table.ArrayRelationships = []metadata.ArrayRelationship{{Name: "posts", Using: using}}
	case "remote":
		table.RemoteRelationships = []metadata.RemoteRelationship{{Name: field}}
	}
}

func TestComputedObjectRelationshipAggregateSuffixIsNotReserved(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	md.Tables[0].ObjectRelationships = []metadata.ObjectRelationship{{
		Name: "profile",
		Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
			RemoteTable: metadata.TableSource{Schema: "public", Name: "posts"},
		}},
	}}
	field := metadata.ComputedField{
		Name: "profile_aggregate",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "public", Name: "user_label"},
		},
	}
	md.Tables[0].ComputedFields = append(md.Tables[0].ComputedFields, field)
	objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}][field.Name] = objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"]
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{Role: "guarded", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{
				field.Name: map[string]any{"_eq": true},
			},
		}},
		{Role: "other", Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}}},
	}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables) != 2 || len(got.Tables[0].SelectPermissions) != 2 ||
		got.Tables[0].SelectPermissions[0].Role != "guarded" ||
		len(
			got.Tables[0].ComputedFields,
		) != 3 || got.Tables[0].ComputedFields[2].Name != field.Name {
		t.Fatalf(
			"computed filter lost the source or unrelated role: %+v, %+v",
			got.Tables,
			inc.Snapshot(),
		)
	}

	for _, entry := range inc.Snapshot() {
		if entry.Kind == metadata.InconsistencyKindComputedField &&
			entry.Name == "public.users."+field.Name {
			t.Errorf("valid computed definition rejected: %+v", entry)
		}

		if entry.Kind == metadata.InconsistencyKindSelectPermission &&
			entry.Name == "public.users.guarded" {
			t.Fatalf("executable scalar predicate revoked permission: %+v", entry)
		}
	}
}

func TestComputedPredicateForwardFK(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	posts, _ := objects.GetTable("public", "posts")
	posts.Columns = append(posts.Columns, introspection.Column{Name: "user_id", Type: "uuid"})
	posts.ForeignKeys = []introspection.ForeignKey{
		{
			ColumnName:        "user_id",
			ForeignSchema:     "public",
			ForeignTable:      "users",
			ForeignColumnName: "id",
		},
	}
	md.Tables[1].ObjectRelationships = []metadata.ObjectRelationship{{
		Name: "author", Using: metadata.RelationshipUsing{ForeignKeyColumns: []string{"user_id"}},
	}}
	md.Tables[1].SelectPermissions = []metadata.SelectPermission{
		{Role: "blocked", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{
				"author": map[string]any{"label": map[string]any{"_eq": "secret"}},
			},
		}},
		{Role: "other", Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}}},
	}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[1].SelectPermissions) != 2 ||
		got.Tables[1].SelectPermissions[0].Role != "blocked" ||
		hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf(
			"valid forward-FK scalar predicate unavailable: %+v; %+v",
			got.Tables[1],
			inc.Snapshot(),
		)
	}
}

func TestSQLiteComputedMetadataRemainsIgnored(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	md.Kind = "sqlite"
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{{
		Role: "reader", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, ComputedFields: []string{"broken"},
			Filter: map[string]any{"label": map[string]any{"_eq": "value"}},
		},
	}}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[0].SelectPermissions) != 1 ||
		!reflect.DeepEqual(got.Tables[0].ComputedFields, md.Tables[0].ComputedFields) ||
		len(inc.Snapshot()) != 0 {
		t.Fatalf(
			"SQLite computed metadata no longer ignored: %+v, %+v",
			got.Tables[0],
			inc.Snapshot(),
		)
	}
}

func TestComputedAggregateColumnCollisionPreservesPermission(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	md.Tables[0].ArrayRelationships = []metadata.ArrayRelationship{
		{
			Name: "posts",
			Using: metadata.RelationshipUsing{ManualConfiguration: &metadata.ManualConfiguration{
				RemoteTable: metadata.TableSource{Schema: "public", Name: "posts"},
			}},
		},
	}
	md.Tables[1].ComputedFields = []metadata.ComputedField{{Name: "id"}}
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{{
		Role: "reader", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, Filter: map[string]any{
				"posts_aggregate": map[string]any{"sum": map[string]any{
					"arguments": "id", "predicate": map[string]any{"_gt": 0},
				}},
			},
		},
	}}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[0].SelectPermissions) != 1 ||
		len(got.Tables[1].ComputedFields) != 0 ||
		!hasComputedInconsistency(inc, metadata.InconsistencyKindComputedField) ||
		hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf(
			"aggregate column collision revoked permission: %+v, %+v",
			got.Tables,
			inc.Snapshot(),
		)
	}
}
