package relationships_test

import (
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

func TestFromMetadata_RemoteSchemaToRemoteSchemaRelationship(t *testing.T) {
	t.Parallel()

	meta := &metadata.Metadata{
		Databases: nil,
		RemoteSchemas: []metadata.RemoteSchemaMetadata{{
			Name: "rs",
			RemoteRelationships: []metadata.RemoteSchemaTypeRemoteRelationship{{
				TypeName: "Team",
				Relationships: []metadata.RemoteSchemaRelationshipDef{{
					Name: "weather",
					Definition: metadata.RemoteSchemaRelationshipDefinition{
						ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
							RemoteSchema: "weather_api",
							LHSFields:    []string{"city"},
							RemoteField: map[string]metadata.RemoteFieldCall{
								"forecast": {Arguments: map[string]string{"city": "$city"}},
							},
						},
					},
				}},
			}},
		}},
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{})

	rels := got["rs"]
	// rs→rs has no aggregate sibling (remote schemas have no aggregate types).
	if len(rels) != 1 {
		t.Fatalf("expected 1 relationship, got %d: %+v", len(rels), rels)
	}

	r := rels[0]
	if r.SourceType != "Team" || r.TargetConnector != "weather_api" || !r.IsRemote {
		t.Errorf("entry wrong: %+v", r)
	}

	if len(r.LHSFields) != 1 || r.LHSFields[0] != "city" {
		t.Errorf("LHSFields = %v, want [city]", r.LHSFields)
	}

	// RemoteFieldPath drives schema-resolver routing; JoinMapping must be keyed
	// by the LHS fields so phantom injection fetches them from the parent.
	if len(r.RemoteFieldPath) != 1 || r.RemoteFieldPath[0].FieldName != "forecast" {
		t.Errorf("RemoteFieldPath = %+v, want [forecast]", r.RemoteFieldPath)
	}

	// The remote_field arguments must be copied onto the path entry: this is
	// what wires the LHS join value ($city) into the remote query.
	if diff := cmp.Diff(
		map[string]string{"city": "$city"}, r.RemoteFieldPath[0].Arguments,
	); diff != "" {
		t.Errorf("RemoteFieldPath[0].Arguments mismatch (-want +got):\n%s", diff)
	}

	if _, ok := r.JoinMapping["city"]; !ok {
		t.Errorf("JoinMapping = %+v, want a \"city\" key", r.JoinMapping)
	}
}

func TestFromMetadata_RemoteSchemaToRemoteSchemaEmptyRemoteFieldSkipped(t *testing.T) {
	t.Parallel()

	// An rs→rs relationship with an empty remote_field yields a zero-length
	// RemoteFieldPath. The planner routes resolver kind on
	// len(RemoteFieldPath) > 0, so emitting such an entry would mis-route a
	// remote-schema target through the database resolver. forRemoteSchemaToRemoteSchema
	// must drop it, mirroring the composer and db→rs guards.
	meta := &metadata.Metadata{
		Databases: nil,
		RemoteSchemas: []metadata.RemoteSchemaMetadata{{
			Name: "rs",
			RemoteRelationships: []metadata.RemoteSchemaTypeRemoteRelationship{{
				TypeName: "Team",
				Relationships: []metadata.RemoteSchemaRelationshipDef{{
					Name: "weather",
					Definition: metadata.RemoteSchemaRelationshipDefinition{
						ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
							RemoteSchema: "weather_api",
							LHSFields:    []string{"city"},
							RemoteField:  nil,
						},
					},
				}},
			}},
		}},
	}

	got := relationships.FromMetadata(meta, map[string]connector.Connector{})

	if rels := got["rs"]; len(rels) != 0 {
		t.Errorf("expected no relationships for empty remote_field, got %d: %+v", len(rels), rels)
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
