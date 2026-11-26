package controller_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/connector"
	csql "github.com/nhost/nhost/services/constellation/connector/sql"
	"github.com/nhost/nhost/services/constellation/connector/sql/sqlite"
	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func TestSelectRootPermissionsHTTP(t *testing.T) {
	t.Parallel()

	md, err := metadata.FromHasuraJSON([]byte(`{
	  "version": 3,
	  "sources": [{"name": "db", "kind": "sqlite", "tables": [
	    {
	      "table": {"schema": "public", "name": "folders"},
	      "array_relationships": [{"name": "documents", "using": {"manual_configuration": {
	        "remote_table": {"schema": "public", "name": "documents"},
	        "column_mapping": {"id": "folder_id"}
	      }}}],
	      "select_permissions": [
	        {"role": "reader", "permission": {"columns": ["id"], "filter": {}}},
	        {"role": "control", "permission": {"columns": ["id"], "filter": {}}},
	        {"role": "nested_only", "permission": {"columns": ["id"], "filter": {}}}
	      ]
	    },
	    {
	      "table": {"schema": "public", "name": "documents"},
	      "configuration": {"custom_root_fields": {"select_by_pk": "document"}},
	      "select_permissions": [
	        {"role": "reader", "permission": {
	          "columns": ["id", "folder_id"], "filter": {},
	          "query_root_fields": ["select", "select_aggregate"]
	        }},
	        {"role": "control", "permission": {
	          "columns": ["id", "folder_id"], "filter": {},
	          "query_root_fields": ["select", "select_aggregate"], "allow_aggregations": true
	        }},
	        {"role": "by_key", "permission": {
	          "columns": ["id", "folder_id"], "filter": {"id": {"_gt": 1}},
	          "query_root_fields": ["select_by_pk"], "subscription_root_fields": []
	        }},
	        {"role": "nested_only", "permission": {
	          "columns": ["id", "folder_id"], "filter": {"id": {"_gt": 1}},
	          "query_root_fields": [], "subscription_root_fields": []
	        }}
	      ]
	    }
	  ]}]
	}`))
	if err != nil {
		t.Fatalf("parse metadata: %v", err)
	}

	db := &md.Databases[0]
	sqlite.FlattenMetadata(db)

	driver := testdb.NewSQLite(t, `
		CREATE TABLE folders (id INTEGER PRIMARY KEY);
		CREATE TABLE documents (id INTEGER PRIMARY KEY, folder_id INTEGER NOT NULL REFERENCES folders(id));
		INSERT INTO folders VALUES (1);
		INSERT INTO documents VALUES (1, 1), (2, 1);
	`)
	logger := slog.New(slog.DiscardHandler)

	conn, err := csql.NewConnector(t.Context(), driver, db, metadata.NewInconsistencies(), logger)
	if err != nil {
		t.Fatalf("build SQL connector: %v", err)
	}

	ctrl, err := controller.NewFromConnectors(
		testAdminSecret, map[string]connector.Connector{"db": conn}, nil, logger,
	)
	if err != nil {
		t.Fatalf("build controller: %v", err)
	}

	router := newTestRouter(t, ctrl)
	allDocuments := []any{map[string]any{"id": float64(1)}, map[string]any{"id": float64(2)}}
	tests := []struct {
		name    string
		role    string
		body    string
		want    map[string]any
		wantErr string
	}{
		{
			"reader root",
			"reader",
			`{"query":"{ documents { id } }"}`,
			nil,
			`Cannot query field "documents"`,
		},
		{
			"reader relationship",
			"reader",
			`{"query":"{ folders { documents { id } } }"}`,
			nil,
			`Cannot query field "documents"`,
		},
		{
			"reader other table", "reader", `{"query":"{ folders { id } }"}`,
			map[string]any{"folders": []any{map[string]any{"id": float64(1)}}},
			"",
		},
		{
			"control root and relationship",
			"control",
			`{"query":"{ documents(order_by: {id: asc}) { id } folders { documents(order_by: {id: asc}) { id } } }"}`,
			map[string]any{
				"documents": allDocuments,
				"folders":   []any{map[string]any{"documents": allDocuments}},
			},
			"",
		},
		{
			"custom by-key root applies row filter", "by_key",
			`{"query":"{ allowed: document(id: 2) { id } filtered: document(id: 1) { id } }"}`,
			map[string]any{"allowed": map[string]any{"id": float64(2)}, "filtered": nil},
			"",
		},
		{
			"by-key role has no collection root", "by_key", `{"query":"{ documents { id } }"}`,
			nil, `Cannot query field "documents"`,
		},
		{
			"by-key role has no subscription root",
			"by_key",
			`{"query":"{ __schema { subscriptionType { name } } }"}`,
			map[string]any{"__schema": map[string]any{"subscriptionType": nil}},
			"",
		},
		{
			"nested read with both allowlists empty",
			"nested_only",
			`{"query":"{ folders { documents { id } } }"}`,
			map[string]any{"folders": []any{
				map[string]any{"documents": []any{map[string]any{"id": float64(2)}}},
			}},
			"",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			req := httptest.NewRequestWithContext(
				t.Context(),
				http.MethodPost,
				"/graphql",
				strings.NewReader(tt.body),
			)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)
			req.Header.Set("X-Hasura-Role", tt.role)

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != http.StatusOK {
				t.Fatalf("HTTP %d: %s", resp.Code, resp.Body.String())
			}

			body := readJSONBody(t, resp)
			if tt.wantErr != "" {
				errs, ok := body["errors"].([]any)
				if !ok || len(errs) != 1 || body["data"] != nil {
					t.Fatalf("want one validation error and no data: %s", resp.Body.String())
				}

				gqlErr, ok := errs[0].(map[string]any)
				if !ok {
					t.Fatalf("want GraphQL error object, got %v", errs[0])
				}

				message, _ := gqlErr["message"].(string)
				if !strings.Contains(message, tt.wantErr) {
					t.Errorf("error = %q; want it to contain %q", message, tt.wantErr)
				}

				return
			}

			if body["errors"] != nil {
				t.Fatalf("unexpected errors: %s", resp.Body.String())
			}

			if diff := cmp.Diff(tt.want, body["data"]); diff != "" {
				t.Errorf("response data (-want +got):\n%s", diff)
			}
		})
	}
}
