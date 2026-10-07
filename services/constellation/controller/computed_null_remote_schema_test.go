package controller_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/nhost/nhost/services/constellation/controller"
	"github.com/nhost/nhost/services/constellation/controller/middleware"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// The null parent must not result in a phantom-key leak or a remote request.
// A role without the LHS grant loses the relationship, per Phase 13's approved
// stricter authorization rule (Hasura v2.50.3-ce exposes it to that role).
//
//nolint:cyclop,paralleltest // Sequential testdb fixture checks nullable data, remote count, phantom cleanup and grant denial.
func TestComputedNullRemoteSchemaKeyAndGrant(t *testing.T) {
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
CREATE FUNCTION cf_select.p14_team_key(item cf_select.items) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 2 THEN 'team-hr' ELSE NULL END $$;
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
		Name: "p14_team_key", Definition: metadata.ComputedFieldDefinition{
			Function: metadata.FunctionSource{Schema: "cf_select", Name: "p14_team_key"},
		},
	})

	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "p14_team", Definition: metadata.RemoteRelationshipDef{
			ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
				RemoteSchema: "teams", LHSFields: []string{"p14_team_key"},
				RemoteField: map[string]metadata.RemoteFieldCall{
					"team": {Arguments: map[string]string{"id": "$p14_team_key"}},
				},
			},
		},
	})
	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields, "p14_team_key")
		}
	}

	var requests atomic.Int64

	remote := computedTeamServer(t, &requests)
	defer remote.Close()

	md.RemoteSchemas = append(md.RemoteSchemas, metadata.RemoteSchemaMetadata{
		Name:       "teams",
		Definition: metadata.RemoteSchemaDefinition{URL: metadata.EnvString(remote.URL)},
		Permissions: []metadata.RemoteSchemaPermission{
			{
				Role:       "cf_reader",
				Definition: metadata.RemoteSchemaPermissionDef{Schema: computedTeamSchema},
			},
			{
				Role:       "cf_no_grant",
				Definition: metadata.RemoteSchemaPermissionDef{Schema: computedTeamSchema},
			},
		},
	})

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	ctx := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
	})
	before := requests.Load()
	response, err := ctrl.Resolve(
		ctx,
		controller.GraphQLRequest{
			Query: `{cf_select_items(order_by:{id:asc}){id p14_team{id name}}}`,
		},
	)

	want := map[string]any{"cf_select_items": []any{
		map[string]any{"id": float64(1), "p14_team": nil},
		map[string]any{
			"id":       float64(2),
			"p14_team": map[string]any{"id": "team-hr", "name": "HR United"},
		},
	}}
	if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, want) ||
		requests.Load()-before != 1 {
		t.Fatalf(
			"nullable remote join = %+v, err=%v, remote requests=%d; want %#v",
			response,
			err,
			requests.Load()-before,
			want,
		)
	}

	encoded, err := json.Marshal(response.Data)
	if err != nil {
		t.Fatal(err)
	}

	if strings.Contains(string(encoded), "p14_team_key") {
		t.Fatalf("phantom key leaked: %s", encoded)
	}

	denied := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_no_grant"},
	})

	sdl, err := ctrl.Resolve(
		denied,
		controller.GraphQLRequest{Query: `{__type(name:"cf_select_items"){fields{name}}}`},
	)
	if err != nil || sdl.Errors != nil {
		t.Fatalf("ungranted SDL: %+v, %v", sdl, err)
	}

	encoded, err = json.Marshal(sdl.Data)
	if err != nil {
		t.Fatal(err)
	}

	if strings.Contains(string(encoded), "p14_team") {
		t.Fatalf("ungranted relationship/key visible: %s", encoded)
	}

	before = requests.Load()

	deniedResponse, err := ctrl.Resolve(
		denied,
		controller.GraphQLRequest{Query: `{cf_select_items{id p14_team{id}}}`},
	)
	if err != nil || deniedResponse.Errors == nil || requests.Load() != before {
		t.Fatalf("ungranted relationship executed: %+v, err=%v", deniedResponse, err)
	}
}
