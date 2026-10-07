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

// Hasura v2.50.3-ce rejects this exact enum/object collision atomically.
// Constellation accepts metadata but omits only the ambiguous selection.
//
//nolint:paralleltest,gocognit,cyclop // One testdb exercises metadata, inconsistency and role schemas in both grant states.
func TestComputedScalarObjectCollisionMetadataAcceptance(t *testing.T) {
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

	const collisionDDL = `
CREATE TYPE public.cf_select_cf_probe_p13_rows AS ENUM ('ok');
CREATE TABLE cf_select.cf_probe_p13_rows (id integer PRIMARY KEY);
CREATE FUNCTION cf_select.p14_collision_enum(item cf_select.items,
  choice public.cf_select_cf_probe_p13_rows) RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT choice::text $$;`

	pool := testdb.NewPostgres(t, string(ddl)+collisionDDL, string(seed))

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	for _, grant := range []bool{false, true} {
		name := "ungranted"
		if grant {
			name = "granted"
		}

		t.Run(name, func(t *testing.T) {
			md, err := metadata.FromHasuraJSON(raw)
			if err != nil {
				t.Fatal(err)
			}

			for i := range md.Databases {
				md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
					pool.Config().ConnConfig.ConnString(),
				)
			}

			parent := &md.Databases[0].Tables[0]

			parent.ComputedFields = append(parent.ComputedFields, metadata.ComputedField{
				Name: "p14_collision_enum",
				Definition: metadata.ComputedFieldDefinition{
					Function: metadata.FunctionSource{
						Schema: "cf_select",
						Name:   "p14_collision_enum",
					},
				},
			})
			if grant {
				parent.SelectPermissions[1].Permission.ComputedFields = append(
					parent.SelectPermissions[1].Permission.ComputedFields, "p14_collision_enum",
				)
			}

			md.Databases[0].Tables = append(md.Databases[0].Tables, metadata.TableMetadata{
				Table: metadata.TableSource{Schema: "cf_select", Name: "cf_probe_p13_rows"},
				SelectPermissions: []metadata.SelectPermission{
					{
						Role:       "cf_reader",
						Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
					},
					{
						Role:       "cf_no_grant",
						Permission: metadata.SelectPermissionConfig{Columns: []string{"id"}},
					},
				},
			})

			ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
				middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
				slog.New(slog.DiscardHandler), "", nil)
			if err != nil {
				t.Fatalf(
					"Constellation rejected metadata instead of omitting the conflicting selection: %v",
					err,
				)
			}

			found := false
			for _, inc := range ctrl.Inconsistencies() {
				if inc.Kind == metadata.InconsistencyKindSelectPermission {
					t.Fatalf("grant revoked unrelated reader access: %+v", ctrl.Inconsistencies())
				}

				if inc.Kind == metadata.InconsistencyKindComputedField &&
					strings.Contains(inc.Name, "p14_collision_enum") {
					found = true
				}
			}

			if !found {
				t.Fatalf(
					"missing conflicting computed selection inconsistency: %+v",
					ctrl.Inconsistencies(),
				)
			}

			for _, role := range []string{"admin", "cf_reader", "cf_no_grant"} {
				const query = `{item:__type(name:"cf_select_items"){fields{name}} scratch:__type(name:"cf_select_cf_probe_p13_rows"){kind fields{name}} cf_select_items(limit:1){id} cf_select_cf_probe_p13_rows{id}}`

				body, marshalErr := json.Marshal(map[string]string{"query": query})
				if marshalErr != nil {
					t.Fatal(marshalErr)
				}

				request := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(body))
				request.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

				if role != "admin" {
					request.Header.Set("X-Hasura-Role", role)
				}

				request.Header.Set("Content-Type", "application/json")

				response := httptest.NewRecorder()
				newTestRouter(t, ctrl).ServeHTTP(response, request)

				var parsed struct {
					Data struct {
						Item    struct{ Fields []struct{ Name string } } `json:"item"`
						Scratch struct {
							Kind   string
							Fields []struct{ Name string }
						} `json:"scratch"`
						Items []struct{ ID int } `json:"cf_select_items"`
						Rows  []struct{ ID int } `json:"cf_select_cf_probe_p13_rows"`
					} `json:"data"`
					Errors []any `json:"errors"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &parsed); err != nil {
					t.Fatal(err)
				}

				if len(parsed.Errors) != 0 || len(parsed.Data.Items) != 1 ||
					parsed.Data.Items[0].ID != 1 ||
					parsed.Data.Rows == nil ||
					parsed.Data.Scratch.Kind != "OBJECT" {
					t.Fatalf("role %s lost safe roots/object: %+v", role, parsed)
				}

				for _, f := range parsed.Data.Item.Fields {
					if f.Name == "p14_collision_enum" {
						t.Fatalf("role %s exposed colliding selection", role)
					}
				}

				foundID := false
				for _, f := range parsed.Data.Scratch.Fields {
					foundID = foundID || f.Name == "id"
				}

				if !foundID {
					t.Fatalf("role %s lost scratch object ID", role)
				}
			}
		})
	}
}
