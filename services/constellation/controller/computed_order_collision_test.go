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

//nolint:paralleltest,cyclop // One controller/testdb fixture covers both role responses and typed inputs.
func TestComputedTableOrderCollisionKeepsHTTPRoles(t *testing.T) {
	pool := testdb.NewPostgres(t, `
CREATE TABLE public.order_parent (id int PRIMARY KEY, sibling_aggregate int NOT NULL);
CREATE TABLE public.order_child (id int PRIMARY KEY, parent_id int REFERENCES public.order_parent(id));
CREATE FUNCTION public.order_kids(p public.order_parent) RETURNS SETOF public.order_child
LANGUAGE sql STABLE AS $$ SELECT c.id, c.parent_id FROM public.order_child c WHERE c.parent_id = p.id $$;
INSERT INTO public.order_parent VALUES (1, 3), (2, 5);
INSERT INTO public.order_child VALUES (1, 1), (2, 2);`)

	const raw = `{"version":3,"sources":[{"name":"db","kind":"postgres",
"configuration":{"connection_info":{"database_url":"placeholder"}},"tables":[
{"table":{"schema":"public","name":"order_parent"},
"computed_fields":[{"name":"sibling","definition":{"function":{"schema":"public","name":"order_kids"}}}],
"select_permissions":[{"role":"reader","permission":{"columns":["id","sibling_aggregate"],"filter":{}}}]},
{"table":{"schema":"public","name":"order_child"},
"select_permissions":[{"role":"reader","permission":{"columns":["id","parent_id"],"filter":{},"allow_aggregations":true}}]}]}]}`

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

	if got := ctrl.Inconsistencies(); len(got) != 1 ||
		got[0].Kind != metadata.InconsistencyKindComputedField ||
		got[0].Name != "public.order_parent.sibling" {
		t.Fatalf("unexpected inconsistencies: %+v", got)
	}

	router := newTestRouter(t, ctrl)
	for _, role := range []string{"admin", "reader"} {
		query := `{order_parent(order_by:{sibling_aggregate:desc}){id sibling_aggregate} order_child{id} __type(name:"order_parent_order_by"){inputFields{name type{name}}}}`

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

		var payload struct {
			Data struct {
				Rows []struct {
					ID int `json:"id"`
				} `json:"order_parent"`
				Child []struct {
					ID int `json:"id"`
				} `json:"order_child"`
				Type struct {
					Fields []struct {
						Name string `json:"name"`
						Type struct {
							Name string `json:"name"`
						} `json:"type"`
					} `json:"inputFields"`
				} `json:"__type"`
			} `json:"data"`
			Errors []struct {
				Message string `json:"message"`
			} `json:"errors"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}

		if response.Code != http.StatusOK || len(payload.Errors) != 0 ||
			len(payload.Data.Rows) != 2 || payload.Data.Rows[0].ID != 2 ||
			len(payload.Data.Child) != 2 {
			t.Fatalf(
				"%s lost HTTP root or ordering (%d): %s",
				role,
				response.Code,
				response.Body.String(),
			)
		}

		var siblingCount int
		for _, field := range payload.Data.Type.Fields {
			if field.Name == "sibling_aggregate" {
				siblingCount++

				if field.Type.Name != "order_by" {
					t.Fatalf("%s wrong order input: %+v", role, field)
				}
			}
		}

		if siblingCount != 1 {
			t.Fatalf("%s has %d order keys", role, siblingCount)
		}
	}
}
