package metadata

import (
	stdjson "encoding/json"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

// ptr returns a pointer to v. The generated wire types model optional scalars
// as pointers, so fixtures use this to set them inline.
func ptr[T any](v T) *T { return &v }

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

func TestConvertHeaderValue(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name             string
		in               hasura.EnvValue
		wantValue        string
		wantValueFromEnv string
	}{
		{
			name:             "from env",
			in:               hasura.EnvValue{FromEnv: "API_KEY"},
			wantValue:        "",
			wantValueFromEnv: "API_KEY",
		},
		{
			name:             "direct value",
			in:               hasura.EnvValue{Value: "secret123"},
			wantValue:        "secret123",
			wantValueFromEnv: "",
		},
		{
			name:             "literal braces stay literal",
			in:               hasura.EnvValue{Value: "{{API_KEY}}"},
			wantValue:        "{{API_KEY}}",
			wantValueFromEnv: "",
		},
		{
			name:             "empty",
			in:               hasura.EnvValue{},
			wantValue:        "",
			wantValueFromEnv: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			gotValue, gotValueFromEnv := convertHeaderValue(tt.in)
			if gotValue != tt.wantValue || gotValueFromEnv != tt.wantValueFromEnv {
				t.Errorf(
					"convertHeaderValue = (%q, %q), want (%q, %q)",
					gotValue,
					gotValueFromEnv,
					tt.wantValue,
					tt.wantValueFromEnv,
				)
			}
		})
	}
}

