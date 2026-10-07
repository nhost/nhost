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

// TestComputedJoinRenamedCollections pins GraphQL-name target mappings across
// the ordinary and grouped paths, including a physical-name collision.
//
//nolint:gocognit,cyclop // One fixture tests both dialects, roles, ordinary and paginated paths.
func TestComputedJoinRenamedCollections(t *testing.T) {
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
CREATE FUNCTION cf_select.item_renamed_json(cf_select.items) RETURNS jsonb
LANGUAGE sql STABLE AS 'SELECT CASE WHEN $1.id = 3 THEN NULL::jsonb ELSE to_jsonb($1.label) END';
CREATE TABLE cf_select.renamed_kids (id integer primary key, label text, lbl text, visible integer);
INSERT INTO cf_select.renamed_kids VALUES
(101,'first','wrong',1),(102,'first','wrong',0),(103,'first','wrong',1),
(201,'second','wrong',1),(202,'second','wrong',0),(203,'second','wrong',1);`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	if _, err := pool.Exec(t.Context(), `INSERT INTO cf_select.items
		(id,owner_id,label,amount,payload) VALUES (3,1,'third',1,'{}')`); err != nil {
		t.Fatal(err)
	}

	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	items := &md.Databases[0].Tables[0]

	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "item_renamed_json", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_renamed_json"},
		},
	})
	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields, "item_renamed_json",
			)
		}
	}

	for _, spec := range []struct {
		name, target, schema, column string
	}{
		{"pg_renamed", "cf_select", "cf_select", "lbl"},
		{"sqlite_renamed_json", "sqlite_renamed", "", "jsonKey"},
	} {
		key := "item_label"
		if spec.name == "sqlite_renamed_json" {
			key = "item_renamed_json"
		}

		items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
			Name: spec.name, Definition: metadata.RemoteRelationshipDef{
				ToSource: &metadata.ToSourceRelationship{
					FieldMapping:     map[string]string{key: spec.column},
					RelationshipType: metadata.RelationshipTypeArray, Source: spec.target,
					Table: metadata.TableSource{Schema: spec.schema, Name: "renamed_kids"},
				},
			},
		})
	}

	md.Databases[0].Tables = append(md.Databases[0].Tables, metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "cf_select", Name: "renamed_kids"},
		Configuration: metadata.TableConfiguration{ColumnConfig: map[string]metadata.ColumnConfig{
			"label": {CustomName: "lbl"}, "lbl": {CustomName: "otherLabel"},
		}},
		SelectPermissions: []metadata.SelectPermission{{
			Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
				Columns: []string{"id", "label"}, Filter: map[string]any{
					"visible": map[string]any{"_eq": 1},
				},
			},
		}},
	})

	path := testdb.SQLitePath(t, `CREATE TABLE renamed_kids (
		id integer primary key, j JSON, visible integer);
		INSERT INTO renamed_kids VALUES
		(101,'"first"',1),(102,'"first"',0),(103,'"first"',1),
		(201,'"second"',1),(202,'"second"',0),(203,'"second"',1);`)
	md.Databases = append(md.Databases, metadata.DatabaseMetadata{
		Name: "sqlite_renamed",
		Kind: "sqlite",
		Configuration: metadata.DatabaseConfiguration{
			ConnectionInfo: metadata.DatabaseConnectionInfo{
				DatabaseURL: metadata.EnvString(path),
			},
		},
		Tables: []metadata.TableMetadata{
			{
				Table: metadata.TableSource{Name: "renamed_kids"},
				Configuration: metadata.TableConfiguration{
					ColumnConfig: map[string]metadata.ColumnConfig{
						"j": {CustomName: "jsonKey"},
					},
				},
				SelectPermissions: []metadata.SelectPermission{{
					Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
						Columns: []string{"id", "j"}, Filter: map[string]any{
							"visible": map[string]any{"_eq": 1},
						},
					},
				}},
			},
		},
	})

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	if len(ctrl.Inconsistencies()) != 0 {
		t.Fatalf("inconsistencies: %+v", ctrl.Inconsistencies())
	}

	for _, spec := range []struct {
		name string
	}{
		{"pg_renamed"}, {"sqlite_renamed_json"},
	} {
		for _, role := range []struct {
			name   string
			header http.Header
		}{
			{"reader", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"}}},
			{"admin", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}},
		} {
			t.Run(spec.name+"/"+role.name, func(t *testing.T) {
				t.Parallel()

				ctx := runSessionMiddleware(t, role.header)
				for _, args := range []string{"", "(order_by:{id:asc},limit:1,offset:1)"} {
					query := fmt.Sprintf(
						`{ cf_select_items(where:{id:{_in:[1,2,3]}},order_by:{id:asc}) {
						id %s%s { id }
					} }`,
						spec.name,
						args,
					)

					response, resolveErr := ctrl.Resolve(
						ctx,
						controller.GraphQLRequest{Query: query},
					)
					if resolveErr != nil || response.Errors != nil {
						t.Fatalf("query=%s response=%+v err=%v", query, response, resolveErr)
					}

					rows := sqliteJSONRows(t, response.Data)
					if len(rows) != 3 {
						t.Fatalf("query=%s rows=%#v", query, rows)
					}

					for i, row := range rows {
						want := renamedCollectionPage(spec.name, role.name, args != "", i)
						if !reflect.DeepEqual(row[spec.name], want) {
							t.Errorf(
								"query=%s parent=%v got=%#v want=%#v",
								query,
								row["id"],
								row[spec.name],
								want,
							)
						}
					}
				}
			})
		}
	}
}

func renamedCollectionPage(target, role string, paginated bool, parent int) any {
	if parent == 2 {
		if target == "pg_renamed" {
			return []any{}
		}

		return nil // The SQLite parent key is SQL NULL.
	}

	first := float64((parent+1)*100 + 1)
	if paginated {
		middle := first + 2
		if role == "admin" {
			middle = first + 1
		}

		return []any{map[string]any{"id": middle}}
	}

	ids := []float64{first, first + 2}
	if role == "admin" {
		ids = []float64{first, first + 1, first + 2}
	}

	rows := make([]any, len(ids))
	for i, id := range ids {
		rows[i] = map[string]any{"id": id}
	}

	return rows
}
