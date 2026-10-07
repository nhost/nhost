package controller_test

import (
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

// TestComputedJoinAggregateAmbiguity checks that an aggregate cannot turn a
// role-hidden SQL column into a computed-key equality oracle under column_config.
//
//nolint:gocognit,gocyclo,cyclop // Shared fixture covers role permissions, arrays, aggregate controls and aliases.
func TestComputedJoinAggregateAmbiguity(t *testing.T) {
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
CREATE TABLE cf_select.ambiguous_kids (id integer primary key, label text, lbl text, plain text, visible integer);
INSERT INTO cf_select.ambiguous_kids VALUES
(101,'first','wrong','first',1),(102,'first','wrong','first',0),
(103,'first','wrong','first',1),(201,'second','wrong','second',1),
(901,'wrong','first','wrong',1),(902,'wrong','second','wrong',1);
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	items := &md.Databases[0].Tables[0]
	for _, spec := range []struct{ name, target string }{
		{"ambiguous_kids", "lbl"}, {"plain_kids", "plain"},
	} {
		items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
			Name: spec.name, Definition: metadata.RemoteRelationshipDef{
				ToSource: &metadata.ToSourceRelationship{
					FieldMapping:     map[string]string{"item_label": spec.target},
					RelationshipType: metadata.RelationshipTypeArray, Source: "cf_select",
					Table: metadata.TableSource{Schema: "cf_select", Name: "ambiguous_kids"},
				},
			},
		})
	}

	md.Databases[0].Tables = append(md.Databases[0].Tables, metadata.TableMetadata{
		Table: metadata.TableSource{Schema: "cf_select", Name: "ambiguous_kids"},
		Configuration: metadata.TableConfiguration{ColumnConfig: map[string]metadata.ColumnConfig{
			"label": {CustomName: "lbl"}, "lbl": {CustomName: "otherLabel"},
		}},
		SelectPermissions: []metadata.SelectPermission{{
			Role: "cf_reader", Permission: metadata.SelectPermissionConfig{
				Columns:           []string{"id", "label", "plain"},
				Filter:            map[string]any{"visible": map[string]any{"_eq": 1}},
				AllowAggregations: true,
			},
		}},
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

	reader := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
	})
	// Ordinary arrays use the role-visible label, never the hidden SQL lbl.
	response, err := ctrl.Resolve(reader, controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_in:[1,2]}},order_by:{id:asc}) {
			id ambiguous_kids(order_by:{id:asc}) { id }
		}
	}`})
	if err != nil || response.Errors != nil {
		t.Fatalf("array response=%+v err=%v", response, err)
	}

	rows := sqliteJSONRows(t, response.Data)
	if len(rows) != 2 || !reflect.DeepEqual(rows[0]["ambiguous_kids"],
		[]any{map[string]any{"id": float64(101)}, map[string]any{"id": float64(103)}}) ||
		!reflect.DeepEqual(rows[1]["ambiguous_kids"], []any{map[string]any{"id": float64(201)}}) {
		t.Fatalf("array joined wrong column: %#v", rows)
	}

	response, err = ctrl.Resolve(reader, controller.GraphQLRequest{Query: `{
		cf_select_ambiguous_kids(where:{otherLabel:{_eq:"first"}}) { id }
	}`})
	if err != nil || response.Errors == nil ||
		!strings.Contains(fmt.Sprint(response.Errors), "otherLabel") {
		t.Fatalf("hidden field unexpectedly available: response=%+v err=%v", response, err)
	}

	// Keep SQL-name aggregates working for an unambiguous physical target,
	// including role-filtered counts and nodes.
	response, err = ctrl.Resolve(reader, controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_in:[1,2]}},order_by:{id:asc}) {
			id plain_kids_aggregate(order_by:{id:asc}) { aggregate { count } nodes { id } }
		}
	}`})
	if err != nil || response.Errors != nil {
		t.Fatalf("plain aggregate response=%+v err=%v", response, err)
	}

	rows = sqliteJSONRows(t, response.Data)
	for i, want := range []struct {
		count float64
		ids   []any
	}{
		{2, []any{map[string]any{"id": float64(101)}, map[string]any{"id": float64(103)}}},
		{1, []any{map[string]any{"id": float64(201)}}},
	} {
		got, ok := rows[i]["plain_kids_aggregate"].(map[string]any)
		if !ok || !reflect.DeepEqual(got["aggregate"], map[string]any{"count": want.count}) ||
			!reflect.DeepEqual(got["nodes"], want.ids) {
			t.Fatalf("role filtered aggregate parent %d: %#v", i, rows[i])
		}
	}

	// Both role and admin must fail for ordinary, aliased and fragment
	// aggregate selections. No partial parent data may accompany the error.
	for _, role := range []struct {
		name string
		ctx  http.Header
	}{
		{"reader", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"}}},
		{"admin", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}},
	} {
		for _, shape := range []struct{ name, query string }{
			{"ordinary", `{ cf_select_items(where:{id:{_eq:1}}) { id ambiguous_kids_aggregate { aggregate { count } nodes { id } } } }`},
			{"alias", `{ cf_select_items(where:{id:{_eq:1}}) { id leak: ambiguous_kids_aggregate { total: aggregate { count } rows: nodes { id } } } }`},
			{"fragment", `query { cf_select_items(where:{id:{_eq:1}}) { id ...A } } fragment A on cf_select_items { ambiguous_kids_aggregate { aggregate { count } nodes { id } } }`},
		} {
			t.Run(role.name+"/"+shape.name, func(t *testing.T) {
				t.Parallel()

				response, resolveErr := ctrl.Resolve(runSessionMiddleware(t, role.ctx),
					controller.GraphQLRequest{Query: shape.query})
				if resolveErr == nil && response.Errors == nil {
					t.Fatalf("ambiguous aggregate succeeded: %+v", response)
				}

				if response.Data != nil {
					t.Fatalf(
						"aggregate exposed data despite error: %+v err=%v",
						response,
						resolveErr,
					)
				}

				if role.name == "reader" && (response.Errors == nil ||
					!strings.Contains(fmt.Sprint(response.Errors), "internal server error") ||
					strings.Contains(fmt.Sprint(response.Errors), "otherLabel")) {
					t.Fatalf("reader received unsafe error: %+v err=%v", response, resolveErr)
				}
			})
		}
	}
}
