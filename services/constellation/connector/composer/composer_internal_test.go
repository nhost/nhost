package composer

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// stubSchemaProvider is an inline stub implementing SchemaProvider for
// white-box tests that cannot import the mock/ subpackage (import cycle).
type stubSchemaProvider struct {
	typeName string
}

func (s stubSchemaProvider) GetSchema() (map[string]*graph.Schema, error) {
	return nil, nil //nolint:nilnil
}

func (s stubSchemaProvider) GetTypeName(identifier string) string {
	return s.typeName + ":" + identifier
}

func TestComposer_typeNameResolvers(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		providers map[string]SchemaProvider
	}{
		{
			name:      "no_providers",
			providers: map[string]SchemaProvider{},
		},
		{
			name: "single_provider",
			providers: map[string]SchemaProvider{
				"db": stubSchemaProvider{typeName: "db"},
			},
		},
		{
			name: "multiple_providers",
			providers: map[string]SchemaProvider{
				"db1": stubSchemaProvider{typeName: "db1"},
				"db2": stubSchemaProvider{typeName: "db2"},
				"rs":  stubSchemaProvider{typeName: "rs"},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			c := New(
				tt.providers,
				&metadata.Metadata{Databases: nil, RemoteSchemas: nil},
				nil,
			)

			resolvers := c.typeNameResolvers()

			if got, want := len(resolvers), len(tt.providers); got != want {
				t.Fatalf("expected %d resolvers, got %d", want, got)
			}

			for name, provider := range tt.providers {
				resolver, ok := resolvers[name]
				if !ok {
					t.Errorf("provider %q missing from resolvers map", name)

					continue
				}

				// Identity check: the resolver entry must be the same
				// SchemaProvider value passed in, so type-name resolution
				// is routed to the right connector. Verify by calling
				// through and comparing against the provider's response.
				const ident = "schema.table"

				if got, want := resolver.GetTypeName(
					ident,
				), provider.GetTypeName(
					ident,
				); got != want {
					t.Errorf(
						"resolver for %q routed to wrong provider: got %q, want %q",
						name, got, want,
					)
				}
			}
		})
	}
}

// TestDBRelationshipSpec covers the branches of the metadata→spec translator
// for relationships rooted in a database table: db→db (ToSource), db→rs
// (ToRemoteSchema with a non-empty path), the db→rs empty-path skip, and the
// neither-set fall-through.
func TestDBRelationshipSpec(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		rel     metadata.RemoteRelationship
		wantOK  bool
		wantSrc string // SourceConnector
		wantTgt string // TargetConnector
		wantArr bool   // IsArray
		wantDsc string // ObjectDescription
	}{
		{
			name: "db_to_db_array",
			rel: metadata.RemoteRelationship{
				Name: "members",
				Definition: metadata.RemoteRelationshipDef{
					ToSource: &metadata.ToSourceRelationship{
						RelationshipType: metadata.RelationshipTypeArray,
						Source:           "default",
						Table: metadata.TableSource{
							Schema: "public", Name: "members",
						},
						FieldMapping: nil,
					},
					ToRemoteSchema: nil,
				},
			},
			wantOK:  true,
			wantSrc: "db1",
			wantTgt: "default",
			wantArr: true,
			wantDsc: "",
		},
		{
			name: "db_to_db_object",
			rel: metadata.RemoteRelationship{
				Name: "owner",
				Definition: metadata.RemoteRelationshipDef{
					ToSource: &metadata.ToSourceRelationship{
						RelationshipType: metadata.RelationshipTypeObject,
						Source:           "default",
						Table: metadata.TableSource{
							Schema: "public", Name: "users",
						},
						FieldMapping: nil,
					},
					ToRemoteSchema: nil,
				},
			},
			wantOK:  true,
			wantSrc: "db1",
			wantTgt: "default",
			wantArr: false,
			wantDsc: "An object relationship",
		},
		{
			name: "db_to_rs",
			rel: metadata.RemoteRelationship{
				Name: "country",
				Definition: metadata.RemoteRelationshipDef{
					ToSource: nil,
					ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
						RemoteSchema: "rs",
						LHSFields:    []string{"country_code"},
						RemoteField: map[string]metadata.RemoteFieldCall{
							"country": {
								Arguments: map[string]string{
									"code": "$country_code",
								},
								Field: nil,
							},
						},
					},
				},
			},
			wantOK:  true,
			wantSrc: "db1",
			wantTgt: "rs",
			wantArr: false,
			wantDsc: "",
		},
		{
			name: "db_to_rs_empty_path",
			rel: metadata.RemoteRelationship{
				Name: "broken",
				Definition: metadata.RemoteRelationshipDef{
					ToSource: nil,
					ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
						RemoteSchema: "rs",
						LHSFields:    nil,
						RemoteField:  nil,
					},
				},
			},
			wantOK: false,
		},
		{
			name: "neither_set",
			rel: metadata.RemoteRelationship{
				Name: "bare",
				Definition: metadata.RemoteRelationshipDef{
					ToSource:       nil,
					ToRemoteSchema: nil,
				},
			},
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec, ok := dbRelationshipSpec("db1", "users", tt.rel)
			if ok != tt.wantOK {
				t.Fatalf("dbRelationshipSpec ok = %v, want %v", ok, tt.wantOK)
			}

			if !ok {
				return
			}

			if spec.SourceConnector != tt.wantSrc {
				t.Errorf("SourceConnector = %q, want %q", spec.SourceConnector, tt.wantSrc)
			}

			if spec.TargetConnector != tt.wantTgt {
				t.Errorf("TargetConnector = %q, want %q", spec.TargetConnector, tt.wantTgt)
			}

			if spec.IsArray != tt.wantArr {
				t.Errorf("IsArray = %v, want %v", spec.IsArray, tt.wantArr)
			}

			if spec.ObjectDescription != tt.wantDsc {
				t.Errorf(
					"ObjectDescription = %q, want %q",
					spec.ObjectDescription, tt.wantDsc,
				)
			}
		})
	}
}

