package controller_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
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
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const computedTeamSchema = `type Query { team(id: ID!, filter: String): Team }
type Team { id: ID! name(prefix: String): String! }`

func mustTeamMap(t *testing.T, value any) map[string]any {
	t.Helper()

	result, ok := value.(map[string]any)
	if !ok {
		t.Fatalf("expected introspection object, got %T", value)
	}

	return result
}

func mustTeamList(t *testing.T, value any) []any {
	t.Helper()

	result, ok := value.([]any)
	if !ok {
		t.Fatalf("expected introspection list, got %T", value)
	}

	return result
}

// teamIntrospection reuses the checked-in remote GraphQL test introspection,
// changing only the root field, its required ID argument, and its return type.
func teamIntrospection(t *testing.T) []byte {
	t.Helper()

	var result map[string]any
	if err := json.Unmarshal([]byte(remoteSchemaIntrospectionResponse), &result); err != nil {
		t.Fatal(err)
	}

	schema := mustTeamMap(t, mustTeamMap(t, result["data"])["__schema"])
	types := mustTeamList(t, schema["types"])
	query := mustTeamMap(t, mustTeamList(t, mustTeamMap(t, types[0])["fields"])[0])
	query["name"] = "team"
	query["args"] = []any{map[string]any{
		"name": "id", "description": "", "defaultValue": nil,
		"type": map[string]any{
			"kind": "NON_NULL", "name": nil,
			"ofType": map[string]any{"kind": "SCALAR", "name": "ID", "ofType": nil},
		},
	}, map[string]any{
		"name": "filter", "description": "", "defaultValue": nil,
		"type": map[string]any{"kind": "SCALAR", "name": "String", "ofType": nil},
	}}
	query["type"] = map[string]any{"kind": "OBJECT", "name": "Team", "ofType": nil}
	team := mustTeamMap(t, types[1])
	team["name"] = "Team"
	teamFields := mustTeamList(t, team["fields"])
	id := mustTeamMap(t, teamFields[0])
	id["name"] = "id"
	mustTeamMap(t, mustTeamMap(t, id["type"])["ofType"])["name"] = "ID"
	mustTeamMap(t, teamFields[1])["args"] = []any{map[string]any{
		"name": "prefix", "description": "", "defaultValue": nil,
		"type": map[string]any{"kind": "SCALAR", "name": "String", "ofType": nil},
	}}

	encoded, err := json.Marshal(result)
	if err != nil {
		t.Fatal(err)
	}

	return encoded
}

func computedTeamServer(t *testing.T, requests *atomic.Int64) *httptest.Server {
	t.Helper()

	introspection := teamIntrospection(t)

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var body remoteSchemaGraphQLRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")

		if strings.Contains(body.Query, "__schema") {
			if _, err := w.Write(introspection); err != nil {
				t.Errorf("writing introspection: %v", err)
			}

			return
		}

		doc, err := parser.ParseQuery(&ast.Source{Input: body.Query})
		if err != nil {
			http.Error(w, "invalid query", http.StatusBadRequest)
			return
		}

		requests.Add(1)

		data := make(map[string]any)
		for _, selection := range doc.Operations[0].SelectionSet {
			field, ok := selection.(*ast.Field)
			if !ok || field.Name != "team" {
				continue
			}

			name := map[string]string{
				"team-eng": "Engineering FC",
				"team-hr":  "HR United",
				"first":    "T-first",
			}
			id := field.Arguments.ForName("id").Value.Raw

			key := field.Alias
			if key == "" {
				key = field.Name
			}

			filter := field.Arguments.ForName("filter")

			teamName, found := name[id]
			if found && (filter == nil || filter.Value.Raw == id) {
				// A named fragment on the remote Team must arrive with its
				// argument variable resolved for this request, not frozen on
				// the cached GraphQL document or left as "$prefix".
				data[key] = map[string]any{
					"id":   id,
					"name": teamNameFromFragments(doc.Fragments, teamName),
				}
			} else {
				data[key] = nil
			}
		}

		if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
			t.Errorf("encoding remote result: %v", err)
		}
	}))
}

