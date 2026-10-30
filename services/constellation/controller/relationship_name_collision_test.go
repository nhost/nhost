package controller_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

// A raw remote definition cannot claim a local relationship's name even for
// roles whose SQL schema hides the local target. Otherwise the role validates
// against the injected remote field but executes the unpermitted local join.
//
//nolint:paralleltest,cyclop // Two SQL connectors share one database; the role and response matrix pins authorization.
func TestLocalRelationshipNameReservedAcrossRoles(t *testing.T) {
	pool := testdb.NewPostgres(t, `
CREATE TABLE public.teams (id integer PRIMARY KEY, name text);
CREATE TABLE public.items (id integer PRIMARY KEY, team_id integer REFERENCES public.teams(id));
CREATE TABLE public.squads (id integer PRIMARY KEY, name text);
INSERT INTO public.teams VALUES (1, 'local-team');
INSERT INTO public.items VALUES (1, 1);
INSERT INTO public.squads VALUES (1, 'remote-squad');`)

	const document = `{"version":3,"sources":[
{"name":"db","kind":"postgres","configuration":{"connection_info":{"database_url":"postgres://localhost/test"}},"tables":[
{"table":{"schema":"public","name":"teams"}},
{"table":{"schema":"public","name":"items"},
"object_relationships":[{"name":"team","using":{"foreign_key_constraint_on":"team_id"}},
{"name":"squad_members_aggregate","using":{"foreign_key_constraint_on":"team_id"}}],
"remote_relationships":[
{"name":"team","definition":{"to_source":{"source":"other","table":{"schema":"public","name":"squads"},"relationship_type":"object","field_mapping":{"team_id":"id"}}}},
{"name":"squad","definition":{"to_source":{"source":"other","table":{"schema":"public","name":"squads"},"relationship_type":"object","field_mapping":{"team_id":"id"}}}},
{"name":"squad_members","definition":{"to_source":{"source":"other","table":{"schema":"public","name":"squads"},"relationship_type":"array","field_mapping":{"team_id":"id"}}}}],
"select_permissions":[{"role":"user","permission":{"columns":["id","team_id"],"filter":{}}}]}]},
{"name":"other","kind":"postgres","configuration":{"connection_info":{"database_url":"postgres://localhost/test"}},"tables":[
{"table":{"schema":"public","name":"squads"},"select_permissions":[{"role":"user","permission":{"columns":["id","name"],"filter":{},"allow_aggregations":true}}]}]}]}`

	md, err := metadata.FromHasuraJSON([]byte(document))
	if err != nil {
		t.Fatal(err)
	}

	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
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

		recorder := httptest.NewRecorder()
		newTestRouter(t, ctrl).ServeHTTP(recorder, req)

		var result map[string]json.RawMessage
		if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
			t.Fatalf("decode %s response: %v", role, err)
		}

		return result
	}

	for _, tc := range []struct {
		role, query, want string
		valid             bool
	}{
		{"admin", `{ items { id team { name } } }`, `"team":{"name":"local-team"}`, true},
		{"user", `{ items { id squad { name } } }`, `"squad":{"name":"remote-squad"}`, true},
		{"user", `{ items { id squad_members { name } } }`, `"squad_members":[{"name":"remote-squad"}]`, true},
		{"user", `{ items { id team { name } } }`, `Cannot query field`, false},
	} {
		t.Run(tc.role+"/"+tc.want, func(t *testing.T) {
			response := request(tc.role, tc.query)
			if tc.valid {
				if response["errors"] != nil ||
					!strings.Contains(string(response["data"]), tc.want) {
					t.Fatalf("valid selection: %s", response)
				}
			} else if response["data"] != nil || !strings.Contains(string(response["errors"]), tc.want) ||
				!strings.Contains(string(response["errors"]), `\"team\"`) {
				t.Fatalf("hidden local target was exposed or selection not rejected: %s", response)
			}
		})
	}

	fields := request("user", `{ __type(name:"items") { fields { name } } }`)
	if fields["errors"] != nil || fields["data"] == nil ||
		strings.Contains(string(fields["data"]), `"name":"team"`) ||
		strings.Contains(string(fields["data"]), `"name":"squad_members_aggregate"`) ||
		!strings.Contains(string(fields["data"]), `"name":"squad"`) ||
		!strings.Contains(string(fields["data"]), `"name":"squad_members"`) {
		t.Fatalf("user schema exposes a shadowed relationship or loses the control: %s", fields)
	}
}
