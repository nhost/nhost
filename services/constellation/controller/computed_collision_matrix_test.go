package controller_test

import (
	"bytes"
	"encoding/json"
	"fmt"
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

// Hasura v2.50.3-ce classified these collisions in a serialized oracle.
// Each Constellation variant is rebuilt from pristine metadata on testdb.
//
//nolint:paralleltest,gocognit,gocyclo,cyclop // Variants open/close connectors serially on the same testdb, checking each role/grant.
func TestComputedCollisionRoleMatrix(t *testing.T) {
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

	pool := testdb.NewPostgres(t, string(ddl), string(seed))

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range []struct {
		name, field string
		custom      bool
	}{
		{"physical column", "label", false},
		{"custom column name", "p14_custom_label", true},
		{"object remote relationship", "cf_label_object", false},
		{"array remote relationship", "cf_label_array", false},
		{"to_source remote relationship", "cf_payload_object", false},
	} {
		for _, grant := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/grant=%t", tc.name, grant), func(t *testing.T) {
				md, err := metadata.FromHasuraJSON(raw)
				if err != nil {
					t.Fatal(err)
				}

				for i := range md.Databases {
					md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
						pool.Config().ConnConfig.ConnString(),
					)
				}

				items := &md.Databases[0].Tables[0]

				items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
					Name: tc.field, Definition: metadata.ComputedFieldDefinition{
						Function: metadata.FunctionSource{Schema: "cf_select", Name: "item_label"},
					},
				})
				if tc.custom {
					items.Configuration.ColumnConfig = map[string]metadata.ColumnConfig{
						"label": {CustomName: tc.field},
					}
				}

				if grant {
					items.SelectPermissions[1].Permission.ComputedFields = append(
						items.SelectPermissions[1].Permission.ComputedFields, tc.field)
				}

				ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
					middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
					slog.New(slog.DiscardHandler), "", nil)
				if err != nil {
					t.Fatal(err)
				}

				found := false
				for _, inc := range ctrl.Inconsistencies() {
					if inc.Kind == metadata.InconsistencyKindComputedField &&
						strings.Contains(inc.Name, tc.field) {
						found = true
					}
				}

				if !found {
					t.Fatalf("missing computed inconsistency: %+v", ctrl.Inconsistencies())
				}

				for _, role := range []string{"admin", "cf_reader", "cf_no_grant"} {
					headers := http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}
					if role != "admin" {
						headers.Set("X-Hasura-Role", role)
					}

					query := `{cf_select_items(limit:1){id}}`
					if role == "cf_reader" && !grant {
						query = `{cf_select_items(limit:1){id item_score}}`
					}

					payload, err := json.Marshal(map[string]any{"query": query})
					if err != nil {
						t.Fatal(err)
					}

					request := httptest.NewRequest(
						http.MethodPost,
						"/graphql",
						bytes.NewReader(payload),
					)
					request.Header = headers
					request.Header.Set("Content-Type", "application/json")

					response := httptest.NewRecorder()
					newTestRouter(t, ctrl).ServeHTTP(response, request)

					var result map[string]any
					if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
						t.Fatal(err)
					}

					switch {
					case role == "cf_reader" && grant:
						if result["errors"] == nil {
							t.Fatalf("grant must revoke reader root: %#v", result)
						}
					case result["errors"] != nil || result["data"] == nil:
						t.Fatalf("unrelated root lost for %s: %#v", role, result)
					case role == "cf_reader":
						data, ok := result["data"].(map[string]any)
						if !ok {
							t.Fatalf("missing reader data: %#v", result)
						}

						rows, ok := data["cf_select_items"].([]any)
						if !ok || len(rows) != 1 {
							t.Fatalf("missing reader row: %#v", result)
						}

						row, ok := rows[0].(map[string]any)
						if !ok || row["id"] != float64(1) || row["item_score"] != float64(12.5) {
							t.Fatalf("unrelated computed selection lost: %#v", result)
						}
					}
				}
			})
		}
	}
}
