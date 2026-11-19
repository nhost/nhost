package controller_test

import (
	"fmt"
	"net/http"
	"os"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// TestCustomizedTargetNativeRoot verifies that controller-built remote target
// roots remain native even when a published customization also matches them.
// Subtests share a schema: connector catalog initialization must be serialized.
//
//nolint:paralleltest,cyclop,gocyclo,gocognit,maintidx // Serialized testdb connectors and the full target execution/validation boundary.
func TestCustomizedTargetNativeRoot(t *testing.T) {
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
CREATE TABLE public.window_kids (id integer primary key, label text);
INSERT INTO public.window_kids VALUES (901,'first'),(902,'second');
`)...)
	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	for _, tc := range []struct {
		name        string
		cfg         metadata.Customization
		publicTable bool
	}{
		{"prefix_wrong_table", metadata.Customization{RootFieldsPrefix: "cf_select_"}, true},
		{"prefix_missing_table", metadata.Customization{RootFieldsPrefix: "cf_"}, false},
		{"suffix", metadata.Customization{RootFieldsSuffix: "_kids"}, false},
		{"namespace_equals_root", metadata.Customization{RootFieldsNamespace: "cf_select_window_kids"}, false},
		{"prefix_type", metadata.Customization{RootFieldsPrefix: "cf_select_", TypeNamesPrefix: "Pub"}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			md := *base
			md.Databases = append([]metadata.DatabaseMetadata(nil), base.Databases...)
			md.Databases[0].Tables = append(
				[]metadata.TableMetadata(nil),
				base.Databases[0].Tables...)
			items := &md.Databases[0].Tables[0]

			items.RemoteRelationships = append(
				[]metadata.RemoteRelationship(nil),
				items.RemoteRelationships...)
			for _, rel := range []struct {
				name string
				from string
				kind string
			}{
				{"physical_kids", "label", metadata.RelationshipTypeArray},
				{"computed_kids", "item_label", metadata.RelationshipTypeArray},
				{"physical_kid", "label", metadata.RelationshipTypeObject},
			} {
				items.RemoteRelationships = append(
					items.RemoteRelationships,
					metadata.RemoteRelationship{
						Name: rel.name,
						Definition: metadata.RemoteRelationshipDef{
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping:     map[string]string{rel.from: "label"},
								RelationshipType: rel.kind,
								Source:           "native_target",
								Table: metadata.TableSource{
									Schema: "cf_select",
									Name:   "window_kids",
								},
							},
						},
					},
				)
			}

			targetTables := []metadata.TableMetadata{
				{Table: metadata.TableSource{Schema: "cf_select", Name: "window_kids"}},
			}
			if tc.publicTable {
				targetTables = append(
					targetTables,
					metadata.TableMetadata{
						Table: metadata.TableSource{Schema: "public", Name: "window_kids"},
					},
				)
			}

			md.Databases = append(md.Databases, metadata.DatabaseMetadata{
				Name: "native_target", Kind: "postgres",
				Configuration: base.Databases[0].Configuration,
				Customization: tc.cfg,
				Tables:        targetTables,
			})
			for i := range md.Databases {
				md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
					pool.Config().ConnConfig.ConnString(),
				)
			}

			ctrl, err := newComputedController(t, &md, false)
			if err != nil {
				t.Fatal(err)
			}

			if issues := ctrl.Inconsistencies(); len(issues) != 0 {
				t.Fatalf("inconsistencies: %+v", issues)
			}

			ctx := runSessionMiddleware(t, http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}})
			for _, q := range []struct {
				name  string
				query string
				want  []any
			}{
				{"two_parents", `query { cf_select_items(where:{id:{_in:[1,2]}},order_by:{id:asc}) {
					id physical_kids(order_by:{id:asc}) { id } computed_kids(order_by:{id:asc}) { id }
				} }`, []any{
					map[string]any{"id": float64(1), "physical_kids": []any{map[string]any{"id": float64(101)}, map[string]any{"id": float64(102)}}, "computed_kids": []any{map[string]any{"id": float64(101)}, map[string]any{"id": float64(102)}}},
					map[string]any{"id": float64(2), "physical_kids": []any{map[string]any{"id": float64(201)}, map[string]any{"id": float64(202)}}, "computed_kids": []any{map[string]any{"id": float64(201)}, map[string]any{"id": float64(202)}}},
				}},
				{"single_parent_limit", `query { cf_select_items(where:{id:{_eq:1}}) {
					physical_kids(order_by:{id:asc},limit:1) { id } physical_kid { id }
				} }`, []any{map[string]any{
					"physical_kids": []any{map[string]any{"id": float64(101)}},
					"physical_kid":  map[string]any{"id": float64(101)},
				}}},
			} {
				t.Run(q.name, func(t *testing.T) {
					response, resolveErr := ctrl.Resolve(
						ctx,
						controller.GraphQLRequest{Query: q.query},
					)
					if resolveErr != nil || response.Errors != nil {
						t.Fatalf("response=%+v error=%v", response, resolveErr)
					}

					data, ok := response.Data.(map[string]any)
					if !ok {
						t.Fatalf("unexpected data: %#v", response.Data)
					}

					got := data["cf_select_items"]
					if !reflect.DeepEqual(got, q.want) {
						t.Fatalf("target rows = %#v, want %#v", got, q.want)
					}
				})
			}

			if tc.cfg.TypeNamesPrefix != "" {
				response, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: `query {
					cf_select_items(where:{id:{_eq:1}}) {
						physical_kids(order_by:{id:asc},limit:1) { ...KidType }
					}
				} fragment KidType on Pubcf_select_window_kids { t:__typename }`})

				want := map[string]any{"cf_select_items": []any{map[string]any{
					"physical_kids": []any{map[string]any{"t": "Pubcf_select_window_kids"}},
				}}}
				if resolveErr != nil || response.Errors != nil ||
					!reflect.DeepEqual(response.Data, want) {
					t.Fatalf(
						"published fragment type = %+v err=%v want=%#v",
						response,
						resolveErr,
						want,
					)
				}
			}

			// A native target validation error must still point to the client
			// relationship, before the insert can write anything.
			id := 91309100 + len(tc.name)

			response, resolveErr := ctrl.Resolve(
				ctx,
				controller.GraphQLRequest{Query: fmt.Sprintf(`mutation {
				insert_cf_select_items_one(object:{id:%d,owner_id:1,label:"first",amount:4,payload:{status:"ready"}}) {
					physical_kids(limit:-1) { id }
				}
			}`, id)},
			)
			if resolveErr != nil || response.Errors == nil {
				t.Fatalf(
					"expected remote validation error: response=%+v err=%v",
					response,
					resolveErr,
				)
			}

			errs, ok := response.Errors.([]map[string]any)
			if !ok || len(errs) != 1 {
				t.Fatalf("unexpected validation errors: %+v", response.Errors)
			}

			ext, ok := errs[0]["extensions"].(map[string]any)
			if !ok || ext["code"] != "validation-failed" ||
				ext["path"] != "$.selectionSet.insert_cf_select_items_one.selectionSet.physical_kids.args.limit" {
				t.Fatalf("validation path did not reach client relationship: %+v", errs[0])
			}

			var count int
			if err := pool.QueryRow(t.Context(), "SELECT count(*) FROM cf_select.items WHERE id=$1", id).
				Scan(&count); err != nil ||
				count != 0 {
				t.Fatalf("pre-validation left %d inserted rows: %v", count, err)
			}

			returning, resolveErr := ctrl.Resolve(
				ctx,
				controller.GraphQLRequest{Query: fmt.Sprintf(`mutation {
				insert_cf_select_items_one(object:{id:%d,owner_id:1,label:"first",amount:4,payload:{status:"ready"}}) {
					physical_kids(order_by:{id:asc}) { id }
				}
			}`, id)},
			)

			want := map[string]any{"insert_cf_select_items_one": map[string]any{
				"physical_kids": []any{
					map[string]any{"id": float64(101)},
					map[string]any{"id": float64(102)},
				},
			}}
			if resolveErr != nil || returning.Errors != nil ||
				!reflect.DeepEqual(returning.Data, want) {
				t.Fatalf("mutation returning = %+v err=%v want=%#v", returning, resolveErr, want)
			}
		})
	}
}
