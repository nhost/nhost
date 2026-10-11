package controller_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

func nativeArrayAggregateMetadata(t *testing.T) *metadata.Metadata {
	t.Helper()

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

	raw, err := os.ReadFile("../integration/computedfields/testdata/metadata.json")
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.native_collision(item cf_select.items)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT item.label $$;
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	items := &md.Databases[0].Tables[0]
	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "tags",
		Definition: metadata.RemoteRelationshipDef{ToSource: &metadata.ToSourceRelationship{
			FieldMapping:     map[string]string{"id": "item_id"},
			RelationshipType: metadata.RelationshipTypeArray,
			Source:           "cf_select",
			Table:            metadata.TableSource{Schema: "cf_select", Name: "tags"},
		}},
	})

	items.ComputedFields = append(items.ComputedFields, metadata.ComputedField{
		Name: "tags_aggregate",
		Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "native_collision"},
		},
	})
	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields, "tags_aggregate",
			)
		}
	}

	encoded, err := metadata.MarshalTOML(md)
	if err != nil {
		t.Fatal(err)
	}

	path := filepath.Join(t.TempDir(), "metadata.toml")
	if err := os.WriteFile(path, encoded, 0o600); err != nil {
		t.Fatal(err)
	}

	native, err := metadata.FromDetect(t.Context(), path)
	if err != nil {
		t.Fatal(err)
	}

	return native
}

// A TOML to_source array stays raw, rather than being lowered into an array
// relationship like the equivalent Hasura metadata.
//
//nolint:paralleltest // Role subtests reuse one controller and its database pool sequentially.
func TestComputedNativeArrayAggregateCollision(t *testing.T) {
	native := nativeArrayAggregateMetadata(t)

	for _, rel := range native.Databases[0].Tables[0].ArrayRelationships {
		if rel.Name == "tags" {
			t.Fatal("native to_source relationship was lowered")
		}
	}

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: native},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	inconsistencies := ctrl.Inconsistencies()
	if len(inconsistencies) != 1 ||
		inconsistencies[0].Kind != metadata.InconsistencyKindComputedField ||
		inconsistencies[0].Name != "cf_select.items.tags_aggregate" {
		t.Fatalf("unexpected collision inconsistencies: %+v", inconsistencies)
	}

	for _, role := range []struct {
		name   string
		header http.Header
	}{
		{"admin", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}}},
		{"reader", http.Header{"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"}}},
	} {
		t.Run(role.name, func(t *testing.T) {
			assertNativeAggregateRole(t, ctrl, role.header)
		})
	}
}

func assertNativeAggregateRole(t *testing.T, ctrl *controller.Controller, header http.Header) {
	t.Helper()

	ctx := runSessionMiddleware(t, header)

	response, resolveErr := ctrl.Resolve(ctx, controller.GraphQLRequest{
		Query: `{ __type(name:"cf_select_items") { fields {
			name type { kind ofType { name } }
		} } }`,
	})
	if resolveErr != nil || response.Errors != nil {
		t.Fatalf("introspection response=%+v err=%v", response, resolveErr)
	}

	data, err := json.Marshal(response.Data)
	if err != nil {
		t.Fatal(err)
	}

	var schema struct {
		Type struct {
			Fields []struct {
				Name string `json:"name"`
				Type struct {
					Kind   string `json:"kind"`
					OfType struct {
						Name string `json:"name"`
					} `json:"ofType"`
				} `json:"type"`
			} `json:"fields"`
		} `json:"__type"`
	}
	if err := json.Unmarshal(data, &schema); err != nil {
		t.Fatal(err)
	}

	var found bool
	for _, field := range schema.Type.Fields {
		if field.Name == "tags_aggregate" {
			found = true

			if field.Type.Kind != "NON_NULL" ||
				field.Type.OfType.Name != "cf_select_tags_aggregate" {
				t.Fatalf("aggregate sibling has wrong type: %+v", field)
			}
		}
	}

	if !found {
		t.Fatal("genuine aggregate sibling missing from role schema")
	}

	response, resolveErr = ctrl.Resolve(ctx, controller.GraphQLRequest{
		Query: `{ cf_select_items(where:{id:{_eq:1}}) {
			id tags_aggregate { aggregate { count } nodes { id } }
		} }`,
	})
	if resolveErr != nil || response.Errors != nil {
		t.Fatalf("aggregate response=%+v err=%v", response, resolveErr)
	}

	want := map[string]any{"cf_select_items": []any{map[string]any{
		"id": float64(1),
		"tags_aggregate": map[string]any{
			"aggregate": map[string]any{"count": float64(2)},
			"nodes": []any{
				map[string]any{"id": float64(1)},
				map[string]any{"id": float64(2)},
			},
		},
	}}}
	if !reflect.DeepEqual(response.Data, want) {
		t.Fatalf("aggregate result = %#v, want %#v", response.Data, want)
	}
}
