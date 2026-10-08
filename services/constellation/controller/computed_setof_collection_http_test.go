package controller_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,gocognit,cyclop // One isolated testdb checks the HTTP envelope and persisted rows across sequential mutation outcomes.
func TestComputedSetofCollectionReturningHTTPRollback(t *testing.T) {
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

	ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.p14_followup_collection(item cf_select.items) RETURNS SETOF int4
LANGUAGE sql STABLE AS $$ SELECT g FROM generate_series(1,
 CASE WHEN item.id IN (101,201) THEN 0 WHEN item.id IN (102,202) THEN 1 ELSE 2 END) g $$;
`)...)
	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
		pool.Config().ConnConfig.ConnString(),
	)
	items := &md.Databases[0].Tables[0]
	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "p14_followup_collection",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_followup_collection"},
		},
	})

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	router := newTestRouter(t, ctrl)
	request := func(query string) map[string]any {
		t.Helper()

		body, err := json.Marshal(map[string]string{"query": query})
		if err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

		response := httptest.NewRecorder()
		router.ServeHTTP(response, req)

		if response.Code != http.StatusOK {
			t.Fatalf("GraphQL HTTP %d: %s", response.Code, response.Body.String())
		}

		var decoded map[string]any
		if err := json.Unmarshal(response.Body.Bytes(), &decoded); err != nil {
			t.Fatal(err)
		}

		return decoded
	}

	got := request(`mutation{insert_cf_select_items(objects:[
		{id:201,owner_id:1,label:"zero",amount:1,payload:{}},
		{id:202,owner_id:1,label:"one",amount:1,payload:{}}
	]){affected_rows returning{id p14_followup_collection}}}`)
	if got["errors"] != nil {
		t.Fatalf("mixed zero/one returning failed: %+v", got)
	}

	data, err := json.Marshal(got["data"])
	if err != nil {
		t.Fatal(err)
	}

	const want = `{"insert_cf_select_items":{"affected_rows":2,"returning":[null,{"id":202,"p14_followup_collection":1}]}}`
	if string(data) != want {
		t.Fatalf("mixed zero/one returning = %s, want %s", data, want)
	}

	if _, err := pool.Exec(t.Context(), `INSERT INTO cf_select.items
		(id,owner_id,label,amount,payload) VALUES (103,1,'before',1,'{}')`); err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, query string
		id          int
		wantLabel   string
	}{
		{"collection insert many", `mutation{insert_cf_select_items(objects:[
			{id:203,owner_id:1,label:"failed",amount:1,payload:{}}
		]){affected_rows returning{id p14_followup_collection}}}`, 203, ""},
		{"collection update many", `mutation{update_cf_select_items(
			where:{id:{_eq:103}},_set:{label:"failed"}
		){affected_rows returning{id p14_followup_collection}}}`, 103, "before"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			failed := request(tc.query)

			errors, ok := failed["errors"].([]any)
			if !ok || len(errors) != 1 || failed["data"] != nil {
				t.Fatalf("expected one database error without data: %+v", failed)
			}

			e, ok := errors[0].(map[string]any)
			if !ok {
				t.Fatalf("invalid error envelope: %+v", errors[0])
			}

			message, ok := e["message"].(string)
			if !ok || e["extensions"] != nil ||
				!strings.HasPrefix(message, "internal server error (trace id:") {
				t.Fatalf("database error was not sanitized: %+v", errors[0])
			}

			var (
				count int
				label string
			)
			if err := pool.QueryRow(t.Context(), `SELECT count(*), coalesce(max(label),'')
				FROM cf_select.items WHERE id=$1`, tc.id).Scan(&count, &label); err != nil {
				t.Fatal(err)
			}

			if (tc.id == 203 && count != 0) ||
				(tc.id == 103 && (count != 1 || label != tc.wantLabel)) {
				t.Fatalf("failed returning persisted id=%d count=%d label=%q", tc.id, count, label)
			}
		})
	}
}
