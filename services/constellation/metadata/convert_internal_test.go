package metadata

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

func TestConvertDatabaseURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   hasura.DatabaseURL
		want EnvString
	}{
		{
			name: "from env",
			in:   hasura.DatabaseURL{FromEnv: "PG_URL"},
			want: "{{PG_URL}}",
		},
		{
			name: "direct url",
			in:   hasura.DatabaseURL{URL: "postgresql://localhost/mydb"},
			want: "postgresql://localhost/mydb",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := convertDatabaseURL(tt.in)
			if got != tt.want {
				t.Errorf("convertDatabaseURL = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestConvertEnvValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   hasura.EnvValue
		want EnvString
	}{
		{
			name: "from env",
			in:   hasura.EnvValue{FromEnv: "API_KEY"},
			want: "{{API_KEY}}",
		},
		{
			name: "direct value",
			in:   hasura.EnvValue{Value: "secret123"},
			want: "secret123",
		},
		{
			name: "empty",
			in:   hasura.EnvValue{},
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := convertEnvValue(tt.in)
			if got != tt.want {
				t.Errorf("convertEnvValue = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestConvertDatabase(t *testing.T) {
	t.Parallel()

	h := hasura.DatabaseMetadata{
		Name: "default",
		Kind: "postgres",
		Configuration: hasura.DatabaseConfiguration{
			ConnectionInfo: hasura.DatabaseConnectionInfo{
				DatabaseURL: hasura.DatabaseURL{FromEnv: "DB_URL"},
			},
		},
		Customization: hasura.DatabaseSourceCustomization{
			RootFields: hasura.RootFieldsCustomization{
				Namespace: "app",
				Prefix:    "pg_",
				Suffix:    "_v1",
			},
			TypeNames: hasura.TypeNamesCustomization{
				Prefix:  "App_",
				Suffix:  "_T",
				Mapping: map[string]string{"users": "ignored"},
			},
		},
		Tables: []hasura.TableMetadata{
			{
				Table: hasura.TableSource{Name: "users", Schema: "public"},
			},
		},
		Functions: []hasura.FunctionMetadata{
			{
				Function: hasura.FunctionSource{Name: "search", Schema: "public"},
			},
		},
	}

	got := convertDatabase(h)

	if got.Name != "default" {
		t.Errorf("Name = %q, want %q", got.Name, "default")
	}

	if got.Kind != "postgres" {
		t.Errorf("Kind = %q, want %q", got.Kind, "postgres")
	}

	if got.Configuration.ConnectionInfo.DatabaseURL != "{{DB_URL}}" {
		t.Errorf("DatabaseURL = %q, want %q",
			got.Configuration.ConnectionInfo.DatabaseURL, "{{DB_URL}}")
	}

	// A database source maps root_fields{namespace,prefix,suffix} +
	// type_names{prefix,suffix}; databases never carry a type-name mapping or
	// per-field renames, so those normalize to nil regardless of any Hasura
	// type_names.mapping present on the source.
	wantCustomization := Customization{
		RootFieldsNamespace: "app",
		RootFieldsPrefix:    "pg_",
		RootFieldsSuffix:    "_v1",
		TypeNamesPrefix:     "App_",
		TypeNamesSuffix:     "_T",
		TypeNamesMapping:    nil,
		FieldNames:          nil,
	}
	if diff := cmp.Diff(wantCustomization, got.Customization); diff != "" {
		t.Errorf("Customization mismatch (-want +got):\n%s", diff)
	}

	if len(got.Tables) != 1 || got.Tables[0].Table.Name != "users" {
		t.Errorf("Tables = %+v, want 1 table named 'users'", got.Tables)
	}

	if len(got.Functions) != 1 || got.Functions[0].Function.Name != "search" {
		t.Errorf("Functions = %+v, want 1 function named 'search'", got.Functions)
	}
}

func TestConvertTable(t *testing.T) {
	t.Parallel()

	h := hasura.TableMetadata{
		Table:  hasura.TableSource{Name: "posts", Schema: "public"},
		IsEnum: true,
		Configuration: hasura.TableConfiguration{
			CustomName: "blogPosts",
			ColumnConfig: map[string]hasura.ColumnConfig{
				"created_at": {CustomName: "createdAt"},
			},
			CustomRootFields: hasura.CustomRootFields{
				Select: "blogPosts",
				Insert: "insertBlogPosts",
			},
		},
		ObjectRelationships: []hasura.ObjectRelationship{
			{
				Name: "author",
				Using: hasura.RelationshipUsing{
					ForeignKeyColumn: "author_id",
				},
			},
		},
		ArrayRelationships: []hasura.ArrayRelationship{
			{
				Name: "comments",
				Using: hasura.RelationshipUsing{
					ForeignKeyConstraint: &hasura.ForeignKeyConstraint{
						Column: "post_id",
						Table:  hasura.TableSource{Name: "comments", Schema: "public"},
					},
				},
			},
		},
		SelectPermissions: []hasura.SelectPermission{
			{
				Role: "user",
				Permission: hasura.SelectPermissionConfig{
					Columns:           []string{"id", "title"},
					AllowAggregations: true,
				},
			},
		},
		InsertPermissions: []hasura.InsertPermission{
			{
				Role: "user",
				Permission: hasura.InsertPermissionConfig{
					Columns: []string{"title", "body"},
					Check:   map[string]any{"author_id": map[string]any{"_eq": "X-Hasura-User-Id"}},
				},
			},
		},
		UpdatePermissions: []hasura.UpdatePermission{
			{
				Role: "user",
				Permission: hasura.UpdatePermissionConfig{
					Columns: []string{"title"},
					Filter:  map[string]any{"author_id": map[string]any{"_eq": "X-Hasura-User-Id"}},
				},
			},
		},
		DeletePermissions: []hasura.DeletePermission{
			{
				Role: "user",
				Permission: hasura.DeletePermissionConfig{
					Filter: map[string]any{"author_id": map[string]any{"_eq": "X-Hasura-User-Id"}},
				},
			},
		},
	}

	got := convertTable(h)

	want := TableMetadata{
		Table:  TableSource{Name: "posts", Schema: "public"},
		IsEnum: true,
		Configuration: TableConfiguration{
			CustomName: "blogPosts",
			ColumnConfig: map[string]ColumnConfig{
				"created_at": {CustomName: "createdAt"},
			},
			CustomRootFields: CustomRootFields{
				Select: "blogPosts",
				Insert: "insertBlogPosts",
			},
		},
		ObjectRelationships: []ObjectRelationship{
			{
				Name: "author",
				Using: RelationshipUsing{
					ForeignKeyColumn: "author_id",
				},
			},
		},
		ArrayRelationships: []ArrayRelationship{
			{
				Name: "comments",
				Using: RelationshipUsing{
					ForeignKeyConstraint: &ForeignKeyConstraint{
						Column: "post_id",
						Table:  TableSource{Name: "comments", Schema: "public"},
					},
				},
			},
		},
		SelectPermissions: []SelectPermission{
			{
				Role: "user",
				Permission: SelectPermissionConfig{
					Columns:           []string{"id", "title"},
					AllowAggregations: true,
				},
			},
		},
		InsertPermissions: []InsertPermission{
			{
				Role: "user",
				Permission: InsertPermissionConfig{
					Columns: []string{"title", "body"},
					Check:   map[string]any{"author_id": map[string]any{"_eq": "X-Hasura-User-Id"}},
				},
			},
		},
		UpdatePermissions: []UpdatePermission{
			{
				Role: "user",
				Permission: UpdatePermissionConfig{
					Columns: []string{"title"},
					Filter:  map[string]any{"author_id": map[string]any{"_eq": "X-Hasura-User-Id"}},
				},
			},
		},
		DeletePermissions: []DeletePermission{
			{
				Role: "user",
				Permission: DeletePermissionConfig{
					Filter: map[string]any{"author_id": map[string]any{"_eq": "X-Hasura-User-Id"}},
				},
			},
		},
	}

	if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("convertTable mismatch (-want +got):\n%s", diff)
	}
}

func TestApplyRemoteSchemaColumnRenames(t *testing.T) {
	t.Parallel()

	rename := tableColumnRenamer(map[string]ColumnConfig{
		"created_at": {CustomName: "createdAt"},
		"user_id":    {CustomName: "userId"},
	})

	tests := []struct {
		name string
		in   *RelationshipUsing
		want *RelationshipUsing
	}{
		{
			name: "nil using is a no-op",
			in:   nil,
			want: nil,
		},
		{
			name: "nil manual configuration is a no-op",
			in: &RelationshipUsing{
				ForeignKeyColumn:     "author_id",
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
			want: &RelationshipUsing{
				ForeignKeyColumn:     "author_id",
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
		},
		{
			name: "empty remote schema leaves column mapping untouched",
			in: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:     TableSource{Name: "comments", Schema: "public"},
					ColumnMapping:   map[string]string{"created_at": "post_id"},
					Source:          "default",
					RemoteSchema:    "",
					RemoteFieldPath: nil,
				},
			},
			want: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:     TableSource{Name: "comments", Schema: "public"},
					ColumnMapping:   map[string]string{"created_at": "post_id"},
					Source:          "default",
					RemoteSchema:    "",
					RemoteFieldPath: nil,
				},
			},
		},
		{
			name: "column mapping keys and values get renamed",
			in: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:     TableSource{},
					ColumnMapping:   map[string]string{"created_at": "user_id"},
					Source:          "",
					RemoteSchema:    "auth",
					RemoteFieldPath: nil,
				},
			},
			want: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:     TableSource{},
					ColumnMapping:   map[string]string{"createdAt": "userId"},
					Source:          "",
					RemoteSchema:    "auth",
					RemoteFieldPath: nil,
				},
			},
		},
		{
			name: "$column argument is rewritten when column has a custom name",
			in: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:   TableSource{},
					ColumnMapping: nil,
					Source:        "",
					RemoteSchema:  "auth",
					RemoteFieldPath: []RemoteFieldPathEntry{
						{
							FieldName: "getUser",
							Arguments: map[string]string{
								"created": "$created_at",
								"literal": "not-a-ref",
							},
						},
					},
				},
			},
			want: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:   TableSource{},
					ColumnMapping: nil,
					Source:        "",
					RemoteSchema:  "auth",
					RemoteFieldPath: []RemoteFieldPathEntry{
						{
							FieldName: "getUser",
							Arguments: map[string]string{
								"created": "$createdAt",
								"literal": "not-a-ref",
							},
						},
					},
				},
			},
		},
		{
			name: "$column argument is left alone when rename is a no-op",
			in: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:   TableSource{},
					ColumnMapping: nil,
					Source:        "",
					RemoteSchema:  "auth",
					RemoteFieldPath: []RemoteFieldPathEntry{
						{
							FieldName: "getUser",
							Arguments: map[string]string{
								"id": "$id",
							},
						},
					},
				},
			},
			want: &RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:   TableSource{},
					ColumnMapping: nil,
					Source:        "",
					RemoteSchema:  "auth",
					RemoteFieldPath: []RemoteFieldPathEntry{
						{
							FieldName: "getUser",
							Arguments: map[string]string{
								"id": "$id",
							},
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			applyRemoteSchemaColumnRenames(tt.in, rename)

			if diff := cmp.Diff(tt.want, tt.in, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("applyRemoteSchemaColumnRenames mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestConvertRelationshipUsing(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   hasura.RelationshipUsing
		want RelationshipUsing
	}{
		{
			name: "foreign key constraint branch",
			in: hasura.RelationshipUsing{
				ForeignKeyColumn: "",
				ForeignKeyConstraint: &hasura.ForeignKeyConstraint{
					Column: "post_id",
					Table:  hasura.TableSource{Name: "comments", Schema: "public"},
				},
				ManualConfiguration: nil,
			},
			want: RelationshipUsing{
				ForeignKeyColumn: "",
				ForeignKeyConstraint: &ForeignKeyConstraint{
					Column: "post_id",
					Table:  TableSource{Name: "comments", Schema: "public"},
				},
				ManualConfiguration: nil,
			},
		},
		{
			name: "manual configuration branch with column mapping",
			in: hasura.RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &hasura.ManualConfiguration{
					RemoteTable:   hasura.TableSource{Name: "orders", Schema: "public"},
					ColumnMapping: map[string]string{"id": "user_id"},
					Source:        "orders_db",
					RemoteSchema:  "",
					LHSFields:     nil,
					RemoteField:   nil,
				},
			},
			want: RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable:     TableSource{Name: "orders", Schema: "public"},
					ColumnMapping:   map[string]string{"id": "user_id"},
					Source:          "orders_db",
					RemoteSchema:    "",
					RemoteFieldPath: nil,
				},
			},
		},
		{
			name: "manual configuration branch with lhs fields seeds column mapping",
			in: hasura.RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &hasura.ManualConfiguration{
					RemoteTable:   hasura.TableSource{},
					ColumnMapping: nil,
					Source:        "",
					RemoteSchema:  "auth",
					LHSFields:     []string{"user_id", "tenant_id"},
					RemoteField: map[string]hasura.RemoteFieldCall{
						"getUser": {
							Arguments: map[string]string{"id": "$user_id"},
							Field:     nil,
						},
					},
				},
			},
			want: RelationshipUsing{
				ForeignKeyColumn:     "",
				ForeignKeyConstraint: nil,
				ManualConfiguration: &ManualConfiguration{
					RemoteTable: TableSource{},
					ColumnMapping: map[string]string{
						"user_id":   "user_id",
						"tenant_id": "tenant_id",
					},
					Source:       "",
					RemoteSchema: "auth",
					RemoteFieldPath: []RemoteFieldPathEntry{
						{
							FieldName: "getUser",
							Arguments: map[string]string{"id": "$user_id"},
						},
					},
				},
			},
		},
		{
			name: "no constraint or manual config keeps only foreign key column",
			in: hasura.RelationshipUsing{
				ForeignKeyColumn:     "author_id",
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
			want: RelationshipUsing{
				ForeignKeyColumn:     "author_id",
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := convertRelationshipUsing(tt.in)

			if diff := cmp.Diff(tt.want, got, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("convertRelationshipUsing mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestConvertRemoteRelationship(t *testing.T) {
	t.Parallel()

	t.Run("to_source", func(t *testing.T) {
		t.Parallel()

		h := hasura.RemoteRelationship{
			Name: "remote_orders",
			Definition: hasura.RemoteRelationshipDef{
				ToSource: &hasura.ToSourceRelationship{
					FieldMapping:     map[string]string{"id": "user_id"},
					RelationshipType: "array",
					Source:           "orders_db",
					Table:            hasura.TableSource{Name: "orders", Schema: "public"},
				},
			},
		}

		got := convertRemoteRelationship(h)

		want := RemoteRelationship{
			Name: "remote_orders",
			Definition: RemoteRelationshipDef{
				ToSource: &ToSourceRelationship{
					FieldMapping:     map[string]string{"id": "user_id"},
					RelationshipType: "array",
					Source:           "orders_db",
					Table:            TableSource{Name: "orders", Schema: "public"},
				},
			},
		}

		if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
			t.Errorf("convertRemoteRelationship (to_source) mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("to_remote_schema", func(t *testing.T) {
		t.Parallel()

		h := hasura.RemoteRelationship{
			Name: "remote_user",
			Definition: hasura.RemoteRelationshipDef{
				ToRemoteSchema: &hasura.ToRemoteSchemaRelationship{
					RemoteSchema: "auth_schema",
					LHSFields:    []string{"user_id"},
					RemoteField: map[string]hasura.RemoteFieldCall{
						"getUser": {
							Arguments: map[string]string{"id": "$user_id"},
						},
					},
				},
			},
		}

		got := convertRemoteRelationship(h)

		want := RemoteRelationship{
			Name: "remote_user",
			Definition: RemoteRelationshipDef{
				ToRemoteSchema: &ToRemoteSchemaRelationship{
					RemoteSchema: "auth_schema",
					LHSFields:    []string{"user_id"},
					RemoteField: map[string]RemoteFieldCall{
						"getUser": {
							Arguments: map[string]string{"id": "$user_id"},
						},
					},
				},
			},
		}

		if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
			t.Errorf(
				"convertRemoteRelationship (to_remote_schema) mismatch (-want +got):\n%s",
				diff,
			)
		}
	})

	t.Run("nil definitions", func(t *testing.T) {
		t.Parallel()

		h := hasura.RemoteRelationship{
			Name:       "empty_rel",
			Definition: hasura.RemoteRelationshipDef{},
		}

		got := convertRemoteRelationship(h)

		if got.Definition.ToSource != nil {
			t.Error("expected ToSource to be nil")
		}

		if got.Definition.ToRemoteSchema != nil {
			t.Error("expected ToRemoteSchema to be nil")
		}
	})
}

func TestConvertRemoteSchema(t *testing.T) {
	t.Parallel()

	h := hasura.RemoteSchemaMetadata{
		Name:    "payments",
		Comment: "Payment service",
		Definition: hasura.RemoteSchemaDefinition{
			URLFromEnv:           "PAYMENTS_URL",
			TimeoutSeconds:       60,
			ForwardClientHeaders: true,
			Customization: hasura.RemoteSchemaCustomization{
				RootFieldsNamespace: "payments",
				TypeNames: hasura.TypeNamesCustomization{
					Prefix:  "Pay_",
					Suffix:  "_RS",
					Mapping: map[string]string{"Payment": "Charge"},
				},
				FieldNames: []hasura.FieldNamesCustomization{
					{
						ParentType: "Payment",
						Prefix:     "p_",
						Suffix:     "_f",
						Mapping:    map[string]string{"id": "paymentId"},
					},
					{
						ParentType: "Query",
						Prefix:     "q_",
					},
				},
			},
			Headers: []hasura.RemoteSchemaHeader{
				{Name: "x-api-key", Value: hasura.EnvValue{FromEnv: "PAYMENTS_KEY"}},
			},
		},
		Permissions: []hasura.RemoteSchemaPermission{
			{
				Role: "user",
				Definition: hasura.RemoteSchemaPermissionDef{
					Schema: "type Query { getPayment(id: ID!): Payment }",
				},
			},
		},
		RemoteRelationships: []hasura.RemoteSchemaTypeRemoteRelationship{
			{
				TypeName: "Payment",
				Relationships: []hasura.RemoteSchemaRelationshipDef{
					{
						Name: "user",
						Definition: hasura.RemoteSchemaRelationshipDefinition{
							ToSource: &hasura.RemoteSchemaToSourceRelationship{
								FieldMapping:     map[string]string{"user_id": "id"},
								RelationshipType: "object",
								Source:           "default",
								Table: hasura.RemoteSchemaTableRef{
									Name:   "users",
									Schema: "auth",
								},
							},
						},
					},
				},
			},
		},
	}

	got := convertRemoteSchema(h)

	want := RemoteSchemaMetadata{
		Name:    "payments",
		Comment: "Payment service",
		Definition: RemoteSchemaDefinition{
			URL:                  "{{PAYMENTS_URL}}",
			TimeoutSeconds:       60,
			ForwardClientHeaders: true,
			// Remote schemas express root-field prefix/suffix through a
			// field_names entry (not RootFieldsPrefix/Suffix), so those stay
			// empty; mapping and the field_names slice carry through in order.
			Customization: Customization{
				RootFieldsNamespace: "payments",
				RootFieldsPrefix:    "",
				RootFieldsSuffix:    "",
				TypeNamesPrefix:     "Pay_",
				TypeNamesSuffix:     "_RS",
				TypeNamesMapping:    map[string]string{"Payment": "Charge"},
				FieldNames: []FieldNameCustomization{
					{
						ParentType: "Payment",
						Prefix:     "p_",
						Suffix:     "_f",
						Mapping:    map[string]string{"id": "paymentId"},
					},
					{
						ParentType: "Query",
						Prefix:     "q_",
						Suffix:     "",
						Mapping:    nil,
					},
				},
			},
			Headers: []RemoteSchemaHeader{
				{Name: "x-api-key", Value: "{{PAYMENTS_KEY}}"},
			},
		},
		Permissions: []RemoteSchemaPermission{
			{
				Role: "user",
				Definition: RemoteSchemaPermissionDef{
					Schema: "type Query { getPayment(id: ID!): Payment }",
				},
			},
		},
		RemoteRelationships: []RemoteSchemaTypeRemoteRelationship{
			{
				TypeName: "Payment",
				Relationships: []RemoteSchemaRelationshipDef{
					{
						Name: "user",
						Definition: RemoteSchemaRelationshipDefinition{
							ToSource: &RemoteSchemaToSourceRelationship{
								FieldMapping:     map[string]string{"user_id": "id"},
								RelationshipType: "object",
								Source:           "default",
								Table: RemoteSchemaTableRef{
									Name:   "users",
									Schema: "auth",
								},
							},
						},
					},
				},
			},
		},
	}

	if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("convertRemoteSchema mismatch (-want +got):\n%s", diff)
	}
}

func TestConvertRemoteSchemaURL(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   hasura.RemoteSchemaDefinition
		want EnvString
	}{
		{
			name: "url_from_env",
			in:   hasura.RemoteSchemaDefinition{URLFromEnv: "GRAPHQL_URL"},
			want: "{{GRAPHQL_URL}}",
		},
		{
			name: "direct url",
			in:   hasura.RemoteSchemaDefinition{URL: "http://localhost:4000/graphql"},
			want: "http://localhost:4000/graphql",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := convertRemoteSchemaURL(tt.in)
			if got != tt.want {
				t.Errorf("convertRemoteSchemaURL = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestConvertFunction(t *testing.T) {
	t.Parallel()

	h := hasura.FunctionMetadata{
		Function: hasura.FunctionSource{Name: "search_articles", Schema: "public"},
		Configuration: hasura.FunctionConfiguration{
			CustomName: "searchArticles",
			CustomRootFields: hasura.FunctionCustomRootFields{
				Function:          "searchArticles",
				FunctionAggregate: "searchArticlesAggregate",
			},
			ExposedAs:       "query",
			SessionArgument: "hasura_session",
		},
		Permissions: []hasura.FunctionPermission{
			{Role: "user"},
			{Role: "editor"},
		},
	}

	got := convertFunction(h)

	want := FunctionMetadata{
		Function: FunctionSource{Name: "search_articles", Schema: "public"},
		Configuration: FunctionConfiguration{
			CustomName: "searchArticles",
			CustomRootFields: FunctionCustomRootFields{
				Function:          "searchArticles",
				FunctionAggregate: "searchArticlesAggregate",
			},
			ExposedAs:       "query",
			SessionArgument: "hasura_session",
		},
		Permissions: []FunctionPermission{
			{Role: "user"},
			{Role: "editor"},
		},
	}

	if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("convertFunction mismatch (-want +got):\n%s", diff)
	}
}

func TestConvertRemoteFieldCalls(t *testing.T) {
	t.Parallel()

	t.Run("nil input", func(t *testing.T) {
		t.Parallel()

		got := convertRemoteFieldCalls(nil)
		if got != nil {
			t.Errorf("expected nil, got %v", got)
		}
	})

	t.Run("nested fields", func(t *testing.T) {
		t.Parallel()

		h := map[string]hasura.RemoteFieldCall{
			"getUser": {
				Arguments: map[string]string{"id": "$user_id"},
				Field: map[string]hasura.RemoteFieldCall{
					"profile": {
						Arguments: map[string]string{},
					},
				},
			},
		}

		got := convertRemoteFieldCalls(h)

		want := map[string]RemoteFieldCall{
			"getUser": {
				Arguments: map[string]string{"id": "$user_id"},
				Field: map[string]RemoteFieldCall{
					"profile": {
						Arguments: map[string]string{},
					},
				},
			},
		}

		if diff := cmp.Diff(want, got, cmpopts.EquateEmpty()); diff != "" {
			t.Errorf("convertRemoteFieldCalls mismatch (-want +got):\n%s", diff)
		}
	})
}

func TestFromHasura(t *testing.T) {
	t.Parallel()

	h := &hasura.Metadata{
		Databases: []hasura.DatabaseMetadata{
			{
				Name: "default",
				Kind: "postgres",
				Configuration: hasura.DatabaseConfiguration{
					ConnectionInfo: hasura.DatabaseConnectionInfo{
						DatabaseURL: hasura.DatabaseURL{FromEnv: "DB"},
					},
				},
			},
		},
		RemoteSchemas: []hasura.RemoteSchemaMetadata{
			{
				Name: "rs",
				Definition: hasura.RemoteSchemaDefinition{
					URL: "http://example.com/graphql",
				},
			},
		},
	}

	got := fromHasura(h)

	if len(got.Databases) != 1 || got.Databases[0].Name != "default" {
		t.Errorf("Databases = %+v, want 1 database named 'default'", got.Databases)
	}

	if len(got.RemoteSchemas) != 1 || got.RemoteSchemas[0].Name != "rs" {
		t.Errorf("RemoteSchemas = %+v, want 1 remote schema named 'rs'", got.RemoteSchemas)
	}

	if got.Databases[0].Configuration.ConnectionInfo.DatabaseURL != "{{DB}}" {
		t.Errorf("DatabaseURL = %q, want %q",
			got.Databases[0].Configuration.ConnectionInfo.DatabaseURL, "{{DB}}")
	}
}
