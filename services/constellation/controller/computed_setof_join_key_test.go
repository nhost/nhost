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

//nolint:paralleltest,gocognit,cyclop // One isolated testdb validates metadata, role SDL, valid joins and errors for both roles.
func TestComputedSetofJoinKeyOmittedFromComposedSchema(t *testing.T) {
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
CREATE FUNCTION cf_select.p14_setof_label(item cf_select.items) RETURNS SETOF text
LANGUAGE sql STABLE AS $$ SELECT item.label $$;
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

	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	items := &md.Databases[0].Tables[0]

	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "p14_setof_label",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_setof_label"},
		},
	})
	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields, "p14_setof_label",
			)
		}
	}

	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "setof_label_object",
		Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
			FieldMapping:     map[string]string{"p14_setof_label": "label"},
			RelationshipType: metadata.RelationshipTypeObject,
			Source:           "cf_select",
			Table:            metadata.TableSource{Schema: "cf_select", Name: "items"},
		}},
	})

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	if got := ctrl.Inconsistencies(); len(got) != 0 {
		t.Fatalf(
			"unsupported join key revoked unrelated permissions or recorded an inconsistency: %+v",
			got,
		)
	}

	request := func(role, query string) map[string]json.RawMessage {
		t.Helper()

		payload, err := json.Marshal(map[string]string{"query": query})
		if err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/graphql", bytes.NewReader(payload))
		req.Header.Set("X-Hasura-Admin-Secret", testAdminSecret)

		if role != "admin" {
			req.Header.Set("X-Hasura-Role", role)
		}

		req.Header.Set("Content-Type", "application/json")

		response := httptest.NewRecorder()
		newTestRouter(t, ctrl).ServeHTTP(response, req)

		var result map[string]json.RawMessage
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatalf("decode %s response: %v: %s", role, err, response.Body.String())
		}

		return result
	}

	for _, role := range []string{"admin", "cf_reader"} {
		t.Run(role, func(t *testing.T) {
			sdl := request(role, `{__type(name:"cf_select_items"){fields{name}}}`)
			if sdl["errors"] != nil || sdl["data"] == nil {
				t.Fatalf("role %s lost item type: %s", role, sdl["errors"])
			}

			var data struct {
				Type struct{ Fields []struct{ Name string } } `json:"__type"`
			}
			if err := json.Unmarshal(sdl["data"], &data); err != nil {
				t.Fatal(err)
			}

			seen := map[string]bool{}
			for _, field := range data.Type.Fields {
				seen[field.Name] = true
			}

			if seen["setof_label_object"] || !seen["cf_label_object"] || !seen["p14_setof_label"] {
				t.Fatalf("role %s exposed SETOF key or lost valid scalar control: %+v", role, seen)
			}

			valid := request(role, `{cf_select_items(where:{id:{_eq:1}}){id cf_label_object{id}}}`)
			if valid["errors"] != nil || !strings.Contains(string(valid["data"]),
				`"cf_label_object":{"id":1}`) {
				t.Fatalf("role %s lost root/valid keyed relationship: %+v", role, valid)
			}

			invalid := request(role, `{cf_select_items{id setof_label_object{id}}}`)
			if !strings.Contains(string(invalid["errors"]), `Cannot query field`) ||
				!strings.Contains(string(invalid["errors"]), `setof_label_object`) {
				t.Fatalf(
					"role %s did not reject omitted relationship at validation: %+v",
					role,
					invalid,
				)
			}
		})
	}
}
