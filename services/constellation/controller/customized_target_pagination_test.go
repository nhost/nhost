package controller_test

import (
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"reflect"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestCustomizedTargetPerParentWindow pins the root-customized target's grouped
// SQL path, which must window each key independently rather than applying a
// global limit to the two-parent batch.
//
//nolint:gocognit,cyclop,paralleltest,tparallel // Target variants initialize catalog functions over the same fixture schema; serialize subtests.
func TestCustomizedTargetPerParentWindow(t *testing.T) {
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
CREATE TABLE cf_select.window_kids (id integer primary key, label text);
INSERT INTO cf_select.window_kids VALUES (101,'first'),(102,'first'),(201,'second'),(202,'second');
`)...)
	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	for _, tc := range []struct {
		name string
		cfg  metadata.Customization
	}{
		{"prefix", metadata.Customization{RootFieldsPrefix: "pfx_"}},
		{"namespace", metadata.Customization{RootFieldsNamespace: "catalog"}},
		{"type_prefix", metadata.Customization{TypeNamesPrefix: "Kid"}},
		{"type_suffix", metadata.Customization{TypeNamesSuffix: "X"}},
		{"namespace_and_type_prefix", metadata.Customization{
			RootFieldsNamespace: "catalog", TypeNamesPrefix: "Kid",
		}},
	} {
		t.Run(
			tc.name,
			func(t *testing.T) {
				md := *base
				md.Databases = append([]metadata.DatabaseMetadata(nil), base.Databases...)
				md.Databases[0].Tables = append(
					[]metadata.TableMetadata(nil),
					base.Databases[0].Tables...)
				items := &md.Databases[0].Tables[0]

				items.RemoteRelationships = append(
					[]metadata.RemoteRelationship(nil),
					items.RemoteRelationships...)
				for _, rel := range []struct{ name, from string }{
					{"physical_kids", "label"}, {"computed_kids", "item_label"},
				} {
					items.RemoteRelationships = append(
						items.RemoteRelationships,
						metadata.RemoteRelationship{
							Name: rel.name,
							Definition: metadata.RemoteRelationshipDef{
								ToSource: &metadata.ToSourceRelationship{
									FieldMapping:     map[string]string{rel.from: "label"},
									RelationshipType: metadata.RelationshipTypeArray,
									Source:           "custom_target",
									Table: metadata.TableSource{
										Schema: "cf_select",
										Name:   "window_kids",
									},
								},
							},
						},
					)
				}

				md.Databases = append(md.Databases, metadata.DatabaseMetadata{
					Name: "custom_target", Kind: "postgres",
					Configuration: base.Databases[0].Configuration,
					Customization: tc.cfg,
					Tables: []metadata.TableMetadata{{
						Table: metadata.TableSource{Schema: "cf_select", Name: "window_kids"},
					}},
				})
				for i := range md.Databases {
					md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
						pool.Config().ConnConfig.ConnString())
				}

				ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
					middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: &md},
					slog.New(slog.DiscardHandler), "", nil)
				if err != nil {
					t.Fatal(err)
				}

				if len(ctrl.Inconsistencies()) > 0 {
					t.Fatalf("inconsistencies: %+v", ctrl.Inconsistencies())
				}

				ctx := runSessionMiddleware(
					t,
					http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}},
				)

				wantType := tc.cfg.TypeNamesPrefix + "cf_select_window_kids" + tc.cfg.TypeNamesSuffix

				response, resolveErr := ctrl.Resolve(
					ctx,
					controller.GraphQLRequest{Query: fmt.Sprintf(`{
				parents:cf_select_items(where:{id:{_in:[1,2]}},order_by:{id:asc}) {
					id
					physical:physical_kids(order_by:{id:asc},limit:1) { id __typename ...Names }
					computed:computed_kids(order_by:{id:asc},limit:1) { id __typename ...Names }
				}
			} fragment Names on %s { t:__typename }`, wantType)},
				)
				if resolveErr != nil || response.Errors != nil {
					t.Fatalf("response=%+v err=%v", response, resolveErr)
				}

				data, ok := response.Data.(map[string]any)
				if !ok {
					t.Fatalf("GraphQL data: %#v", response.Data)
				}

				rows, ok := data["parents"].([]any)
				if !ok || len(rows) != 2 {
					t.Fatalf("parent result: %#v", data)
				}

				for i, id := range []float64{101, 201} {
					row, ok := rows[i].(map[string]any)
					if !ok {
						t.Fatalf("row %d: %#v", i, rows[i])
					}

					want := []any{map[string]any{"id": id, "__typename": wantType, "t": wantType}}
					for _, name := range []string{"physical", "computed"} {
						if !reflect.DeepEqual(row[name], want) {
							t.Errorf("row %d %s = %#v, want %#v", i, name, row[name], want)
						}
					}
				}
			},
		)
	}
}
