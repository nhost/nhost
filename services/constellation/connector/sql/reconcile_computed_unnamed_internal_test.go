//nolint:revive,nolintlint // package name "sql" shadows database/sql; this package never imports it.
package sql

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/graphql/queries/dialect"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// A bad catalog name must not invalidate the entire admin or granted role schema.
//
//nolint:gocognit,cyclop // Matrix checks field, permission, and role schema independently for every name shape.
func TestComputedArgumentNamesReconciled(t *testing.T) {
	t.Parallel()

	userArg := func(name string) introspection.ComputedFunctionArgument {
		return introspection.ComputedFunctionArgument{
			Name: name, Mode: "i",
			Type: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "int4", Kind: "b"},
		}
	}

	tests := []struct {
		name       string
		args       []introspection.ComputedFunctionArgument
		session    string
		reason     string
		inputNames []string
	}{
		{
			"reserved",
			[]introspection.ComputedFunctionArgument{userArg("__x")},
			"",
			"computed function argument name is reserved",
			nil,
		},
		{
			"dollar",
			[]introspection.ComputedFunctionArgument{userArg("a$b")},
			"",
			"computed function argument name is not a GraphQL identifier",
			nil,
		},
		{
			"quoted",
			[]introspection.ComputedFunctionArgument{userArg("my-arg")},
			"",
			"computed function argument name is not a GraphQL identifier",
			nil,
		},
		{
			"non-ASCII",
			[]introspection.ComputedFunctionArgument{userArg("ñame")},
			"",
			"computed function argument name is not a GraphQL identifier",
			nil,
		},
		{
			"duplicate",
			[]introspection.ComputedFunctionArgument{userArg("arg_1"), userArg("")},
			"",
			"duplicate computed function argument name",
			nil,
		},
		{
			"reverse duplicate",
			[]introspection.ComputedFunctionArgument{userArg(""), userArg("arg_1")},
			"",
			"duplicate computed function argument name",
			nil,
		},
		{
			"valid named and unnamed",
			[]introspection.ComputedFunctionArgument{userArg("ok_name"), userArg("")},
			"",
			"",
			[]string{"ok_name", "arg_1"},
		},
		{
			"hidden session",
			[]introspection.ComputedFunctionArgument{
				{ //nolint:exhaustruct // Only the input mode, catalog name and JSONB type affect session validation.
					Name: "__session",
					Mode: "i",
					Type: introspection.PostgreSQLType{
						Schema: "pg_catalog",
						Name:   "jsonb",
						Kind:   "b",
					},
				},
				userArg("ok_name"),
				userArg(""),
			},
			"__session",
			"",
			[]string{"ok_name", "arg_1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, objects := computedReconcileFixture()
			fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"].Function
			fn.Arguments[0].Name = "__hidden_row"
			fn.Arguments = append(fn.Arguments, tt.args...)
			md.Tables[0].ComputedFields[0].Definition.SessionArgument = tt.session
			md.Tables[0].SelectPermissions = []metadata.SelectPermission{
				{Role: "reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id"}, ComputedFields: []string{"label"},
				}},
				{
					Role:       "plain",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
			}
			md.Tables[1].SelectPermissions = []metadata.SelectPermission{
				{
					Role:       "reader",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
				{
					Role:       "plain",
					Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
				},
			}
			inc := metadata.NewInconsistencies()
			effective := reconcileMetadata(t.Context(), nil, inc, md, objects)

			kept := false
			for _, field := range effective.Tables[0].ComputedFields {
				kept = kept || field.Name == "label"
			}

			if kept != (tt.reason == "") {
				t.Fatalf("field availability: %t, inconsistencies: %+v", kept, inc.Snapshot())
			}

			var fieldCount, permissionCount int
			for _, item := range inc.Snapshot() {
				switch item.Kind {
				case metadata.InconsistencyKindComputedField:
					if item.Name == "public.users.label" && item.Reason == tt.reason {
						fieldCount++
					}
				case metadata.InconsistencyKindSelectPermission:
					if item.Name == "public.users.reader" {
						permissionCount++
					}
				case metadata.InconsistencyKindRole:
					t.Fatalf("role loss: %+v", item)
				}
			}

			if fieldCount != boolInt(tt.reason != "") ||
				permissionCount != boolInt(tt.reason != "") ||
				len(effective.Tables[0].SelectPermissions) != 1+boolInt(tt.reason == "") ||
				len(effective.Tables[1].SelectPermissions) != 2 {
				t.Fatalf(
					"field/grant inconsistency or unrelated grant loss: %+v, %+v",
					inc.Snapshot(),
					effective.Tables,
				)
			}

			schemas, err := reloadSchema(objects, effective, dialect.NewPostgresDialect())
			if err != nil {
				t.Fatal(err)
			}

			for _, role := range []string{"admin", "reader", "plain"} {
				if _, _, err := schemamerge.BuildValidatedSchema(schemas[role], role); err != nil {
					t.Fatalf("%s role lost: %v", role, err)
				}

				defs := schemas[role].ToAST().Definitions
				if defs.ForName("posts") == nil {
					t.Fatalf("%s unrelated table lost", role)
				}

				args := defs.ForName("label_users_args")
				if tt.reason == "" && role != "plain" {
					if args == nil || len(args.Fields) != len(tt.inputNames) {
						t.Fatalf("%s missing computed input: %+v", role, args)
					}

					for i, name := range tt.inputNames {
						if args.Fields[i].Name != name {
							t.Fatalf(
								"%s argument %d: got %s, want %s",
								role,
								i,
								args.Fields[i].Name,
								name,
							)
						}
					}
				} else if args != nil {
					t.Fatalf("%s exposed invalid or ungranted input", role)
				}
			}
		})
	}
}

func TestUnnamedComputedUserArgumentReconciled(t *testing.T) {
	t.Parallel()

	md, objects := computedReconcileFixture()
	fn := objects.ComputedFunctions[introspection.ComputedTable{Schema: "public", Name: "users"}]["label"].Function
	fn.Arguments = append(fn.Arguments, introspection.ComputedFunctionArgument{
		Mode: "i",
		Type: introspection.PostgreSQLType{Schema: "pg_catalog", Name: "integer", Kind: "b"},
	})
	md.Tables[0].SelectPermissions = []metadata.SelectPermission{{
		Role: "reader", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, ComputedFields: []string{"label"},
		},
	}}

	inc := metadata.NewInconsistencies()

	got := reconcileMetadata(t.Context(), nil, inc, md, objects)
	if len(got.Tables[0].ComputedFields) != 2 || got.Tables[0].ComputedFields[0].Name != "label" {
		t.Fatalf("unnamed argument was dropped: %+v", got.Tables[0].ComputedFields)
	}

	if len(got.Tables[0].SelectPermissions) != 1 ||
		got.Tables[0].SelectPermissions[0].Role != "reader" {
		t.Fatalf(
			"unnamed signature revoked grant: %+v",
			got.Tables[0].SelectPermissions,
		)
	}
}
