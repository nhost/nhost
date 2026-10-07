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

// TestComputedJoinKeys exercises schema injection and the SQL/planner/resolver
// path without Hasura. The same metadata is used for both source connectors.
//
//nolint:tparallel,gocognit,gocyclo,cyclop,maintidx // Role SDL, execution and permission cases share one fixture/pool.
func TestComputedJoinKeys(t *testing.T) {
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

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	ddl = append(ddl, []byte(`
ALTER TABLE cf_predicates.rules ADD COLUMN join_payload jsonb;
ALTER TABLE cf_select.items ADD COLUMN physical_json_key jsonb;
ALTER TABLE cf_select.items ADD COLUMN physical_json_text jsonb;
ALTER TABLE cf_select.items ADD COLUMN physical_id_text text;
ALTER TABLE cf_select.items ADD COLUMN nullable_text text;
ALTER TABLE cf_select.items ADD COLUMN nullable_json jsonb;
ALTER TABLE cf_select.items ADD COLUMN matched text;
ALTER TABLE cf_select.items ADD COLUMN all_null_text text;
ALTER TABLE cf_select.items ADD COLUMN all_null_json jsonb;
ALTER TABLE cf_select.tags ADD COLUMN null_key text;
CREATE FUNCTION cf_select.item_null_text(item cf_select.items) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT NULL::text $$;
CREATE FUNCTION cf_select.item_mixed_text(item cf_select.items) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 1 THEN 'first'::text ELSE NULL::text END $$;
CREATE FUNCTION cf_select.item_null_json(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 1 THEN 'null'::jsonb ELSE NULL::jsonb END $$;
CREATE FUNCTION cf_select.item_mixed_json(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 1 THEN to_jsonb('first'::text) ELSE 'null'::jsonb END $$;
CREATE FUNCTION cf_select.item_json_string(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT to_jsonb(item.id::text) $$;
CREATE FUNCTION cf_select.item_json_number(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT to_jsonb(item.id) $$;
CREATE FUNCTION cf_select.item_json_array(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT jsonb_build_array(item.label) $$;
CREATE FUNCTION cf_select.item_json_mixed(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 1 THEN to_jsonb('1'::text) ELSE to_jsonb(1) END $$;
CREATE FUNCTION cf_select.item_json_text(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT to_jsonb(item.label) $$;
CREATE FUNCTION cf_select.item_nullable_json(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 3 THEN NULL::jsonb ELSE to_jsonb(item.label) END $$;
CREATE FUNCTION cf_select.item_matched(item cf_select.items) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT item.matched $$;
CREATE FUNCTION cf_select.item_json_shared(item cf_select.items) RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT to_jsonb('first'::text) $$;
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	_, err = pool.Exec(t.Context(), `UPDATE cf_select.items
 SET physical_json_key = CASE WHEN id = 1 THEN '"1"'::jsonb ELSE '1'::jsonb END,
 physical_json_text = to_jsonb(label), physical_id_text = id::text,
 nullable_text = CASE WHEN id = 1 THEN 'first' ELSE NULL END,
 nullable_json = CASE WHEN id = 1 THEN '"first"'::jsonb ELSE 'null'::jsonb END,
 matched = CASE WHEN id = 1 THEN 'a' ELSE 'a' END;
 INSERT INTO cf_predicates.rules(id,owner_id,label,join_payload)
 VALUES (91301301,1,'first','{"status":"ready"}'::jsonb),
 (91301402,1,'string','"1"'::jsonb), (91301403,1,'number','1'::jsonb),
 (91301404,1,'array','["first"]'::jsonb),
 (91301405,1,'first','"first"'::jsonb), (91301406,1,'second','"second"'::jsonb),
 (91301407,1,'two','2'::jsonb), (91301408,1,'two string','"2"'::jsonb),
 (91301409,1,'json null','null'::jsonb)`)
	if err != nil {
		t.Fatal(err)
	}

	items := &md.Databases[0].Tables[0]
	// A same-named physical column cannot impersonate a rejected computed
	// definition, even for admin (where select grants are implicit).
	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "label", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_label"},
		},
	})
	for _, name := range []string{"item_json_string", "item_json_number", "item_json_array", "item_json_mixed", "item_json_text", "item_nullable_json", "item_matched", "item_json_shared", "item_null_text", "item_mixed_text", "item_null_json", "item_mixed_json"} {
		items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
			Name: name, Definition: metadata.ComputedFieldDefinition{
				Function: metadata.FunctionSource{Schema: "cf_select", Name: name},
			},
		})
	}

	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.Columns = append(
				items.SelectPermissions[i].Permission.Columns,
				"physical_json_key",
				"physical_json_text",
				"physical_id_text",
				"nullable_text",
				"nullable_json",
				"all_null_text",
				"all_null_json", "matched", "owner_id",
			)
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields,
				"item_json_string",
				"item_json_number",
				"item_json_array",
				"item_json_mixed",
				"item_json_text", "item_nullable_json", "item_matched",
				"item_json_shared",
				"item_null_text",
				"item_mixed_text",
				"item_null_json",
				"item_mixed_json",
			)
		}
	}

	rules := &md.Databases[1].Tables[0]
	for _, spec := range []struct{ name, kind string }{
		{"physical_id_object", metadata.RelationshipTypeObject},
		{"physical_id_array", metadata.RelationshipTypeArray},
	} {
		rules.RemoteRelationships = append(rules.RemoteRelationships, metadata.RemoteRelationship{
			Name: spec.name,
			Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"owner_id": "id"},
				RelationshipType: spec.kind,
				Source:           "cf_select",
				Table:            metadata.TableSource{Schema: "cf_select", Name: "items"},
			}},
		})
	}

	for i := range rules.SelectPermissions {
		if rules.SelectPermissions[i].Role == "cf_reader" {
			rules.SelectPermissions[i].Permission.Columns = append(
				rules.SelectPermissions[i].Permission.Columns, "join_payload",
			)
			rules.SelectPermissions[i].Permission.AllowAggregations = true
		}
	}

	items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
		Role: "cf_tuple_filtered", Permission: metadata.SelectPermissionConfig{
			Columns:        []string{"id", "owner_id", "physical_json_text", "matched"},
			ComputedFields: []string{"item_nullable_json"},
			Filter:         map[string]any{"id": map[string]any{"_lt": 5}},
		},
	})
	items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
		Role: "cf_page_filtered", Permission: metadata.SelectPermissionConfig{
			Columns:           []string{"id", "label", "amount"},
			ComputedFields:    []string{"item_label"},
			Filter:            map[string]any{"id": map[string]any{"_lt": 5}},
			AllowAggregations: false,
		},
	})

	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "payload_tuple_array", Definition: metadata.RemoteRelationshipDef{
			ToSource: &metadata.ToSourceRelationship{
				FieldMapping: map[string]string{
					"owner_id": "owner_id", "item_payload": "payload",
				},
				RelationshipType: metadata.RelationshipTypeArray, Source: "cf_select",
				Table: metadata.TableSource{Schema: "cf_select", Name: "items"},
			},
		},
	}, metadata.RemoteRelationship{
		Name: "tuple_array",
		Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
			FieldMapping: map[string]string{
				"item_nullable_json": "physical_json_text", "owner_id": "owner_id",
			},
			RelationshipType: metadata.RelationshipTypeArray,
			Source:           "cf_select",
			Table:            metadata.TableSource{Schema: "cf_select", Name: "items"},
		}},
	})

	// Separate roles pin target column and row checks independently of the
	// computed grant on the source table.
	for _, role := range []string{"cf_lhs_only", "cf_target_no_col", "cf_target_filtered"} {
		items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
			Role: role, Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id"}, ComputedFields: []string{"item_label"},
				Filter: map[string]any{}, AllowAggregations: false,
			},
		})
	}

	for _, role := range []string{"cf_hidden_json", "cf_hidden_filtered"} {
		items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
			Role: role, Permission: metadata.SelectPermissionConfig{
				Columns:        []string{"id", "physical_json_key", "physical_json_text"},
				ComputedFields: []string{"item_json_mixed"},
				Filter:         map[string]any{}, AllowAggregations: false,
			},
		})

		ruleFilter := map[string]any{}
		if role == "cf_hidden_filtered" {
			ruleFilter = map[string]any{"id": map[string]any{"_lt": 91301403}}
		}

		rules.SelectPermissions = append(rules.SelectPermissions, metadata.SelectPermission{
			Role: role, Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id"}, Filter: ruleFilter, AllowAggregations: true,
			},
		})
	}

	rules.SelectPermissions = append(
		rules.SelectPermissions,
		metadata.SelectPermission{
			Role: "cf_target_no_col",
			Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id"}, Filter: map[string]any{}, AllowAggregations: true,
			},
		},
		metadata.SelectPermission{
			Role: "cf_target_filtered",
			Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "label"}, Filter: map[string]any{
					"id": map[string]any{"_lt": 91301301},
				}, AllowAggregations: true,
			},
		},
	)

	for _, spec := range []struct {
		name, key, target, source, table, kind string
	}{
		{"label_object", "item_label", "label", "cf_select", "items", metadata.RelationshipTypeObject},
		{"label_array", "item_label", "label", "cf_select", "items", metadata.RelationshipTypeArray},
		{"payload_object", "item_payload", "payload", "cf_select", "items", metadata.RelationshipTypeObject},
		{"rules_label", "item_label", "label", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"rules_payload", "item_payload", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"rules_json_string", "item_json_string", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"rules_json_number", "item_json_number", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"rules_json_array", "item_json_array", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"mixed_object", "item_json_mixed", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"mixed_array", "item_json_mixed", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"json_text_array", "item_json_text", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"json_shared_array", "item_json_shared", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"json_string_array", "item_json_string", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"json_number_array", "item_json_number", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"json_object_array", "item_payload", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"json_array_array", "item_json_array", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"text_rules_array", "item_label", "label", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_payload_array", "payload", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_primitive_array", "physical_json_key", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_primitive_object", "physical_json_key", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"physical_text_array", "physical_json_text", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_id_object", "physical_id_text", "id", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"null_text_object", "item_null_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"null_text_array", "item_null_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"mixed_text_object", "item_mixed_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"mixed_text_array", "item_mixed_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"null_json_object", "item_null_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"null_json_array", "item_null_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"mixed_json_object", "item_mixed_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"mixed_json_array", "item_mixed_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_all_null_text_object", "all_null_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"physical_all_null_text_array", "all_null_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_all_null_json_object", "all_null_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"physical_all_null_json_array", "all_null_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_null_text_object", "nullable_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"physical_null_text_array", "nullable_text", "label", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"physical_null_json_object", "nullable_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeObject},
		{"physical_null_json_array", "nullable_json", "join_payload", "cf_predicates", "rules", metadata.RelationshipTypeArray},
		{"invalid_args", "item_score", "amount", "cf_select", "items", metadata.RelationshipTypeObject},
		{"invalid_table", "item_tags", "label", "cf_select", "items", metadata.RelationshipTypeObject},
		{"invalid_collision", "label", "label", "cf_select", "items", metadata.RelationshipTypeObject},
	} {
		items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
			Name: spec.name,
			Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{spec.key: spec.target},
				RelationshipType: spec.kind,
				Source:           spec.source,
				Table:            metadata.TableSource{Schema: spec.source, Name: spec.table},
			}},
		})
	}

	tags := &md.Databases[0].Tables[1]
	tags.RemoteRelationships = append(tags.RemoteRelationships, metadata.RemoteRelationship{
		Name: "nested_null_array",
		Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
			FieldMapping:     map[string]string{"null_key": "label"},
			RelationshipType: metadata.RelationshipTypeArray,
			Source:           "cf_predicates",
			Table:            metadata.TableSource{Schema: "cf_predicates", Name: "rules"},
		}},
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md}, logger, "", nil)
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, role, query string
		want              map[string]any
		denied            bool
	}{
		{
			name: "nested computed key collides with selected alias", role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) { cf_label_object {
				item_mixed_text:id mixed_text_array(order_by:{id:asc}) { id }
			} } }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{
					"item_mixed_text": float64(1), "mixed_text_array": []any{
						map[string]any{
							"id": float64(91301301),
						},
						map[string]any{"id": float64(91301405)},
					},
				}},
				map[string]any{"cf_label_object": map[string]any{
					"item_mixed_text": float64(2), "mixed_text_array": nil,
				}},
			}},
		},
		{
			name: "nested remote phantom alias collision keeps user field", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { physical_id_object {
				_constellation_remote_phantom_id:owner_id
				physical_id_array { id }
			} } }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"physical_id_object": map[string]any{
					"_constellation_remote_phantom_id": float64(1),
					"physical_id_array":                []any{map[string]any{"id": float64(1)}},
				},
			}}},
		},
		{
			name: "nested physical collision keeps its real join key", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { physical_text_array {
				owner_id:id physical_id_array { id }
			} } }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"physical_text_array": []any{map[string]any{
					"owner_id":          float64(91301405),
					"physical_id_array": []any{map[string]any{"id": float64(1)}},
				}},
			}}},
		},
		{
			name: "computed remote object array and aggregate at two levels", role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) { root:cf_label_object {
				id cf_label_array(order_by:{id:asc}) { id next:cf_label_object { id } }
				cf_label_array_aggregate { aggregate { count } nodes { id cf_label_object { id } } }
			} } }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"root": map[string]any{
					"id": float64(1),
					"cf_label_array": []any{map[string]any{
						"id":   float64(1),
						"next": map[string]any{"id": float64(1)},
					}},
					"cf_label_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes": []any{map[string]any{
							"id":              float64(1),
							"cf_label_object": map[string]any{"id": float64(1)},
						}},
					},
				}},
				map[string]any{"root": map[string]any{
					"id": float64(2),
					"cf_label_array": []any{map[string]any{
						"id":   float64(2),
						"next": map[string]any{"id": float64(2)},
					}},
					"cf_label_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes": []any{map[string]any{
							"id":              float64(2),
							"cf_label_object": map[string]any{"id": float64(2)},
						}},
					},
				}},
			}},
		},
		{
			name: "physical keys through two remote hops", role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) { id physical_id_object {
				id physical_id_array(order_by:{id:asc}) { id physical_id_object { id } }
			} } }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"id": float64(1), "physical_id_object": map[string]any{
					"id": float64(1), "physical_id_array": []any{map[string]any{
						"id": float64(1), "physical_id_object": map[string]any{"id": float64(1)},
					}},
				}},
				map[string]any{"id": float64(2), "physical_id_object": map[string]any{
					"id": float64(2), "physical_id_array": []any{map[string]any{
						"id": float64(2), "physical_id_object": map[string]any{"id": float64(2)},
					}},
				}},
			}},
		},
		{
			name: "granted object array jsonb and cross-source with alias and fragment",
			role: "cf_reader",
			query: `query { cf_select_items(where:{id:{_eq:1}}) { id found:label_object { id } ...JoinFields } }
			fragment JoinFields on cf_select_items { label_array(order_by:{id:asc}) { id } payload_object { id } rules_label { id } rules_payload { id } }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"id": float64(1), "found": map[string]any{"id": float64(1)},
				"label_array":    []any{map[string]any{"id": float64(1)}},
				"payload_object": map[string]any{"id": float64(1)},
				"rules_label":    map[string]any{"id": float64(91301301)},
				"rules_payload":  map[string]any{"id": float64(91301301)},
			}}},
		},
		{
			name: "JSON string one does not join JSON number one", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				rules_json_string { id } rules_json_number { id }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"rules_json_string": map[string]any{"id": float64(91301402)},
				"rules_json_number": map[string]any{"id": float64(91301403)},
			}}},
		},
		{
			name: "JSON string number and array keys retain their types", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				rules_payload { id } rules_json_string { id }
				rules_json_number { id } rules_json_array { id }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"rules_payload":     map[string]any{"id": float64(91301301)},
				"rules_json_string": map[string]any{"id": float64(91301402)},
				"rules_json_number": map[string]any{"id": float64(91301403)},
				"rules_json_array":  map[string]any{"id": float64(91301404)},
			}}},
		},
		{
			name: "mixed JSON string and number keys do not collapse across rows",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) {
				id mixed_object { id } mixed_array(order_by:{id:asc}) { id }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{
					"id":           float64(1),
					"mixed_object": map[string]any{"id": float64(91301402)},
					"mixed_array":  []any{map[string]any{"id": float64(91301402)}},
				},
				map[string]any{
					"id":           float64(2),
					"mixed_object": map[string]any{"id": float64(91301403)},
					"mixed_array":  []any{map[string]any{"id": float64(91301403)}},
				},
			}},
		},
		{
			name: "mixed JSON aggregate and array keep string and number apart",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) { id
				mixed_array(order_by:{id:asc}) { id }
				grouped: mixed_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{
					"id": float64(1), "mixed_array": []any{map[string]any{"id": float64(91301402)}},
					"grouped": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301402)}},
					},
				},
				map[string]any{
					"id": float64(2), "mixed_array": []any{map[string]any{"id": float64(91301403)}},
					"grouped": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301403)}},
					},
				},
			}},
		},
		{
			name: "non-numeric JSON string aggregate alone",
			role: "admin",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				json_text_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"json_text_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(91301405)}},
				},
			}}},
		},
		{
			name: "JSON string and numeric two aggregate in same query",
			role: "admin",
			query: `{ cf_select_items(where:{id:{_eq:2}}) {
				json_string_array_aggregate { aggregate { count } nodes { id } }
				json_number_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"json_string_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(91301408)}},
				},
				"json_number_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(91301407)}},
				},
			}}},
		},
		{
			name: "JSON object and array aggregates and physical JSONB key",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) {
				json_object_array_aggregate { aggregate { count } nodes { id } }
				json_array_array_aggregate { aggregate { count } nodes { id } }
				physical_payload_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{
					"json_object_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301301)}},
					},
					"json_array_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301404)}},
					},
					"physical_payload_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301301)}},
					},
				},
				map[string]any{
					"json_object_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(0)},
						"nodes":     []any{},
					},
					"json_array_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(0)},
						"nodes":     []any{},
					},
					"physical_payload_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(0)},
						"nodes":     []any{},
					},
				},
			}},
		},
		{
			name: "physical JSONB primitive aggregate keeps types distinct",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) {
				physical_primitive_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"physical_primitive_array_aggregate": map[string]any{
					"aggregate": map[string]any{
						"count": float64(1),
					},
					"nodes": []any{map[string]any{"id": float64(91301402)}},
				}},
				map[string]any{"physical_primitive_array_aggregate": map[string]any{
					"aggregate": map[string]any{
						"count": float64(1),
					},
					"nodes": []any{map[string]any{"id": float64(91301403)}},
				}},
			}},
		},
		{
			name: "hidden JSONB target column physical object array and aggregate",
			role: "cf_hidden_json",
			query: `{ cf_select_items(order_by:{id:asc}) { id
				physical_primitive_object { id }
				physical_primitive_array(order_by:{id:asc}) { id }
				physical_primitive_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{
					"id": float64(
						1,
					),
					"physical_primitive_object": map[string]any{"id": float64(91301402)},
					"physical_primitive_array":  []any{map[string]any{"id": float64(91301402)}},
					"physical_primitive_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301402)}},
					},
				},
				map[string]any{
					"id": float64(
						2,
					),
					"physical_primitive_object": map[string]any{"id": float64(91301403)},
					"physical_primitive_array":  []any{map[string]any{"id": float64(91301403)}},
					"physical_primitive_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301403)}},
					},
				},
			}},
		},
		{
			name: "hidden JSONB target nonnumeric string selected alone",
			role: "cf_hidden_json",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				physical_text_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"physical_text_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(91301405)}},
				},
			}}},
		},
		{
			name: "visible JSONB target nonnumeric control", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { physical_text_array { id } } }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"physical_text_array": []any{map[string]any{"id": float64(91301405)}},
			}}},
		},
		{
			name: "nested remote target filter excludes parent without running child",
			role: "cf_target_filtered",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				physical_text_array { id physical_id_object { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"physical_text_array": []any{},
			}}},
		},
		{
			name: "hidden JSONB target still enforces row filter", role: "cf_hidden_filtered",
			query: `{ cf_select_items(order_by:{id:asc}) {
				physical_primitive_array { id }
				physical_primitive_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{
					"physical_primitive_array": []any{map[string]any{"id": float64(91301402)}},
					"physical_primitive_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(1)},
						"nodes":     []any{map[string]any{"id": float64(91301402)}},
					},
				},
				map[string]any{
					"physical_primitive_array": []any{},
					"physical_primitive_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(0)},
						"nodes":     []any{},
					},
				},
			}},
		},
		{
			name:  "non-JSON physical text to integer retains cross-scalar equality",
			role:  "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) { physical_id_object { id } } }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"physical_id_object": map[string]any{"id": float64(1)}},
				map[string]any{"physical_id_object": map[string]any{"id": float64(2)}},
			}},
		},
		{
			name: "hidden JSONB target cannot expose computed key", role: "cf_hidden_json",
			query: `{ cf_select_items { mixed_array { id } } }`, denied: true,
		},
		{
			name:   "hidden JSONB target cannot expose computed aggregate",
			role:   "cf_hidden_json",
			query:  `{ cf_select_items { mixed_array_aggregate { aggregate { count } } } }`,
			denied: true,
		},
		{
			name: "two parents share JSON aggregate key",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) {
				json_shared_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"json_shared_array_aggregate": map[string]any{
					"aggregate": map[string]any{
						"count": float64(1),
					},
					"nodes": []any{map[string]any{"id": float64(91301405)}},
				}},
				map[string]any{"json_shared_array_aggregate": map[string]any{
					"aggregate": map[string]any{
						"count": float64(1),
					},
					"nodes": []any{map[string]any{"id": float64(91301405)}},
				}},
			}},
		},
		{
			name: "text aggregate retains arguments and target permissions",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) {
				text_rules_array_aggregate(where:{id:{_gte:91301405}}, order_by:{id:asc}, limit:1) {
					aggregate { count } nodes { id }
				}
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"text_rules_array_aggregate": map[string]any{
					"aggregate": map[string]any{
						"count": float64(1),
					},
					"nodes": []any{map[string]any{"id": float64(91301405)}},
				}},
				map[string]any{"text_rules_array_aggregate": map[string]any{
					"aggregate": map[string]any{
						"count": float64(1),
					},
					"nodes": []any{map[string]any{"id": float64(91301406)}},
				}},
			}},
		},
		{
			name: "JSON aggregate applies where and limit per group",
			role: "cf_reader",
			query: `{ cf_select_items(order_by:{id:asc}) {
				mixed_array_aggregate(where:{id:{_gte:91301403}}, limit:1) {
					aggregate { count } nodes { id }
				}
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"mixed_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(0)}, "nodes": []any{},
				}},
				map[string]any{"mixed_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(91301403)}},
				}},
			}},
		},
		{
			name: "target row filter applies to aggregate", role: "cf_target_filtered",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				text_rules_array_aggregate { aggregate { count } nodes { id } }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"text_rules_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(0)}, "nodes": []any{},
				},
			}}},
		},
		{
			name: "JSON path selection cannot replace full join key", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				item_payload(path:"status") payload_object { id }
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"item_payload": "ready", "payload_object": map[string]any{"id": float64(1)},
			}}},
		},
		{
			name: "target access without key grant denies the join", role: "cf_no_grant",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { rules_label { id } } }`, denied: true,
		},
		{
			name: "target table select grant absent", role: "cf_lhs_only",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { rules_label { id } } }`, denied: true,
		},
		{
			name: "target join column not selectable", role: "cf_target_no_col",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { rules_label { id } } }`, denied: true,
		},
		{
			name: "target join column not selectable for aggregate", role: "cf_target_no_col",
			query: `{ cf_select_items(where:{id:{_eq:1}}) {
				text_rules_array_aggregate { aggregate { count } }
			} }`, denied: true,
		},
		{
			name: "target row filter", role: "cf_target_filtered",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { rules_label { id } } }`,
			want:  map[string]any{"cf_select_items": []any{map[string]any{"rules_label": nil}}},
		},
		{
			name: "no key grant denies self object", role: "cf_no_grant",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { label_object { id } } }`, denied: true,
		},
		{
			name:   "no key grant denies jsonb",
			role:   "cf_filtered_one",
			query:  `{ cf_select_items(where:{id:{_eq:1}}) { payload_object { id } } }`,
			denied: true,
		},
		{
			name: "argument-bearing key absent", role: "cf_reader",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { invalid_args { id } } }`, denied: true,
		},
		{
			name: "table-valued key absent", role: "admin",
			query: `{ cf_select_items(where:{id:{_eq:1}}) { invalid_table { id } } }`, denied: true,
		},
		{
			name:   "invalid computed identity cannot reuse physical column",
			role:   "admin",
			query:  `{ cf_select_items(where:{id:{_eq:1}}) { invalid_collision { id } } }`,
			denied: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := adminSessionContext(t)
			if tt.role != "admin" {
				ctx = runSessionMiddleware(t, http.Header{
					"X-Hasura-Admin-Secret": {testAdminSecret},
					"X-Hasura-Role":         {tt.role},
				})
			}

			resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: tt.query})
			if err != nil {
				t.Fatal(err)
			}

			if tt.denied {
				if resp.Errors == nil || resp.Data != nil {
					t.Fatalf("expected GraphQL validation rejection without data: %+v", resp)
				}

				return
			}

			if resp.Errors != nil || !reflect.DeepEqual(resp.Data, tt.want) {
				t.Fatalf("response = %+v, want data %#v", resp, tt.want)
			}

			// Phantom keys were evaluated in the source connector but never
			// become response keys, even through aliases and fragments.
			encoded, err := json.Marshal(resp.Data)
			if err != nil {
				t.Fatal(err)
			}

			if strings.Contains(string(encoded), "_constellation_phantom_") ||
				strings.Contains(string(encoded), `"_constellation_remote_phantom_id_1"`) ||
				strings.Contains(string(encoded), `"item_label"`) ||
				strings.Contains(string(encoded), `"item_json_mixed"`) {
				t.Fatalf("phantom field leaked: %s", encoded)
			}
		})
	}

	// Null SQL and JSONB-literal keys never join, including against the
	// target JSONB literal null row. Match Hasura's explicit null for all
	// three relationship shapes, even though array/aggregate SDL is NON_NULL.
	for _, role := range []string{"admin", "cf_reader"} {
		for _, spec := range []struct {
			name, object, array string
			matchingIDs         []any
		}{
			{"computed SQL-null text", "null_text_object", "null_text_array", nil},
			{"computed JSON-literal and SQL-null", "null_json_object", "null_json_array", nil},
			{"physical SQL-null text", "physical_all_null_text_object", "physical_all_null_text_array", nil},
			{"physical SQL-null JSONB", "physical_all_null_json_object", "physical_all_null_json_array", nil},
			{"computed mixed text", "mixed_text_object", "mixed_text_array", []any{float64(91301301), float64(91301405)}},
			{"computed mixed JSONB", "mixed_json_object", "mixed_json_array", []any{float64(91301405)}},
			{"physical mixed text", "physical_null_text_object", "physical_null_text_array", []any{float64(91301301), float64(91301405)}},
			{"physical mixed JSONB", "physical_null_json_object", "physical_null_json_array", []any{float64(91301405)}},
		} {
			t.Run(role+" "+spec.name, func(t *testing.T) {
				ctx := adminSessionContext(t)
				if role != "admin" {
					ctx = runSessionMiddleware(t, http.Header{
						"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {role},
					})
				}

				query := fmt.Sprintf(`{ cf_select_items(order_by:{id:asc}) { id
					o:%s { id } a:%s(order_by:{id:asc}) { id }
					g:%s_aggregate { aggregate { count } nodes { id } }
				} }`, spec.object, spec.array, spec.array)

				response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: query})
				if err != nil || response.Errors != nil {
					t.Fatalf("null join response=%+v error=%v", response, err)
				}

				rows := []any{
					map[string]any{"id": float64(1), "o": nil, "a": nil, "g": nil},
					map[string]any{"id": float64(2), "o": nil, "a": nil, "g": nil},
				}
				if len(spec.matchingIDs) != 0 {
					matches := make([]any, 0, len(spec.matchingIDs))
					for _, id := range spec.matchingIDs {
						matches = append(matches, map[string]any{"id": id})
					}

					rows[0] = map[string]any{
						"id": float64(1),
						"o":  matches[0],
						"a":  matches,
						"g": map[string]any{
							"aggregate": map[string]any{"count": float64(len(matches))},
							"nodes":     matches,
						},
					}
				}

				want := map[string]any{"cf_select_items": rows}
				if !reflect.DeepEqual(response.Data, want) {
					t.Fatalf("response=%#v, want %#v", response.Data, want)
				}
			})
		}
	}

	// The real key must be read through its internal alias when the user
	// assigns its response name to a different field. In particular, item 2's
	// non-null id cannot turn a null-key array into an empty array.
	for _, role := range []string{"admin", "cf_reader"} {
		t.Run(role+" null key colliding response alias", func(t *testing.T) {
			ctx := adminSessionContext(t)
			if role != "admin" {
				ctx = runSessionMiddleware(t, http.Header{
					"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {role},
				})
			}

			resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: `{
				cf_select_items(order_by:{id:asc}) { item_mixed_text:id
					mixed_text_array(order_by:{id:asc}) { id }
					mixed_text_object { id }
					mixed_text_array_aggregate { aggregate { count } }
				}
			}`})

			want := map[string]any{"cf_select_items": []any{
				map[string]any{
					"item_mixed_text": float64(1),
					"mixed_text_array": []any{
						map[string]any{"id": float64(91301301)},
						map[string]any{"id": float64(91301405)},
					},
					"mixed_text_object": map[string]any{"id": float64(91301301)},
					"mixed_text_array_aggregate": map[string]any{
						"aggregate": map[string]any{"count": float64(2)},
					},
				},
				map[string]any{
					"item_mixed_text": float64(2), "mixed_text_array": nil,
					"mixed_text_object": nil, "mixed_text_array_aggregate": nil,
				},
			}}
			if err != nil || resp.Errors != nil || !reflect.DeepEqual(resp.Data, want) {
				t.Fatalf("response=%+v err=%v want=%#v", resp, err, want)
			}
		})
	}

	// Selected alone, fragment and nested variants must not depend on any
	// sibling relationship having a non-null join argument.
	for _, tt := range []struct {
		name, query string
		want        map[string]any
	}{
		{
			"remote result nested null JSON and two-level fragment", `query {
				cf_select_items(order_by:{id:asc}) { item:cf_label_object {
					id ...NestedNull
				}
			} }
			fragment NestedNull on cf_select_items {
				o:null_json_object { id } a:null_json_array { id }
				g:null_json_array_aggregate { aggregate { count } nodes { id } }
				mixed:mixed_json_array(order_by:{id:asc}) { id }
				deeper:cf_label_array(order_by:{id:asc}) { id ...DeepNull }
			}
			fragment DeepNull on cf_select_items { n:null_json_object { id } }`,
			map[string]any{"cf_select_items": []any{
				map[string]any{"item": map[string]any{
					"id": float64(1),
					"o":  nil, "a": nil, "g": nil,
					"mixed":  []any{map[string]any{"id": float64(91301405)}},
					"deeper": []any{map[string]any{"id": float64(1), "n": nil}},
				}},
				map[string]any{"item": map[string]any{
					"id": float64(2),
					"o":  nil, "a": nil, "g": nil, "mixed": nil,
					"deeper": []any{map[string]any{"id": float64(2), "n": nil}},
				}},
			}},
		},
		{
			"all null array alone", `{ cf_select_items(order_by:{id:asc}) { a:null_json_array { id } } }`,
			map[string]any{"cf_select_items": []any{map[string]any{"a": nil}, map[string]any{"a": nil}}},
		},
		{
			"all null aggregate alone", `{ cf_select_items(order_by:{id:asc}) { g:null_text_array_aggregate { aggregate { count } } } }`,
			map[string]any{"cf_select_items": []any{map[string]any{"g": nil}, map[string]any{"g": nil}}},
		},
		{
			"null fragment", `query { cf_select_items(order_by:{id:asc}) { ...NullRels } }
				fragment NullRels on cf_select_items { o:null_json_object { id } a:null_json_array { id }
				g:null_json_array_aggregate { aggregate { count } nodes { id } } }`,
			map[string]any{"cf_select_items": []any{
				map[string]any{"o": nil, "a": nil, "g": nil}, map[string]any{"o": nil, "a": nil, "g": nil},
			}},
		},
		{"nested null", `{ cf_select_items(order_by:{id:asc}) {
				item_tags(order_by:{id:asc}) { id a:nested_null_array { id }
					g:nested_null_array_aggregate { aggregate { count } } }
			} }`, map[string]any{"cf_select_items": []any{
			map[string]any{"item_tags": []any{
				map[string]any{"id": float64(1), "a": nil, "g": nil},
				map[string]any{"id": float64(2), "a": nil, "g": nil},
			}},
			map[string]any{"item_tags": []any{map[string]any{"id": float64(3), "a": nil, "g": nil}}},
		}}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			response, err := ctrl.Resolve(
				adminSessionContext(t),
				controller.GraphQLRequest{Query: tt.query},
			)
			if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, tt.want) {
				t.Fatalf("response=%+v, error=%v, want=%#v", response, err, tt.want)
			}
		})
	}

	// The controller caches parsed query documents by text and role. Remote
	// arguments must resolve afresh for each request, even through nested
	// objects/lists and local fields inside a remote target selection.
	for _, tc := range []struct {
		name, query   string
		first, second map[string]any
	}{
		{
			name: "flat remote array nested argument value",
			query: `query($n:Int!) { cf_select_items(order_by:{id:asc}) {
				cf_label_array(where:{_and:[{id:{_eq:$n}}]}) { id }
			} }`,
			first: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}},
				map[string]any{"cf_label_array": []any{}},
			}},
			second: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_array": []any{}},
				map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}},
			}},
		},
		{
			name: "nested remote array variable",
			query: `query($n:Int!) { cf_select_items(order_by:{id:asc}) {
				cf_label_object { cf_label_array(where:{id:{_eq:$n}}) { id } }
			} }`,
			first: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{
					"cf_label_array": []any{map[string]any{"id": float64(1)}},
				}},
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{}}},
			}},
			second: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{}}},
				map[string]any{"cf_label_object": map[string]any{
					"cf_label_array": []any{map[string]any{"id": float64(2)}},
				}},
			}},
		},
		{
			name: "leaf computed argument inside remote result",
			query: `query($m:Int!) { cf_select_items(order_by:{id:asc}) {
				cf_label_object { id item_score(args:{multiplier:$m}) }
			} }`,
			first: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"id": float64(1), "item_score": float64(12.5)}},
				map[string]any{"cf_label_object": map[string]any{"id": float64(2), "item_score": float64(3.25)}},
			}},
			second: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"id": float64(1), "item_score": float64(37.5)}},
				map[string]any{"cf_label_object": map[string]any{"id": float64(2), "item_score": float64(9.75)}},
			}},
		},
		{
			name: "local field argument inside remote result",
			query: `query($n:Int!) { cf_select_items(where:{id:{_eq:1}}) {
				cf_label_object { item_tags(where:{id:{_eq:$n}}) { id } }
			} }`,
			first: map[string]any{"cf_select_items": []any{map[string]any{
				"cf_label_object": map[string]any{
					"item_tags": []any{map[string]any{"id": float64(1)}},
				},
			}}},
			second: map[string]any{"cf_select_items": []any{map[string]any{
				"cf_label_object": map[string]any{
					"item_tags": []any{map[string]any{"id": float64(2)}},
				},
			}}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
			})

			iterations := []struct {
				n    int
				want map[string]any
			}{{1, tc.first}, {2, tc.second}}
			if tc.name == "leaf computed argument inside remote result" {
				iterations = []struct {
					n    int
					want map[string]any
				}{{1, tc.first}, {3, tc.second}}
			}

			for _, iteration := range iterations {
				response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
					Query: tc.query, Variables: map[string]any{"n": iteration.n, "m": iteration.n},
				})
				if err != nil || response.Errors != nil ||
					!reflect.DeepEqual(response.Data, iteration.want) {
					t.Fatalf(
						"n=%d response=%+v error=%v want=%#v",
						iteration.n,
						response,
						err,
						iteration.want,
					)
				}
			}
		})
	}

	// GraphQL field collection merges each response path, including fields
	// contributed by fragments and remote children. A missing join column in
	// one occurrence must not delete a user-selected column in another.
	for _, tc := range []struct {
		name, query, role string
		want              map[string]any
	}{
		{
			name: "flat duplicate object with selected join column", role: "cf_reader",
			query: `query { cf_select_items(order_by:{id:asc}) {
				cf_label_object { id }
				... on cf_select_items { cf_label_object { label } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"id": float64(1), "label": "first"}},
				map[string]any{"cf_label_object": map[string]any{"id": float64(2), "label": "second"}},
			}},
		},
		{
			name: "nested named fragment array and child", role: "cf_reader",
			query: `query { cf_select_items(order_by:{id:asc}) {
				cf_label_object { cf_label_array { id cf_payload_object { id } } ...Dup }
			} } fragment Dup on cf_select_items {
				cf_label_array { item_label cf_payload_object { label } }
			}`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{
					map[string]any{
						"id": float64(1), "item_label": "first",
						"cf_payload_object": map[string]any{"id": float64(1), "label": "first"},
					},
				}}},
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{
					map[string]any{
						"id": float64(2), "item_label": "second",
						"cf_payload_object": map[string]any{"id": float64(2), "label": "second"},
					},
				}}},
			}},
		},
		{
			name: "duplicate child leaves no internal phantom", role: "cf_reader",
			query: `query { cf_select_items(order_by:{id:asc}) {
				cf_label_object { cf_label_array { id } }
				... on cf_select_items { cf_label_object { mixed_text_array { id } } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}, "mixed_text_array": []any{map[string]any{"id": float64(91301301)}, map[string]any{"id": float64(91301405)}}}},
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}, "mixed_text_array": nil}},
			}},
		},
		{
			name: "duplicate child retains sibling user join key", role: "cf_reader",
			query: `query { cf_select_items(order_by:{id:asc}) {
				cf_label_object { cf_label_array { id } }
				... on cf_select_items { cf_label_object { item_label } }
			} }`,
			want: map[string]any{"cf_select_items": []any{
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}, "item_label": "first"}},
				map[string]any{"cf_label_object": map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}, "item_label": "second"}},
			}},
		},
		{
			name: "duplicate aggregate nodes", role: "cf_reader",
			query: `query { cf_select_items(where:{id:{_eq:1}}) {
				cf_label_array_aggregate { aggregate { count } nodes { id } }
				... on cf_select_items {
					cf_label_array_aggregate { nodes { item_label cf_label_object { id } } }
				}
			} }`,
			want: map[string]any{"cf_select_items": []any{map[string]any{
				"cf_label_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes": []any{map[string]any{
						"id": float64(1), "item_label": "first",
						"cf_label_object": map[string]any{"id": float64(1)},
					}},
				},
			}}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := adminSessionContext(t)
			if tc.role != "admin" {
				ctx = runSessionMiddleware(t, http.Header{
					"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {tc.role},
				})
			}

			response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: tc.query})
			if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, tc.want) {
				t.Fatalf("response=%+v error=%v want=%#v", response, err, tc.want)
			}
		})
	}

	for _, include := range []bool{false, true} {
		query := `query($include:Boolean!) { cf_select_items(where:{id:{_eq:1}}) {
			cf_label_object { id }
			...More @include(if:$include)
		} } fragment More on cf_select_items {
			cf_label_object { label }
		}`
		ctx := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		})
		response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: query, Variables: map[string]any{"include": include},
		})

		object := map[string]any{"id": float64(1)}
		if include {
			object["label"] = "first"
		}

		want := map[string]any{"cf_select_items": []any{map[string]any{
			"cf_label_object": object,
		}}}
		if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
			t.Fatalf(
				"fragment include=%t response=%+v err=%v want=%#v",
				include,
				response,
				err,
				want,
			)
		}
	}

	// A skipped spread cannot satisfy the target join-column selection.
	for _, include := range []bool{false, true, false} {
		ctx := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		})
		response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `query($include:Boolean!) { cf_select_items(where:{id:{_eq:1}}) {
				cf_label_object { id ...TargetLabel @include(if:$include) }
			} } fragment TargetLabel on cf_select_items { label }`,
			Variables: map[string]any{"include": include},
		})

		object := map[string]any{"id": float64(1)}
		if include {
			object["label"] = "first"
		}

		want := map[string]any{"cf_select_items": []any{map[string]any{"cf_label_object": object}}}
		if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
			t.Fatalf(
				"target fragment include=%t response=%+v err=%v want=%#v",
				include,
				response,
				err,
				want,
			)
		}
	}

	nestedMutation, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		Query: `mutation { insert_cf_select_items_one(object:{id:91301303,
			owner_id:1,label:"inserted nested",amount:4,payload:{status:"ready"}}) {
			cf_label_object { id cf_label_array { id } }
		} }`,
	})
	if err != nil || nestedMutation.Errors != nil || !reflect.DeepEqual(nestedMutation.Data,
		map[string]any{"insert_cf_select_items_one": map[string]any{
			"cf_label_object": map[string]any{
				"id":             float64(91301303),
				"cf_label_array": []any{map[string]any{"id": float64(91301303)}},
			},
		}}) {
		t.Fatalf("nested mutation returning: response=%+v err=%v", nestedMutation, err)
	}

	mutation, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		Query: `mutation { insert_cf_select_items_one(object:{id:91301302,
			owner_id:1,label:"inserted",amount:4,payload:{status:"ready"}}) {
			cf_label_object { id }
			... on cf_select_items { cf_label_object { label } }
			noObject: null_json_object { id }
			noArray: null_json_array { id }
			noAggregate: null_json_array_aggregate { aggregate { count } }
			physicalNull: physical_all_null_text_array { id }
		} }`,
	})
	if err != nil || mutation.Errors != nil {
		t.Fatalf("mutation returning computed join: response=%+v error=%v", mutation, err)
	}

	mutationWant := map[string]any{"insert_cf_select_items_one": map[string]any{
		"cf_label_object": map[string]any{"id": float64(91301302), "label": "inserted"},
		"noObject":        nil, "noArray": nil, "noAggregate": nil, "physicalNull": nil,
	}}
	if !reflect.DeepEqual(mutation.Data, mutationWant) {
		t.Fatalf("mutation returning join = %#v, want %#v", mutation.Data, mutationWant)
	}

	_, err = pool.Exec(t.Context(), `UPDATE cf_select.items SET payload='{"status":"inserted"}'
		WHERE id IN (91301302,91301303)`)
	if err != nil {
		t.Fatal(err)
	}

	// Additional target rows are isolated to this testdb and inserted only after
	// the preceding assertions, so each parent's array has several matches.
	_, err = pool.Exec(
		t.Context(),
		`INSERT INTO cf_select.items(id,owner_id,label,amount,payload) VALUES
		(3,1,'first',12.5,'{}'), (4,2,'second',3.25,'{}'),
		(5,1,'first',3.25,'{}'), (6,2,'second',12.5,'{}'),
		(8,1,'third',3.25,'{"kind":"tuple"}'),
		(9,1,'third',3.25,'{"kind":"tuple"}'),
		(10,1,'third',3.25,'{"kind":"tuple"}');
		UPDATE cf_select.items SET physical_json_text=to_jsonb(label),
		matched=CASE WHEN id IN (1,2) THEN 'a' WHEN id IN (3,4) THEN 'b' ELSE 'c' END
		WHERE id BETWEEN 1 AND 10`,
	)
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query, role string
		want              map[string]any
	}{
		{"tuple array single key and null component", `{ cf_select_items(where:{id:{_in:[1,3]}},order_by:{id:asc}) {
			id tuple_array(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"id": float64(1), "tuple_array": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"id": float64(3), "tuple_array": nil},
		}}},
		{"different first component with shared owner", `{ cf_select_items(where:{id:{_in:[1,8]}},order_by:{id:asc}) {
			tuple_array(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(9)}}},
		}}},
		{"tuple object JSONB component", `{ cf_select_items(where:{id:{_in:[1,8]}},order_by:{id:asc}) {
			payload_tuple_array(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"payload_tuple_array": []any{}},
			map[string]any{"payload_tuple_array": []any{map[string]any{"id": float64(9)}}},
		}}},
		{"tuple array per-key offset and repeated key", `{ cf_select_items(where:{id:{_in:[1,2,3,5]}},order_by:{id:asc}) {
			id ...TuplePage
		} } fragment TuplePage on cf_select_items {
			matchedRows:tuple_array(order_by:{id:asc},offset:1,limit:1) { id matched item_matched }
		}`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"id": float64(1), "matchedRows": []any{map[string]any{
				"id": float64(3), "matched": "b", "item_matched": "b",
			}}},
			map[string]any{"id": float64(2), "matchedRows": []any{map[string]any{
				"id": float64(4), "matched": "b", "item_matched": "b",
			}}},
			map[string]any{"id": float64(3), "matchedRows": nil},
			map[string]any{"id": float64(5), "matchedRows": []any{map[string]any{
				"id": float64(3), "matched": "b", "item_matched": "b",
			}}},
		}}},
		{"tuple target role filter excludes third row", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			tuple_array(order_by:{id:asc},offset:1,limit:2) { id }
		} }`, "cf_tuple_filtered", map[string]any{"cf_select_items": []any{
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(4)}}},
		}}},
		{"tuple distinct on matched and filtered target", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			tuple_array(where:{matched:{_in:["b","c"]}},distinct_on:[matched],
			order_by:[{matched:asc},{id:asc}],offset:1,limit:1) { id matched }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(5), "matched": "c"}}},
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(6), "matched": "c"}}},
		}}},
		{"mixed null keys", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			physical_null_text_array(limit:1,order_by:{id:asc}) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"physical_null_text_array": []any{map[string]any{"id": float64(91301301)}}},
			map[string]any{"physical_null_text_array": nil},
		}}},
		{"flat limit per parent", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(limit:1,order_by:{id:asc}) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}},
		}}},
		{"repeated parent values", `{ cf_select_items(where:{id:{_lte:4}},order_by:{id:asc}) {
			cf_label_array(limit:1,order_by:{id:asc}) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(1)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(2)}}},
		}}},
		{"typed jsonb string and numeric keys", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			mixed_array(limit:1,order_by:{id:asc}) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"mixed_array": []any{map[string]any{"id": float64(91301402)}}},
			map[string]any{"mixed_array": []any{map[string]any{"id": float64(91301403)}}},
		}}},
		{"flat offset per parent", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(limit:1,offset:1,order_by:{id:asc}) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(4)}}},
		}}},
		{"paginated array with remote descendants", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(limit:1,order_by:{id:asc}) { id cf_payload_object { id } }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{map[string]any{
				"id": float64(1), "cf_payload_object": map[string]any{"id": float64(1)},
			}}},
			map[string]any{"cf_label_array": []any{map[string]any{
				"id": float64(2), "cf_payload_object": map[string]any{"id": float64(2)},
			}}},
		}}},
		{"nested fragmented per parent", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_object { ...Page }
		} } fragment Page on cf_select_items {
			a:cf_label_array(limit:1,offset:1,order_by:{id:asc}) { id }
		}`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_object": map[string]any{"a": []any{map[string]any{"id": float64(3)}}}},
			map[string]any{"cf_label_object": map[string]any{"a": []any{map[string]any{"id": float64(4)}}}},
		}}},
		{"distinct per parent with shared amounts", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(distinct_on:[amount],order_by:[{amount:asc},{id:desc}]) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{
				map[string]any{"id": float64(5)}, map[string]any{"id": float64(3)},
			}},
			map[string]any{"cf_label_array": []any{
				map[string]any{"id": float64(4)}, map[string]any{"id": float64(6)},
			}},
		}}},
		{"distinct before limit", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(distinct_on:[amount],order_by:[{amount:asc},{id:desc}],limit:1) { id }
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(5)}}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(4)}}},
		}}},
		{"array and aggregate siblings", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(limit:1,offset:1,order_by:{id:asc}) { id }
			cf_label_array_aggregate(limit:1,offset:1,order_by:{id:asc}) {
				aggregate { count } nodes { id }
			}
		} }`, "cf_reader", map[string]any{"cf_select_items": []any{
			map[string]any{
				"cf_label_array": []any{map[string]any{"id": float64(3)}},
				"cf_label_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(3)}},
				},
			},
			map[string]any{
				"cf_label_array": []any{map[string]any{"id": float64(4)}},
				"cf_label_array_aggregate": map[string]any{
					"aggregate": map[string]any{"count": float64(1)},
					"nodes":     []any{map[string]any{"id": float64(4)}},
				},
			},
		}}},
		{"filtered target and combined arguments", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			cf_label_array(where:{id:{_gte:2}},offset:1,limit:1,order_by:{id:asc}) { id }
		} }`, "cf_page_filtered", map[string]any{"cf_select_items": []any{
			map[string]any{"cf_label_array": []any{}},
			map[string]any{"cf_label_array": []any{map[string]any{"id": float64(4)}}},
		}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {tc.role},
			})

			response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: tc.query})
			if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, tc.want) {
				t.Fatalf("response=%+v err=%v want=%#v", response, err, tc.want)
			}
		})
	}

	invalid, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		Query: `{ cf_select_items(where:{id:{_lte:2}}) {
			tuple_array(distinct_on:[matched],order_by:{id:asc},limit:1) { id }
		} }`,
	})
	if err != nil {
		t.Fatal(err)
	}

	invalidErrors, ok := invalid.Errors.([]map[string]any)
	if !ok || len(invalidErrors) != 1 {
		t.Fatalf("expected structured composite pagination validation: %+v", invalid)
	}

	invalidExtensions, ok := invalidErrors[0]["extensions"].(map[string]any)
	if !ok || invalidExtensions["code"] != "validation-failed" ||
		invalidExtensions["path"] != "$.selectionSet.cf_select_items.selectionSet.tuple_array.args" {
		t.Fatalf("invalid composite pagination envelope: %+v", invalidErrors)
	}

	for _, iteration := range []struct {
		limit, offset int
		want          []any
	}{
		{1, 0, []any{map[string]any{"id": float64(1)}}},
		{1, 1, []any{map[string]any{"id": float64(3)}}},
		{1, 0, []any{map[string]any{"id": float64(1)}}},
	} {
		ctx := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		})
		response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `query($l:Int!,$o:Int!) { cf_select_items(where:{id:{_eq:1}}) {
				cf_label_array(limit:$l,offset:$o,order_by:{id:asc}) { id }
			} }`,
			Variables: map[string]any{"l": iteration.limit, "o": iteration.offset},
		})

		want := map[string]any{"cf_select_items": []any{map[string]any{
			"cf_label_array": iteration.want,
		}}}
		if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
			t.Fatalf("pagination variables %d/%d: response=%+v err=%v want=%#v",
				iteration.limit, iteration.offset, response, err, want)
		}
	}

	for _, check := range []struct { //nolint:paralleltest // Introspection shares the fixture.
		role, field string
		visible     bool
	}{
		{"cf_reader", "label_object", true},
		{"cf_reader", "rules_payload", true},
		{"cf_no_grant", "label_object", false},
		{"cf_filtered_one", "payload_object", false},
		{"cf_target_no_col", "rules_label", false},
		{"cf_lhs_only", "rules_label", false},
		{"admin", "invalid_table", false},
		{"admin", "invalid_collision", false},
	} {
		ctx := adminSessionContext(t)
		if check.role != "admin" {
			ctx = runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {check.role},
			})
		}

		resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `{ __type(name:"cf_select_items") { fields { name } } }`,
		})
		if err != nil || resp.Errors != nil {
			t.Fatalf("role %s SDL: response=%+v err=%v", check.role, resp, err)
		}

		encoded, err := json.Marshal(resp.Data)
		if err != nil {
			t.Fatal(err)
		}

		found := strings.Contains(string(encoded), `"name":"`+check.field+`"`)
		if found != check.visible {
			t.Fatalf("role %s field %s visible=%t, want %t: %s",
				check.role, check.field, found, check.visible, encoded)
		}
	}

	// Add these rows only after the existing matrix: their shared label would
	// otherwise change unrelated collection and distinctness expectations.
	if _, err := pool.Exec(t.Context(), `INSERT INTO cf_select.items
		(id,owner_id,label,amount,payload,physical_json_text) VALUES
		(12,2,'first',99,'{}','"first"'),
		(13,2,'first',99,'{}','"first"'),
		(14,2,'first',99,'{}','"first"')`); err != nil {
		t.Fatal(err)
	}

	t.Run("shared first sorted component requires owner predicate", func(t *testing.T) {
		ctx := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		})
		response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `{ cf_select_items(where:{id:{_in:[1,12]}},order_by:{id:asc}) {
				tuple_array(order_by:{id:asc},offset:1,limit:1) { id }
			} }`,
		})

		want := map[string]any{"cf_select_items": []any{
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"tuple_array": []any{map[string]any{"id": float64(13)}}},
		}}
		if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
			t.Fatalf("response=%+v err=%v want=%#v", response, err, want)
		}
	})
}
