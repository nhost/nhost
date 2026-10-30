package sql_test

import (
	"encoding/json"
	"log/slog"
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,gocognit,cyclop // The fixture owns a connector; schema, grant and execution assertions share it.
func TestComputedAggregateOrderCollisionKeepsGenuineObjectOrder(t *testing.T) {
	fixture := computedTestDB(t)

	md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
	if err != nil {
		t.Fatal(err)
	}

	parent := &md.Databases[0].Tables[0]
	parent.ObjectRelationships = append(parent.ObjectRelationships, metadata.ObjectRelationship{
		Name: "item_tags_aggregate", Using: metadata.RelationshipUsing{
			ManualConfiguration: &metadata.ManualConfiguration{
				RemoteTable:   metadata.TableSource{Schema: "cf_select", Name: "tags"},
				ColumnMapping: map[string]string{"id": "id"},
			},
		},
	})

	pool, err := postgres.Open(t.Context(), fixture.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}

	inc := metadata.NewInconsistencies()

	conn, err := csql.NewConnector(
		t.Context(),
		postgres.NewClient(pool),
		&md.Databases[0],
		inc,
		slog.Default(),
	)
	if err != nil {
		pool.Close()
		t.Fatal(err)
	}

	t.Cleanup(conn.Close)

	found := false
	for _, item := range inc.Snapshot() {
		if item.Kind == metadata.InconsistencyKindComputedField &&
			item.Name == "cf_select.items.item_tags" {
			found = true
		}

		if item.Kind == metadata.InconsistencyKindSelectPermission {
			t.Fatalf("lost role permission: %+v", item)
		}
	}

	if !found {
		t.Fatalf("missing field-local inconsistency: %+v", inc.Snapshot())
	}

	schemas, err := conn.GetSchema()
	if err != nil {
		t.Fatal(err)
	}

	for _, role := range []string{"admin", "cf_reader"} {
		if _, _, err := schemamerge.BuildValidatedSchema(schemas[role], role); err != nil {
			t.Fatalf("%s schema invalid: %v", role, err)
		}

		defs := schemas[role].ToAST().Definitions

		row := defs.ForName("cf_select_items")
		if row == nil || row.Fields.ForName("id") == nil ||
			row.Fields.ForName("item_tags") != nil ||
			row.Fields.ForName("item_tags_aggregate") == nil {
			t.Fatalf("%s row fields lost or ambiguous computed selection survived", role)
		}

		order := defs.ForName("cf_select_items_order_by")

		var count int
		for _, field := range order.Fields {
			if field.Name == "item_tags_aggregate" {
				count++

				if field.Type.Name() != "cf_select_tags_order_by" {
					t.Fatalf("%s wrong order type %s", role, field.Type.Name())
				}
			}
		}

		if count != 1 {
			t.Fatalf("%s has %d genuine order keys", role, count)
		}

		got, err := customArgumentQuery(
			t,
			conn,
			role,
			`{cf_select_items(order_by:{item_tags_aggregate:{label:desc}}){id item_tags_aggregate{id}}}`,
			nil,
		)
		if err != nil {
			t.Fatalf("%s genuine object order failed: %v", role, err)
		}

		encoded, err := json.Marshal(got)
		if err != nil ||
			string(
				encoded,
			) != `{"cf_select_items":[{"id":2,"item_tags_aggregate":{"id":2}},{"id":1,"item_tags_aggregate":{"id":1}}]}` {
			t.Fatalf("%s wrong ordered result: %s, %v", role, encoded, err)
		}
	}
}