func teamNameFromFragments(fragments ast.FragmentDefinitionList, name string) string {
	for _, fragment := range fragments {
		for _, selection := range fragment.SelectionSet {
			if field, ok := selection.(*ast.Field); ok && field.Name == "name" {
				if arg := field.Arguments.ForName("prefix"); arg != nil {
					return arg.Value.Raw + name
				}
			}
		}
	}

	return name
}

//nolint:tparallel,cyclop,gocyclo,gocognit,maintidx,paralleltest // Cohorts and role checks share one testdb and remote server.
func TestComputedJoinRemoteSchema(t *testing.T) {
	t.Parallel()

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

	// Declare these in the Hasura document before conversion so the test
	// exercises lowering to ManualConfiguration and column_config renames.
	var document map[string]any
	if err := json.Unmarshal(raw, &document); err != nil {
		t.Fatal(err)
	}

	sources := mustTeamList(t, document["sources"])
	itemsJSON := mustTeamMap(t,
		mustTeamList(t, mustTeamMap(t, sources[0])["tables"])[0],
	)
	itemsJSON["configuration"] = map[string]any{
		"column_config": map[string]any{"label": map[string]any{"custom_name": "itemLabel"}},
	}

	itemsJSON["computed_fields"] = append(mustTeamList(t, itemsJSON["computed_fields"]),
		map[string]any{"name": "item_team_id", "definition": map[string]any{
			"function": map[string]any{"schema": "cf_select", "name": "item_team_id"},
		}},
		map[string]any{"name": "item_session_team", "definition": map[string]any{
			"function":         map[string]any{"schema": "cf_select", "name": "item_session_team"},
			"session_argument": "session_argument",
		}},
	)
	for _, key := range []string{"item_team_id", "item_session_team", "item_payload", "label"} {
		itemsJSON["remote_relationships"] = append(
			mustTeamList(t, itemsJSON["remote_relationships"]),
			map[string]any{"name": key + "_join", "definition": map[string]any{
				"to_remote_schema": map[string]any{
					"remote_schema": "teams", "lhs_fields": []string{key},
					"remote_field": map[string]any{"team": map[string]any{
						"arguments": map[string]any{"id": "$" + key},
					}},
				},
			}},
		)
	}

	raw, err = json.Marshal(document)
	if err != nil {
		t.Fatal(err)
	}

	md, err := metadata.FromHasuraJSON(raw)
	if err != nil {
		t.Fatal(err)
	}

	ddl = append(ddl, []byte(`
CREATE FUNCTION cf_select.item_team_id(item cf_select.items) RETURNS text LANGUAGE sql STABLE
AS $$ SELECT CASE WHEN item.id = 1 THEN 'team-eng' ELSE NULL END $$;
CREATE FUNCTION cf_select.item_session_team(item cf_select.items, session_argument json) RETURNS text
LANGUAGE sql STABLE AS $$ SELECT CASE WHEN item.id = 1 AND
 session_argument->>'x-hasura-team-id' IN ('team-eng','team-hr')
 THEN session_argument->>'x-hasura-team-id' ELSE NULL END $$;
`)...)

	pool := testdb.NewPostgres(t, string(ddl), string(seed))
	for i := range md.Databases {
		md.Databases[i].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
			pool.Config().ConnConfig.ConnString(),
		)
	}

	var remoteRequests atomic.Int64

	teamServer := computedTeamServer(t, &remoteRequests)
	defer teamServer.Close()

	md.RemoteSchemas = append(md.RemoteSchemas, metadata.RemoteSchemaMetadata{
		Name:       "teams",
		Definition: metadata.RemoteSchemaDefinition{URL: metadata.EnvString(teamServer.URL)},
		RemoteRelationships: []metadata.RemoteSchemaTypeRemoteRelationship{{
			TypeName: "Team", Relationships: []metadata.RemoteSchemaRelationshipDef{{
				Name: "item", Definition: metadata.RemoteSchemaRelationshipDefinition{
					ToSource: &metadata.RemoteSchemaToSourceRelationship{
						FieldMapping:     map[string]string{"id": "itemLabel"},
						RelationshipType: metadata.RelationshipTypeObject, Source: "cf_select",
						Table: metadata.RemoteSchemaTableRef{Schema: "cf_select", Name: "items"},
					},
				},
			}},
		}},
		Permissions: []metadata.RemoteSchemaPermission{
			{Role: "cf_reader", Definition: metadata.RemoteSchemaPermissionDef{
				Schema: computedTeamSchema,
			}},
			{Role: "cf_no_grant", Definition: metadata.RemoteSchemaPermissionDef{
				Schema: computedTeamSchema,
			}},
		},
	})

	items := &md.Databases[0].Tables[0]
	// Native/TOML raw-only relationships have no Hasura-lowered counterpart.
	items.RemoteRelationships = append(items.RemoteRelationships, metadata.RemoteRelationship{
		Name: "native_team_join", Definition: metadata.RemoteRelationshipDef{
			ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
				RemoteSchema: "teams", LHSFields: []string{"item_team_id"},
				RemoteField: map[string]metadata.RemoteFieldCall{
					"team": {Arguments: map[string]string{"id": "$item_team_id"}},
				},
			},
		},
	})

	items.SelectPermissions = append(items.SelectPermissions, metadata.SelectPermission{
		Role: "cf_remote_no_access", Permission: metadata.SelectPermissionConfig{
			Columns: []string{"id"}, ComputedFields: []string{"item_team_id"},
			Filter: map[string]any{}, AllowAggregations: false,
		},
	})

	for i := range items.SelectPermissions {
		if items.SelectPermissions[i].Role == "cf_reader" {
			items.SelectPermissions[i].Permission.ComputedFields = append(
				items.SelectPermissions[i].Permission.ComputedFields,
				"item_team_id",
				"item_session_team",
			)
		}
	}

	ctrl, err := controller.New(t.Context(), time.Second, testAdminSecret, false,
		middleware.NewNoOpJWTAuthenticator(), computedStaticSource{meta: md},
		slog.New(slog.DiscardHandler), "", nil)
	if err != nil {
		t.Fatal(err)
	}

	for _, tt := range []struct {
		name, role, team, want, selectedKey string
	}{
		{"default computed ID", "cf_reader", "team-eng", "Engineering FC", ""},
		{"selected computed ID", "cf_reader", "team-eng", "Engineering FC", "item_team_id"},
		{"session cohort HR", "cf_reader", "team-hr", "HR United", "item_session_team"},
		{"session cohort Engineering", "cf_reader", "team-eng", "Engineering FC", ""},
	} {
		t.Run(tt.name, func(t *testing.T) {
			ctx := runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret},
				"X-Hasura-Role":         {tt.role}, "X-Hasura-Team-Id": {tt.team},
			})

			resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: `query {
 cf_select_items(where:{id:{_eq:1}}) { id ` + tt.selectedKey + ` aliased:item_session_team_join { id name }
 native_team_join { id } label_join { id name } ...RemoteTeam } }
 fragment RemoteTeam on cf_select_items { item_team_id_join { id name } }`})
			if err != nil || resp.Errors != nil {
				t.Fatalf("remote computed join response=%+v err=%v", resp, err)
			}

			wantRow := map[string]any{
				"id": float64(1), "aliased": map[string]any{"id": tt.team, "name": tt.want},
				"item_team_id_join": map[string]any{"id": "team-eng", "name": "Engineering FC"},
				"native_team_join":  map[string]any{"id": "team-eng", "name": "Engineering FC"},
				"label_join":        map[string]any{"id": "first", "name": "T-first"},
			}
			if tt.selectedKey != "" {
				wantRow[tt.selectedKey] = tt.team
			}

			want := map[string]any{"cf_select_items": []any{wantRow}}

			if !reflect.DeepEqual(resp.Data, want) {
				t.Fatalf("data = %#v, want %#v", resp.Data, want)
			}
		})
	}

	// The same cached operation is resolved under different variable and
	// session contexts. Its user argument must not freeze into the cached AST.
	for _, tc := range []struct{ name, query string }{
		{"flat", `query($filter:String!) { cf_select_items(where:{id:{_eq:1}}) {
			label_join(filter:$filter) { id }
		} }`},
		{"nested", `query($filter:String!) { cf_select_items(where:{id:{_eq:1}}) {
			cf_payload_object { label_join(filter:$filter) { id } }
		} }`},
	} {
		t.Run(tc.name+" remote schema argument across requests", func(t *testing.T) {
			for _, iteration := range []struct {
				filter, team string
				matched      bool
			}{{"first", "team-eng", true}, {"second", "team-hr", false}} {
				ctx := runSessionMiddleware(t, http.Header{
					"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
					"X-Hasura-Team-Id": {iteration.team},
				})

				response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
					Query: tc.query, Variables: map[string]any{"filter": iteration.filter},
				})
				if err != nil || response.Errors != nil {
					t.Fatalf("filter=%s response=%+v err=%v", iteration.filter, response, err)
				}

				row := mustTeamMap(
					t,
					mustTeamList(t, mustTeamMap(t, response.Data)["cf_select_items"])[0],
				)
				if tc.name == "nested" {
					row = mustTeamMap(t, row["cf_payload_object"])
				}

				if iteration.matched {
					if mustTeamMap(t, row["label_join"])["id"] != "first" {
						t.Fatalf("filter=%s data=%#v", iteration.filter, response.Data)
					}
				} else if row["label_join"] != nil {
					t.Fatalf("filter=%s unexpectedly joined: %#v", iteration.filter, response.Data)
				}
			}
		})
	}

	// Fragment arguments on the remote-schema target must be substituted on
	// per-request copies, even when the same parsed query is served again.
	for _, prefix := range []string{"A-", "B-", "A-"} {
		ctx := runSessionMiddleware(t, http.Header{
			"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		})
		response, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `query($prefix:String!) { cf_select_items(where:{id:{_eq:1}}) {
				label_join { id ...TeamName }
			} } fragment TeamName on Team { name(prefix:$prefix) }`,
			Variables: map[string]any{"prefix": prefix},
		})

		want := map[string]any{"cf_select_items": []any{map[string]any{
			"label_join": map[string]any{"id": "first", "name": prefix + "T-first"},
		}}}
		if err != nil || response.Errors != nil || !reflect.DeepEqual(response.Data, want) {
			t.Fatalf("prefix=%q response=%+v err=%v want=%#v", prefix, response, err, want)
		}
	}

	// The remote schema's Team rows supply a physical key to a database
	// result, which itself contains a computed-key remote relationship.
	for _, role := range []string{"admin", "cf_reader"} {
		t.Run(role+" remote schema to database nested", func(t *testing.T) {
			ctx := adminSessionContext(t)
			if role != "admin" {
				ctx = runSessionMiddleware(t, http.Header{
					"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {role},
				})
			}

			resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: `{
				cf_select_items(order_by:{id:asc}) { label_join {
					item { id cf_payload_object { id } }
				}
			} }`})

			want := map[string]any{"cf_select_items": []any{
				map[string]any{"label_join": map[string]any{
					"name": "T-first", "item": map[string]any{
						"id": float64(1), "cf_payload_object": map[string]any{"id": float64(1)},
					},
				}},
				map[string]any{"label_join": nil},
			}}
			if err != nil || resp.Errors != nil || !reflect.DeepEqual(resp.Data, want) {
				t.Fatalf("response=%+v err=%v want=%#v", resp, err, want)
			}
		})
	}

	// A to_source result can in turn supply a computed LHS for a remote
	// schema. The child's source phantom must survive the SQL target query.
	toSchema, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_eq:1}}) { cf_payload_object {
			item_team_id_join { id name }
		} }
	}`})

	toSchemaWant := map[string]any{"cf_select_items": []any{map[string]any{
		"cf_payload_object": map[string]any{
			"item_team_id_join": map[string]any{"id": "team-eng", "name": "Engineering FC"},
		},
	}}}
	if err != nil || toSchema.Errors != nil || !reflect.DeepEqual(toSchema.Data, toSchemaWant) {
		t.Fatalf("nested to_remote_schema: response=%+v err=%v want=%#v",
			toSchema, err, toSchemaWant)
	}

	// The child computed function receives the caller's session, not a new
	// admin context when its parent remote SQL result is materialized.
	sessionCtx := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_reader"},
		"X-Hasura-Team-Id": {"team-hr"},
	})
	sessionNested, err := ctrl.Resolve(sessionCtx, controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_eq:1}}) { cf_payload_object {
			item_session_team_join { id name }
		} }
	}`})

	sessionWant := map[string]any{"cf_select_items": []any{map[string]any{
		"cf_payload_object": map[string]any{
			"item_session_team_join": map[string]any{"id": "team-hr", "name": "HR United"},
		},
	}}}
	if err != nil || sessionNested.Errors != nil ||
		!reflect.DeepEqual(sessionNested.Data, sessionWant) {
		t.Fatalf("nested session join: response=%+v err=%v want=%#v",
			sessionNested, err, sessionWant)
	}

	beforeNestedNull := remoteRequests.Load()
	nullNested, err := ctrl.Resolve(sessionCtx, controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_eq:2}}) { cf_payload_object {
			item_session_team_join { id }
		} }
	}`})

	nullWant := map[string]any{"cf_select_items": []any{map[string]any{
		"cf_payload_object": map[string]any{"item_session_team_join": nil},
	}}}
	if err != nil || nullNested.Errors != nil || !reflect.DeepEqual(nullNested.Data, nullWant) ||
		remoteRequests.Load() != beforeNestedNull {
		t.Fatalf("null nested remote LHS: response=%+v err=%v remote calls=%d",
			nullNested, err, remoteRequests.Load()-beforeNestedNull)
	}

	// Finite cycles in an operation must run in dependency order: remote
	// schema → database → remote schema, with one batched call at each hop.
	beforeCycle := remoteRequests.Load()
	cycle, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_eq:1}}) { label_join {
			item { id label_join { id } }
		} }
	}`})

	cycleWant := map[string]any{"cf_select_items": []any{map[string]any{
		"label_join": map[string]any{"name": "T-first", "item": map[string]any{
			"id": float64(1), "label_join": map[string]any{
				"id": "first", "name": "T-first",
			},
		}},
	}}}
	if err != nil || cycle.Errors != nil || !reflect.DeepEqual(cycle.Data, cycleWant) ||
		remoteRequests.Load()-beforeCycle != 2 {
		t.Fatalf("finite cross-connector cycle: response=%+v err=%v calls=%d",
			cycle, err, remoteRequests.Load()-beforeCycle)
	}

	// Native metadata has no Hasura-lowered JoinMapping to supply this key.
	// Selecting the raw-only relationship alone must inject its LHSFields phantom.
	native, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{
		Query: `{ cf_select_items(order_by:{id:asc}) { id native_team_join { id name } } }`,
	})
	if err != nil || native.Errors != nil {
		t.Fatalf("native-only remote join: response=%+v err=%v", native, err)
	}

	nativeWant := map[string]any{"cf_select_items": []any{
		map[string]any{"id": float64(1), "native_team_join": map[string]any{
			"id": "team-eng", "name": "Engineering FC",
		}},
		map[string]any{"id": float64(2), "native_team_join": nil},
	}}
	if !reflect.DeepEqual(native.Data, nativeWant) {
		t.Fatalf("native-only remote join data = %#v, want %#v", native.Data, nativeWant)
	}

	for _, query := range []string{
		`{ cf_select_items(where:{id:{_eq:1}}) { label_join { id } } }`,
		`{ cf_select_items(where:{id:{_eq:1}}) { itemLabel label_join { id } } }`,
	} {
		resp, err := ctrl.Resolve(adminSessionContext(t), controller.GraphQLRequest{Query: query})
		if err != nil || resp.Errors != nil {
			t.Fatalf("renamed physical join: response=%+v err=%v", resp, err)
		}

		rows := mustTeamList(t, mustTeamMap(t, resp.Data)["cf_select_items"])

		row := mustTeamMap(t, rows[0])
		if !reflect.DeepEqual(row["label_join"], map[string]any{"id": "first", "name": "T-first"}) {
			t.Fatalf("renamed join = %#v", row)
		}

		if strings.Contains(query, "itemLabel ") {
			if row["itemLabel"] != "first" {
				t.Fatalf("selected renamed column = %#v", row)
			}
		} else if _, leaked := row["itemLabel"]; leaked {
			t.Fatalf("phantom renamed column leaked: %#v", row)
		}
	}

	ctx := runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_no_grant"},
	})

	for _, name := range []string{"item_team_id_join", "item_session_team_join", "item_payload_join"} {
		sdl, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `{ __type(name:"cf_select_items") { fields { name } } }`,
		})
		if err != nil || sdl.Errors != nil {
			t.Fatalf("role SDL: response=%+v err=%v", sdl, err)
		}

		encoded, err := json.Marshal(sdl.Data)
		if err != nil {
			t.Fatal(err)
		}

		if strings.Contains(string(encoded), `"name":"`+name+`"`) {
			t.Fatalf("denied computed relationship %s visible: %s", name, encoded)
		}
	}

	for _, role := range []string{"admin", "cf_reader"} {
		roleCtx := adminSessionContext(t)
		if role != "admin" {
			roleCtx = runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {role},
			})
		}

		sdl, err := ctrl.Resolve(roleCtx, controller.GraphQLRequest{
			Query: `{ __type(name:"cf_select_items") { fields { name } } }`,
		})
		if err != nil || sdl.Errors != nil {
			t.Fatalf("JSONB role SDL: response=%+v err=%v", sdl, err)
		}

		encoded, err := json.Marshal(sdl.Data)
		if err != nil {
			t.Fatal(err)
		}

		if strings.Contains(string(encoded), `"name":"item_payload_join"`) {
			t.Fatalf("JSONB remote relationship visible: %s", encoded)
		}
	}

	beforeDenied := remoteRequests.Load()

	deniedNested, err := ctrl.Resolve(ctx, controller.GraphQLRequest{Query: `{
		cf_select_items(where:{id:{_eq:1}}) {
			label_join { item { cf_payload_object { id } } }
		}
	}`})
	if err != nil || deniedNested.Errors == nil || deniedNested.Data != nil ||
		remoteRequests.Load() != beforeDenied {
		t.Fatalf("denied nested computed key: response=%+v err=%v remote calls=%d",
			deniedNested, err, remoteRequests.Load()-beforeDenied)
	}

	for _, name := range []string{"item_team_id_join", "item_session_team_join", "item_payload_join"} {
		resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
			Query: `{ cf_select_items(where:{id:{_eq:1}}) { ` + name + ` { id } } }`,
		})
		if err != nil || resp.Errors == nil || resp.Data != nil ||
			remoteRequests.Load() != beforeDenied {
			t.Fatalf(
				"denied key %s: response=%+v err=%v requests=%d",
				name,
				resp,
				err,
				remoteRequests.Load()-beforeDenied,
			)
		}
	}

	for _, role := range []string{"admin", "cf_reader"} {
		roleCtx := adminSessionContext(t)
		if role != "admin" {
			roleCtx = runSessionMiddleware(t, http.Header{
				"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {role},
			})
		}

		resp, err := ctrl.Resolve(roleCtx, controller.GraphQLRequest{
			Query: `{ cf_select_items(where:{id:{_eq:1}}) { item_payload_join { id } } }`,
		})
		if err != nil || resp.Errors == nil || resp.Data != nil ||
			remoteRequests.Load() != beforeDenied {
			t.Fatalf("JSONB key selected: response=%+v err=%v", resp, err)
		}
	}

	ctx = runSessionMiddleware(t, http.Header{
		"X-Hasura-Admin-Secret": {testAdminSecret}, "X-Hasura-Role": {"cf_remote_no_access"},
	})

	resp, err := ctrl.Resolve(ctx, controller.GraphQLRequest{
		Query: `{ cf_select_items(where:{id:{_eq:1}}) { item_team_id_join { id } } }`,
	})
	if err != nil || resp.Errors == nil || resp.Data != nil ||
		remoteRequests.Load() != beforeDenied {
		t.Fatalf("missing remote target grant joined: response=%+v err=%v", resp, err)
	}
}