// TestRSRelationshipSpec covers the rs→db happy path and the nil-ToSource
// skip (rs→rs is not supported and is currently the only other shape).
func TestRSRelationshipSpec(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		rel     metadata.RemoteSchemaRelationshipDef
		wantOK  bool
		wantArr bool
	}{
		{
			name: "rs_to_db_array",
			rel: metadata.RemoteSchemaRelationshipDef{
				Name: "users",
				Definition: metadata.RemoteSchemaRelationshipDefinition{
					ToSource: &metadata.RemoteSchemaToSourceRelationship{
						RelationshipType: metadata.RelationshipTypeArray,
						Source:           "default",
						Table: metadata.RemoteSchemaTableRef{
							Schema: "public", Name: "users",
						},
						FieldMapping: nil,
					},
				},
			},
			wantOK:  true,
			wantArr: true,
		},
		{
			name: "rs_to_db_object",
			rel: metadata.RemoteSchemaRelationshipDef{
				Name: "owner",
				Definition: metadata.RemoteSchemaRelationshipDefinition{
					ToSource: &metadata.RemoteSchemaToSourceRelationship{
						RelationshipType: metadata.RelationshipTypeObject,
						Source:           "default",
						Table: metadata.RemoteSchemaTableRef{
							Schema: "public", Name: "users",
						},
						FieldMapping: nil,
					},
				},
			},
			wantOK:  true,
			wantArr: false,
		},
		{
			name: "nil_to_source_skipped",
			rel: metadata.RemoteSchemaRelationshipDef{
				Name: "bare",
				Definition: metadata.RemoteSchemaRelationshipDefinition{
					ToSource: nil,
				},
			},
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec, ok := rsRelationshipSpec("rs", "Country", tt.rel)
			if ok != tt.wantOK {
				t.Fatalf("rsRelationshipSpec ok = %v, want %v", ok, tt.wantOK)
			}

			if !ok {
				return
			}

			if spec.IsArray != tt.wantArr {
				t.Errorf("IsArray = %v, want %v", spec.IsArray, tt.wantArr)
			}

			// rs→db never synthesises an object description.
			if spec.ObjectDescription != "" {
				t.Errorf(
					"ObjectDescription = %q, want empty",
					spec.ObjectDescription,
				)
			}
		})
	}
}

// TestRelationshipSpecs_SkipsEnumAndMissingConnector verifies the two
// composer-level guards that the M3 refactor moved out of relationships.go:
// IsEnum tables are skipped, and tables whose database has no provider in the
// resolver map are skipped without erroring.
func TestRelationshipSpecs_SkipsEnumAndMissingConnector(t *testing.T) {
	t.Parallel()

	// db1 has one enum table (skipped) and one normal table whose
	// relationship should be collected. db2 has a normal table but no
	// matching SchemaProvider — the whole database is skipped.
	md := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{
			{
				Name: "db1",
				Tables: []metadata.TableMetadata{
					{
						Table:  metadata.TableSource{Schema: "public", Name: "roles"},
						IsEnum: true,
						RemoteRelationships: []metadata.RemoteRelationship{
							{
								Name: "should_be_skipped",
								Definition: metadata.RemoteRelationshipDef{
									ToSource: &metadata.ToSourceRelationship{
										RelationshipType: metadata.RelationshipTypeArray,
										Source:           "db2",
										Table: metadata.TableSource{
											Schema: "public", Name: "members",
										},
										FieldMapping: nil,
									},
									ToRemoteSchema: nil,
								},
							},
						},
					},
					{
						Table:  metadata.TableSource{Schema: "public", Name: "users"},
						IsEnum: false,
						RemoteRelationships: []metadata.RemoteRelationship{
							{
								Name: "members",
								Definition: metadata.RemoteRelationshipDef{
									ToSource: &metadata.ToSourceRelationship{
										RelationshipType: metadata.RelationshipTypeArray,
										Source:           "db2",
										Table: metadata.TableSource{
											Schema: "public", Name: "members",
										},
										FieldMapping: nil,
									},
									ToRemoteSchema: nil,
								},
							},
						},
					},
				},
			},
			{
				Name: "db2_missing_provider",
				Tables: []metadata.TableMetadata{
					{
						Table:  metadata.TableSource{Schema: "public", Name: "members"},
						IsEnum: false,
						RemoteRelationships: []metadata.RemoteRelationship{
							{
								Name: "owner",
								Definition: metadata.RemoteRelationshipDef{
									ToSource: &metadata.ToSourceRelationship{
										RelationshipType: metadata.RelationshipTypeObject,
										Source:           "db1",
										Table: metadata.TableSource{
											Schema: "public", Name: "users",
										},
										FieldMapping: nil,
									},
									ToRemoteSchema: nil,
								},
							},
						},
					},
				},
			},
		},
	}

	c := &Composer{
		providers: map[string]SchemaProvider{
			"db1": stubSchemaProvider{typeName: "db1"},
			// db2_missing_provider is intentionally absent.
		},
		meta:            md,
		inconsistencies: metadata.NewInconsistencies(),
	}

	specs := c.relationshipSpecs()

	if len(specs) != 1 {
		t.Fatalf("expected 1 spec, got %d: %+v", len(specs), specs)
	}

	if specs[0].Name != "members" {
		t.Errorf("expected only the non-enum spec to survive, got %q", specs[0].Name)
	}
}
