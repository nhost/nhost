package metadata

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
)

func TestMarshalunmarshalTOML_Roundtrip(t *testing.T) {
	t.Parallel()

	original := &Metadata{
		Databases: []DatabaseMetadata{
			{
				Name: "default",
				Kind: "postgres",
				Configuration: DatabaseConfiguration{
					ConnectionInfo: DatabaseConnectionInfo{
						DatabaseURL: "{{NHOST_GRAPHQL_DATABASE_URL}}",
					},
				},
				Tables: []TableMetadata{
					{
						Table:  TableSource{Name: "users", Schema: "auth"},
						IsEnum: false,
						Configuration: TableConfiguration{
							CustomName: "users",
							ColumnConfig: map[string]ColumnConfig{
								"display_name": {CustomName: "displayName"},
							},
							CustomRootFields: CustomRootFields{
								Select:     "users",
								SelectByPk: "user",
								Insert:     "insertUsers",
								InsertOne:  "insertUser",
								Delete:     "deleteUsers",
								DeleteByPk: "deleteUser",
								Update:     "updateUsers",
								UpdateByPk: "updateUser",
							},
						},
						ObjectRelationships: []ObjectRelationship{
							{
								Name: "role",
								Using: RelationshipUsing{
									ForeignKeyColumn: "default_role",
								},
							},
						},
						ArrayRelationships: []ArrayRelationship{
							{
								Name: "posts",
								Using: RelationshipUsing{
									ForeignKeyConstraint: &ForeignKeyConstraint{
										Column: "author_id",
										Table:  TableSource{Name: "posts", Schema: "public"},
									},
								},
							},
						},
						SelectPermissions: []SelectPermission{
							{
								Role: "user",
								Permission: SelectPermissionConfig{
									Columns: []string{"id", "email"},
									Filter: map[string]any{
										"id": map[string]any{"_eq": "X-Hasura-User-Id"},
									},
									AllowAggregations: true,
								},
							},
						},
						InsertPermissions: []InsertPermission{
							{
								Role: "user",
								Permission: InsertPermissionConfig{
									Columns: []string{"display_name"},
									Check: map[string]any{
										"id": map[string]any{"_eq": "X-Hasura-User-Id"},
									},
								},
							},
						},
						UpdatePermissions: []UpdatePermission{
							{
								Role: "user",
								Permission: UpdatePermissionConfig{
									Columns: []string{"display_name"},
									Filter: map[string]any{
										"id": map[string]any{"_eq": "X-Hasura-User-Id"},
									},
								},
							},
						},
						DeletePermissions: []DeletePermission{
							{
								Role: "user",
								Permission: DeletePermissionConfig{
									Filter: map[string]any{
										"id": map[string]any{"_eq": "X-Hasura-User-Id"},
									},
								},
							},
						},
					},
				},
				Functions: []FunctionMetadata{
					{
						Function: FunctionSource{Name: "search_users", Schema: "public"},
						Configuration: FunctionConfiguration{
							ExposedAs:       "query",
							SessionArgument: "hasura_session",
						},
						Permissions: []FunctionPermission{
							{Role: "user"},
						},
					},
				},
			},
		},
		RemoteSchemas: []RemoteSchemaMetadata{
			{
				Name:    "my-remote",
				Comment: "a remote schema",
				Definition: RemoteSchemaDefinition{
					URL:            "{{REMOTE_SCHEMA_URL}}",
					TimeoutSeconds: 30,
					Headers: []RemoteSchemaHeader{
						{Name: "x-api-key", Value: "{{API_KEY}}"},
					},
					ForwardClientHeaders: true,
				},
				Permissions: []RemoteSchemaPermission{
					{
						Role: "user",
						Definition: RemoteSchemaPermissionDef{
							Schema: "type Query { hello: String }",
						},
					},
				},
			},
		},
	}

	data, err := MarshalTOML(original)
	if err != nil {
		t.Fatalf("MarshalTOML: %v", err)
	}

	got, err := unmarshalTOML(data)
	if err != nil {
		t.Fatalf("unmarshalTOML: %v", err)
	}

	if diff := cmp.Diff(original, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("roundtrip mismatch (-original +got):\n%s", diff)
	}
}

func TestMarshalunmarshalTOML_Empty(t *testing.T) {
	t.Parallel()

	original := &Metadata{}

	data, err := MarshalTOML(original)
	if err != nil {
		t.Fatalf("MarshalTOML: %v", err)
	}

	got, err := unmarshalTOML(data)
	if err != nil {
		t.Fatalf("unmarshalTOML: %v", err)
	}

	if diff := cmp.Diff(original, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("roundtrip mismatch (-original +got):\n%s", diff)
	}
}

func TestStripEmptyTableHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "no headers",
			input: "key = \"value\"\n",
			want:  "key = \"value\"\n",
		},
		{
			name:  "header with content kept",
			input: "[section]\nkey = \"value\"\n",
			want:  "[section]\nkey = \"value\"\n",
		},
		{
			name:  "empty header removed",
			input: "[parent]\n[parent.child]\nkey = \"value\"\n",
			want:  "[parent.child]\nkey = \"value\"\n",
		},
		{
			name:  "array headers always kept",
			input: "[[items]]\nname = \"a\"\n",
			want:  "[[items]]\nname = \"a\"\n",
		},
		{
			name:  "empty header before EOF removed",
			input: "[empty]\n",
			want:  "",
		},
		{
			name:  "blank lines between header and next header",
			input: "[parent]\n\n[parent.child]\nkey = \"value\"\n",
			want:  "\n[parent.child]\nkey = \"value\"\n",
		},
		{
			name:  "non-empty header among empties",
			input: "[a]\n[a.b]\nval = 1\n[a.c]\n[a.c.d]\nval = 2\n",
			want:  "[a.b]\nval = 1\n[a.c.d]\nval = 2\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := string(stripEmptyTableHeaders([]byte(tt.input)))
			if got != tt.want {
				t.Errorf("stripEmptyTableHeaders:\n got: %q\nwant: %q", got, tt.want)
			}
		})
	}
}
