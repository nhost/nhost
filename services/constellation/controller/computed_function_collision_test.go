package controller_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// Serial: this HTTP boundary owns a testdb pool and a SQL connector pool.
//
//nolint:cyclop,paralleltest // Serial testdb fixture asserts both roles, execution, introspection and inconsistency scope.
func TestSameSourceComputedFunctionCollisionHTTP(t *testing.T) {
	const ddl = `
CREATE TABLE public.items (id text PRIMARY KEY, amount numeric);
INSERT INTO public.items VALUES ('a', 1), ('b', 2);
CREATE FUNCTION public.item_value(item public.items, scale int4)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount * scale $$;
CREATE FUNCTION public.value_items(factor int4)
RETURNS SETOF public.items LANGUAGE sql STABLE
AS $$ SELECT id, amount FROM public.items WHERE amount * factor > 1 $$;`

	pool := testdb.NewPostgres(t, ddl)

	const raw = `{"version":3,"sources":[{"name":"db","kind":"postgres",
"configuration":{"connection_info":{"database_url":"placeholder"}},"tables":[
{"table":{"schema":"public","name":"items"},
"computed_fields":[{"name":"value","definition":{"function":{"schema":"public","name":"item_value"}}}],
"select_permissions":[{"role":"reader","permission":{"columns":["id","amount"],
"computed_fields":["value"],"filter":{},"allow_aggregations":true}}]}],
"functions":[{"function":{"schema":"public","name":"value_items"},
"permissions":[{"role":"reader"}]}]}]}`

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

	incs := ctrl.Inconsistencies()
	if len(incs) != 2 {
		t.Fatalf("want one computed inconsistency per role: %+v", incs)
	}

	for _, inc := range incs {
		if inc.Kind != metadata.InconsistencyKindComputedField || inc.Name != "public.items.value" {
			t.Fatalf("unexpected inconsistency: %+v", inc)
		}
	}

	router := newTestRouter(t, ctrl)
	//nolint:paralleltest // Both roles share the same controller and PostgreSQL pool.
	for _, role := range []string{"admin", "reader"} {
		t.Run(role, func(t *testing.T) {
			const query = `{ value_items(args:{factor:1}, order_by:{id:asc}) { id }
items(order_by:{id:asc}) { id amount }
input:__type(name:"value_items_args") { inputFields { name type { kind } } }
item:__type(name:"items") { fields { name } } }`

			payload, err := json.Marshal(map[string]string{"query": query})
			if err != nil {
				t.Fatal(err)
			}

			request := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(payload))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

			if role != "admin" {
				request.Header.Set("X-Hasura-Role", role)
			}

			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			var body struct {
				Data struct {
					Rows []struct {
						ID string `json:"id"`
					} `json:"value_items"`
					Items []struct {
						ID string `json:"id"`
					} `json:"items"`
					Input struct {
						InputFields []struct {
							Name string `json:"name"`
							Type struct {
								Kind string `json:"kind"`
							} `json:"type"`
						} `json:"inputFields"`
					} `json:"input"`
					Item struct {
						Fields []struct {
							Name string `json:"name"`
						} `json:"fields"`
					} `json:"item"`
				} `json:"data"`
				Errors []struct {
					Message string `json:"message"`
				} `json:"errors"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
				t.Fatal(err)
			}

			if response.Code != http.StatusOK || len(body.Errors) != 0 ||
				len(body.Data.Rows) != 1 || body.Data.Rows[0].ID != "b" ||
				len(body.Data.Items) != 2 || len(body.Data.Input.InputFields) != 1 ||
				body.Data.Input.InputFields[0].Name != "factor" ||
				body.Data.Input.InputFields[0].Type.Kind != "NON_NULL" {
				t.Fatalf("role %s lost function/input or table data (HTTP %d): %s",
					role, response.Code, response.Body.String())
			}

			for _, field := range body.Data.Item.Fields {
				if field.Name == "value" {
					t.Fatalf("role %s exposes ambiguous computed field", role)
				}
			}
		})
	}
}
