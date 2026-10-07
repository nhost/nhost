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

// TestComputedJoinSQLiteCollections keeps the SQLite target and the postgres
// computed parent in separate sources. A hidden middle row must not count
// toward either parent's role-filtered offset.
func TestComputedJoinSQLiteCollections(t *testing.T) {
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

	ddl = append(ddl, []byte(`ALTER TABLE cf_select.items ADD COLUMN sqlite_nullable_key text;`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	if _, err := pool.Exec(t.Context(), `INSERT INTO cf_select.items
		(id,owner_id,label,amount,payload) VALUES (8,1,'third',1,'{}'),
		(12,2,'first',1,'{}');
		UPDATE cf_select.items SET sqlite_nullable_key =
		CASE WHEN id = 1 THEN 'first' ELSE NULL END`); err != nil {
		t.Fatal(err)
	}

	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	items := &md.Databases[0].Tables[0]
	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.Columns = append(
				items.SelectPermissions[i].Permission.Columns, "owner_id", "sqlite_nullable_key",
			)
		}
	}

	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "sqlite_null_kids", Definition: metadata.RemoteRelationshipDef{
			ToSource: &metadata.ToSourceRelationship{
				FieldMapping: map[string]string{
					"owner_id": "owner_id", "sqlite_nullable_key": "label",
				},
				RelationshipType: metadata.RelationshipTypeArray, Source: "sqlite_page",
				Table: metadata.TableSource{Name: "page_kids"},
			},
		},
	}, metadata.RemoteRelationship{
		Name: "sqlite_one_key", Definition: metadata.RemoteRelationshipDef{
			ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"owner_id": "owner_id"},
				RelationshipType: metadata.RelationshipTypeArray, Source: "sqlite_page",
				Table: metadata.TableSource{Name: "page_kids"},
			},
		},
	}, metadata.RemoteRelationship{
		Name: "sqlite_kids", Definition: metadata.RemoteRelationshipDef{
			ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"owner_id": "owner_id", "item_label": "label"},
				RelationshipType: metadata.RelationshipTypeArray, Source: "sqlite_page",
				Table: metadata.TableSource{Name: "page_kids"},
			},
		},
	})

	path := testdb.SQLitePath(t, `CREATE TABLE page_kids (
		id integer primary key, owner_id integer, label text, visible integer);
		INSERT INTO page_kids VALUES (1,1,'first',1),(2,1,'first',0),
		(3,1,'first',1),(4,1,'first',1),(5,2,'second',1),
		(6,2,'second',0),(7,2,'second',1),(8,2,'second',1),
		(9,1,'third',1),(10,1,'third',1),(11,1,'third',1),
		(12,2,'first',1),(13,2,'first',0),(14,2,'first',1),(15,2,'first',1);`)
	md.Databases = append(md.Databases, metadata.DatabaseMetadata{
		Name: "sqlite_page",
		Kind: "sqlite",
		Configuration: metadata.DatabaseConfiguration{
			ConnectionInfo: metadata.DatabaseConnectionInfo{
				DatabaseURL: metadata.EnvString(path),
			},
		},
		Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Name: "page_kids"},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "owner_id", "label"},
					Filter:  map[string]any{"visible": map[string]any{"_eq": 1}},
				},
			}},
		}},
	})

	logger := slog.New(slog.DiscardHandler)

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md}, logger, "", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ctrl.Inconsistencies()) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", ctrl.Inconsistencies())
	}

	ctx := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
	})
	for _, tc := range []struct {
		name, query string
		want        map[string]any
	}{
		{"single key ordinary fallback", `{ cf_select_items(where:{id:{_eq:1}}) {
			sqlite_kids(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, map[string]any{"cf_select_items": []any{map[string]any{
			"sqlite_kids": []any{map[string]any{"id": float64(3)}},
		}}}},
		{"null composite component", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			sqlite_null_kids(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, map[string]any{"cf_select_items": []any{
			map[string]any{"sqlite_null_kids": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"sqlite_null_kids": nil},
		}}},
		{"single-column two-key offsets", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			sqlite_one_key(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, map[string]any{"cf_select_items": []any{
			map[string]any{"sqlite_one_key": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"sqlite_one_key": []any{map[string]any{"id": float64(7)}}},
		}}},
		{"different first component with shared owner", `{ cf_select_items(where:{id:{_in:[1,8]}},order_by:{id:asc}) {
			sqlite_kids(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, map[string]any{"cf_select_items": []any{
			map[string]any{"sqlite_kids": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"sqlite_kids": []any{map[string]any{"id": float64(10)}}},
		}}},
		{"shared first sorted component requires owner predicate", `{ cf_select_items(where:{id:{_in:[1,12]}},order_by:{id:asc}) {
			sqlite_kids(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, map[string]any{"cf_select_items": []any{
			map[string]any{"sqlite_kids": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"sqlite_kids": []any{map[string]any{"id": float64(14)}}},
		}}},
		{"two keys role-filtered offsets", `{ cf_select_items(where:{id:{_lte:2}},order_by:{id:asc}) {
			alias:sqlite_kids(order_by:{id:asc},offset:1,limit:1) { id }
		} }`, map[string]any{"cf_select_items": []any{
			map[string]any{"alias": []any{map[string]any{"id": float64(3)}}},
			map[string]any{"alias": []any{map[string]any{"id": float64(7)}}},
		}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			response, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: tc.query})
			if resolveErr != nil || response.Errors != nil ||
				!reflect.DeepEqual(response.Data, tc.want) {
				t.Fatalf("response=%+v err=%v want=%#v", response, resolveErr, tc.want)
			}
		})
	}
}

// TestComputedJoinSQLiteJSONKeys compares batched JSON-typed keys with the
// ordinary one-parent path and pins typed result keys under a target role gate.
//
//nolint:gocognit,cyclop,gocyclo,maintidx // One fixture exercises JSON shapes across roles and ordinary/grouped paths.
func TestComputedJoinSQLiteJSONKeys(t *testing.T) {
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

	ddl = append(ddl, []byte(`ALTER TABLE cf_select.items ADD COLUMN sqlite_json_key jsonb;
		CREATE FUNCTION cf_select.item_sqlite_join_key(cf_select.items) RETURNS jsonb
		LANGUAGE sql STABLE AS 'SELECT $1.sqlite_json_key';`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	if _, err := pool.Exec(t.Context(), `INSERT INTO cf_select.items
		(id,owner_id,label,amount,payload,sqlite_json_key) VALUES
		(8,1,'object',1,'{}','{"x":1,"a":2}'),
		(9,1,'duplicate',1,'{}','1'),
		(10,1,'sql null',1,'{}',NULL),
		(11,1,'json null',1,'{}','null'),
		(12,1,'number two',1,'{}','2'),
		(13,1,'boolean',1,'{}','true'),
		(14,1,'array',1,'{}','[1,"x"]'),
		(15,1,'html',1,'{}','"<a>&"'),
		(16,1,'string',1,'{}','"s"'),
		(17,1,'duplicate object',1,'{}','{"a":2,"x":1}');
		UPDATE cf_select.items SET sqlite_json_key =
		CASE WHEN id=1 THEN '1'::jsonb WHEN id=2 THEN '"1"'::jsonb
		ELSE sqlite_json_key END WHERE id IN (1,2)`); err != nil {
		t.Fatal(err)
	}

	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	items := &md.Databases[0].Tables[0]

	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "item_sqlite_join_key", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_sqlite_join_key"},
		},
	})
	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.Columns = append(
				items.SelectPermissions[i].Permission.Columns, "owner_id",
			)
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields, "item_sqlite_join_key",
			)
		}
	}

	for _, spec := range []struct {
		name    string
		mapping map[string]string
	}{
		{"json_kids", map[string]string{"item_sqlite_join_key": "j"}},
		{"json_composite_kids", map[string]string{"owner_id": "owner_id", "item_sqlite_join_key": "j"}},
	} {
		items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
			Name: spec.name, Definition: metadata.RemoteRelationshipDef{
				ToSource: &metadata.ToSourceRelationship{
					FieldMapping: spec.mapping, RelationshipType: metadata.RelationshipTypeArray,
					Source: "sqlite_json_page", Table: metadata.TableSource{Name: "json_kids"},
				},
			},
		})
	}

	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "json_object_kid", Definition: metadata.RemoteRelationshipDef{
			ToSource: &metadata.ToSourceRelationship{
				FieldMapping:     map[string]string{"item_sqlite_join_key": "j"},
				RelationshipType: metadata.RelationshipTypeObject,
				Source:           "sqlite_json_page",
				Table:            metadata.TableSource{Name: "json_kids"},
			},
		},
	})

	path := testdb.SQLitePath(t, `CREATE TABLE json_kids (
		id integer primary key, owner_id integer, j JSON, visible integer);
		INSERT INTO json_kids VALUES
		(101,1,'1',1),(102,1,'1',0),(103,1,'1',1),
		(201,2,'"1"',1),(202,2,'"1"',0),(203,2,'"1"',1),
		(301,1,'{"a":2,"x":1}',1),(302,1,'{"a":2,"x":1}',0),
		(303,1,'{"a":2,"x":1}',1),(304,1,'{"x":1, "a":2}',1),
		(401,1,'2',1),(402,1,'2',0),(403,1,'2',1),
		(501,1,NULL,1),(502,1,'null',1),
		(601,1,'true',1),(602,1,'true',0),(603,1,'true',1),
		(701,1,'[1,"x"]',1),(702,1,'[1,"x"]',0),(703,1,'[1,"x"]',1),
		(801,1,'"\u003ca\u003e\u0026"',1),
		(802,1,'"\u003ca\u003e\u0026"',0),
		(803,1,'"\u003ca\u003e\u0026"',1),(804,1,'"<a>&"',1),
		(901,1,'"s"',1),(902,1,'"s"',0),(903,1,'"s"',1);`)
	md.Databases = append(md.Databases, metadata.DatabaseMetadata{
		Name: "sqlite_json_page", Kind: "sqlite",
		Configuration: metadata.DatabaseConfiguration{
			ConnectionInfo: metadata.DatabaseConnectionInfo{DatabaseURL: metadata.EnvString(path)},
		},
		Tables: []metadata.TableMetadata{{
			Table: metadata.TableSource{Name: "json_kids"},
			SelectPermissions: []metadata.SelectPermission{{
				Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
					Columns: []string{"id", "owner_id", "j"},
					Filter: map[string]any{"_and": []any{
						map[string]any{"visible": map[string]any{"_eq": 1}},
						map[string]any{"owner_id": map[string]any{"_gte": "X-Hasura-User-Id"}},
					}},
				},
			}},
		}},
	})

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ctrl.Inconsistencies()) != 0 {
		t.Fatalf("unexpected inconsistencies: %+v", ctrl.Inconsistencies())
	}

	ctx := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		"X-Hasura-User-Id": {"1"},
	})
	for _, rel := range []string{"json_kids", "json_composite_kids"} {
		t.Run(rel, func(t *testing.T) {
			t.Parallel()

			query := fmt.Sprintf(
				`{ cf_select_items(where:{id:{_in:[1,2,8,9,10,11,12,13,14,15,16,17]}},order_by:{id:asc}) {
				id %s(order_by:{id:asc},limit:1,offset:1) { id }
			} }`,
				rel,
			)

			response, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: query})
			if resolveErr != nil || response.Errors != nil {
				t.Fatalf("batch response=%+v err=%v", response, resolveErr)
			}

			rows := sqliteJSONRows(t, response.Data)

			wants := map[float64]any{
				1:  []any{map[string]any{"id": float64(103)}},
				2:  []any{map[string]any{"id": float64(203)}},
				8:  []any{map[string]any{"id": float64(303)}},
				9:  []any{map[string]any{"id": float64(103)}},
				10: nil, 11: nil,
				12: []any{map[string]any{"id": float64(403)}},
				13: []any{map[string]any{"id": float64(603)}},
				14: []any{map[string]any{"id": float64(703)}},
				15: []any{map[string]any{"id": float64(803)}},
				16: []any{map[string]any{"id": float64(903)}},
				17: []any{map[string]any{"id": float64(303)}},
			}
			if len(rows) != len(wants) {
				t.Fatalf("batch row count=%d, want %d", len(rows), len(wants))
			}

			// The target role filter hides each middle row. Admin's same
			// window must instead return that row, not the reader's result.
			//nolint:contextcheck // A separate role requires its own middleware context.
			admin, adminErr := ctrl.Resolve(
				adminSessionContext(t),
				controller.GraphQLRequest{Query: query},
			)
			if adminErr != nil || admin.Errors != nil {
				t.Fatalf("admin response=%+v err=%v", admin, adminErr)
			}

			adminRows := sqliteJSONRows(t, admin.Data)
			for _, adminRow := range adminRows {
				id := sqliteJSONID(t, adminRow, "id")

				var want any
				if page, ok := wants[id].([]any); ok {
					pageRow, rowOK := page[0].(map[string]any)
					if !rowOK {
						t.Fatalf("invalid paginated row: %#v", page[0])
					}

					want = []any{map[string]any{"id": sqliteJSONID(t, pageRow, "id") - 1}}
				}

				if !reflect.DeepEqual(adminRow[rel], want) {
					t.Errorf("admin parent %v page=%#v want=%#v", id, adminRow[rel], want)
				}

				single := fmt.Sprintf(`{ cf_select_items(where:{id:{_eq:%d}}) {
					%s(order_by:{id:asc},limit:1,offset:1) { id }
				} }`, int(id), rel)
				//nolint:contextcheck // Admin requires a separate authenticated request context.
				one, oneErr := ctrl.Resolve(
					adminSessionContext(t), controller.GraphQLRequest{Query: single},
				)
				if oneErr != nil || one.Errors != nil {
					t.Fatalf("admin parent %v ordinary=%+v err=%v", id, one, oneErr)
				}

				if got := sqliteJSONRows(t, one.Data)[0][rel]; !reflect.DeepEqual(
					got,
					adminRow[rel],
				) {
					t.Errorf("admin parent %v single=%#v batch=%#v", id, got, adminRow[rel])
				}
			}

			for _, row := range rows {
				id, ok := row["id"].(float64)
				if !ok {
					t.Fatalf("invalid parent id: %#v", row["id"])
				}

				if !reflect.DeepEqual(row[rel], wants[id]) {
					t.Errorf("parent %v batch=%#v, want %#v", id, row[rel], wants[id])
				}

				single := fmt.Sprintf(`{ cf_select_items(where:{id:{_eq:%d}}) {
					%s(order_by:{id:asc},limit:1,offset:1) { id }
				} }`, int(id), rel)

				ordinary, ordinaryErr := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: single})
				if ordinaryErr != nil || ordinary.Errors != nil {
					t.Fatalf("parent %v ordinary=%+v err=%v", id, ordinary, ordinaryErr)
				}

				ordinaryRows := sqliteJSONRows(t, ordinary.Data)
				if len(ordinaryRows) != 1 {
					t.Fatalf("parent %v ordinary row count=%d", id, len(ordinaryRows))
				}

				if !reflect.DeepEqual(row[rel], ordinaryRows[0][rel]) {
					t.Errorf("parent %v batch=%#v ordinary=%#v", id, row[rel], ordinaryRows)
				}
			}
		})
	}

	// Non-paginated arrays and object relationships use the ordinary _in
	// operation even for multiple parents. Assert its rows, not just parity
	// with the paginated path: an empty result in both contexts is a bug.
	const ids = "1,2,8,9,10,11,12,13,14,15,16,17"
	for _, role := range []struct {
		name   string
		ctx    func(*testing.T) http.Header
		hidden bool
	}{
		{"reader", func(*testing.T) http.Header {
			return http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
				"X-Hasura-User-Id": {"1"},
			}
		}, false},
		{"admin", func(*testing.T) http.Header {
			return http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret},
			}
		}, true},
	} {
		t.Run(role.name+" ordinary batch and single", func(t *testing.T) {
			t.Parallel()

			session := runSessionMiddleware(t, role.ctx(t))

			first := map[float64]float64{
				1: 101, 2: 201, 8: 301, 9: 101, 12: 401,
				13: 601, 14: 701, 15: 801, 16: 901, 17: 301,
			}
			for _, rel := range []string{"json_kids", "json_composite_kids", "json_object_kid"} {
				isObject := rel == "json_object_kid"
				query := fmt.Sprintf(`{ cf_select_items(where:{id:{_in:[%s]}},order_by:{id:asc}) {
					id %s { id }
				} }`, ids, rel)

				batch, batchErr := ctrl.Resolve(session, controller.GraphQLRequest{Query: query})
				if batchErr != nil || batch.Errors != nil {
					t.Fatalf("%s batch=%+v err=%v", rel, batch, batchErr)
				}

				for _, row := range sqliteJSONRows(t, batch.Data) {
					id := sqliteJSONID(t, row, "id")
					start := first[id]

					var want any
					if start != 0 {
						if isObject {
							want = map[string]any{"id": start}
						} else {
							ids := []float64{start, start + 2}
							if role.hidden {
								ids = []float64{start, start + 1, start + 2}
							}

							rows := make([]any, 0, len(ids))
							for _, kid := range ids {
								rows = append(rows, map[string]any{"id": kid})
							}

							want = rows
						}
					}

					if !reflect.DeepEqual(row[rel], want) {
						t.Errorf("%s parent %v batch=%#v want=%#v", rel, id, row[rel], want)
					}

					single := fmt.Sprintf(`{ cf_select_items(where:{id:{_eq:%d}}) {
						id %s { id }
					} }`, int(id), rel)

					one, oneErr := ctrl.Resolve(session, controller.GraphQLRequest{Query: single})
					if oneErr != nil || one.Errors != nil {
						t.Fatalf("%s parent %v single=%+v err=%v", rel, id, one, oneErr)
					}

					if got := sqliteJSONRows(t, one.Data)[0][rel]; !reflect.DeepEqual(
						got,
						row[rel],
					) {
						t.Errorf("%s parent %v single=%#v batch=%#v", rel, id, got, row[rel])
					}
				}
			}
		})
	}

	t.Run("session filter applies before per-parent window", func(t *testing.T) {
		t.Parallel()

		filtered := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
			"X-Hasura-User-Id": {"3"},
		})
		for _, args := range []string{"", "(order_by:{id:asc},limit:1,offset:1)"} {
			query := fmt.Sprintf(`{ cf_select_items(where:{id:{_in:[1,2,8]}}) {
				json_kids%s { id }
			} }`, args)

			response, resolveErr := ctrl.Resolve(filtered, controller.GraphQLRequest{Query: query})
			if resolveErr != nil || response.Errors != nil {
				t.Fatalf("session-filtered response=%+v err=%v", response, resolveErr)
			}

			for _, row := range sqliteJSONRows(t, response.Data) {
				if got := row["json_kids"]; !reflect.DeepEqual(got, []any{}) {
					t.Errorf("parent %v session-filtered=%#v, want []", row["id"], got)
				}
			}
		}
	})
}

func sqliteJSONID(t *testing.T, row map[string]any, key string) float64 {
	t.Helper()

	id, ok := row[key].(float64)
	if !ok {
		t.Fatalf("invalid numeric %s: %#v", key, row[key])
	}

	return id
}

// sqliteJSONRows validates the GraphQL row transport before comparing windows.
func sqliteJSONRows(t *testing.T, data any) []map[string]any {
	t.Helper()

	root, ok := data.(map[string]any)
	if !ok {
		t.Fatalf("invalid GraphQL data: %#v", data)
	}

	rawRows, ok := root["cf_select_items"].([]any)
	if !ok {
		t.Fatalf("invalid parent rows: %#v", root)
	}

	rows := make([]map[string]any, len(rawRows))
	for i, raw := range rawRows {
		row, valid := raw.(map[string]any)
		if !valid {
			t.Fatalf("invalid row %d: %#v", i, raw)
		}

		rows[i] = row
	}

	return rows
}
