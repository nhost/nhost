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

// TestCustomizedSourceRemoteRelationships pins source-side namespace resolution,
// including hidden physical keys, computed grants, target permissions and phantoms.
//
//nolint:gocognit,gocyclo,cyclop,nestif,maintidx,paralleltest,tparallel // One fixture checks role/customization variants serially: connector catalog-function initialization updates the same test schema.
func TestCustomizedSourceRemoteRelationships(t *testing.T) {
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

	ddl = append(ddl, []byte(`
CREATE TABLE cf_select.ns_kids (id integer primary key, label text);
INSERT INTO cf_select.ns_kids VALUES (101,'first'),(102,'first'),(201,'second');
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for _, tc := range []struct {
		name       string
		cfg        metadata.Customization
		targetCfg  metadata.Customization
		root       string
		typePrefix bool
	}{
		{"namespace", metadata.Customization{RootFieldsNamespace: "catalog"}, metadata.Customization{}, "catalog { cf_select_items", false},
		{"prefix", metadata.Customization{RootFieldsPrefix: "pfx_"}, metadata.Customization{}, "pfx_cf_select_items", false},
		{"plain", metadata.Customization{}, metadata.Customization{}, "cf_select_items", false},
		{"namespace_with_type_prefix", metadata.Customization{RootFieldsNamespace: "catalog", TypeNamesPrefix: "Catalog"}, metadata.Customization{}, "catalog { cf_select_items", true},
		{"target_type_prefix", metadata.Customization{}, metadata.Customization{TypeNamesPrefix: "Kid"}, "cf_select_items", false},
		{"target_type_suffix", metadata.Customization{}, metadata.Customization{TypeNamesSuffix: "X"}, "cf_select_items", false},
		{"source_and_target_type_prefix", metadata.Customization{RootFieldsNamespace: "catalog", TypeNamesPrefix: "Catalog"}, metadata.Customization{TypeNamesPrefix: "Kid", RootFieldsNamespace: "kidbox"}, "catalog { cf_select_items", true},
	} {
		t.Run(
			tc.name,
			func(t *testing.T) {
				md, parseErr := metadata.FromHasuraJSON(raw)
				if parseErr != nil {
					t.Fatal(parseErr)
				}

				for i := range md.Databases {
					md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
						pool.Config().ConnConfig.ConnString(),
					)
				}

				src := &md.Databases[0]
				src.Customization = tc.cfg

				items := &src.Tables[0]
				src.Tables[1].ObjectRelationships = append(
					src.Tables[1].ObjectRelationships,
					metadata.ObjectRelationship{
						Name: "item",
						Using: metadata.RelationshipUsing{
							ForeignKeyColumns: []string{"item_id"},
						},
					},
				)

				items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
					Role: "cf_target_hidden",
					Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id"}, ComputedFields: []string{"item_label"},
					},
				})
				for i := range items.SelectPermissions {
					p := &items.SelectPermissions[i]
					if p.Role == "cf_reader" {
						p.Permission.Columns = []string{"id"}
					}
				}

				if tc.name == "target_type_prefix" {
					items.RemoteRelationships = append(items.RemoteRelationships,
						metadata.RemoteRelationship{
							Name: "unknown_kids",
							Definition: metadata.RemoteRelationshipDef{
								ToSource: &metadata.ToSourceRelationship{
									FieldMapping:     map[string]string{"label": "label"},
									RelationshipType: metadata.RelationshipTypeArray,
									Source:           "ns_target",
									Table: metadata.TableSource{
										Schema: "cf_select",
										Name:   "missing_kids",
									},
								},
							},
						},
					)
				}

				items.RemoteRelationships = append(
					items.RemoteRelationships,
					metadata.RemoteRelationship{
						Name: "physical_kids",
						Definition: metadata.RemoteRelationshipDef{
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping:     map[string]string{"label": "label"},
								RelationshipType: metadata.RelationshipTypeArray,
								Source:           "ns_target",
								Table: metadata.TableSource{
									Schema: "cf_select",
									Name:   "ns_kids",
								},
							},
						},
					},
					metadata.RemoteRelationship{
						Name: "computed_kids",
						Definition: metadata.RemoteRelationshipDef{
							ToSource: &metadata.ToSourceRelationship{
								FieldMapping:     map[string]string{"item_label": "label"},
								RelationshipType: metadata.RelationshipTypeArray,
								Source:           "ns_target",
								Table: metadata.TableSource{
									Schema: "cf_select",
									Name:   "ns_kids",
								},
							},
						},
					},
				)
				md.Databases = append(md.Databases, metadata.DatabaseMetadata{
					Name: "ns_target", Kind: "postgres", Configuration: src.Configuration,
					Customization: tc.targetCfg,
					Tables: []metadata.TableMetadata{
						{
							Table: metadata.TableSource{Schema: "cf_select", Name: "ns_kids"},
							RemoteRelationships: []metadata.RemoteRelationship{
								{
									Name: "source_item",
									Definition: metadata.RemoteRelationshipDef{
										ToSource: &metadata.ToSourceRelationship{
											FieldMapping:     map[string]string{"label": "label"},
											RelationshipType: metadata.RelationshipTypeObject,
											Source:           "cf_select",
											Table: metadata.TableSource{
												Schema: "cf_select",
												Name:   "items",
											},
										},
									},
								},
							},
							SelectPermissions: []metadata.SelectPermission{
								{
									Role: "cf_reader",
									Permission: metadata.SelectPermissionConfig{
										Columns: []string{"id", "label"},
										Filter: map[string]any{
											"id": map[string]any{"_neq": 102},
										},
										AllowAggregations: true,
									},
								},
								{
									Role: "cf_filtered_one",
									Permission: metadata.SelectPermissionConfig{
										Columns: []string{"id", "label"},
										Filter:  map[string]any{"id": map[string]any{"_neq": 102}},
									},
								},
								{
									Role: "cf_target_hidden",
									Permission: metadata.SelectPermissionConfig{
										Columns: []string{"id"},
										Filter:  map[string]any{"id": map[string]any{"_neq": 102}},
									},
								},
							},
						},
					},
				})

				ctrl, newErr := controller.New(
					t.Context(),
					time.Second,
					testAdminSecret,
					false,
					middleware.NewNoOpJWTAuthenticator(),
					computedStaticSource{meta: md},
					slog.New(slog.DiscardHandler),
					"",
					nil,
				)
				if newErr != nil {
					t.Fatal(newErr)
				}

				if len(ctrl.Inconsistencies()) != 0 {
					t.Fatalf("inconsistencies: %+v", ctrl.Inconsistencies())
				}

				for _, role := range []struct {
					name      string
					fields    []string
					computed  bool
					aggregate bool
				}{
					{"cf_reader", []string{"id", "physical_kids", "computed_kids", "physical_kids_aggregate", "computed_kids_aggregate"}, true, true},
					{"cf_filtered_one", []string{"id", "physical_kids"}, false, false},
					{"cf_target_hidden", []string{"id", "physical_kids"}, false, false},
					{"admin", []string{"id", "label", "physical_kids", "computed_kids", "physical_kids_aggregate", "computed_kids_aggregate"}, true, true},
				} {
					t.Run(role.name, func(t *testing.T) {
						h := http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}
						if role.name != "admin" {
							h.Set("X-Hasura-Role", role.name)
						}

						ctx := runSessionMiddleware(t, h)
						exec := func(query string, vars map[string]any) *controller.GraphQLResponse {
							t.Helper()

							response, resolveErr := ctrl.Resolve(
								ctx,
								controller.GraphQLRequest{Query: query, Variables: vars},
							)
							if resolveErr != nil || response.Errors != nil {
								t.Fatalf(
									"query %s: response=%+v err=%v",
									query,
									response,
									resolveErr,
								)
							}

							return response
						}

						sourceType := "cf_select_items"
						if tc.typePrefix {
							sourceType = "Catalogcf_select_items"
						}

						schema := exec(
							fmt.Sprintf(`{ __type(name:%q) { fields { name } } }`, sourceType),
							nil,
						)

						encoded, encErr := json.Marshal(schema.Data)
						if encErr != nil {
							t.Fatal(encErr)
						}

						for _, name := range role.fields {
							if !strings.Contains(string(encoded), `"name":"`+name+`"`) {
								t.Errorf("missing %s in SDL %s", name, encoded)
							}
						}

						if tc.name == "target_type_prefix" {
							if strings.Contains(string(encoded), `"name":"unknown_kids"`) {
								t.Errorf("untracked target admitted to SDL: %s", encoded)
							}

							failed, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{
								Query: `{ cf_select_items { id unknown_kids { id } } }`,
							})
							if resolveErr != nil || failed.Errors == nil || failed.Data != nil {
								t.Errorf(
									"untracked target must fail validation: %+v %v",
									failed,
									resolveErr,
								)
							}
						}

						if role.name != "admin" &&
							strings.Contains(string(encoded), `"name":"label"`) {
							t.Errorf("hidden source label in SDL: %s", encoded)
						}

						if !role.computed {
							for _, denied := range []string{"computed_kids", "computed_kids_aggregate"} {
								if strings.Contains(string(encoded), `"name":"`+denied+`"`) {
									t.Errorf(
										"unauthorized key relationship %s in SDL: %s",
										denied,
										encoded,
									)
								}
							}
						}

						if role.name == "cf_filtered_one" || role.name == "admin" {
							assertCustomizedSourcePathSecurity(
								t,
								exec,
								tc.cfg.RootFieldsNamespace != "",
								tc.typePrefix,
								tc.cfg.RootFieldsPrefix,
								tc.targetCfg.TypeNamesPrefix,
								role.name,
							)
						}

						if role.name == "admin" && tc.cfg.RootFieldsNamespace != "" {
							for _, query := range []string{
								`{ other:catalog { cf_select_items(limit:-1) { id } }
									catalog { cf_select_items { id } } }`,
								`{ catalog { cf_select_items { id } }
									other:catalog { x:cf_select_items(limit:-1) { id } } }`,
							} {
								invalid, resolveErr := ctrl.Resolve(
									ctx,
									controller.GraphQLRequest{Query: query},
								)
								if resolveErr != nil || invalid.Data != nil ||
									invalid.Errors == nil {
									t.Fatalf(
										"aliased namespace validation: %+v %v",
										invalid,
										resolveErr,
									)
								}

								errs, ok := invalid.Errors.([]map[string]any)
								if !ok || len(errs) != 1 {
									t.Fatalf("validation errors: %#v", invalid.Errors)
								}

								extensions, ok := errs[0]["extensions"].(map[string]any)
								if !ok || extensions["path"] !=
									"$.selectionSet.catalog.selectionSet.cf_select_items.args.limit" {
									t.Errorf("validation path: %#v", invalid.Errors)
								}

								if strings.Contains(
									fmt.Sprint(invalid.Errors),
									"_constellation_ns_",
								) {
									t.Errorf(
										"internal namespace alias in error: %#v",
										invalid.Errors,
									)
								}
							}
						}

						root := tc.root

						closeRoot := ""
						if tc.cfg.RootFieldsNamespace != "" {
							closeRoot = " }"
						}

						rels := "physical_kids(order_by:{id:asc}) { id }"
						if role.computed {
							rels += " computed_kids(order_by:{id:asc}) { id }"
						}

						q := fmt.Sprintf(
							`{ %s(where:{id:{_in:[1,2]}},order_by:{id:asc}) { id %s }%s }`,
							root,
							rels,
							closeRoot,
						)
						result := exec(q, nil)

						data := sourceMap(t, result.Data)
						if tc.cfg.RootFieldsNamespace != "" {
							data = sourceMap(t, data["catalog"])
						}

						key := "cf_select_items"
						if tc.name == "prefix" {
							key = "pfx_cf_select_items"
						}

						rows := sourceRows(t, data[key])
						if len(rows) != 2 {
							t.Fatalf("rows: %#v", rows)
						}

						for i, id := range []float64{101, 201} {
							row := sourceMap(t, rows[i])
							if _, found := row["label"]; found {
								t.Errorf("role-hidden/unselected label returned: %#v", row)
							}

							if _, found := row["item_label"]; found {
								t.Errorf("unselected computed key returned: %#v", row)
							}

							want := []any{map[string]any{"id": id}}
							if role.name == "admin" && i == 0 {
								want = []any{
									map[string]any{"id": float64(101)},
									map[string]any{"id": float64(102)},
								}
							}

							if !reflect.DeepEqual(row["physical_kids"], want) {
								t.Errorf("row %d physical: %#v want %#v", i, row, want)
							}

							if role.computed && !reflect.DeepEqual(row["computed_kids"], want) {
								t.Errorf("row %d computed: %#v want %#v", i, row, want)
							}
						}

						if role.name == "cf_reader" {
							// Aliases, a named fragment and directive variables must preserve the wrapper path.
							q = fmt.Sprintf(
								`query($show:Boolean!,$id:Int!) { box:%s(where:{id:{_eq:$id}}) { ...Selection }%s } fragment Selection on %s { id kids:computed_kids @include(if:$show) { id } }`,
								root,
								closeRoot,
								sourceType,
							)
							result = exec(q, map[string]any{"show": true, "id": 1})

							data = sourceMap(t, result.Data)
							if tc.cfg.RootFieldsNamespace != "" {
								data = sourceMap(t, data["box"])
								key = "cf_select_items"
							} else {
								key = "box"
							}

							aliasedRows := sourceRows(t, data[key])
							if !reflect.DeepEqual(
								aliasedRows,
								[]any{
									map[string]any{
										"id":   float64(1),
										"kids": []any{map[string]any{"id": float64(101)}},
									},
								},
							) {
								t.Errorf("alias/fragment result: %#v", aliasedRows)
							}

							if tc.targetCfg.TypeNamesPrefix != "" ||
								tc.targetCfg.TypeNamesSuffix != "" {
								targetType := tc.targetCfg.TypeNamesPrefix + "cf_select_ns_kids" + tc.targetCfg.TypeNamesSuffix
								q = fmt.Sprintf(
									`query($show:Boolean!) { %s(where:{id:{_eq:1}}) { id k:computed_kids { ...KidFields @include(if:$show) } }%s } fragment KidFields on %s { __typename id }`,
									root,
									closeRoot,
									targetType,
								)
								result = exec(q, map[string]any{"show": true})

								data = sourceMap(t, result.Data)
								if tc.cfg.RootFieldsNamespace != "" {
									data = sourceMap(t, data["catalog"])
								}

								got := sourceRows(t, data["cf_select_items"])

								want := []any{map[string]any{
									"id": float64(1), "k": []any{map[string]any{
										"__typename": targetType, "id": float64(101),
									}},
								}}
								if !reflect.DeepEqual(got, want) {
									t.Errorf(
										"customized target fragment/typename: %#v want %#v",
										got,
										want,
									)
								}
							}
						}

						if role.name == "cf_reader" && tc.cfg.RootFieldsNamespace != "" {
							result = exec(
								`{ catalog { cf_select_items(where:{id:{_eq:1}}) { id physical_kids { id source_item { id } } } } }`,
								nil,
							)
							data = sourceMap(t, sourceMap(t, result.Data)["catalog"])
							nested := sourceRows(t, data["cf_select_items"])

							nestedWant := []any{
								map[string]any{
									"id": float64(1),
									"physical_kids": []any{
										map[string]any{
											"id":          float64(101),
											"source_item": map[string]any{"id": float64(1)},
										},
									},
								},
							}
							if !reflect.DeepEqual(nested, nestedWant) {
								t.Errorf("nested relationship: %#v want %#v", nested, nestedWant)
							}

							wrapper := "catalog_query"
							if tc.typePrefix {
								wrapper = "Catalogcatalog_query"
							}

							result = exec(
								fmt.Sprintf(
									`query($show:Boolean!) { box:catalog { ...Root @include(if:$show) } } fragment Root on %s { cf_select_items(where:{id:{_eq:1}}) { id physical_kids { id } } }`,
									wrapper,
								),
								map[string]any{"show": true},
							)
							data = sourceMap(t, sourceMap(t, result.Data)["box"])

							got, ok := data["cf_select_items"].([]any)
							if !ok {
								t.Fatalf("wrapper fragment data: %#v", result.Data)
							}

							want := []any{
								map[string]any{
									"id":            float64(1),
									"physical_kids": []any{map[string]any{"id": float64(101)}},
								},
							}
							if !reflect.DeepEqual(got, want) {
								t.Errorf("wrapper fragment: %#v want %#v", got, want)
							}

							skipped := exec(
								fmt.Sprintf(
									`query($show:Boolean!) { box:catalog { ...Root @include(if:$show) } } fragment Root on %s { cf_select_items { id physical_kids { id } } }`,
									wrapper,
								),
								map[string]any{"show": false},
							)

							skippedJSON, marshalErr := json.Marshal(skipped.Data)
							if marshalErr != nil {
								t.Fatal(marshalErr)
							}

							if strings.Contains(string(skippedJSON), `"label"`) ||
								strings.Contains(string(skippedJSON), `"physical_kids"`) {
								t.Errorf("skipped wrapper fragment leaked data: %s", skippedJSON)
							}
						}

						if (role.name == "cf_filtered_one" || role.name == "cf_target_hidden") &&
							tc.cfg.RootFieldsNamespace != "" {
							failed, resolveErr := ctrl.Resolve(
								ctx,
								controller.GraphQLRequest{
									Query: `{ catalog { cf_select_items { id computed_kids { id } } } }`,
								},
							)
							if resolveErr != nil || failed.Data != nil || failed.Errors == nil {
								t.Errorf(
									"unavailable computed join must fail validation: %+v %v",
									failed,
									resolveErr,
								)
							}
						}

						if role.name == "cf_target_hidden" && tc.name == "target_type_prefix" {
							failed, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{
								Query: `{ cf_select_items { id physical_kids { id label } } }`,
							})
							if resolveErr != nil || failed.Errors == nil || failed.Data != nil {
								t.Errorf(
									"denied target label must fail validation: %+v %v",
									failed,
									resolveErr,
								)
							}
						}

						if role.name == "cf_reader" && tc.cfg.RootFieldsNamespace != "" {
							failed, resolveErr := ctrl.Resolve(
								ctx,
								controller.GraphQLRequest{
									Query: `{ catalog { cf_select_items { id physical_kids(limit:-1) { id } } } }`,
								},
							)
							if resolveErr != nil || failed.Data != nil || failed.Errors == nil {
								t.Errorf(
									"invalid remote query must return no data: %+v %v",
									failed,
									resolveErr,
								)
							}

							failed, resolveErr = ctrl.Resolve(
								ctx,
								controller.GraphQLRequest{
									Query: `{ catalog { cf_select_items { id label } } }`,
								},
							)
							if resolveErr != nil || failed.Data != nil || failed.Errors == nil {
								t.Errorf(
									"hidden source label must fail validation: %+v %v",
									failed,
									resolveErr,
								)
							}
						}

						if role.aggregate {
							q = fmt.Sprintf(
								`{ %s(where:{id:{_in:[1,2]}},order_by:{id:asc}) { id physical_kids_aggregate { aggregate { count } } }%s }`,
								root,
								closeRoot,
							)
							result = exec(q, nil)

							data = sourceMap(t, result.Data)
							if tc.cfg.RootFieldsNamespace != "" {
								data = sourceMap(t, data["catalog"])
							}

							switch tc.name {
							case "namespace":
								key = "cf_select_items"
							case "prefix":
								key = "pfx_cf_select_items"
							default:
								key = "cf_select_items"
							}

							counts := []float64{1, 1}
							if role.name == "admin" {
								counts[0] = 2
							}

							for i, want := range counts {
								count := sourceMap(t, sourceMap(t, sourceRows(t, data[key])[i])["physical_kids_aggregate"])["aggregate"]

								count = sourceMap(t, count)["count"]
								if count != want {
									t.Errorf("aggregate %d = %#v want %v", i, count, want)
								}
							}

							if role.name == "cf_reader" && tc.name == "target_type_prefix" {
								result = exec(
									`{ cf_select_items(where:{id:{_eq:1}}) { physical_kids_aggregate { aggregate { count } nodes { id __typename ...KidNames } } } } fragment KidNames on Kidcf_select_ns_kids { t:__typename }`,
									nil,
								)
								rows := sourceRows(t, sourceMap(t, result.Data)["cf_select_items"])
								got := sourceMap(t, rows[0])["physical_kids_aggregate"]

								want := map[string]any{
									"aggregate": map[string]any{"count": float64(1)},
									"nodes": []any{
										map[string]any{
											"id":         float64(101),
											"__typename": "Kidcf_select_ns_kids",
											"t":          "Kidcf_select_ns_kids",
										},
									},
								}
								if !reflect.DeepEqual(got, want) {
									t.Errorf(
										"type-prefixed aggregate nodes = %#v want %#v",
										got,
										want,
									)
								}
							}
						}
					})
				}
			},
		)
	}
}

func sourceMap(t *testing.T, value any) map[string]any {
	t.Helper()

	out, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("expected object: %#v", value)
	}

	return out
}

func sourceRows(t *testing.T, value any) []any {
	t.Helper()

	out, ok := value.([]any)
	if !ok {
		t.Fatalf("expected rows: %#v", value)
	}

	return out
}

// assertCustomizedSourcePathSecurity pins both the shared-fragment injection
// boundary and independent lifted namespace roots against a hidden physical key.
//
//nolint:cyclop // The cases compare whole responses, including filtered joins and leak checks.
func assertCustomizedSourcePathSecurity(
	t *testing.T,
	exec func(string, map[string]any) *controller.GraphQLResponse,
	namespaced, prefixed bool,
	rootPrefix, targetPrefix, role string,
) {
	t.Helper()

	safeExec := func(query string, variables ...map[string]any) *controller.GraphQLResponse {
		t.Helper()

		var values map[string]any
		if len(variables) > 0 {
			values = variables[0]
		}

		response := exec(query, values)

		encoded, err := json.Marshal(response.Data)
		if err != nil {
			t.Fatal(err)
		}

		if strings.Contains(string(encoded), `"label"`) ||
			strings.Contains(string(encoded), `"_constellation_phantom_`) {
			t.Fatalf("hidden key in response %s: %s", query, encoded)
		}

		return response
	}

	tagType, wrapperType := "cf_select_tags", "catalog_query"
	if prefixed {
		tagType, wrapperType = "Catalog"+tagType, "Catalog"+wrapperType
	}

	join := []any{map[string]any{"id": float64(101)}}
	if role == "admin" {
		join = append(join, map[string]any{"id": float64(102)})
	}

	root := rootPrefix + "cf_select_tags"

	closeRoot := ""
	if namespaced {
		root, closeRoot = "catalog { cf_select_tags", " }"
	}

	shared := fmt.Sprintf(`{ a:%s(where:{id:{_eq:1}}) { ...T item { physical_kids { id } } }%s
		b:%s(where:{id:{_eq:1}}) { ...T }%s }
		fragment T on %s { id item { id } }`, root, closeRoot, root, closeRoot, tagType)
	data := sourceMap(t, safeExec(shared).Data)

	first, second := data["a"], data["b"]
	if namespaced {
		first, second = sourceMap(t, first)["cf_select_tags"], sourceMap(t, second)["cf_select_tags"]
	}

	if want := []any{map[string]any{"id": float64(1), "item": map[string]any{
		"id": float64(1), "physical_kids": join,
	}}}; !reflect.DeepEqual(first, want) {
		t.Errorf("shared fragment planned response: %#v want %#v", first, want)
	}

	if want := []any{
		map[string]any{"id": float64(1), "item": map[string]any{"id": float64(1)}},
	}; !reflect.DeepEqual(
		second,
		want,
	) {
		t.Errorf("shared fragment unrelated response: %#v want %#v", second, want)
	}

	nested := fmt.Sprintf(`{ a:%s(where:{id:{_eq:1}}) { ...Only }%s }
		fragment Only on %s { item { physical_kids { id } } }`, root, closeRoot, tagType)

	nestedData := sourceMap(t, safeExec(nested).Data)["a"]
	if namespaced {
		nestedData = sourceMap(t, nestedData)["cf_select_tags"]
	}

	if want := []any{
		map[string]any{"item": map[string]any{"physical_kids": join}},
	}; !reflect.DeepEqual(
		nestedData,
		want,
	) {
		t.Errorf("nested-fragment-only relationship: %#v want %#v", nestedData, want)
	}

	if namespaced {
		for _, tc := range []struct {
			name, query            string
			wantOther, wantCatalog []any
		}{
			{
				"first_plain", `{ other:catalog { cf_select_items(where:{id:{_eq:1}}) { id } }
				catalog { cf_select_items(where:{id:{_eq:1}}) { id physical_kids { id } } } }`,
				[]any{map[string]any{"id": float64(1)}},
				[]any{map[string]any{"id": float64(1), "physical_kids": join}},
			},
			{
				"first_join", `{ catalog { cf_select_items(where:{id:{_eq:1}}) { id physical_kids { id } } }
				other:catalog { cf_select_items(where:{id:{_eq:1}}) { id } } }`,
				[]any{map[string]any{"id": float64(1)}},
				[]any{map[string]any{"id": float64(1), "physical_kids": join}},
			},
			{
				"different_arguments", `{ other:catalog { cf_select_items(where:{id:{_eq:2}},limit:1) { id } }
				catalog { cf_select_items(where:{id:{_eq:1}},limit:1) { id physical_kids { id } } } }`,
				[]any{map[string]any{"id": float64(2)}},
				[]any{map[string]any{"id": float64(1), "physical_kids": join}},
			},
		} {
			result := sourceMap(t, safeExec(tc.query).Data)
			other := sourceMap(t, result["other"])["cf_select_items"]

			catalog := sourceMap(t, result["catalog"])["cf_select_items"]
			if !reflect.DeepEqual(other, tc.wantOther) ||
				!reflect.DeepEqual(catalog, tc.wantCatalog) {
				t.Errorf("%s independent paths: other=%#v catalog=%#v", tc.name, other, catalog)
			}
		}

		wrapper := fmt.Sprintf(
			`query($show:Boolean!) { catalog { ...W cf_select_items(where:{id:{_eq:1}}) { physical_kids { id } } }
			other:catalog { ...W @include(if:$show) } } fragment W on %s { cf_select_items(where:{id:{_eq:1}}) { id } }`,
			wrapperType,
		)

		wrapped := sourceMap(t, safeExec(wrapper, map[string]any{"show": true}).Data)
		if want := []any{map[string]any{"id": float64(1)}}; !reflect.DeepEqual(
			sourceMap(t, wrapped["other"])["cf_select_items"], want,
		) {
			t.Errorf("shared wrapper spread: %#v", wrapped)
		}

		if want := []any{
			map[string]any{"id": float64(1), "physical_kids": join},
		}; !reflect.DeepEqual(
			sourceMap(t, wrapped["catalog"])["cf_select_items"],
			want,
		) {
			t.Errorf("planned wrapper spread: %#v want %#v", wrapped, want)
		}

		assertCollectedNamespaceSelections(t, safeExec, wrapperType, prefixed, targetPrefix, join)

		collision := `{ other:catalog { _constellation_ns_0:cf_select_items(where:{id:{_eq:2}}) { id } }
			catalog { cf_select_items(where:{id:{_eq:1}}) { id physical_kids { id } } } }`

		collided := sourceMap(t, safeExec(collision).Data)
		if got := sourceMap(t, collided["other"])["_constellation_ns_0"]; !reflect.DeepEqual(
			got, []any{map[string]any{"id": float64(2)}},
		) {
			t.Errorf("client alias collision: %#v", collided)
		}
	}
}

