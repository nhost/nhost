package controller_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,gocognit,cyclop // One testdb/controller checks all signatures, inconsistencies and HTTP role roots.
func TestComputedArgumentNamesKeepHTTPRoles(t *testing.T) {
	pool := testdb.NewPostgres(t, `
CREATE TABLE public.items (id text PRIMARY KEY, amount numeric);
CREATE TABLE public.other (id int PRIMARY KEY);
INSERT INTO public.items VALUES ('a', 1), ('b', 2);
INSERT INTO public.other VALUES (1);
CREATE FUNCTION public.f_reserved(item public.items, __x int4) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * $2 $$;
CREATE FUNCTION public.f_duplicate(item public.items, arg_1 int4, int4) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * $2 + $3 $$;
CREATE FUNCTION public.f_dollar(item public.items, a$b int4) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * $2 $$;
CREATE FUNCTION public.f_ok(item public.items, ok_name int4) RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * $2 $$;`)

	const raw = `{"version":3,"sources":[{"name":"db","kind":"postgres",
"configuration":{"connection_info":{"database_url":"placeholder"}},"tables":[
{"table":{"schema":"public","name":"items"},"computed_fields":[
{"name":"reserved","definition":{"function":{"schema":"public","name":"f_reserved"},"table_argument":"item"}},
{"name":"duplicate","definition":{"function":{"schema":"public","name":"f_duplicate"},"table_argument":"item"}},
{"name":"dollar","definition":{"function":{"schema":"public","name":"f_dollar"},"table_argument":"item"}},
{"name":"ok","definition":{"function":{"schema":"public","name":"f_ok"},"table_argument":"item"}}],
"select_permissions":[
{"role":"reader","permission":{"columns":["id"],"computed_fields":["reserved","duplicate","dollar","ok"],"filter":{}}},
{"role":"plain","permission":{"columns":["id"],"filter":{}}},
{"role":"valid","permission":{"columns":["id"],"computed_fields":["ok"],"filter":{}}}]},
{"table":{"schema":"public","name":"other"},"select_permissions":[
{"role":"reader","permission":{"columns":["id"],"filter":{}}},
{"role":"plain","permission":{"columns":["id"],"filter":{}}},
{"role":"valid","permission":{"columns":["id"],"filter":{}}}]}]}]}`

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

	fields := map[string]bool{"reserved": false, "duplicate": false, "dollar": false}

	var revoked bool
	for _, inc := range ctrl.Inconsistencies() {
		switch inc.Kind {
		case metadata.InconsistencyKindComputedField:
			name := strings.TrimPrefix(inc.Name, "public.items.")
			if _, ok := fields[name]; !ok || inc.Reason == "" {
				t.Fatalf("unexpected computed inconsistency: %+v", inc)
			}

			fields[name] = true
		case metadata.InconsistencyKindSelectPermission:
			if inc.Name != "public.items.reader" {
				t.Fatalf("unexpected permission loss: %+v", inc)
			}

			revoked = true
		default:
			t.Fatalf("unrelated/role inconsistency: %+v", inc)
		}
	}

	for name, found := range fields {
		if !found {
			t.Fatalf("missing field inconsistency: %s", name)
		}
	}

	if !revoked {
		t.Fatal("invalid computed grant did not revoke whole select permission")
	}

	router := newTestRouter(t, ctrl)
	request := func(role, query string) string {
		t.Helper()

		body, err := json.Marshal(map[string]string{"query": query})
		if err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

		if role != "admin" {
			req.Header.Set("X-Hasura-Role", role)
		}

		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("%s HTTP %d: %s", role, rec.Code, rec.Body.String())
		}

		return rec.Body.String()
	}

	for _, role := range []string{"admin", "reader", "plain", "valid"} {
		response := request(role, `{other{id}}`)
		if !strings.Contains(response, `"id":1`) || strings.Contains(response, `"errors"`) {
			t.Fatalf("%s unrelated root lost: %s", role, response)
		}
	}

	for _, role := range []string{"admin", "plain", "valid"} {
		response := request(role, `{items(order_by:{id:asc}){id}}`)
		if !strings.Contains(response, `"id":"a"`) || strings.Contains(response, `"errors"`) {
			t.Fatalf("%s allowed root lost: %s", role, response)
		}
	}

	if response := request("reader", `{items{id}}`); !strings.Contains(response, `"errors"`) {
		t.Fatalf("invalid grant leaked select root: %s", response)
	}

	for _, role := range []string{"admin", "valid"} {
		response := request(role, `{items(order_by:{id:asc}){id ok(args:{ok_name:2})}}`)
		if strings.Contains(response, `"errors"`) || !strings.Contains(response, `"ok":2`) ||
			!strings.Contains(response, `"ok":4`) {
			t.Fatalf("%s valid computed field lost: %s", role, response)
		}
	}

	for _, name := range []string{"reserved", "duplicate", "dollar"} {
		if response := request(
			"admin",
			`{items{id `+name+`}}`,
		); !strings.Contains(
			response,
			`"errors"`,
		) {
			t.Fatalf("invalid %s exposed: %s", name, response)
		}
	}
}
