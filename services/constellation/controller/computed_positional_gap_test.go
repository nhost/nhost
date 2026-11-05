package controller_test

import (
	"os"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// The invalid computed selection is on another source or on a remote target:
// both paths must reject the mutation before any root writes are executed.
//
//nolint:paralleltest // One fixture and two SQL connectors share the isolated schema.
func TestComputedPositionalGapRejectsMutationBeforeWrites(t *testing.T) {
	ddl, err := os.ReadFile(
		"../integration/nhost/migrations/default/1790001000000_computed_fields/up.sql",
	)
	if err != nil {
		t.Fatal(err)
	}

	seed, err := os.ReadFile("../integration/nhost/seeds/default/40-computed-fields.sql")
	if err != nil {
		t.Fatal(err)
	}

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.item_gap(cf_select.items, integer DEFAULT 1, integer DEFAULT 2)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT $2 + $3 $$;
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	md.Databases[0].Tables[0].ComputedFields = append(md.Databases[0].Tables[0].ComputedFields,
		metadata.ComputedField{
			Name: "item_gap",
			Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_gap"},
			},
		})
	md.Databases[1].Tables[0].RemoteRelationships = append(
		md.Databases[1].Tables[0].RemoteRelationships,
		metadata.RemoteRelationship{
			Name: "items",
			Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"owner_id": "id"},
				RelationshipType: metadata.RelationshipTypeArray,
				Source:           "cf_select",
				Table:            metadata.TableSource{Schema: "cf_select", Name: "items"},
			}},
		},
	)

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query, path string
		insertedID        int
	}{
		{
			name: "remote returning",
			query: `mutation { insert_cf_predicates_rules(objects:[{id:50,owner_id:1,label:"new"}]) {
				returning { id items { id item_gap(args:{arg_2:5}) } }
			} }`,
			path:       "$.selectionSet.insert_cf_predicates_rules.selectionSet.returning.selectionSet.items.selectionSet.item_gap.args.args",
			insertedID: 50,
		},
		{
			name: "two sources",
			query: `mutation {
				a: insert_cf_predicates_rules(objects:[{id:51,owner_id:1,label:"new"}]) { affected_rows }
				b: insert_cf_select_items(objects:[{id:51,owner_id:1,label:"new",amount:1,payload:{}}]) {
					returning { id item_gap(args:{arg_2:5}) }
				}
			}`,
			path:       "$.selectionSet.insert_cf_select_items.selectionSet.returning.selectionSet.item_gap.args.args",
			insertedID: 51,
		},
	} { //nolint:paralleltest // Both cases share one controller and database.
		t.Run(tc.name, func(t *testing.T) {
			response, err := ctrl.Resolve(
				adminSessionContext(t),
				controller.GraphQLRequest{Query: tc.query},
			)
			if err != nil {
				t.Fatal(err)
			}

			want := []map[string]any{{
				"message":    `cannot omit positional computed argument "arg_1"`,
				"extensions": map[string]any{"code": "validation-failed", "path": tc.path},
			}}
			if response.Data != nil || !reflect.DeepEqual(response.Errors, want) {
				t.Fatalf("mutation was not rejected before execution: %+v", response)
			}

			for _, table := range []string{"cf_predicates.rules", "cf_select.items"} {
				var count int
				if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM "+table+" WHERE id=$1", tc.insertedID).
					Scan(&count); err != nil {
					t.Fatal(err)
				}

				if count != 0 {
					t.Fatalf("%s persisted %d rows after rejected mutation", table, count)
				}
			}
		})
	}
}
