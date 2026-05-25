package hasura_test

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

func TestFromJSON_ValidV3(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": "postgres://user:pass@localhost:5432/mydb"
					}
				},
				"tables": [
					{
						"table": {"name": "users", "schema": "public"},
						"select_permissions": [
							{
								"role": "user",
								"permission": {
									"columns": ["id", "name"],
									"filter": {"id": {"_eq": "X-Hasura-User-Id"}}
								}
							}
						],
						"insert_permissions": [
							{
								"role": "user",
								"permission": {
									"columns": ["name"],
									"check": {"id": {"_eq": "X-Hasura-User-Id"}}
								}
							}
						],
						"object_relationships": [
							{
								"name": "profile",
								"using": {
									"foreign_key_constraint_on": "profile_id"
								}
							}
						],
						"array_relationships": [
							{
								"name": "posts",
								"using": {
									"foreign_key_constraint_on": {
										"column": "author_id",
										"table": {"name": "posts", "schema": "public"}
									}
								}
							}
						]
					}
				],
				"functions": [
					{
						"function": {"name": "search_users", "schema": "public"},
						"configuration": {
							"exposed_as": "query",
							"session_argument": "hasura_session"
						}
					}
				]
			}
		],
		"remote_schemas": [
			{
				"name": "my_remote",
				"definition": {
					"url": "https://remote.example.com/graphql",
					"timeout_seconds": 30,
					"headers": [
						{"name": "Authorization", "value": "Bearer token123"},
						{"name": "X-Api-Key", "value_from_env": "REMOTE_API_KEY"}
					]
				},
				"permissions": [
					{
						"role": "user",
						"definition": {
							"schema": "type Query { hello: String }"
						}
					}
				]
			}
		]
	}`)

	meta, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assertDatabaseBasics(t, meta)
	assertTableRelationships(t, meta.Databases[0].Tables[0])
	assertFunctions(t, meta.Databases[0])
	assertRemoteSchemas(t, meta)
}

func assertDatabaseBasics(t *testing.T, meta *hasura.Metadata) {
	t.Helper()

	if len(meta.Databases) != 1 {
		t.Fatalf("expected 1 database, got %d", len(meta.Databases))
	}

	db := meta.Databases[0]
	if db.Name != "default" {
		t.Errorf("expected database name 'default', got %q", db.Name)
	}

	if db.Kind != "postgres" {
		t.Errorf("expected database kind 'postgres', got %q", db.Kind)
	}

	if db.Configuration.ConnectionInfo.DatabaseURL.URL != "postgres://user:pass@localhost:5432/mydb" {
		t.Errorf("unexpected database URL: %q", db.Configuration.ConnectionInfo.DatabaseURL.URL)
	}

	if len(db.Tables) != 1 {
		t.Fatalf("expected 1 table, got %d", len(db.Tables))
	}

	table := db.Tables[0]
	if table.Table.Name != "users" || table.Table.Schema != "public" {
		t.Errorf("unexpected table: %+v", table.Table)
	}

	if len(table.SelectPermissions) != 1 || table.SelectPermissions[0].Role != "user" {
		t.Errorf("unexpected select permissions: %+v", table.SelectPermissions)
	}
}

func assertTableRelationships(t *testing.T, table hasura.TableMetadata) {
	t.Helper()

	if len(table.ObjectRelationships) != 1 {
		t.Fatalf("expected 1 object relationship, got %d", len(table.ObjectRelationships))
	}

	if table.ObjectRelationships[0].Using.ForeignKeyColumn != "profile_id" {
		t.Errorf("expected foreign key column 'profile_id', got %q",
			table.ObjectRelationships[0].Using.ForeignKeyColumn)
	}

	if len(table.ArrayRelationships) != 1 {
		t.Fatalf("expected 1 array relationship, got %d", len(table.ArrayRelationships))
	}

	fkc := table.ArrayRelationships[0].Using.ForeignKeyConstraint
	if fkc == nil {
		t.Fatal("expected foreign key constraint, got nil")
	}

	if fkc.Column != "author_id" {
		t.Errorf("expected constraint column 'author_id', got %q", fkc.Column)
	}

	if fkc.Table.Name != "posts" || fkc.Table.Schema != "public" {
		t.Errorf("unexpected constraint table: %+v", fkc.Table)
	}
}

func assertFunctions(t *testing.T, db hasura.DatabaseMetadata) {
	t.Helper()

	if len(db.Functions) != 1 {
		t.Fatalf("expected 1 function, got %d", len(db.Functions))
	}

	if db.Functions[0].Configuration.ExposedAs != "query" {
		t.Errorf("expected exposed_as 'query', got %q", db.Functions[0].Configuration.ExposedAs)
	}
}

func assertRemoteSchemas(t *testing.T, meta *hasura.Metadata) {
	t.Helper()

	if len(meta.RemoteSchemas) != 1 {
		t.Fatalf("expected 1 remote schema, got %d", len(meta.RemoteSchemas))
	}

	rs := meta.RemoteSchemas[0]
	if rs.Name != "my_remote" {
		t.Errorf("expected remote schema name 'my_remote', got %q", rs.Name)
	}

	if len(rs.Definition.Headers) != 2 {
		t.Fatalf("expected 2 headers, got %d", len(rs.Definition.Headers))
	}

	if rs.Definition.Headers[0].Value.Value != "Bearer token123" {
		t.Errorf(
			"expected header value 'Bearer token123', got %q",
			rs.Definition.Headers[0].Value.Value,
		)
	}

	if rs.Definition.Headers[1].Value.FromEnv != "REMOTE_API_KEY" {
		t.Errorf(
			"expected header from_env 'REMOTE_API_KEY', got %q",
			rs.Definition.Headers[1].Value.FromEnv,
		)
	}
}

func TestFromJSON_DatabaseURLFromEnv(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": {"from_env": "PG_DATABASE_URL"}
					}
				},
				"tables": []
			}
		]
	}`)

	meta, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	dbURL := meta.Databases[0].Configuration.ConnectionInfo.DatabaseURL
	if dbURL.FromEnv != "PG_DATABASE_URL" {
		t.Errorf("expected from_env 'PG_DATABASE_URL', got %q", dbURL.FromEnv)
	}

	if dbURL.URL != "" {
		t.Errorf("expected empty URL, got %q", dbURL.URL)
	}
}

