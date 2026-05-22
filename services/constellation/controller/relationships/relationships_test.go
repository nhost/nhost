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
