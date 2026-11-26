package controller_test

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestComputedJoinAggregateReturningPrevalidates checks that advertised but
// unbuildable aggregate siblings cannot report an error after committing a mutation.
//
//nolint:paralleltest,gocognit,cyclop // Variants share an isolated testdb and run serially to avoid catalog initialization races.
func TestComputedJoinAggregateReturningPrevalidates(t *testing.T) {
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

	ddl = append(ddl, []byte(`
CREATE TABLE cf_select.aggregate_kids (id integer primary key, label text, lbl text, owner_id integer);
INSERT INTO cf_select.aggregate_kids VALUES (101,'first','wrong',1);
`)...)
	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	for variantIndex, variant := range []struct {
		name    string
		mapping map[string]string
		config  map[string]metadata.ColumnConfig
	}{
		{"ambiguous", map[string]string{"item_label": "lbl"}, map[string]metadata.ColumnConfig{
			"label": {CustomName: "lbl"}, "lbl": {CustomName: "otherLabel"},
		}},
		{"renamed", map[string]string{"item_label": "itemLabel"}, map[string]metadata.ColumnConfig{
			"label": {CustomName: "itemLabel"},
		}},
		{"composite", map[string]string{"item_label": "label", "owner_id": "owner_id"}, nil},
	} {
		t.Run(variant.name, func(t *testing.T) {
			md, parseErr := metadata.FromHasuraJSON(raw)
			if parseErr != nil {
				t.Fatal(parseErr)
			}

			for i := range md.Databases {
				md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
					pool.Config().ConnConfig.ConnString(),
				)
			}

			items := &md.Databases[0].Tables[0]
			items.RemoteRelationships = append(
				items.RemoteRelationships,
				metadata.RemoteRelationship{
					Name: "aggregate_kids", Definition: metadata.RemoteRelationshipDef{
						ToSource: &metadata.ToSourceRelationship{
							FieldMapping:     variant.mapping,
							RelationshipType: metadata.RelationshipTypeArray,
							Source:           "cf_select",
							Table: metadata.TableSource{
								Schema: "cf_select",
								Name:   "aggregate_kids",
							},
						},
					},
				},
			)
			items.SelectPermissions[1].Permission.Columns = append(
				items.SelectPermissions[1].Permission.Columns, "owner_id",
			)
			items.InsertPermissions = append(items.InsertPermissions, metadata.InsertPermission{
				Role: "cf_reader", Permission: metadata.InsertPermissionConfig{
					Columns: []string{"id", "owner_id", "label", "amount", "payload"},
					Check:   map[string]any{},
				},
			})
			items.UpdatePermissions = append(items.UpdatePermissions, metadata.UpdatePermission{
				Role: "cf_reader", Permission: metadata.UpdatePermissionConfig{
					Columns: []string{"label"}, Filter: map[string]any{}, Check: map[string]any{},
				},
			})
			md.Databases[0].Tables = append(md.Databases[0].Tables, metadata.TableMetadata{
				Table:         metadata.TableSource{Schema: "cf_select", Name: "aggregate_kids"},
				Configuration: metadata.TableConfiguration{ColumnConfig: variant.config},
				SelectPermissions: []metadata.SelectPermission{{
					Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "label", "owner_id"}, AllowAggregations: true,
					},
				}},
			})

			ctrl, newErr := newComputedController(t, md, false)
			if newErr != nil {
				t.Fatal(newErr)
			}

			if len(ctrl.Inconsistencies()) != 0 {
				t.Fatalf("inconsistencies: %+v", ctrl.Inconsistencies())
			}

			for roleIndex, role := range []string{"admin", "cf_reader"} {
				h := http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}
				if role != "admin" {
					h.Set("X-Hasura-Role", role)
				}

				ctx := runSessionMiddleware(t, h)
				for operationIndex, operation := range []string{"single insert", "collection insert", "update"} {
					t.Run(role+"/"+operation, func(t *testing.T) {
						id := 91000 + variantIndex*100 + roleIndex*10 + operationIndex

						var query string
						switch operation {
						case "single insert":
							query = fmt.Sprintf(
								`mutation { insert_cf_select_items_one(object:{id:%d,owner_id:1,label:"first",amount:1,payload:{}}) { id aggregate_kids_aggregate { aggregate { count } } } }`,
								id,
							)
						case "collection insert":
							query = fmt.Sprintf(
								`mutation { insert_cf_select_items(objects:[{id:%d,owner_id:1,label:"first",amount:1,payload:{}}]) { returning { id aggregate_kids_aggregate { aggregate { count } } } } }`,
								id,
							)
						case "update":
							if _, err := pool.Exec(
								ctx,
								`INSERT INTO cf_select.items (id,owner_id,label,amount,payload) VALUES ($1,1,'first',1,'{}')`,
								id,
							); err != nil {
								t.Fatal(err)
							}

							query = fmt.Sprintf(
								`mutation { update_cf_select_items(where:{id:{_eq:%d}},_set:{label:"changed"}) { returning { id aggregate_kids_aggregate { aggregate { count } } } } }`,
								id,
							)
						}

						response, resolveErr := ctrl.Resolve(
							ctx,
							controller.GraphQLRequest{Query: query},
						)
						if resolveErr != nil || response == nil || response.Data != nil {
							t.Fatalf("mutation response=%+v err=%v", response, resolveErr)
						}

						errs, ok := response.Errors.([]map[string]any)
						if !ok || len(errs) != 1 || errs[0]["extensions"] != nil ||
							!strings.HasPrefix(
								fmt.Sprint(errs[0]["message"]),
								"internal server error (trace id:",
							) ||
							strings.Contains(fmt.Sprint(errs[0]), "otherLabel") {
							t.Fatalf("aggregate error was not sanitized: %+v", response.Errors)
						}

						var (
							count int
							label string
						)
						if err := pool.QueryRow(ctx, `SELECT count(*),coalesce(max(label),'') FROM cf_select.items WHERE id=$1`, id).
							Scan(&count, &label); err != nil {
							t.Fatal(err)
						}

						if (operation == "update" && (count != 1 || label != "first")) ||
							(operation != "update" && count != 0) {
							t.Fatalf(
								"failed aggregate returning persisted row id=%d count=%d label=%q",
								id,
								count,
								label,
							)
						}
					})
				}
			}
		})
	}
}
