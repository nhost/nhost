package controller_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// This is intentionally serial: each case owns a testdb pool and a controller
// connector; avoid multiplying the cross-package database connection budget.
//
//nolint:gocognit,cyclop,paralleltest // Serial testdb fixture checks admin/granted/ungranted HTTP, output shape and executed aggregate together.
func TestComputedCollisionPreservesAggregateHTTP(t *testing.T) {
	const ddl = `
CREATE SCHEMA cf_probe;
CREATE TYPE public.cf_probe_mood AS ENUM ('low', 'high');
CREATE TABLE cf_probe.items (id uuid PRIMARY KEY, label text NOT NULL);
CREATE TABLE cf_probe.mood (id text PRIMARY KEY);
CREATE FUNCTION cf_probe.value(item cf_probe.items, choice public.cf_probe_mood)
RETURNS integer LANGUAGE sql STABLE AS $$ SELECT length(item.label) $$;
INSERT INTO cf_probe.items VALUES
('00000000-0000-0000-0000-000000000001', 'first'),
('00000000-0000-0000-0000-000000000002', 'second');
`

	pool := testdb.NewPostgres(t, ddl)
	// Tracking mood makes its object type collide with the custom argument
	// scalar used by value; neither the numeric aggregate nor the table root
	// should remove admin or the granted reader role.
	const raw = `{"version":3,"sources":[{"name":"db","kind":"postgres",
"configuration":{"connection_info":{"database_url":"placeholder"}},"tables":[
{"table":{"schema":"cf_probe","name":"items"},
"computed_fields":[{"name":"value","definition":{"function":{"schema":"cf_probe","name":"value"}}}],
"select_permissions":[
{"role":"reader","permission":{"columns":["id","label"],"computed_fields":["value"],"filter":{},"allow_aggregations":true}},
{"role":"ungranted","permission":{"columns":["id","label"],"filter":{},"allow_aggregations":true}}]},
{"table":{"schema":"cf_probe","name":"mood"},"select_permissions":[
{"role":"reader","permission":{"columns":["id"],"filter":{}}},
{"role":"ungranted","permission":{"columns":["id"],"filter":{}}}]}]}]}`

	md, err := metadata.FromHasuraJSON([]byte(raw))
	if err != nil {
		t.Fatal(err)
	}

	md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
		pool.Config().ConnConfig.ConnString(),
	)

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	for _, inc := range ctrl.Inconsistencies() {
		if inc.Kind != metadata.InconsistencyKindComputedField {
			t.Fatalf("unexpected inconsistency: %+v", inc)
		}
	}

	router := newTestRouter(t, ctrl)
	//nolint:paralleltest // All roles share a single controller and testdb pool.
	for _, role := range []string{"admin", "reader", "ungranted"} {
		t.Run(role, func(t *testing.T) {
			query := `{ cf_probe_items_aggregate { aggregate { count max { label } } nodes { label } } cf_probe_items { label } agg:__type(name:"cf_probe_items_aggregate_fields") { fields { name } } item:__type(name:"cf_probe_items") { fields { name } } }`

			body, err := json.Marshal(map[string]string{"query": query})
			if err != nil {
				t.Fatal(err)
			}

			request := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

			if role != "admin" {
				request.Header.Set("X-Hasura-Role", role)
			}

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			var data struct {
				Data struct {
					Agg       struct{ Fields []struct{ Name string } } `json:"agg"`
					Item      struct{ Fields []struct{ Name string } } `json:"item"`
					Rows      []struct{ Label string }                 `json:"cf_probe_items"`
					Aggregate struct {
						Aggregate struct {
							Count int
							Max   struct{ Label string }
						} `json:"aggregate"`
						Nodes []struct{ Label string } `json:"nodes"`
					} `json:"cf_probe_items_aggregate"`
				} `json:"data"`
				Errors []struct{ Message string } `json:"errors"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &data); err != nil {
				t.Fatal(err)
			}

			if response.Code != http.StatusOK || len(data.Errors) != 0 ||
				len(data.Data.Rows) != 2 ||
				data.Data.Aggregate.Aggregate.Count != 2 ||
				len(data.Data.Aggregate.Nodes) != 2 ||
				data.Data.Aggregate.Aggregate.Max.Label != "second" {
				t.Fatalf("role %s HTTP %d: %s", role, response.Code, response.Body.String())
			}

			got := make([]string, 0, len(data.Data.Agg.Fields))
			for _, field := range data.Data.Agg.Fields {
				got = append(got, field.Name)
			}

			slices.Sort(got)

			if !slices.Equal(got, []string{"count", "max", "min"}) {
				t.Errorf("role %s aggregate fields = %v", role, got)
			}

			for _, field := range data.Data.Item.Fields {
				if field.Name == "value" && role != "ungranted" {
					t.Errorf("role %s exposes colliding value", role)
				}
			}
		})
	}
}
