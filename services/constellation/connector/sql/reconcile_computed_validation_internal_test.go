//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestValidateComputedFieldSignatures(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		change  func(*metadata.TableMetadata, *introspection.ComputedFunction)
		backend string
		invalid bool
	}{
		{"valid scalar", nil, "postgres", false},
		{
			"extension base return",
			func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
				fn.ReturnType = introspection.PostgreSQLType{
					Schema: "public",
					Name:   "citext",
					Kind:   "b",
				}
			},
			"postgres",
			false,
		},
		{
			"invalid enum return",
			func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
				fn.ReturnType = introspection.PostgreSQLType{
					Schema: "public",
					Name:   "status",
					Kind:   "e",
				}
			},
			"postgres",
			true,
		},
		{
			"deferred domain argument",
			func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
				fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
					Mode: "i",
					Type: introspection.PostgreSQLType{Schema: "public", Name: "amount", Kind: "d"},
				})
			},
			"postgres",
			false,
		},
		{
			"extension base argument",
			func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
				fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
					Mode: "i",
					Type: introspection.PostgreSQLType{Schema: "public", Name: "vector", Kind: "b"},
				})
			},
			"postgres",
			false,
		},
		{"pseudo argument", func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
			fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
				Mode: "i",
				Type: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "record", Kind: "p"},
			})
		}, "postgres", true},
		{"composite argument", func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
			fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
				Mode: "i",
				Type: introspection.PostgreSQLType{Schema: "public", Name: "other", Kind: "c"},
			})
		}, "postgres", true},
		{"no function name", func(t *metadata.TableMetadata, _ *introspection.ComputedFunction) {
			t.ComputedFields[0].Definition.Function.Name = ""
		}, "postgres", true},
		{
			"invalid GraphQL name",
			func(t *metadata.TableMetadata, _ *introspection.ComputedFunction) {
				t.ComputedFields[0].Name = "bad-name"
			},
			"postgres",
			true,
		},
		{
			"name column collision",
			func(t *metadata.TableMetadata, _ *introspection.ComputedFunction) { t.ComputedFields[0].Name = "id" },
			"postgres",
			true,
		},
		{
			"custom column collision",
			func(t *metadata.TableMetadata, _ *introspection.ComputedFunction) {
				t.Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
					"id": {CustomName: "label"},
				}
			},
			"postgres",
			true,
		},
		{
			"row mode",
			func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) { fn.Arguments[0].Mode = "b" },
			"postgres",
			true,
		},
		{"volatile", func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
			fn.Volatility = introspection.VolatilityVolatile
		}, "postgres", true},
		{
			"record return",
			func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
				fn.ReturnType = introspection.PostgreSQLType{
					Schema: "pg_catalog",
					Name:   "record",
					Kind:   "p",
				}
			},
			"postgres",
			true,
		},
		{"untracked table", func(_ *metadata.TableMetadata, fn *introspection.ComputedFunction) {
			fn.ReturnRelOID = 1
			fn.ReturnSet = true
			fn.ReturnType = introspection.PostgreSQLType{
				Schema: "public",
				Name:   "absent",
				Kind:   "c",
			}
		}, "postgres", true},
		{"wrong session type", func(t *metadata.TableMetadata, fn *introspection.ComputedFunction) {
			t.ComputedFields[0].Definition.SessionArgument = "session"

			fn.Arguments = append(
				fn.Arguments,
				introspection.ComputedFunctionArgument{
					Name: "session",
					Mode: "i",
					Type: introspection.PostgreSQLType{
						Schema: "pg_catalog",
						Name:   "text",
						Kind:   "b",
					},
				},
			)
		}, "postgres", true},
		{"valid session", func(t *metadata.TableMetadata, fn *introspection.ComputedFunction) {
			t.ComputedFields[0].Definition.SessionArgument = "session"

			fn.Arguments = append(
				fn.Arguments,
				introspection.ComputedFunctionArgument{
					Name: "session",
					Mode: "i",
					Type: introspection.PostgreSQLType{
						Schema: "pg_catalog",
						Name:   "jsonb",
						Kind:   "b",
					},
				},
			)
		}, "postgres", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			table := &md.Tables[0]

			fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"].Function
			if tt.change != nil {
				tt.change(table, fn)
			}

			tracked := map[introspection.ComputedTable]struct{}{
				{Schema: "public", Name: "users"}: {},
				{Schema: "public", Name: "posts"}: {},
			}

			_, reason := validateComputedField(
				tt.backend,
				table,
				table.ComputedFields[0],
				objects,
				tracked,
			)
			if (reason != "") != tt.invalid {
				t.Fatalf("invalid=%v reason=%q", tt.invalid, reason)
			}
		})
	}
}

func TestNonBaseReturnRevokesGrantButNonBaseArgumentRemainsDeferred(t *testing.T) {
	t.Parallel()

	for _, kind := range []string{"d", "e", "r", "m"} {
		for _, position := range []string{"return", "argument"} {
			t.Run(kind+"_"+position, func(t *testing.T) {
				t.Parallel()

				md, objects := computedReconcileFixture()
				fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"].Function

				typ := introspection.PostgreSQLType{Schema: "public", Name: "custom", Kind: kind}
				if position == "return" {
					fn.ReturnType = typ
				} else {
					fn.Arguments = append(
						fn.Arguments,
						introspection.ComputedFunctionArgument{Mode: "i", Type: typ},
					)
				}

				md.Tables[0].SelectPermissions = []metadata.SelectPermission{{
					Role: "reader", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, ComputedFields: []string{"label"},
					},
				}}
				inc := metadata.NewInconsistencies()

				got := reconcileMetadata(t.Context(), nil, inc, md, objects)

				invalidField := false
				for _, item := range inc.Snapshot() {
					if item.Kind == metadata.InconsistencyKindComputedField &&
						item.Name == "public.users.label" {
						invalidField = true
					}
				}

				if len(got.Tables[0].ComputedFields) != len(md.Tables[0].ComputedFields)-2 ||
					(len(got.Tables[0].SelectPermissions) == 0) != (position == "return") ||
					hasComputedInconsistency(
						inc,
						metadata.InconsistencyKindSelectPermission,
					) != (position == "return") ||
					invalidField != (position == "return") {
					t.Fatalf("non-base %s %s reconciliation: %+v, %+v", position, kind,
						got.Tables[0], inc.Snapshot())
				}
			})
		}
	}
}

func TestUnclassifiedTableArgumentNeverExposesField(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["posts_for_user"].Function
	fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
		Mode: "i", Type: introspection.PostgreSQLType{Schema: "public", Name: "custom", Kind: "d"},
	})
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{
		{Role: "reader", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, ComputedFields: []string{"posts_for_user"},
		}},
		{Role: "other", Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}}},
	}
	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[0].ComputedFields) != 1 || got.Tables[0].ComputedFields[0].Name != "label" ||
		len(
			got.Tables[0].SelectPermissions,
		) != 1 || got.Tables[0].SelectPermissions[0].Role != "other" ||
		!hasComputedInconsistency(inc, metadata.InconsistencyKindSelectPermission) {
		t.Fatalf(
			"deferred table signature or invalid table grant survived: %+v, %+v",
			got.Tables[0],
			inc.Snapshot(),
		)
	}
}