// assertCollectedNamespaceSelections checks selected fields and published type
// names through repeated namespace children while permissions filter joins.
func assertCollectedNamespaceSelections(
	t *testing.T,
	safeExec func(string, ...map[string]any) *controller.GraphQLResponse,
	wrapperType string, prefixed bool, targetPrefix string, join []any,
) {
	t.Helper()

	// A native SQL field returns the union of compatible occurrences. Both
	// wrapper/direct and direct/direct collections must forward that union,
	// including every selected published typename, without emitting hidden
	// role columns or internal response keys.
	rowType := "cf_select_items"
	if prefixed {
		rowType = "Catalog" + rowType
	}

	childType := targetPrefix + "cf_select_ns_kids"

	selectedJoin := make([]any, len(join))
	for i, child := range join {
		selectedJoin[i] = map[string]any{
			"id": sourceMap(t, child)["id"], "__typename": childType,
		}
	}

	const (
		filter   = "(where:{id:{_eq:1}})"
		selected = "physical_kids(order_by:{id:asc}) { id __typename }"
	)
	for _, tc := range []struct {
		name, fields string
	}{
		{"wrapper first", "...W cf_select_items" + filter + " { __typename " + selected + " }"},
		{"wrapper last", "cf_select_items" + filter + " { __typename " + selected + " } ...W"},
		{"direct typename first", "cf_select_items" + filter + " { __typename } cf_select_items" + filter + " { id " + selected + " }"},
		{"direct typename last", "cf_select_items" + filter + " { id " + selected + " } cf_select_items" + filter + " { __typename }"},
		{"row fragment first", "cf_select_items" + filter + " { ...T } cf_select_items" + filter + " { " + selected + " }"},
		{"row fragment last", "cf_select_items" + filter + " { " + selected + " } cf_select_items" + filter + " { ...T }"},
	} {
		query := fmt.Sprintf(
			`{ catalog { %s } other:catalog { cf_select_items(where:{id:{_eq:2}}) { id } } }`,
			tc.fields,
		)
		if strings.Contains(tc.fields, "...W") {
			query += fmt.Sprintf(
				` fragment W on %s { cf_select_items%s { id } }`,
				wrapperType,
				filter,
			)
		}

		if strings.Contains(tc.fields, "...T") {
			query += fmt.Sprintf(` fragment T on %s { id __typename }`, rowType)
		}

		data := sourceMap(t, safeExec(query).Data)
		if len(data) != 2 {
			t.Errorf("%s: unexpected namespace keys: %#v", tc.name, data)
		}

		want := []any{map[string]any{
			"id": float64(1), "__typename": rowType, "physical_kids": selectedJoin,
		}}
		if got := sourceMap(t, data["catalog"])["cf_select_items"]; !reflect.DeepEqual(
			got,
			want,
		) {
			t.Errorf("%s: catalog = %#v, want %#v", tc.name, got, want)
		}

		if got := sourceMap(t, data["other"])["cf_select_items"]; !reflect.DeepEqual(
			got, []any{map[string]any{"id": float64(2)}},
		) {
			t.Errorf("%s: other = %#v", tc.name, got)
		}
	}
}
