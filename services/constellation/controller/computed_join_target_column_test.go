package controller_test

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestComputedJoinTargetRequiresSelectableColumn pins the column identity gate:
// a relationship named like the SQL name of a denied, renamed column cannot
// authorize a computed-key join through that column.
//
//nolint:gocognit,gocyclo,cyclop,maintidx // End-to-end authorization and execution controls share one isolated fixture.
func TestComputedJoinTargetRequiresSelectableColumn(t *testing.T) {
	t.Parallel()

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

	base, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	ddl = append(ddl, []byte(`
CREATE TABLE cf_select.target_column_kids (id integer primary key, label text, lbl text, visible integer);
INSERT INTO cf_select.target_column_kids VALUES
(101,'first','wrong',1),(102,'first','wrong',0),(201,'second','wrong',1),
(901,'wrong','first',1),(902,'wrong','second',1);
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range base.Databases {
		base.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	for _, target := range []struct {
		name, source, schema string
	}{
		{"postgres", "cf_select", "cf_select"},
		{"sqlite", "sqlite_target_columns", ""},
	} {
		t.Run(target.name, func(t *testing.T) {
			t.Parallel()

			md := *base
			md.Databases = append([]metadata.DatabaseMetadata(nil), base.Databases...)
			md.Databases[0].Tables = append(
				[]metadata.TableMetadata(nil),
				base.Databases[0].Tables...)
			items := &md.Databases[0].Tables[0]
			items.RemoteRelationships = append(
				[]metadata.RemoteRelationship(nil),
				items.RemoteRelationships...)

			for _, mapping := range []struct{ rel, field string }{
				{"rel_kids", "lbl"}, {"good_kids", "itemLabel"},
			} {
				items.RemoteRelationships = append(
					items.RemoteRelationships,
					metadata.RemoteRelationship{
						Name: mapping.rel, Definition: metadata.RemoteRelationshipDef{
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping:     map[string]string{"item_label": mapping.field},
								RelationshipType: metadata.RelationshipTypeArray,
								Source:           target.source,
								Table: metadata.TableSource{
									Schema: target.schema,
									Name:   "target_column_kids",
								},
							},
						},
					},
				)
			}

			if target.name == "sqlite" {
				path := testdb.SQLitePath(t, `CREATE TABLE target_column_kids
					(id integer primary key, label text, lbl text, visible integer);
					INSERT INTO target_column_kids VALUES
					(101,'first','wrong',1),(102,'first','wrong',0),(201,'second','wrong',1),
					(901,'wrong','first',1),(902,'wrong','second',1);`)
				md.Databases = append(md.Databases, metadata.DatabaseMetadata{
					Name: target.source, Kind: "sqlite",
					Configuration: metadata.DatabaseConfiguration{
						ConnectionInfo: metadata.DatabaseConnectionInfo{
							DatabaseURL: metadata.EnvString(path),
						},
					},
				})
			}

			targetDB := 0
			if target.name == "sqlite" {
				targetDB = len(md.Databases) - 1
			}

			md.Databases[targetDB].Tables = append(
				md.Databases[targetDB].Tables,
				metadata.TableMetadata{
					Table: metadata.TableSource{Schema: target.schema, Name: "target_column_kids"},
					Configuration: metadata.TableConfiguration{
						ColumnConfig: map[string]metadata.ColumnConfig{
							"label": {CustomName: "itemLabel"}, "lbl": {CustomName: "otherLabel"},
						},
					},
					ObjectRelationships: []metadata.ObjectRelationship{{
						Name: "lbl", Using: metadata.RelationshipUsing{
							ManualConfiguration: &metadata.ManualConfiguration{
								RemoteTable: metadata.TableSource{
									Schema: target.schema,
									Name:   "target_column_kids",
								},
								ColumnMapping: map[string]string{"id": "id"},
							},
						},
					}},
					SelectPermissions: []metadata.SelectPermission{{
						Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
							Columns: []string{"id", "label"}, Filter: map[string]any{
								"visible": map[string]any{"_eq": 1},
							}, AllowAggregations: true,
						},
					}},
				},
			)

			ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
				middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: &md},
				slog.New(slog.DiscardHandler), "", nil)
			if err != nil {
				t.Fatal(err)
			}

			if len(ctrl.Inconsistencies()) != 0 {
				t.Fatalf("inconsistencies: %+v", ctrl.Inconsistencies())
			}

			for _, role := range []struct {
				name   string
				header http.Header
			}{
				{"reader", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"}}},
				{"admin", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}},
			} {
				ctx := runSessionMiddleware(t, role.header)

				response, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{
					Query: `{ __type(name:"cf_select_items") { fields { name } } }`,
				})
				if resolveErr != nil || response.Errors != nil {
					t.Fatalf("%s SDL response=%+v err=%v", role.name, response, resolveErr)
				}

				encoded, err := json.Marshal(response.Data)
				if err != nil {
					t.Fatal(err)
				}

				targetType := "cf_select_target_column_kids"
				if target.name == "sqlite" {
					targetType = "target_column_kids"
				}

				for _, probe := range []struct {
					typeName, member string
					present          bool
				}{
					{targetType, "lbl", true}, // The relationship exists; it is not a column.
					{targetType, "otherLabel", role.name == "admin"},
					{targetType + "_select_column", "lbl", false},
					{targetType + "_select_column", "itemLabel", true},
				} {
					probeResult, probeErr := ctrl.Resolve(
						ctx,
						controller.GraphQLRequest{Query: fmt.Sprintf(
							`{ __type(name:%q) { fields { name } enumValues { name } } }`,
							probe.typeName,
						)},
					)
					if probeErr != nil || probeResult.Errors != nil {
						t.Fatalf(
							"%s target SDL response=%+v err=%v",
							role.name,
							probeResult,
							probeErr,
						)
					}

					value, marshalErr := json.Marshal(probeResult.Data)
					if marshalErr != nil {
						t.Fatal(marshalErr)
					}

					if strings.Contains(
						string(value),
						`"name":"`+probe.member+`"`,
					) != probe.present {
						t.Errorf(
							"%s target %s member %s: %s",
							role.name,
							probe.typeName,
							probe.member,
							value,
						)
					}
				}

				// Exercise both vulnerable execution sinks even on a reverted gate:
				// a revert must fail on returned hidden-column rows, not just SDL.
				for _, sink := range []struct{ name, selection string }{
					{"paginated", `rel_kids(order_by:{id:asc},limit:5) { id }`},
					{"aggregate", `rel_kids_aggregate { aggregate { count } nodes { id } }`},
				} {
					query := fmt.Sprintf(
						`{ cf_select_items(where:{id:{_in:[1,2]}},order_by:{id:asc}) {
						id %s } }`,
						sink.selection,
					)

					got, queryErr := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: query})
					switch {
					case queryErr == nil && got.Errors == nil:
						t.Errorf(
							"%s %s leaked hidden column rows: %+v",
							role.name,
							sink.name,
							got.Data,
						)
					case got.Data != nil:
						t.Errorf(
							"%s %s returned partial data: %+v err=%v",
							role.name,
							sink.name,
							got,
							queryErr,
						)
					case queryErr != nil || !strings.Contains(fmt.Sprint(got.Errors), "rel_kids"):
						t.Errorf(
							"%s %s did not fail GraphQL validation: %+v err=%v",
							role.name,
							sink.name,
							got,
							queryErr,
						)
					}
				}

				for _, field := range []string{"rel_kids", "rel_kids_aggregate"} {
					if strings.Contains(string(encoded), `"name":"`+field+`"`) {
						t.Errorf("%s exposed %s: %s", role.name, field, encoded)
					}
				}

				if !strings.Contains(string(encoded), `"name":"good_kids"`) {
					t.Fatalf("%s lost selectable renamed-column mapping: %s", role.name, encoded)
				}

				positive, queryErr := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: `{
					cf_select_items(where:{id:{_in:[1,2]}},order_by:{id:asc}) {
						id good_kids(order_by:{id:asc},limit:5) { id }
					} }`})
				if queryErr != nil || positive.Errors != nil {
					t.Fatalf("%s positive response=%+v err=%v", role.name, positive, queryErr)
				}

				rows := sqliteJSONRows(t, positive.Data)

				want := []any{map[string]any{"id": float64(101)}}
				if role.name == "admin" {
					want = append(want, map[string]any{"id": float64(102)})
				}

				if !reflect.DeepEqual(rows[0]["good_kids"], want) ||
					!reflect.DeepEqual(
						rows[1]["good_kids"],
						[]any{map[string]any{"id": float64(201)}},
					) {
					t.Fatalf("%s positive rows: %#v", role.name, rows)
				}
			}
		})
	}
}
