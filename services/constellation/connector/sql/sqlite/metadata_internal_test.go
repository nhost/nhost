package sqlite

import (
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestFlattenExistsSchemas(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   any
		want any
	}{
		{
			name: "nil input is a no-op",
			in:   nil,
			want: nil,
		},
		{
			name: "filter with no _exists clause is pass-through",
			in: map[string]any{
				"id":      map[string]any{"_eq": "X-Hasura-User-Id"},
				"deleted": map[string]any{"_eq": false},
			},
			want: map[string]any{
				"id":      map[string]any{"_eq": "X-Hasura-User-Id"},
				"deleted": map[string]any{"_eq": false},
			},
		},
		{
			name: "single-level _exists with qualified table",
			in: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "auth",
					},
					"_where": map[string]any{
						"id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
				},
			},
			want: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "",
					},
					"_where": map[string]any{
						"id": map[string]any{"_eq": "X-Hasura-User-Id"},
					},
				},
			},
		},
		{
			name: "_exists with already-empty schema is unchanged",
			in: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "",
					},
				},
			},
			want: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "",
					},
				},
			},
		},
		{
			name: "nested _exists inside _where is also flattened",
			in: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "auth",
					},
					"_where": map[string]any{
						"_exists": map[string]any{
							"_table": map[string]any{
								"name":   "user_roles",
								"schema": "auth",
							},
						},
					},
				},
			},
			want: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "",
					},
					"_where": map[string]any{
						"_exists": map[string]any{
							"_table": map[string]any{
								"name":   "user_roles",
								"schema": "",
							},
						},
					},
				},
			},
		},
		{
			name: "_exists wrapped in _and / _or arrays",
			in: map[string]any{
				"_and": []any{
					map[string]any{
						"_exists": map[string]any{
							"_table": map[string]any{
								"name":   "users",
								"schema": "auth",
							},
						},
					},
					map[string]any{
						"_or": []any{
							map[string]any{
								"_exists": map[string]any{
									"_table": map[string]any{
										"name":   "files",
										"schema": "storage",
									},
								},
							},
							map[string]any{
								"id": map[string]any{"_eq": "X-Hasura-User-Id"},
							},
						},
					},
				},
			},
			want: map[string]any{
				"_and": []any{
					map[string]any{
						"_exists": map[string]any{
							"_table": map[string]any{
								"name":   "users",
								"schema": "",
							},
						},
					},
					map[string]any{
						"_or": []any{
							map[string]any{
								"_exists": map[string]any{
									"_table": map[string]any{
										"name":   "files",
										"schema": "",
									},
								},
							},
							map[string]any{
								"id": map[string]any{"_eq": "X-Hasura-User-Id"},
							},
						},
					},
				},
			},
		},
		{
			name: "_table without schema key gets schema set to empty string",
			in: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name": "users",
					},
				},
			},
			want: map[string]any{
				"_exists": map[string]any{
					"_table": map[string]any{
						"name":   "users",
						"schema": "",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			flattenExistsSchemas(tt.in)

			if diff := cmp.Diff(tt.want, tt.in); diff != "" {
				t.Errorf("flattenExistsSchemas mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFlattenRelationshipUsing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   metadata.RelationshipUsing
		want metadata.RelationshipUsing
	}{
		{
			name: "no config: nothing to flatten",
			in:   metadata.RelationshipUsing{ForeignKeyColumns: []string{"user_id"}},
			want: metadata.RelationshipUsing{ForeignKeyColumns: []string{"user_id"}},
		},
		{
			name: "manual configuration with qualified remote_table",
			in: metadata.RelationshipUsing{
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Name: "users", Schema: "auth"},
					ColumnMapping: map[string]string{"user_id": "id"},
				},
			},
			want: metadata.RelationshipUsing{
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Name: "users", Schema: ""},
					ColumnMapping: map[string]string{"user_id": "id"},
				},
			},
		},
		{
			name: "manual configuration with unqualified remote_table is unchanged",
			in: metadata.RelationshipUsing{
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Name: "users", Schema: ""},
					ColumnMapping: map[string]string{"user_id": "id"},
				},
			},
			want: metadata.RelationshipUsing{
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Name: "users", Schema: ""},
					ColumnMapping: map[string]string{"user_id": "id"},
				},
			},
		},
		{
			name: "foreign key constraint with qualified table",
			in: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Name: "users", Schema: "auth"},
				},
			},
			want: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Name: "users", Schema: ""},
				},
			},
		},
		{
			name: "foreign key constraint with unqualified table is unchanged",
			in: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Name: "users", Schema: ""},
				},
			},
			want: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Name: "users", Schema: ""},
				},
			},
		},
		{
			name: "both manual and foreign key configurations are flattened",
			in: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Name: "users", Schema: "auth"},
				},
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Name: "files", Schema: "storage"},
					ColumnMapping: map[string]string{"file_id": "id"},
				},
			},
			want: metadata.RelationshipUsing{
				ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
					Columns: []string{"user_id"},
					Table:   metadata.TableSource{Name: "users", Schema: ""},
				},
				ManualConfiguration: &metadata.ManualConfiguration{
					RemoteTable:   metadata.TableSource{Name: "files", Schema: ""},
					ColumnMapping: map[string]string{"file_id": "id"},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := tt.in
			flattenRelationshipUsing(&got)

			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("flattenRelationshipUsing mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