func TestFromJSON_ConvertRemoteRelationships(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": "postgres://localhost/db"
					}
				},
				"tables": [
					{
						"table": {"name": "orders", "schema": "public"},
						"remote_relationships": [
							{
								"name": "customer",
								"definition": {
									"to_source": {
										"field_mapping": {"customer_id": "id"},
										"relationship_type": "object",
										"source": "customers_db",
										"table": {"name": "customers", "schema": "public"}
									}
								}
							},
							{
								"name": "items",
								"definition": {
									"to_source": {
										"field_mapping": {"id": "order_id"},
										"relationship_type": "array",
										"source": "items_db",
										"table": {"name": "order_items", "schema": "public"}
									}
								}
							}
						]
					}
				]
			}
		]
	}`)

	meta, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	table := meta.Databases[0].Tables[0]

	if len(table.ObjectRelationships) != 1 {
		t.Fatalf("expected 1 object relationship, got %d", len(table.ObjectRelationships))
	}

	objRel := table.ObjectRelationships[0]
	if objRel.Name != "customer" {
		t.Errorf("expected name 'customer', got %q", objRel.Name)
	}

	if objRel.Using.ManualConfiguration == nil {
		t.Fatal("expected manual configuration, got nil")
	}

	if objRel.Using.ManualConfiguration.Source != "customers_db" {
		t.Errorf("expected source 'customers_db', got %q", objRel.Using.ManualConfiguration.Source)
	}

	expectedMapping := map[string]string{"customer_id": "id"}
	if diff := cmp.Diff(
		expectedMapping,
		objRel.Using.ManualConfiguration.ColumnMapping,
	); diff != "" {
		t.Errorf("column mapping mismatch (-want +got):\n%s", diff)
	}

	if len(table.ArrayRelationships) != 1 {
		t.Fatalf("expected 1 array relationship, got %d", len(table.ArrayRelationships))
	}

	arrRel := table.ArrayRelationships[0]
	if arrRel.Name != "items" {
		t.Errorf("expected name 'items', got %q", arrRel.Name)
	}

	if arrRel.Using.ManualConfiguration == nil {
		t.Fatal("expected manual configuration, got nil")
	}

	if arrRel.Using.ManualConfiguration.Source != "items_db" {
		t.Errorf("expected source 'items_db', got %q", arrRel.Using.ManualConfiguration.Source)
	}
}

func TestConvertRemoteRelationships_RemoteSchemaCustomColumnNames(t *testing.T) {
	t.Parallel()

	// Simulate a table with custom column names and a to_remote_schema relationship
	// that references those columns in lhs_fields. The column_config renames
	// "app_id" to "appID" in GraphQL. After full conversion the native metadata
	// types must use GraphQL names in ColumnMapping and in $column references.
	input := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": "postgres://localhost/db"
					}
				},
				"tables": [
					{
						"table": {"name": "run_service", "schema": "public"},
						"configuration": {
							"column_config": {
								"app_id": {"custom_name": "appID"},
								"created_at": {"custom_name": "createdAt"}
							}
						},
						"remote_relationships": [
							{
								"name": "config",
								"definition": {
									"to_remote_schema": {
										"lhs_fields": ["id", "app_id"],
										"remote_field": {
											"runServiceConfig": {
												"arguments": {
													"appID": "$app_id",
													"serviceID": "$id"
												}
											}
										},
										"remote_schema": "mimir"
									}
								}
							}
						]
					}
				]
			}
		]
	}`)

	meta, err := metadata.FromHasuraJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	table := meta.Databases[0].Tables[0]

	if len(table.ObjectRelationships) != 1 {
		t.Fatalf("expected 1 object relationship, got %d", len(table.ObjectRelationships))
	}

	objRel := table.ObjectRelationships[0]
	if objRel.Name != "config" {
		t.Errorf("expected name 'config', got %q", objRel.Name)
	}

	mc := objRel.Using.ManualConfiguration
	if mc == nil {
		t.Fatal("expected manual configuration, got nil")
	}

	if mc.RemoteSchema != "mimir" {
		t.Errorf("expected remote schema 'mimir', got %q", mc.RemoteSchema)
	}

	expectedMapping := map[string]string{"id": "id", "appID": "appID"}
	if diff := cmp.Diff(expectedMapping, mc.ColumnMapping); diff != "" {
		t.Errorf("column mapping mismatch (-want +got):\n%s", diff)
	}

	if len(mc.RemoteFieldPath) != 1 {
		t.Fatalf("expected 1 remote field path entry, got %d", len(mc.RemoteFieldPath))
	}

	entry := mc.RemoteFieldPath[0]
	if entry.FieldName != "runServiceConfig" {
		t.Errorf("expected field name 'runServiceConfig', got %q", entry.FieldName)
	}

	expectedArgs := map[string]string{"appID": "$appID", "serviceID": "$id"}
	if diff := cmp.Diff(expectedArgs, entry.Arguments); diff != "" {
		t.Errorf("remote field arguments mismatch (-want +got):\n%s", diff)
	}
}

