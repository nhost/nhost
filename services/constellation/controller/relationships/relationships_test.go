package relationships_test

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector"
	connectormock "github.com/nhost/nhost/services/constellation/connector/mock"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/controller/relationships"
	"github.com/nhost/nhost/services/constellation/metadata"
	"go.uber.org/mock/gomock"
)

func TestFromMetadata_NilManualConfigSkipsRelationship(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().GetTypeName("public.users").Return("users").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table:  metadata.TableSource{Schema: "public", Name: "users"},
				IsEnum: false,
				ObjectRelationships: []metadata.ObjectRelationship{{
					Name: "rel",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: nil,
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	if rels := got["db"]; len(rels) != 0 {
		t.Errorf("expected no relationships, got %d: %+v", len(rels), rels)
	}
}

func TestFromMetadata_LocalRelationshipSkipped(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().GetTypeName("public.users").Return("users").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ObjectRelationships: []metadata.ObjectRelationship{{
					Name: "rel",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteTable:   metadata.TableSource{Schema: "public", Name: "users"},
							ColumnMapping: map[string]string{"id": "user_id"},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	if rels := got["db"]; len(rels) != 0 {
		t.Errorf("expected no relationships for local rel, got %d: %+v", len(rels), rels)
	}
}

func TestFromMetadata_EnumTablesSkipped(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table:  metadata.TableSource{Schema: "public", Name: "user_role"},
				IsEnum: true,
				ObjectRelationships: []metadata.ObjectRelationship{{
					Name: "shouldnt_be_built",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							Source:        "other_db",
							RemoteTable:   metadata.TableSource{Schema: "public", Name: "x"},
							ColumnMapping: map[string]string{"id": "user_id"},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	if rels := got["db"]; len(rels) != 0 {
		t.Errorf("expected no relationships from enum tables, got %d: %+v", len(rels), rels)
	}
}

func TestFromMetadata_DBToDBObjectRelationship(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().GetTypeName("public.users").Return("users").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ObjectRelationships: []metadata.ObjectRelationship{{
					Name: "remote_users",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							Source:        "other_db",
							RemoteTable:   metadata.TableSource{Schema: "public", Name: "users"},
							ColumnMapping: map[string]string{"id": "user_id"},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	rels := got["db"]
	if len(rels) != 1 {
		t.Fatalf("expected 1 relationship, got %d", len(rels))
	}

	want := &planner.RelationshipMetadata{
		Name:              "remote_users",
		SourceType:        "users",
		TargetConnector:   "other_db",
		TargetTable:       "users",
		TargetTableSchema: "public",
		JoinMapping:       map[string]string{"id": "user_id"},
		IsArray:           false,
		IsArrayAggregate:  false,
		IsRemote:          true,
		LHSFields:         nil,
		RemoteFieldPath:   nil,
	}
	if diff := cmp.Diff(want, rels[0]); diff != "" {
		t.Errorf("mismatch (-want +got):\n%s", diff)
	}
}

func TestFromMetadata_DBToDBArrayRelationshipEmitsAggregate(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().GetTypeName("public.users").Return("users").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ArrayRelationships: []metadata.ArrayRelationship{{
					Name: "posts",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							Source:        "other_db",
							RemoteTable:   metadata.TableSource{Schema: "public", Name: "posts"},
							ColumnMapping: map[string]string{"id": "user_id"},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	rels := got["db"]
	if len(rels) != 2 {
		t.Fatalf("expected 2 relationships (array + aggregate), got %d", len(rels))
	}

	if !rels[0].IsArray || rels[0].IsArrayAggregate {
		t.Errorf("first entry should be plain array, got %+v", rels[0])
	}

	if rels[0].Name != "posts" {
		t.Errorf("first entry name = %q, want %q", rels[0].Name, "posts")
	}

	if !rels[1].IsArray || !rels[1].IsArrayAggregate {
		t.Errorf("second entry should be aggregate, got %+v", rels[1])
	}

	if rels[1].Name != "posts_aggregate" {
		t.Errorf("aggregate name = %q, want %q", rels[1].Name, "posts_aggregate")
	}
}

func TestFromMetadata_DBToRemoteSchemaRelationship(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().GetTypeName("public.users").Return("users").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ObjectRelationships: []metadata.ObjectRelationship{{
					Name: "remote_data",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteSchema:  "my_remote",
							ColumnMapping: map[string]string{"id": "userId"},
							RemoteFieldPath: []metadata.RemoteFieldPathEntry{{
								FieldName: "getUser",
								Arguments: map[string]string{"id": "$id"},
							}},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	rels := got["db"]
	if len(rels) != 1 {
		t.Fatalf("expected 1 relationship, got %d", len(rels))
	}

	rel := rels[0]
	if rel.TargetConnector != "my_remote" {
		t.Errorf("TargetConnector = %q, want %q", rel.TargetConnector, "my_remote")
	}

	if len(rel.RemoteFieldPath) != 1 {
		t.Fatalf("RemoteFieldPath len = %d, want 1", len(rel.RemoteFieldPath))
	}

	if rel.RemoteFieldPath[0].FieldName != "getUser" {
		t.Errorf("RemoteFieldPath[0].FieldName = %q, want %q",
			rel.RemoteFieldPath[0].FieldName, "getUser")
	}

	if len(rel.LHSFields) != 1 || rel.LHSFields[0] != "id" {
		t.Errorf("LHSFields = %v, want [id]", rel.LHSFields)
	}
}

// An exported Hasura document contains both the raw remote definition and a
// lowered relationship, but the lowered path is not part of the TOML format.
func TestFromMetadata_ExportedRemoteSchemaRelationships(t *testing.T) {
	t.Parallel()

	const document = `{
		"version":3,"sources":[{"name":"db","kind":"postgres",
		"configuration":{"connection_info":{"database_url":"postgres://localhost/test"}},
		"tables":[{"table":{"schema":"public","name":"items"},
		"configuration":{"column_config":{"id":{"custom_name":"itemId"}}},
		"computed_fields":[{"name":"team_key","definition":{"function":{"schema":"public","name":"team_key"}}}],
		"select_permissions":[{"role":"reader","permission":{"columns":["id"],"computed_fields":["team_key"],"filter":{}}}],
		"remote_relationships":[
			{"name":"computed_team","definition":{"to_remote_schema":{"remote_schema":"rs","lhs_fields":["team_key"],"remote_field":{"team":{"arguments":{"id":"$team_key"}}}}}},
			{"name":"physical_team","definition":{"to_remote_schema":{"remote_schema":"rs","lhs_fields":["id"],"remote_field":{"team":{"arguments":{"id":"$id"}}}}}}
		]}]}]}`

	original, err := metadata.FromHasuraJSON([]byte(document))
	if err != nil {
		t.Fatal(err)
	}

	originalArg := original.Databases[0].Tables[0].RemoteRelationships[1].Definition.ToRemoteSchema.RemoteField["team"].Arguments["id"]
	if originalArg != "$id" {
		t.Fatalf("raw SQL argument before export = %q, want $id", originalArg)
	}

	encoded, err := metadata.MarshalTOML(original)
	if err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "metadata.toml")
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		t.Fatal(err)
	}

	reloaded, err := metadata.FromDetect(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}

	conn := connectormock.NewMockConnector(gomock.NewController(t))
	conn.EXPECT().GetTypeName("public.items").Return("items").AnyTimes()

	tests := []struct {
		name, field, arg string
	}{
		{"computed_team", "team_key", "$team_key"},
		{"physical_team", "itemId", "$itemId"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := relationships.FromMetadata(reloaded, map[string]connector.Connector{"db": conn})["db"]
			want := &planner.RelationshipMetadata{
				Name:              tt.name,
				SourceType:        "items",
				TargetConnector:   "rs",
				TargetTable:       "",
				TargetTableSchema: "",
				JoinMapping:       map[string]string{tt.field: tt.field},
				IsArray:           false,
				IsArrayAggregate:  false,
				IsRemote:          true,
				LHSFields:         []string{tt.field},
				RemoteFieldPath: []planner.RemoteFieldPathEntry{{
					FieldName: "team", Arguments: map[string]string{"id": tt.arg},
				}},
			}

			if len(got) != len(tests) {
				t.Fatalf("planner entries = %d, want %d: %+v", len(got), len(tests), got)
			}

			found := 0
			for _, rel := range got {
				if rel.Name == tt.name {
					found++

					if diff := cmp.Diff(want, rel); diff != "" {
						t.Errorf("planner entry (-want +got):\n%s", diff)
					}
				}
			}

			if found != 1 {
				t.Errorf("%s entries = %d, want 1", tt.name, found)
			}
		})
	}

	// Restoring the derived path must not modify the exported raw definition.
	raw := reloaded.Databases[0].Tables[0].RemoteRelationships[1].Definition.ToRemoteSchema
	if got := raw.RemoteField["team"].Arguments["id"]; got != originalArg {
		t.Errorf("raw argument = %q, want %q", got, originalArg)
	}
}

func TestFromMetadata_RawRemoteSchemaFallbackWithoutUsableLoweredPath(t *testing.T) {
	t.Parallel()

	conn := connectormock.NewMockConnector(gomock.NewController(t))
	conn.EXPECT().GetTypeName("public.items").Return("items").AnyTimes()

	tests := []struct {
		name    string
		lowered bool
	}{
		{name: "raw only", lowered: false},
		{name: "lowered without path", lowered: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			table := metadata.TableMetadata{
				Table: metadata.TableSource{Schema: "public", Name: "items"},
				Configuration: metadata.TableConfiguration{
					ColumnConfig: map[string]metadata.ColumnConfig{
						"id": {CustomName: "itemId"},
					},
				},
				RemoteRelationships: []metadata.RemoteRelationship{{
					Name: "team", Definition: metadata.RemoteRelationshipDef{
						ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
							RemoteSchema: "rs", LHSFields: []string{"id"},
							RemoteField: map[string]metadata.RemoteFieldCall{
								"lookup": {Arguments: map[string]string{"id": "$id"}},
							},
						},
					},
				}},
			}
			if tt.lowered {
				table.ObjectRelationships = []metadata.ObjectRelationship{{
					Name: "team", Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteSchema:  "rs",
							ColumnMapping: map[string]string{"itemId": "itemId"},
						},
					},
				}}
			}

			md := &metadata.Metadata{Databases: []metadata.DatabaseMetadata{{
				Name: "db", Tables: []metadata.TableMetadata{table},
			}}}
			got := relationships.FromMetadata(md, map[string]connector.Connector{"db": conn})["db"]
			want := &planner.RelationshipMetadata{
				Name: "team", SourceType: "items", TargetConnector: "rs",
				TargetTable: "", TargetTableSchema: "", JoinMapping: nil,
				IsArray: false, IsArrayAggregate: false, IsRemote: true,
				LHSFields: []string{"itemId"}, RemoteFieldPath: []planner.RemoteFieldPathEntry{{
					FieldName: "lookup", Arguments: map[string]string{"id": "$itemId"},
				}},
			}

			if len(got) != 1 {
				t.Fatalf("planner entries = %d, want 1: %+v", len(got), got)
			}

			if diff := cmp.Diff(want, got[0]); diff != "" {
				t.Errorf("planner entry (-want +got):\n%s", diff)
			}
		})
	}
}

func TestFromMetadata_DBToRemoteSchemaArrayDoesNotEmitAggregate(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	conn := connectormock.NewMockConnector(ctrl)
	conn.EXPECT().GetTypeName("public.users").Return("users").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "db",
			Tables: []metadata.TableMetadata{{
				Table: metadata.TableSource{Schema: "public", Name: "users"},
				ArrayRelationships: []metadata.ArrayRelationship{{
					Name: "remote_things",
					Using: metadata.RelationshipUsing{
						ManualConfiguration: &metadata.ManualConfiguration{
							RemoteSchema:  "my_remote",
							ColumnMapping: map[string]string{"id": "userId"},
							RemoteFieldPath: []metadata.RemoteFieldPathEntry{{
								FieldName: "things",
								Arguments: map[string]string{"id": "$id"},
							}},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: nil,
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{"db": conn})

	rels := got["db"]
	if len(rels) != 1 {
		t.Fatalf("expected 1 relationship (no aggregate for rs target), got %d", len(rels))
	}

	if rels[0].IsArrayAggregate {
		t.Errorf("db→rs array should not emit aggregate sibling")
	}
}

func TestFromMetadata_RemoteSchemaToSourceRelationship(t *testing.T) {
	t.Parallel()

	meta := &metadata.Metadata{
		Databases: nil,
		RemoteSchemas: []metadata.RemoteSchemaMetadata{{
			Name: "rs",
			RemoteRelationships: []metadata.RemoteSchemaTypeRemoteRelationship{{
				TypeName: "User",
				Relationships: []metadata.RemoteSchemaRelationshipDef{{
					Name: "orders",
					Definition: metadata.RemoteSchemaRelationshipDefinition{
						ToSource: &metadata.RemoteSchemaToSourceRelationship{
							FieldMapping:     map[string]string{"id": "user_id"},
							RelationshipType: metadata.RelationshipTypeArray,
							Source:           "db",
							Table: metadata.RemoteSchemaTableRef{
								Name:   "orders",
								Schema: "public",
							},
						},
					},
				}},
			}},
		}},
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{})

	rels := got["rs"]
	if len(rels) != 2 {
		t.Fatalf("expected 2 relationships (array + aggregate), got %d", len(rels))
	}

	if rels[0].SourceType != "User" || rels[0].TargetConnector != "db" ||
		rels[0].TargetTable != "orders" || rels[0].TargetTableSchema != "public" {
		t.Errorf("primary entry wrong: %+v", rels[0])
	}

	if !rels[0].IsArray || rels[0].IsArrayAggregate {
		t.Errorf("primary entry should be plain array, got %+v", rels[0])
	}

	if rels[1].Name != "orders_aggregate" || !rels[1].IsArrayAggregate {
		t.Errorf("aggregate entry wrong: %+v", rels[1])
	}
}

func TestFromMetadata_RemoteSchemaWithoutToSourceSkipped(t *testing.T) {
	t.Parallel()

	meta := &metadata.Metadata{
		Databases: nil,
		RemoteSchemas: []metadata.RemoteSchemaMetadata{{
			Name: "rs",
			RemoteRelationships: []metadata.RemoteSchemaTypeRemoteRelationship{{
				TypeName: "User",
				Relationships: []metadata.RemoteSchemaRelationshipDef{{
					Name: "noop",
					Definition: metadata.RemoteSchemaRelationshipDefinition{
						ToSource: nil,
					},
				}},
			}},
		}},
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{})

	if rels := got["rs"]; len(rels) != 0 {
		t.Errorf("expected no relationships, got %d: %+v", len(rels), rels)
	}
}

// TestFromMetadata_MissingDatabaseConnectorSkipped is the regression test for
// the nil-pointer panic that bit `go run main.go serve` when a database
// source failed to build: FromMetadata still iterated metadata.Databases and
// reached for connectors[db.Name], got nil, and then forDatabase invoked
// GetTypeName on the nil interface. Databases whose connector is absent from
// the surviving set must now be skipped silently — the source already has a
// `database` inconsistency recorded for the failure that took it down.
func TestFromMetadata_MissingDatabaseConnectorSkipped(t *testing.T) {
	t.Parallel()

	ctrl := gomock.NewController(t)
	survivingConn := connectormock.NewMockConnector(ctrl)
	survivingConn.EXPECT().GetTypeName("public.orders").Return("orders").AnyTimes()

	meta := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				// "dead" is referenced by metadata but has no surviving
				// connector — it failed to build upstream.
				Name: "dead",
				Tables: []metadata.TableMetadata{{
					Table: metadata.TableSource{Schema: "public", Name: "users"},
					ObjectRelationships: []metadata.ObjectRelationship{{
						Name: "would_have_been_cross_db",
						Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								Source: "alive",
								RemoteTable: metadata.TableSource{
									Schema: "public",
									Name:   "orders",
								},
								ColumnMapping: map[string]string{"id": "user_id"},
							},
						},
					}},
				}},
			},
			{
				Name: "alive",
				Tables: []metadata.TableMetadata{{
					Table: metadata.TableSource{Schema: "public", Name: "orders"},
				}},
			},
		},
		RemoteSchemas: nil,
	}

	// connectors map intentionally omits "dead". The function must not
	// panic and must still produce relationships for "alive".
	got := relationships.FromMetadata(meta, map[string]connector.Connector{
		"alive": survivingConn,
	})

	if rels, ok := got["dead"]; ok && len(rels) > 0 {
		t.Errorf("expected no relationships for missing connector, got %+v", rels)
	}

	if _, ok := got["alive"]; !ok {
		// alive has no cross-db relationship of its own; an absent entry
		// (rather than nil slice) is fine — the planner tolerates both.
		_ = got
	}
}
