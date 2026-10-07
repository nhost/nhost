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

// This exercises the real HTTP/controller trust boundary, not just connector.Execute.
// Both modes use the same isolated PostgreSQL schema and independent column controls.
//
//nolint:paralleltest,gocognit,gocyclo,cyclop,nestif,maintidx // Modes and negative cases share one isolated database; assertions pin distinct error boundaries.
func TestComputedArgumentHTTPInheritedErrorAndIntControls(t *testing.T) {
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
CREATE DOMAIN public.p14_http_posint AS integer CHECK (VALUE > 0);
ALTER TABLE cf_select.items ADD COLUMN p14_http_column int4range;
CREATE FUNCTION cf_select.p14_http(item cf_select.items, n public.p14_http_posint)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT item.amount + n $$;
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
		Name: "p14_http", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_http"},
		},
	})
	// Admin sees both the public-domain column and the computed argument.
	for _, dev := range []bool{false, true} {
		name := "production"
		if dev {
			name = "development"
		}

		t.Run(name, func(t *testing.T) {
			ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, dev,
				middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
				slog.New(slog.DiscardHandler), "", nil)
			if err != nil {
				t.Fatal(err)
			}

			router := newTestRouter(t, ctrl)

			query := func(q string) map[string]any {
				t.Helper()

				payload, err := json.Marshal(map[string]any{"query": q})
				if err != nil {
					t.Fatal(err)
				}

				req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(payload))
				req.Header.Set("Content-Type", "application/json")
				req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code != http.StatusOK {
					t.Fatalf("HTTP %d: %s", w.Code, w.Body.String())
				}

				var response map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatal(err)
				}

				return response
			}
			for _, tc := range []struct{ name, query, sqlstate, sensitive string }{
				{"computed domain check", `{cf_select_items(where:{id:{_eq:1}}){p14_http(args:{n:"0"})}}`, "23514", "p14_http_posint"},
				{"computed invalid cast", `{cf_select_items(where:{id:{_eq:1}}){p14_http(args:{n:"x"})}}`, "22P02", `"x"`},
				{"column invalid cast", `{cf_select_items(where:{p14_http_column:{_eq:"x"}}){id}}`, "22P02", `"x"`},
				{"computed public success", `{cf_select_items(where:{id:{_eq:1}}){p14_http(args:{n:"2"})}}`, "", ""},
			} {
				t.Run(tc.name, func(t *testing.T) {
					response := query(tc.query)
					if tc.sqlstate == "" {
						if response["errors"] != nil || response["data"] == nil {
							t.Fatalf("public domain success: %#v", response)
						}

						return
					}

					errors, ok := response["errors"].([]any)
					if !ok || len(errors) != 1 {
						t.Fatalf("expected one database error, got %#v", response)
					}

					e, ok := errors[0].(map[string]any)
					if !ok {
						t.Fatalf("invalid error envelope: %#v", response)
					}

					msg, ok := e["message"].(string)
					if !ok {
						t.Fatalf("missing error message: %#v", response)
					}

					if _, present := e["extensions"]; present {
						t.Fatalf("database error disclosed extensions: %#v", e)
					}

					if dev {
						if !strings.Contains(msg, tc.sqlstate) ||
							!strings.Contains(msg, "failed to execute") {
							t.Fatalf("raw chain missing SQLSTATE %s: %#v", tc.sqlstate, response)
						}
					} else if !strings.HasPrefix(msg, "internal server error (trace id: ") ||
						strings.Contains(msg, tc.sqlstate) || strings.Contains(msg, tc.sensitive) {
						t.Fatalf("unsafe or missing production sanitizer: %#v", response)
					}

					if response["data"] != nil {
						t.Fatalf("database failure returned data: %#v", response)
					}
				})
			}

			for _, tc := range []struct {
				name, query string
				success     bool
			}{
				{"computed quoted Int", `{cf_select_items(where:{id:{_eq:1}}){item_score(args:{multiplier:"3"})}}`, false},
				{"column quoted Int", `{cf_select_items(where:{id:{_eq:"1"}}){id}}`, false},
				{"computed float Int", `{cf_select_items{item_score(args:{multiplier:2.5})}}`, false},
				{"column float Int", `{cf_select_items(where:{id:{_eq:2.5}}){id}}`, false},
				{"computed out of range Int", `{cf_select_items{item_score(args:{multiplier:2147483648})}}`, false},
				{"column out of range Int", `{cf_select_items(where:{id:{_eq:2147483648}}){id}}`, false},
				{"computed valid Int", `{cf_select_items(where:{id:{_eq:1}}){item_score(args:{multiplier:3})}}`, true},
				{"column valid Int", `{cf_select_items(where:{id:{_eq:1}}){id}}`, true},
			} {
				t.Run(tc.name, func(t *testing.T) {
					response := query(tc.query)

					errors, failed := response["errors"].([]any)
					if tc.success {
						if failed || response["data"] == nil {
							t.Fatalf("valid Int failed: %#v", response)
						}

						return
					}

					if !failed || len(errors) != 1 {
						t.Fatalf("strict Int input unexpectedly accepted: %#v", response)
					}

					e, ok := errors[0].(map[string]any)
					if !ok {
						t.Fatalf("invalid error envelope: %#v", response)
					}

					msg, ok := e["message"].(string)
					if !ok {
						t.Fatalf("missing error message: %#v", response)
					}

					if strings.Contains(tc.name, "out of range") {
						// Some out-of-range paths reach pgx encoding rather than GraphQL validation.
						// The inherited sanitizer still applies at that boundary.
						if dev {
							if !strings.Contains(msg, "failed to encode") ||
								!strings.Contains(msg, "int4") {
								t.Fatalf("raw out-of-range encode error missing: %#v", response)
							}
						} else if !strings.HasPrefix(msg, "internal server error (trace id: ") ||
							strings.Contains(msg, "2147483648") || e["extensions"] != nil {
							t.Fatalf("out-of-range encode error not sanitized: %#v", response)
						}
					} else if !strings.Contains(msg, "Int cannot represent") ||
						e["locations"] == nil || e["extensions"] != nil {
						t.Fatalf("unexpected strict Int validation envelope: %#v", response)
					}
				})
			}
		})
	}
}
