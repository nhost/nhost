package source

import (
	"errors"
	"testing"

	"github.com/nhost/nhost/services/constellation/metadata/internal/hasura"
)

func table(schema, name string) hasura.TableSource {
	return hasura.TableSource{Schema: schema, Name: name, Unknown: nil}
}

func sameTable(a, b hasura.TableSource) bool {
	return a.Schema == b.Schema && a.Name == b.Name
}

func objectSuggestion(from, to hasura.TableSource) suggestedRelationship {
	return suggestedRelationship{
		Type: "object",
		From: relationshipEndpoint{Table: from, Columns: []string{"id"}},
		To:   relationshipEndpoint{Table: to, Columns: []string{"id"}},
	}
}

// fkConstraintRel builds an ObjectRelationship tracked via the object form of
// foreign_key_constraint_on (target table + column), the shape Hasura emits for
// pg_create_object_relationship using foreign_key_constraint_on.
func fkConstraintRel(name string, target hasura.TableSource) hasura.ObjectRelationship {
	return hasura.ObjectRelationship{
		Name: name,
		Using: hasura.RelationshipUsing{
			ForeignKeyColumns: nil,
			ForeignKeyConstraint: &hasura.ForeignKeyConstraint{
				Columns: []string{"id"},
				Table:   target,
				Unknown: nil,
			},
			ManualConfiguration: nil,
			Unknown:             nil,
		},
		Unknown: nil,
	}
}

// manualConfigRel builds an ObjectRelationship tracked via manual_configuration
// (remote_table + column_mapping), the shape Hasura emits for a relationship
// created with manual_configuration rather than a foreign key.
func manualConfigRel(name string, remote hasura.TableSource) hasura.ObjectRelationship {
	return hasura.ObjectRelationship{
		Name: name,
		Using: hasura.RelationshipUsing{
			ForeignKeyColumns:    nil,
			ForeignKeyConstraint: nil,
			ManualConfiguration: &hasura.ManualConfiguration{
				RemoteTable:   remote,
				ColumnMapping: map[string]string{"id": "id"},
				Source:        "",
				RemoteSchema:  "",
				LHSFields:     nil,
				RemoteField:   nil,
				Unknown:       nil,
			},
			Unknown: nil,
		},
		Unknown: nil,
	}
}

func TestFilterTrackedRels_ForeignKeyConstraintOn(t *testing.T) {
	t.Parallel()

	orders := table("public", "orders")
	customers := table("public", "customers")
	products := table("public", "products")

	tests := []struct {
		name        string
		rels        []hasura.ObjectRelationship
		suggestions []suggestedRelationship
		want        []suggestedRelationship
	}{
		{
			name: "filters relationship tracked via foreign_key_constraint_on",
			rels: []hasura.ObjectRelationship{fkConstraintRel("customer", customers)},
			suggestions: []suggestedRelationship{
				objectSuggestion(orders, customers),
			},
			want: nil,
		},
		{
			name: "keeps not-yet-tracked FK suggestion",
			rels: []hasura.ObjectRelationship{fkConstraintRel("customer", customers)},
			suggestions: []suggestedRelationship{
				objectSuggestion(orders, customers),
				objectSuggestion(orders, products),
			},
			want: []suggestedRelationship{
				objectSuggestion(orders, products),
			},
		},
		{
			name: "filters relationship tracked via manual_configuration",
			rels: []hasura.ObjectRelationship{manualConfigRel("customer", customers)},
			suggestions: []suggestedRelationship{
				objectSuggestion(orders, customers),
			},
			want: nil,
		},
		{
			name: "keeps suggestion when manual_configuration targets a different table",
			rels: []hasura.ObjectRelationship{manualConfigRel("customer", customers)},
			suggestions: []suggestedRelationship{
				objectSuggestion(orders, products),
			},
			want: []suggestedRelationship{
				objectSuggestion(orders, products),
			},
		},
		{
			name: "keeps everything when nothing is tracked",
			rels: nil,
			suggestions: []suggestedRelationship{
				objectSuggestion(orders, customers),
				objectSuggestion(orders, products),
			},
			want: []suggestedRelationship{
				objectSuggestion(orders, customers),
				objectSuggestion(orders, products),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			h := &hasura.Metadata{
				Databases: []hasura.DatabaseMetadata{{
					Name:          "default",
					Kind:          "postgres",
					Configuration: hasura.DatabaseConfiguration{},
					Customization: hasura.DatabaseSourceCustomization{},
					Tables: []hasura.TableMetadata{{
						Table:               orders,
						IsEnum:              false,
						Configuration:       hasura.TableConfiguration{},
						ObjectRelationships: tt.rels,
						ArrayRelationships:  nil,
						RemoteRelationships: nil,
						SelectPermissions:   nil,
						InsertPermissions:   nil,
						UpdatePermissions:   nil,
						DeletePermissions:   nil,
						EventTriggers:       nil,
						Unknown:             nil,
					}},
					Functions: nil,
					Unknown:   nil,
				}},
				RemoteSchemas: nil,
				Unknown:       nil,
			}

			got := filterTrackedRels(tt.suggestions, h, "default")

			if len(got) != len(tt.want) {
				t.Fatalf("filterTrackedRels returned %d suggestions, want %d: %+v",
					len(got), len(tt.want), got)
			}

			for i := range tt.want {
				if got[i].Type != tt.want[i].Type ||
					!sameTable(got[i].From.Table, tt.want[i].From.Table) ||
					!sameTable(got[i].To.Table, tt.want[i].To.Table) {
					t.Errorf("suggestion[%d] = %+v, want %+v", i, got[i], tt.want[i])
				}
			}
		})
	}
}

// TestStore_PgGetViewdef_RequiresDB asserts a read op on a Store with no
// Queryer (a non-database-backed Store) returns ErrReadOpRequiresDB. The
// controller's mapping of that sentinel to the "not-supported" wire code is
// covered separately by TestDispatch_PgGetViewdef_NoDB_NotSupported.
func TestStore_PgGetViewdef_RequiresDB(t *testing.T) {
	t.Parallel()

	s := bootstrappedStore(t, &fakeWriter{})

	_, err := s.PgGetViewdef(t.Context(),
		[]byte(`{"source":"default","table":{"schema":"public","name":"v"}}`))
	if !errors.Is(err, ErrReadOpRequiresDB) {
		t.Errorf("err = %v, want ErrReadOpRequiresDB", err)
	}
}