func TestFromJSON_InvalidVersion(t *testing.T) {
	t.Parallel()

	_, err := hasura.FromJSON([]byte(`{"version": 2, "sources": []}`))
	if err == nil {
		t.Fatal("expected error for version 2, got nil")
	}
}

func TestFromJSON_MalformedJSON(t *testing.T) {
	t.Parallel()

	_, err := hasura.FromJSON([]byte(`{not valid json`))
	if err == nil {
		t.Fatal("expected error for malformed JSON, got nil")
	}
}

func TestFromJSON_ManualConfiguration(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": "postgres://localhost/db"
					}
				},
				"tables": [
					{
						"table": {"name": "orders", "schema": "public"},
						"object_relationships": [
							{
								"name": "customer",
								"using": {
									"manual_configuration": {
										"remote_table": {"name": "customers", "schema": "public"},
										"column_mapping": {"customer_id": "id"}
									}
								}
							}
						]
					}
				]
			}
		]
	}`)

	meta, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	table := meta.Databases[0].Tables[0]
	if len(table.ObjectRelationships) != 1 {
		t.Fatalf("expected 1 object relationship, got %d", len(table.ObjectRelationships))
	}

	manual := table.ObjectRelationships[0].Using.ManualConfiguration
	if manual == nil {
		t.Fatal("expected manual configuration, got nil")
	}

	if manual.RemoteTable.Name != "customers" {
		t.Errorf("expected remote table 'customers', got %q", manual.RemoteTable.Name)
	}

	expectedMapping := map[string]string{"customer_id": "id"}
	if diff := cmp.Diff(expectedMapping, manual.ColumnMapping); diff != "" {
		t.Errorf("column mapping mismatch (-want +got):\n%s", diff)
	}
}

func TestFromJSON_TableConfiguration(t *testing.T) {
	t.Parallel()

	input := []byte(`{
		"version": 3,
		"sources": [
			{
				"name": "default",
				"kind": "postgres",
				"configuration": {
					"connection_info": {
						"database_url": "{{NHOST_GRAPHQL_DATABASE_URL}}"
					}
				},
				"tables": [
					{
						"table": {"name": "provider_requests", "schema": "auth"},
						"configuration": {
							"column_config": {
								"id": {"custom_name": "id"},
								"options": {"custom_name": "options"}
							},
							"custom_name": "authProviderRequests",
							"custom_root_fields": {
								"delete": "deleteAuthProviderRequests",
								"select": "authProviderRequests",
								"select_aggregate": "authProviderRequestsAggregate"
							}
						}
					}
				]
			}
		]
	}`)

	meta, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	table := meta.Databases[0].Tables[0]
	if table.Configuration.CustomName != "authProviderRequests" {
		t.Errorf(
			"expected custom_name 'authProviderRequests', got %q",
			table.Configuration.CustomName,
		)
	}

	if table.Configuration.CustomRootFields.Select != "authProviderRequests" {
		t.Errorf("expected select root field 'authProviderRequests', got %q",
			table.Configuration.CustomRootFields.Select)
	}

	dbURL := meta.Databases[0].Configuration.ConnectionInfo.DatabaseURL.URL
	if dbURL != "{{NHOST_GRAPHQL_DATABASE_URL}}" {
		t.Errorf("unexpected database URL: %q", dbURL)
	}
}

func TestFromJSON_EmptySources(t *testing.T) {
	t.Parallel()

	input := []byte(`{"version": 3, "sources": []}`)

	meta, err := hasura.FromJSON(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if diff := cmp.Diff(0, len(meta.Databases)); diff != "" {
		t.Errorf("databases count mismatch (-want +got):\n%s", diff)
	}

	if diff := cmp.Diff(0, len(meta.RemoteSchemas), cmpopts.EquateEmpty()); diff != "" {
		t.Errorf("remote schemas count mismatch (-want +got):\n%s", diff)
	}
}

// TestFromJSON_RealMetadata tests deserialization of real Hasura metadata
// exported from a PostgreSQL hdb_catalog.hdb_metadata table. It goes through
// the full conversion pipeline: JSON -> hasura.Metadata -> metadata.Metadata,
// and compares the result against a golden file.
func TestFromJSON_RealMetadata(t *testing.T) { //nolint:paralleltest
	dir := filepath.Join("testdata", t.Name())

	input, err := os.ReadFile(filepath.Join(dir, "metadata.json"))
	if err != nil {
		t.Fatalf("failed to read metadata.json: %v", err)
	}

	m, err := metadata.FromHasuraJSON(input)
	if err != nil {
		t.Fatalf("FromHasuraJSON failed: %v", err)
	}

	goldenPath := filepath.Join(dir, "golden.json")

	if *updateGolden {
		b, err := json.Marshal(
			m,
			jsontext.WithIndent("  "),
			json.FormatNilSliceAsNull(true),
			json.FormatNilMapAsNull(true),
		)
		if err != nil {
			t.Fatalf("failed to marshal metadata to JSON: %v", err)
		}

		if err := os.WriteFile(goldenPath, b, 0o600); err != nil {
			t.Fatalf("failed to write golden file: %v", err)
		}
	}

	golden, err := os.ReadFile(goldenPath)
	if err != nil {
		t.Fatalf("failed to read golden file (run with -update to generate): %v", err)
	}

	var expected metadata.Metadata
	if err := json.Unmarshal(golden, &expected); err != nil {
		t.Fatalf("failed to unmarshal golden file: %v", err)
	}

	if diff := cmp.Diff(
		&expected, m,
		cmpopts.EquateEmpty(),
		// RemoteFieldPath is a derived field (json:"-") populated during conversion
		// but not serialized to the golden file, so we ignore it in the comparison.
		cmpopts.IgnoreFields(metadata.ManualConfiguration{}, "RemoteFieldPath"),
	); diff != "" {
		t.Errorf("metadata mismatch (-expected +got):\n%s", diff)
	}
}
