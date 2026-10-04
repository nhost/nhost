package integration_test

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
)

const orderedInsertReset = `TRUNCATE cf_insert_order.events, cf_insert_order.after_0,
 cf_insert_order.after_1, cf_insert_order.child, cf_insert_order.parent,
 cf_insert_order.before_object RESTART IDENTITY CASCADE`

type orderedInsertSnapshot struct {
	Events                                    []string
	Parents, Before, Children, After0, After1 int
	ChildFKs                                  []int
	AfterFKs                                  []int
}

func orderedInsertState(ctx context.Context, conn *pgx.Conn) (orderedInsertSnapshot, error) {
	state := orderedInsertSnapshot{}

	rows, err := conn.Query(ctx, `SELECT tag FROM cf_insert_order.events ORDER BY seq`)
	if err != nil {
		return state, fmt.Errorf("reading event order: %w", err)
	}

	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			rows.Close()
			return state, fmt.Errorf("scanning event: %w", err)
		}

		state.Events = append(state.Events, tag)
	}

	if err := rows.Err(); err != nil {
		rows.Close()
		return state, fmt.Errorf("iterating events: %w", err)
	}

	rows.Close()

	if err := conn.QueryRow(ctx, `SELECT
(SELECT count(*) FROM cf_insert_order.parent),
(SELECT count(*) FROM cf_insert_order.before_object),
(SELECT count(*) FROM cf_insert_order.child),
(SELECT count(*) FROM cf_insert_order.after_0),
(SELECT count(*) FROM cf_insert_order.after_1)`).Scan(&state.Parents, &state.Before, &state.Children, &state.After0, &state.After1); err != nil {
		return state, fmt.Errorf("reading fixture row counts: %w", err)
	}

	for _, table := range []string{"child", "after_0", "after_1"} {
		rows, err := conn.Query(ctx, `SELECT parent_id FROM cf_insert_order.`+table+` ORDER BY id`)
		if err != nil {
			return state, fmt.Errorf("reading %s foreign keys: %w", table, err)
		}

		for rows.Next() {
			var fk int
			if err := rows.Scan(&fk); err != nil {
				rows.Close()
				return state, fmt.Errorf("scanning %s FK: %w", table, err)
			}

			if table == "child" {
				state.ChildFKs = append(state.ChildFKs, fk)
			} else {
				state.AfterFKs = append(state.AfterFKs, fk)
			}
		}

		if err := rows.Err(); err != nil {
			rows.Close()
			return state, fmt.Errorf("iterating %s FKs: %w", table, err)
		}

		rows.Close()
	}

	return state, nil
}

func orderedInsertQuery(reverse bool) string {
	fields := []string{
		`obj_rel_0000:{data:{id:50,tag:"after000"}}`,
		`qa:{data:[{id:14,tag:"short"}]}`,
		`rel_arr_00000:{data:[{id:13,tag:"tie00"}]}`,
		`rel_arr_02120:{data:[{id:12,tag:"tie21"}]}`,
		`arr_mmmmmmmmmmmmmmmmmmmmmmmmmmmmmm_00000:{data:[{id:11,tag:"long"}]}`,
		`id:1,label:"parent"`,
		`obj_rel_0224:{data:{id:51,tag:"after224"}}`,
		`obj_rel_0001:{data:{id:10,tag:"before"}}`,
	}
	if reverse {
		slices.Reverse(fields)
	}

	return `mutation {insert_cf_insert_order_parent(objects:[{` + strings.Join(
		fields,
		",",
	) + `}]) {affected_rows returning{id}}}`
}

