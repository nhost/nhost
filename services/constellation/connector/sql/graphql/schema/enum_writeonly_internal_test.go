package schema

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/connector/sql/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

const enumWriteOnlyRole = "user"

func TestGenerateForRole_WriteOnlyEnumFKEmitsEnumType(t *testing.T) {
	t.Parallel()

	md := enumWriteOnlyMetadata()
	objects := enumWriteOnlyObjects()

	sch, err := GenerateForRole(objects, enumWriteOnlyRole, md, Capabilities{
		Kind: KindPostgres,
	})
	if err != nil {
		t.Fatalf("GenerateForRole returned error: %v", err)
	}

	assertSchemaValid(t, sch, enumWriteOnlyRole)
	assertEnumTypeExists(t, sch, "statuses_enum")
	assertInputExists(t, sch, "statuses_enum_comparison_exp")
	assertNullableInputFieldNamedType(t, sch, "tasks_insert_input", "status", "statuses_enum")
	assertNullableInputFieldNamedType(t, sch, "tasks_set_input", "status", "statuses_enum")
}

func TestGenerateForRole_PKEnumFKMutationArgsEmitEnumType(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		permissions func(*metadata.TableMetadata)
		assert      func(*testing.T, *graph.Schema)
	}{
		{
			name: "update pk_columns_input",
			permissions: func(tableMeta *metadata.TableMetadata) {
				tableMeta.UpdatePermissions = []metadata.UpdatePermission{
					{
						Role: enumWriteOnlyRole,
						Permission: metadata.UpdatePermissionConfig{
							Columns: []string{"note"},
						},
					},
				}
			},
			assert: func(t *testing.T, sch *graph.Schema) {
				t.Helper()

				assertInputFieldType(
					t, sch, "status_notes_pk_columns_input", "status", "statuses_enum",
				)
			},
		},
		{
			name: "delete by pk argument",
			permissions: func(tableMeta *metadata.TableMetadata) {
				tableMeta.DeletePermissions = []metadata.DeletePermission{
					{
						Role:       enumWriteOnlyRole,
						Permission: metadata.DeletePermissionConfig{},
					},
				}
			},
			assert: func(t *testing.T, sch *graph.Schema) {
				t.Helper()

				assertArgType(
					t,
					findObject(sch, "mutation_root"),
					"delete_status_notes_by_pk",
					"status",
					"statuses_enum",
				)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md := enumPKMetadata(tt.permissions)
			objects := enumPKObjects()

			sch, err := GenerateForRole(objects, enumWriteOnlyRole, md, Capabilities{
				Kind: KindPostgres,
			})
			if err != nil {
				t.Fatalf("GenerateForRole returned error: %v", err)
			}

			assertSchemaValid(t, sch, enumWriteOnlyRole)
			assertEnumTypeExists(t, sch, "statuses_enum")
			tt.assert(t, sch)
		})
	}
}

func enumWriteOnlyMetadata() *metadata.DatabaseMetadata {
	return &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table:  metadata.TableSource{Schema: "public", Name: "statuses"},
				IsEnum: true,
			},
			{
				Table: metadata.TableSource{Schema: "public", Name: "tasks"},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role: enumWriteOnlyRole,
						Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id"},
						},
					},
				},
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: enumWriteOnlyRole,
						Permission: metadata.InsertPermissionConfig{
							Columns: []string{"status"},
						},
					},
				},
				UpdatePermissions: []metadata.UpdatePermission{
					{
						Role: enumWriteOnlyRole,
						Permission: metadata.UpdatePermissionConfig{
							Columns: []string{"status"},
						},
					},
				},
			},
		},
	}
}

