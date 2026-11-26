package sql_test

import (
	"encoding/json"
	"log/slog"
	"testing"

	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/postgres"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,gocognit,cyclop // One isolated connector per variant; the role/SDL matrix intentionally shares its assertions.
func TestComputedAggregateSiblingCollisionKeepsRelationshipAndRole(t *testing.T) {
	for _, grant := range []bool{false, true} {
		t.Run(
			map[bool]string{false: "without grant", true: "with grant"}[grant],
			func(t *testing.T) {
				fixture := computedTestDB(t)
				if _, err := fixture.Exec(
					t.Context(),
					`CREATE FUNCTION cf_select.p14_collision(item cf_select.items)
				RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount $$`,
				); err != nil {
					t.Fatal(err)
				}

				md, err := metadata.FromHasuraJSON(computedFixture(t, "metadata.json"))
				if err != nil {
					t.Fatal(err)
				}

				parent := &md.Databases[0].Tables[0]
				parent.ArrayRelationships = append(
					parent.ArrayRelationships,
					metadata.ArrayRelationship{
						Name: "tags", Using: metadata.RelationshipUsing{
							ForeignKeyConstraint: &metadata.ForeignKeyConstraint{
								Table:   metadata.TableSource{Schema: "cf_select", Name: "tags"},
								Columns: []string{"item_id"},
							},
						},
					},
				)

				parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
					Name: "tags_aggregate", Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{
							Schema: "cf_select",
							Name:   "p14_collision",
						},
					},
				})
				if grant {
					parent.SelectPermissions[1].Permission.ComputedFields = append(
						parent.SelectPermissions[1].Permission.ComputedFields, "tags_aggregate")
				}

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
						item.Name == "cf_select.items.tags_aggregate" {
						found = true
					}

					if item.Kind == metadata.InconsistencyKindSelectPermission {
						t.Fatalf("collision revoked role: %+v", inc.Snapshot())
					}
				}

				if !found {
					t.Fatalf("missing collision inconsistency: %+v", inc.Snapshot())
				}

				schemas, err := conn.GetSchema()
				if err != nil {
					t.Fatal(err)
				}

				for _, role := range []string{"admin", "cf_reader", "cf_no_grant"} {
					defs := schemas[role].ToAST().Definitions

					row := defs.ForName("cf_select_items")
					if row == nil || row.Fields.ForName("id") == nil {
						t.Fatalf("lost %s role root", role)
					}

					if role == "cf_no_grant" {
						if row.Fields.ForName("tags") != nil ||
							row.Fields.ForName("tags_aggregate") != nil {
							t.Fatalf("target permission bypass in %s", role)
						}

						continue
					}

					if row.Fields.ForName("tags") == nil ||
						row.Fields.ForName("tags_aggregate") == nil ||
						row.Fields.ForName(
							"tags_aggregate",
						).Type.Name() != "cf_select_tags_aggregate" {
						t.Fatalf("genuine relationship lost in %s", role)
					}

					for _, name := range []string{"cf_select_items", "cf_select_items_order_by"} {
						var fields int
						for _, field := range defs.ForName(name).Fields {
							if field.Name == "tags_aggregate" {
								fields++
							}
						}

						if fields != 1 {
							t.Fatalf("%s %s has %d aggregate siblings", role, name, fields)
						}
					}
				}

				for _, role := range []string{"admin", "cf_reader"} {
					got, err := customArgumentQuery(
						t,
						conn,
						role,
						`{cf_select_items(where:{id:{_eq:1}}){id tags{id} tags_aggregate{aggregate{count}}}}`,
						nil,
					)
					if err != nil {
						t.Fatalf("%s relationship execution: %v", role, err)
					}

					b, err := json.Marshal(got)
					if err != nil ||
						string(
							b,
						) != `{"cf_select_items":[{"id":1,"tags":[{"id":1},{"id":2}],"tags_aggregate":{"aggregate":{"count":2}}}]}` {
						t.Fatalf("%s got %s: %v", role, b, err)
					}
				}
			},
		)
	}
}