func TestNormalizePermissionMap(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   map[string]any
		want map[string]any
	}{
		{
			name: "json number large integer",
			in: map[string]any{
				"id": map[string]any{"_eq": stdjson.Number("9007199254740993")},
			},
			want: map[string]any{
				"id": map[string]any{"_eq": int64(9007199254740993)},
			},
		},
		{
			name: "yaml uint64 integer",
			in: map[string]any{
				"id": map[string]any{"_eq": uint64(9007199254740993)},
			},
			want: map[string]any{
				"id": map[string]any{"_eq": int64(9007199254740993)},
			},
		},
		{
			name: "genuine float remains float",
			in: map[string]any{
				"score": map[string]any{"_eq": 1.5},
			},
			want: map[string]any{
				"score": map[string]any{"_eq": 1.5},
			},
		},
		{
			name: "arrays are deep cloned",
			in: map[string]any{
				"_and": []any{map[string]any{"id": map[string]any{"_eq": uint(7)}}},
			},
			want: map[string]any{
				"_and": []any{map[string]any{"id": map[string]any{"_eq": int64(7)}}},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := normalizePermissionMap(tt.in)
			if diff := cmp.Diff(tt.want, got); diff != "" {
				t.Errorf("normalizePermissionMap mismatch (-want +got):\n%s", diff)
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
					ForeignKeyColumns: []string{"author_id"},
				},
			},
		},
		ArrayRelationships: []hasura.ArrayRelationship{
			{
				Name: "comments",
				Using: hasura.RelationshipUsing{
					ForeignKeyConstraint: &hasura.ForeignKeyConstraint{
						Columns: []string{"post_id"},
						Table:   hasura.TableSource{Name: "comments", Schema: "public"},
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
					ForeignKeyColumns: []string{"author_id"},
				},
			},
		},
		ArrayRelationships: []ArrayRelationship{
			{
				Name: "comments",
				Using: RelationshipUsing{
					ForeignKeyConstraint: &ForeignKeyConstraint{
						Columns: []string{"post_id"},
						Table:   TableSource{Name: "comments", Schema: "public"},
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
				ForeignKeyColumns:    []string{"author_id"},
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
			want: &RelationshipUsing{
				ForeignKeyColumns:    []string{"author_id"},
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
		},
		{
			name: "empty remote schema leaves column mapping untouched",
			in: &RelationshipUsing{
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns: nil,
				ForeignKeyConstraint: &hasura.ForeignKeyConstraint{
					Columns: []string{"post_id"},
					Table:   hasura.TableSource{Name: "comments", Schema: "public"},
				},
				ManualConfiguration: nil,
			},
			want: RelationshipUsing{
				ForeignKeyColumns: nil,
				ForeignKeyConstraint: &ForeignKeyConstraint{
					Columns: []string{"post_id"},
					Table:   TableSource{Name: "comments", Schema: "public"},
				},
				ManualConfiguration: nil,
			},
		},
		{
			name: "manual configuration branch with column mapping",
			in: hasura.RelationshipUsing{
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    nil,
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
				ForeignKeyColumns:    []string{"author_id"},
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
			want: RelationshipUsing{
				ForeignKeyColumns:    []string{"author_id"},
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
		},
		{
			name: "composite foreign key columns in parent",
			in: hasura.RelationshipUsing{
				ForeignKeyColumns:    []string{"exercise_id", "kind"},
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
			want: RelationshipUsing{
				ForeignKeyColumns:    []string{"exercise_id", "kind"},
				ForeignKeyConstraint: nil,
				ManualConfiguration:  nil,
			},
		},
		{
			name: "composite foreign key constraint in target",
			in: hasura.RelationshipUsing{
				ForeignKeyColumns: nil,
				ForeignKeyConstraint: &hasura.ForeignKeyConstraint{
					Columns: []string{"a", "b"},
					Table:   hasura.TableSource{Name: "t", Schema: "public"},
				},
				ManualConfiguration: nil,
			},
			want: RelationshipUsing{
				ForeignKeyColumns: nil,
				ForeignKeyConstraint: &ForeignKeyConstraint{
					Columns: []string{"a", "b"},
					Table:   TableSource{Name: "t", Schema: "public"},
				},
				ManualConfiguration: nil,
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

	// The Hasura wire type is generated (pointers + oapi-codegen unions), so the
	// fixture is built by decoding JSON rather than hand-writing pointer/union
	// literals; this also exercises the wire decode path the store uses.
	const hJSON = `{` +
		`"name":"payments","comment":"Payment service",` +
		`"definition":{` +
		`"url_from_env":"PAYMENTS_URL","timeout_seconds":60,"forward_client_headers":true,` +
		`"customization":{"root_fields_namespace":"payments",` +
		`"type_names":{"prefix":"Pay_","suffix":"_RS","mapping":{"Payment":"Charge"}},` +
		`"field_names":[` +
		`{"parent_type":"Payment","prefix":"p_","suffix":"_f","mapping":{"id":"paymentId"}},` +
		`{"parent_type":"Query","prefix":"q_"}]},` +
		`"headers":[{"name":"x-api-key","value_from_env":"PAYMENTS_KEY"}]},` +
		`"permissions":[{"role":"user","definition":` +
		`{"schema":"type Query { getPayment(id: ID!): Payment }"}}],` +
		`"remote_relationships":[{"type_name":"Payment","relationships":[` +
		`{"name":"user","definition":{"to_source":{"field_mapping":{"user_id":"id"},` +
		`"relationship_type":"object","source":"default",` +
		`"table":{"name":"users","schema":"auth"}}}}]}]` +
		`}`

	var h hasura.RemoteSchemaMetadata
	if err := stdjson.Unmarshal([]byte(hJSON), &h); err != nil {
		t.Fatalf("building wire fixture: %v", err)
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
				{Name: "x-api-key", ValueFromEnv: "PAYMENTS_KEY"},
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

// TestConvertRemoteSchema_ToRemoteSchemaRelationship verifies the rs→rs
// (to_remote_schema) relationship variant converts into the native model.
func TestConvertRemoteSchema_ToRemoteSchemaRelationship(t *testing.T) {
	t.Parallel()

	const hJSON = `{"name":"rs","definition":{"url":"http://rs.test/graphql"},` +
		`"remote_relationships":[{"type_name":"Team","relationships":[` +
		`{"name":"weather","definition":{"to_remote_schema":{` +
		`"remote_schema":"weather_api","lhs_fields":["city"],` +
		`"remote_field":{"forecast":{"arguments":{"city":"$city"}}}}}}]}]}`

	var h hasura.RemoteSchemaMetadata
	if err := stdjson.Unmarshal([]byte(hJSON), &h); err != nil {
		t.Fatalf("building wire fixture: %v", err)
	}

	got := convertRemoteSchema(h)

	toRS := got.RemoteRelationships[0].Relationships[0].Definition.ToRemoteSchema
	if toRS == nil {
		t.Fatal("expected ToRemoteSchema to be populated")
	}

	want := &ToRemoteSchemaRelationship{
		RemoteSchema: "weather_api",
		LHSFields:    []string{"city"},
		RemoteField: map[string]RemoteFieldCall{
			"forecast": {Arguments: map[string]string{"city": "$city"}},
		},
	}

	if diff := cmp.Diff(want, toRS, cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("to_remote_schema mismatch (-want +got):\n%s", diff)
	}

	if got.RemoteRelationships[0].Relationships[0].Definition.ToSource != nil {
		t.Error("ToSource should be nil for a to_remote_schema relationship")
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
			in:   hasura.RemoteSchemaDefinition{UrlFromEnv: ptr("GRAPHQL_URL")},
			want: "{{GRAPHQL_URL}}",
		},
		{
			name: "direct url",
			in:   hasura.RemoteSchemaDefinition{Url: ptr("http://localhost:4000/graphql")},
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
					Url: ptr("http://example.com/graphql"),
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