func enumPKMetadata(configure func(*metadata.TableMetadata)) *metadata.DatabaseMetadata {
	statusNotes := metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "public", Name: "status_notes"},
		SelectPermissions: []metadata.SelectPermission{
			{
				Role: enumWriteOnlyRole,
				Permission: metadata.SelectPermissionConfig{
					Columns: []string{"note"},
				},
			},
		},
	}
	configure(&statusNotes)

	return &metadata.DatabaseMetadata{
		Tables: []metadata.TableMetadata{
			{
				Table:  metadata.TableSource{Schema: "public", Name: "statuses"},
				IsEnum: true,
			},
			statusNotes,
		},
	}
}

func enumWriteOnlyObjects() *introspection.Objects {
	objects := introspection.NewObjects()
	objects.EnumValues["public.statuses"] = []introspection.EnumValue{
		{Value: "open"},
		{Value: "closed"},
	}
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"statuses": enumTable("statuses"),
			"tasks": {
				Schema:       "public",
				Name:         "tasks",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"id"},
				Columns: []introspection.Column{
					{Name: "id", Type: "uuid"},
					{Name: "status", Type: "text"},
				},
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "status",
						ForeignSchema:     "public",
						ForeignTable:      "statuses",
						ForeignColumnName: "value",
					},
				},
			},
		},
	}

	return objects
}

func enumPKObjects() *introspection.Objects {
	objects := introspection.NewObjects()
	objects.EnumValues["public.statuses"] = []introspection.EnumValue{
		{Value: "open"},
		{Value: "closed"},
	}
	objects.Schemas["public"] = &introspection.Schema{
		Tables: map[string]*introspection.Table{
			"statuses": enumTable("statuses"),
			"status_notes": {
				Schema:       "public",
				Name:         "status_notes",
				IsInsertable: true,
				IsUpdatable:  true,
				PrimaryKeys:  []string{"status"},
				Columns: []introspection.Column{
					{Name: "status", Type: "text"},
					{Name: "note", Type: "text"},
				},
				ForeignKeys: []introspection.ForeignKey{
					{
						ColumnName:        "status",
						ForeignSchema:     "public",
						ForeignTable:      "statuses",
						ForeignColumnName: "value",
					},
				},
			},
		},
	}

	return objects
}

func enumTable(name string) *introspection.Table {
	return &introspection.Table{
		Schema:       "public",
		Name:         name,
		IsInsertable: true,
		IsUpdatable:  true,
		PrimaryKeys:  []string{"value"},
		Columns: []introspection.Column{
			{Name: "value", Type: "text"},
		},
	}
}

func assertSchemaValid(t *testing.T, sch *graph.Schema, role string) {
	t.Helper()

	if _, _, err := schemamerge.BuildValidatedSchema(sch, role); err != nil {
		t.Fatalf("schema did not validate: %v", err)
	}
}

func assertEnumTypeExists(t *testing.T, sch *graph.Schema, enumName string) {
	t.Helper()

	for _, enumType := range sch.Enums {
		if enumType.Name == enumName {
			return
		}
	}

	t.Fatalf("schema has no enum type %q", enumName)
}

func assertInputExists(t *testing.T, sch *graph.Schema, inputName string) {
	t.Helper()

	for _, inputType := range sch.Inputs {
		if inputType.Name == inputName {
			return
		}
	}

	t.Fatalf("schema has no input type %q", inputName)
}

func assertNullableInputFieldNamedType(
	t *testing.T,
	sch *graph.Schema,
	inputName string,
	fieldName string,
	wantNamed string,
) {
	t.Helper()

	for _, inputType := range sch.Inputs {
		if inputType.Name != inputName {
			continue
		}

		for _, field := range inputType.Fields {
			if field.Name != fieldName {
				continue
			}

			if field.Type == nil || field.Type.Elem != nil || field.Type.NonNull ||
				field.Type.NamedType != wantNamed {
				t.Fatalf(
					"%s.%s: got %s, want %s",
					inputName, fieldName, formatType(field.Type), wantNamed,
				)
			}

			return
		}

		t.Fatalf("%s has no field %q", inputName, fieldName)
	}

	t.Fatalf("schema has no input type %q", inputName)
}