// TestOrderedInsertReference is the required serialized, version-pinned live
// order/denial tripwire. The fixture is static in BOTH startup metadata files;
// replacing Hasura metadata cannot supply the Constellation endpoint's schema.
// Both endpoints share one DB: run Hasura, snapshot, reset, run Constellation.
// Neither response uses TestCase.expected (which would skip the live Hasura).
//
//nolint:paralleltest,cyclop,gocyclo,gocognit,maintidx // Shared-stack writes and oracle assertions must remain serial.
func TestOrderedInsertReference(
	t *testing.T,
) {
	version, err := referenceVersion(t.Context(), hasuraURL)
	if err != nil {
		t.Fatalf("Hasura /v1/version: %v", err)
	}

	if version != "v2.48.10-ce" {
		t.Fatalf(
			"Hasura order coupling changed: /v1/version=%q; expected v2.48.10-ce (hashable 1.4.7.0/text 2.1.1/unordered-containers 0.2.20); re-probe before changing XXH3 order",
			version,
		)
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = defaultDBURL
	}

	conn, err := pgx.Connect(t.Context(), dbURL)
	if err != nil {
		t.Fatalf("fixture DB: %v", err)
	}
	defer conn.Close(t.Context())
	defer func() {
		if _, err := conn.Exec(context.Background(), orderedInsertReset); err != nil {
			t.Errorf("fixture cleanup: %v", err)
		}
	}()

	headers := http.Header{}
	headers.Set("x-hasura-admin-secret", adminSecret)

	wantEvents := []string{
		"before",
		"parent",
		"long",
		"tie21",
		"tie00",
		"short",
		"after224",
		"after000",
	}
	for _, reverse := range []bool{false, true} {
		name := "forward"
		if reverse {
			name = "reverse"
		}

		t.Run(name, func(t *testing.T) {
			var baseline orderedInsertSnapshot
			for i, endpoint := range []string{hasuraURL, constellationURL} {
				if _, err := conn.Exec(t.Context(), orderedInsertReset); err != nil {
					t.Fatal(err)
				}

				result, err := makeHTTPQuery(
					t.Context(),
					endpoint,
					query{Query: orderedInsertQuery(reverse), Role: "admin"},
					headers,
				)
				if err != nil {
					t.Fatalf("endpoint %s: %v", endpoint, err)
				}

				want := map[string]any{
					"data": map[string]any{
						"insert_cf_insert_order_parent": map[string]any{
							"affected_rows": float64(8),
							"returning":     []any{map[string]any{"id": float64(1)}},
						},
					},
				}
				if !reflect.DeepEqual(result, want) {
					t.Fatalf("%s response=%v, want %v", endpoint, result, want)
				}

				state, err := orderedInsertState(t.Context(), conn)
				if err != nil {
					t.Fatal(err)
				}

				if !slices.Equal(state.Events, wantEvents) {
					t.Fatalf(
						"Hasura order coupling: %s event order=%v, want %v; re-probe pinned image",
						endpoint,
						state.Events,
						wantEvents,
					)
				}

				if state.Parents != 1 || state.Before != 1 || state.Children != 4 ||
					state.After0 != 1 ||
					state.After1 != 1 ||
					!slices.Equal(state.ChildFKs, []int{1, 1, 1, 1}) ||
					!slices.Equal(state.AfterFKs, []int{1, 1}) {
					t.Fatalf("%s row state=%+v", endpoint, state)
				}

				if i == 0 {
					baseline = state
				} else if !reflect.DeepEqual(state, baseline) {
					t.Fatalf("stored rows differ: Hasura=%+v Constellation=%+v", baseline, state)
				}
			}
		})
	}

	t.Run("determined FK validation is write-free on both endpoints", func(t *testing.T) {
		cases := []struct{ name, mutation, message, path string }{
			{
				name:     "array child",
				mutation: `mutation {insert_cf_insert_order_parent(objects:[{id:1,label:"p",rel_arr_00000:{data:[{id:10,parent_id:7}]}}]){affected_rows}}`,
				message:  `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
				path:     `$.selectionSet.insert_cf_insert_order_parent.args.objects[0].rel_arr_00000.data[0]`,
			},
			{
				name:     "after-parent object",
				mutation: `mutation {insert_cf_insert_order_parent(objects:[{id:1,label:"p",obj_rel_0000:{data:{id:30,tag:"after",parent_id:7}}}]){affected_rows}}`,
				message:  `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
				path:     `$.selectionSet.insert_cf_insert_order_parent.args.objects[0].obj_rel_0000.data[0]`,
			},
			{
				name:     "insert_one after-parent object",
				mutation: `mutation {insert_cf_insert_order_parent_one(object:{id:1,label:"p",obj_rel_0000:{data:{id:30,tag:"after",parent_id:7}}}){id}}`,
				message:  `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
				path:     `$.selectionSet.insert_cf_insert_order_parent_one.args.object[0].obj_rel_0000.data[0]`,
			},
			{
				name:     "inherited FK overlaps before-parent relationship",
				mutation: `mutation {insert_cf_insert_order_parent(objects:[{id:1,label:"p",rel_arr_00000:{data:[{id:10,owner:{data:{id:5,label:"owner"}}}]}}]){affected_rows}}`,
				message:  `cannot insert object relationship "owner" as "parent_id" column values are already determined`,
				path:     `$.selectionSet.insert_cf_insert_order_parent.args.objects[0].rel_arr_00000.data[0].owner`,
			},
			{
				name:     "inherited plus client FK uses parent precedence",
				mutation: `mutation {insert_cf_insert_order_parent(objects:[{id:1,label:"p",rel_arr_00000:{data:[{id:10,parent_id:7,owner:{data:{id:5,label:"owner"}}}]}}]){affected_rows}}`,
				message:  `cannot insert "parent_id" columns as their values are already being determined by parent insert`,
				path:     `$.selectionSet.insert_cf_insert_order_parent.args.objects[0].rel_arr_00000.data[0]`,
			},
			{
				name:     "before-parent overlap",
				mutation: `mutation {insert_cf_insert_order_parent(objects:[{id:1,before_id:7,obj_rel_0001:{data:{id:10}}}]){affected_rows}}`,
				message:  `cannot insert object relationship "obj_rel_0001" as "before_id" column values are already determined`,
				path:     `$.selectionSet.insert_cf_insert_order_parent.args.objects[0].obj_rel_0001`,
			},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				for _, endpoint := range []string{hasuraURL, constellationURL} {
					if _, err := conn.Exec(t.Context(), orderedInsertReset); err != nil {
						t.Fatal(err)
					}

					result, err := makeHTTPQuery(
						t.Context(),
						endpoint,
						query{Query: tc.mutation, Role: "admin"},
						headers,
					)
					if err != nil {
						t.Fatalf("%s: %v", endpoint, err)
					}

					want := map[string]any{"errors": []any{map[string]any{
						"message":    tc.message,
						"extensions": map[string]any{"code": "validation-failed", "path": tc.path},
					}}}
					if !reflect.DeepEqual(result, want) {
						t.Fatalf("%s validation=%v, want %v", endpoint, result, want)
					}

					state, err := orderedInsertState(t.Context(), conn)
					if err != nil {
						t.Fatal(err)
					}

					if state.Parents != 0 || state.Before != 0 || state.Children != 0 ||
						len(state.Events) != 0 {
						t.Fatalf("%s validation wrote rows: %+v", endpoint, state)
					}
				}
			})
		}
	})

	t.Run("insert_one zero-row parent keeps before object", func(t *testing.T) {
		mutation := query{
			Role:  "admin",
			Query: `mutation{insert_cf_insert_order_parent_one(object:{id:1,label:"new",obj_rel_0001:{data:{id:10,tag:"before"}}},on_conflict:{constraint:parent_pkey,update_columns:[]}){id}}`,
		}
		for _, endpoint := range []string{hasuraURL, constellationURL} {
			if _, err := conn.Exec(t.Context(), orderedInsertReset); err != nil {
				t.Fatal(err)
			}

			if _, err := conn.Exec(
				t.Context(),
				`INSERT INTO cf_insert_order.parent(id,label) VALUES(1,'old')`,
			); err != nil {
				t.Fatal(err)
			}

			result, err := makeHTTPQuery(t.Context(), endpoint, mutation, headers)
			if err != nil {
				t.Fatalf("%s: %v", endpoint, err)
			}

			want := map[string]any{"data": map[string]any{"insert_cf_insert_order_parent_one": nil}}
			if !reflect.DeepEqual(result, want) {
				t.Fatalf("%s zero-row insert_one=%v, want null", endpoint, result)
			}

			state, err := orderedInsertState(t.Context(), conn)
			if err != nil {
				t.Fatal(err)
			}

			if state.Parents != 1 || state.Before != 1 || state.Children != 0 ||
				!slices.Equal(state.Events, []string{"old", "before"}) {
				t.Fatalf("%s zero-row parent state=%+v", endpoint, state)
			}
		}
	})

	t.Run("DO NOTHING duplicate child batch counts only the inserted child", func(t *testing.T) {
		mutation := query{
			Role:  "admin",
			Query: `mutation{insert_cf_insert_order_parent(objects:[{id:1,label:"p",rel_arr_00000:{data:[{id:10,tag:"first"},{id:10,tag:"second"}],on_conflict:{constraint:child_pkey,update_columns:[]}}}]){affected_rows}}`,
		}

		var baseline orderedInsertSnapshot
		for i, endpoint := range []string{hasuraURL, constellationURL} {
			if _, err := conn.Exec(t.Context(), orderedInsertReset); err != nil {
				t.Fatal(err)
			}

			result, err := makeHTTPQuery(t.Context(), endpoint, mutation, headers)
			if err != nil {
				t.Fatalf("%s: %v", endpoint, err)
			}

			want := map[string]any{"data": map[string]any{
				"insert_cf_insert_order_parent": map[string]any{"affected_rows": float64(2)},
			}}
			if !reflect.DeepEqual(result, want) {
				t.Fatalf("%s DO NOTHING response=%v, want %v", endpoint, result, want)
			}

			state, err := orderedInsertState(t.Context(), conn)
			if err != nil {
				t.Fatal(err)
			}

			if state.Parents != 1 || state.Children != 1 ||
				!slices.Equal(state.ChildFKs, []int{1}) {
				t.Fatalf("%s DO NOTHING persisted state=%+v", endpoint, state)
			}

			if i == 0 {
				baseline = state
			} else if !reflect.DeepEqual(state, baseline) {
				t.Fatalf(
					"DO NOTHING stored rows differ: Hasura=%+v Constellation=%+v",
					baseline,
					state,
				)
			}
		}
	})

	t.Run("DO UPDATE child batch cardinality rolls back on both engines", func(t *testing.T) {
		mutation := query{
			Role:  "admin",
			Query: `mutation{insert_cf_insert_order_parent(objects:[{id:1,label:"p",rel_arr_00000:{data:[{id:10,tag:"first"},{id:10,tag:"second"}],on_conflict:{constraint:child_pkey,update_columns:[tag]}}}]){affected_rows}}`,
		}
		for _, endpoint := range []string{hasuraURL, constellationURL} {
			if _, err := conn.Exec(t.Context(), orderedInsertReset); err != nil {
				t.Fatal(err)
			}

			result, err := makeHTTPQuery(t.Context(), endpoint, mutation, headers)
			if err != nil {
				t.Fatalf("%s: %v", endpoint, err)
			}

			response, ok := result.(map[string]any)
			if !ok {
				t.Fatalf("%s response type %T", endpoint, result)
			}

			errors, ok := response["errors"].([]any)
			if !ok || len(errors) != 1 {
				t.Fatalf("%s cardinality response=%v", endpoint, result)
			}

			first, ok := errors[0].(map[string]any)
			if !ok {
				t.Fatalf("%s error=%v", endpoint, errors[0])
			}

			if endpoint == hasuraURL {
				ext, ok := first["extensions"].(map[string]any)
				if !ok || first["message"] != "database query error" ||
					ext["code"] != "unexpected" ||
					ext["path"] != "$.selectionSet.insert_cf_insert_order_parent.args.objects[0].rel_arr_00000.data" {
					t.Fatalf("Hasura cardinality envelope has unexpected category/path")
				}

				internal, ok := ext["internal"].(map[string]any)
				if !ok {
					t.Fatal("Hasura cardinality internal error is missing")
				}

				pgError, ok := internal["error"].(map[string]any)
				if !ok || pgError["status_code"] != "21000" {
					t.Fatal("Hasura cardinality SQLSTATE is not 21000")
				}
			} else if !strings.Contains(fmt.Sprint(first["message"]), "SQLSTATE 21000") {
				t.Fatalf("Constellation cardinality error=%v", first)
			}

			state, err := orderedInsertState(t.Context(), conn)
			if err != nil {
				t.Fatal(err)
			}

			if state.Parents != 0 || state.Children != 0 || len(state.Events) != 0 {
				t.Fatalf("%s cardinality failure left rows: %+v", endpoint, state)
			}
		}
	})

	t.Run("plain-column permission denial rolls back", func(t *testing.T) {
		roleHeaders := headers.Clone()
		roleHeaders.Set("x-hasura-role", "cf_insert_guard")

		denied := query{
			Role: "cf_insert_guard",
			Query: `mutation {insert_cf_insert_order_parent(objects:[
{id:1,label:"blocked",rel_arr_00000:{data:[{id:11,tag:"child"}]}},
{id:2,label:"ordinary"}]){affected_rows}}`,
		}
		for _, endpoint := range []string{hasuraURL, constellationURL} {
			if _, err := conn.Exec(t.Context(), orderedInsertReset); err != nil {
				t.Fatal(err)
			}

			result, err := makeHTTPQuery(t.Context(), endpoint, denied, roleHeaders)
			if err != nil {
				t.Fatalf("endpoint %s: %v", endpoint, err)
			}

			response, ok := result.(map[string]any)
			if !ok {
				t.Fatalf("%s response type %T", endpoint, result)
			}

			if _, ok := response["errors"]; !ok {
				t.Fatalf("%s accepted denied write: %v", endpoint, result)
			}

			if endpoint == hasuraURL {
				errors, ok := response["errors"].([]any)
				if !ok || len(errors) == 0 {
					t.Fatalf("Hasura denial envelope=%v", result)
				}

				first, ok := errors[0].(map[string]any)
				if !ok {
					t.Fatalf("Hasura error envelope=%v", errors[0])
				}

				extensions, ok := first["extensions"].(map[string]any)
				if !ok || extensions["code"] != "permission-error" {
					t.Fatalf("Hasura denial envelope=%v", result)
				}
			} else if !strings.Contains(fmt.Sprint(response["errors"]), "ZZ901") {
				t.Fatalf("Constellation denial should retain root ZZ901 presentation: %v", result)
			}

			state, err := orderedInsertState(t.Context(), conn)
			if err != nil {
				t.Fatal(err)
			}

			if state.Parents != 0 || state.Children != 0 || len(state.Events) != 0 {
				t.Fatalf("%s denial left rows/events: %+v", endpoint, state)
			}
		}
	})
}
