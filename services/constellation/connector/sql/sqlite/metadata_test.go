package sqlite_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// makeRelationshipDB builds a database with one table whose object/array/remote
// relationships all reference tables in the given schema. Used so the same
// structure can be re-emitted with schema="" to form the expected output.
func makeRelationshipDB(schema string) metadata.DatabaseMetadata {
	return metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Name: "users", Schema: schema},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "profile",
						Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								RemoteTable: metadata.TableSource{
									Name:   "profiles",
									Schema: schema,
								},
								ColumnMapping: map[string]string{"id": "user_id"},
							},
						},
					},
				},
				ArrayRelationships: []metadata.ArrayRelationship{
					{
						Name: "files",
						Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"user_id"},
								Table: metadata.TableSource{
									Name:   "files",
									Schema: schema,
								},
							},
						},
					},
				},
				RemoteRelationships: []metadata.RemoteRelationship{
					{
						Name: "remote_user",
						Definition: metadata.RemoteRelationshipDef{
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping: map[string]string{"id": "user_id"},
								Source:       "other",
								Table: metadata.TableSource{
									Name:   "remote_users",
									Schema: schema,
								},
							},
						},
					},
				},
			},
		},
	}
}

// makePermissionsDB builds a database whose table carries all four permission
// kinds, each with an _exists filter referencing tables in `schema`.
func makePermissionsDB(schema string) metadata.DatabaseMetadata {
	existsRef := func(name string) map[string]any {
		return map[string]any{
			"_exists": map[string]any{
				"_table": map[string]any{
					"name":   name,
					"schema": schema,
				},
			},
		}
	}

	return metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Name: "files", Schema: schema},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role: "user",
						Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id", "name"},
							Filter:  existsRef("users"),
						},
					},
				},
				InsertPermissions: []metadata.InsertPermission{
					{
						Role: "user",
						Permission: metadata.InsertPermissionConfig{
							Check: existsRef("users"),
							Set:   existsRef("audit"),
						},
					},
				},
				UpdatePermissions: []metadata.UpdatePermission{
					{
						Role: "user",
						Permission: metadata.UpdatePermissionConfig{
							Filter: existsRef("users"),
							Check:  existsRef("buckets"),
							Set:    existsRef("audit"),
						},
					},
				},
				DeletePermissions: []metadata.DeletePermission{
					{
						Role: "user",
						Permission: metadata.DeletePermissionConfig{
							Filter: existsRef("users"),
						},
					},
				},
			},
		},
	}
}

// makeEndToEndDB builds a database covering tables, relationships, permissions
// with boolean-wrapped _exists clauses, and functions — all parameterised by
// schema for input/output reuse.
func makeEndToEndDB(schema string) metadata.DatabaseMetadata {
	return metadata.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Name: "users", Schema: schema},
				ObjectRelationships: []metadata.ObjectRelationship{
					{
						Name: "profile",
						Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Columns: []string{"profile_id"},
								Table: metadata.TableSource{
									Name:   "profiles",
									Schema: schema,
								},
							},
						},
					},
				},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role: "user",
						Permission: metadata.SelectPermissionConfig{
							Filter: map[string]any{
								"_and": []any{
									map[string]any{
										"_exists": map[string]any{
											"_table": map[string]any{
												"name":   "user_roles",
												"schema": schema,
											},
										},
									},
									map[string]any{
										"id": map[string]any{
											"_eq": "X-Hasura-User-Id",
										},
									},
								},
							},
						},
					},
				},
			},
			{
				Table: metadata.TableSource{Name: "files", Schema: schema},
			},
		},
		Functions: []metadata.FunctionMetadata{
			{
				Function: metadata.FunctionSource{
					Name:   "search",
					Schema: schema,
				},
			},
		},
	}
}

func TestFlattenMetadata(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   metadata.DatabaseMetadata
		want metadata.DatabaseMetadata
	}{
		{
			name: "empty database metadata",
			in:   metadata.DatabaseMetadata{Name: "default", Kind: "postgres"},
			want: metadata.DatabaseMetadata{Name: "default", Kind: "postgres"},
		},
		{
			name: "table schema is flattened",
			in: metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Tables: []metadata.TableMetadata{
					{Table: metadata.TableSource{Name: "users", Schema: "auth"}},
				},
			},
			want: metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Tables: []metadata.TableMetadata{
					{Table: metadata.TableSource{Name: "users", Schema: ""}},
				},
			},
		},
		{
			name: "function schema is flattened",
			in: metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Functions: []metadata.FunctionMetadata{
					{Function: metadata.FunctionSource{Name: "search_users", Schema: "public"}},
					{Function: metadata.FunctionSource{Name: "audit", Schema: "internal"}},
				},
			},
			want: metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Functions: []metadata.FunctionMetadata{
					{Function: metadata.FunctionSource{Name: "search_users", Schema: ""}},
					{Function: metadata.FunctionSource{Name: "audit", Schema: ""}},
				},
			},
		},
		{
			name: "object and array relationships and remote to_source are flattened",
			in:   makeRelationshipDB("auth"),
			want: makeRelationshipDB(""),
		},
		{
			name: "remote relationship without to_source is untouched",
			in: metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Tables: []metadata.TableMetadata{
					{
						Table: metadata.TableSource{Name: "users", Schema: "auth"},
						RemoteRelationships: []metadata.RemoteRelationship{
							{
								Name: "remote_schema_only",
								Definition: metadata.RemoteRelationshipDef{
									ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
										RemoteSchema: "remote_gql",
										LHSFields:    []string{"id"},
									},
								},
							},
						},
					},
				},
			},
			want: metadata.DatabaseMetadata{
				Name: "default",
				Kind: "postgres",
				Tables: []metadata.TableMetadata{
					{
						Table: metadata.TableSource{Name: "users", Schema: ""},
						RemoteRelationships: []metadata.RemoteRelationship{
							{
								Name: "remote_schema_only",
								Definition: metadata.RemoteRelationshipDef{
									ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
										RemoteSchema: "remote_gql",
										LHSFields:    []string{"id"},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "all permission filters with _exists are flattened",
			in:   makePermissionsDB("auth"),
			want: makePermissionsDB(""),
		},
		{
			name: "end-to-end: tables, relationships, permissions, and functions together",
			in:   makeEndToEndDB("auth"),
			want: makeEndToEndDB(""),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.in
			sqlite.FlattenMetadata(&got)

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("FlattenMetadata mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
