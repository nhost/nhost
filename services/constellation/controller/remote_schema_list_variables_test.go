package controller_test

import (
	"encoding/json"
	"fmt"
	"maps"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/controller"
	gqlintrospection "github.com/nhost/nhost/services/constellation/controller/introspection"
	"github.com/nhost/nhost/services/constellation/internal/lib/testdb"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,tparallel // Sequential warm-query cases share one database pool and echo server.
func TestRemoteSchemaRelationshipListVariables(t *testing.T) {
	t.Parallel()

	remote := relationshipListRemote(t)
	defer remote.Close()

	pool := testdb.NewPostgres(t, `
CREATE SCHEMA list_join;
CREATE TABLE list_join.owners (id integer PRIMARY KEY);
INSERT INTO list_join.owners VALUES (1),(2);
`)
	md := &metadata.Metadata{
		Databases: []metadata.DatabaseMetadata{{
			Name: "source", Kind: "postgres",
			Tables: []metadata.TableMetadata{{
				Table: metadata.TableSource{Schema: "list_join", Name: "owners"},
				RemoteRelationships: []metadata.RemoteRelationship{{
					Name: "team", Definition: metadata.RemoteRelationshipDef{
						ToRemoteSchema: &metadata.ToRemoteSchemaRelationship{
							RemoteSchema: "echo", LHSFields: []string{"id"},
							RemoteField: map[string]metadata.RemoteFieldCall{
								"team": {Arguments: map[string]string{"id": "$id"}},
							},
						},
					},
				}},
			}},
		}},
		RemoteSchemas: []metadata.RemoteSchemaMetadata{
			{
				Name:       "echo",
				Definition: metadata.RemoteSchemaDefinition{URL: metadata.EnvString(remote.URL)},
			},
		},
	}
	md.Databases[0].Configuration.ConnectionInfo.DatabaseURL = metadata.EnvString(
		pool.Config().ConnConfig.ConnString(),
	)

	ctrl, err := newComputedController(t, md, false)
	if err != nil {
		t.Fatal(err)
	}

	if inconsistencies := ctrl.Inconsistencies(); len(inconsistencies) != 0 {
		t.Fatalf("inconsistencies: %+v", inconsistencies)
	}

	router := newTestRouter(t, ctrl)
	query := `query($t:[String!],$m:[[String!]!],$f:ListFilter,$n:[Int!],$x:[Float!],$b:[Boolean!],$s:String) {
 list_join_owners(order_by:{id:asc}) {
  id team(tags:$t,matrix:$m,filter:$f,nums:$n,floats:$x,flags:$b,text:$s) {
   args direct:nested(tags:$t,matrix:$m) ...Nested
  }
 }
} fragment Nested on ListTeam { fromFragment:nested(tags:$t,matrix:$m) }`

	tests := []struct {
		name, variables, arguments, nested string
	}{
		{
			"string singleton coercions",
			`{"t":"a","m":["x","y"],"f":{"ids":"z","matrix":["p"],"nums":[4]},"n":[4],"x":[4.5],"b":[true],"s":"[a]"}`,
			`tags:["a"],matrix:[["x"],["y"]],filter:{ids:["z"],matrix:[["p"]],nums:[4]},nums:[4],floats:[4.5],flags:[true],text:"[a]"`,
			`tags:["a"],matrix:[["x"],["y"]]`,
		},
		{
			"singleton coercions",
			`{"t":"a","m":["x","y"],"f":{"ids":"z","matrix":["p"],"nums":4},"n":4,"x":4.5,"b":true,"s":"[a]"}`,
			`tags:["a"],matrix:[["x"],["y"]],filter:{ids:["z"],matrix:[["p"]],nums:[4]},nums:[4],floats:[4.5],flags:[true],text:"[a]"`,
			`tags:["a"],matrix:[["x"],["y"]]`,
		},
		{
			"explicit lists on warm query",
			`{"t":["a"],"m":[["x"],["y"]],"f":{"ids":["z"],"matrix":[["p"]],"nums":[4]},"n":[4],"x":[4.5],"b":[true],"s":"[a]"}`,
			`tags:["a"],matrix:[["x"],["y"]],filter:{ids:["z"],matrix:[["p"]],nums:[4]},nums:[4],floats:[4.5],flags:[true],text:"[a]"`,
			`tags:["a"],matrix:[["x"],["y"]]`,
		},
		{
			"different singleton on warm query",
			`{"t":"b","m":"q","f":{"ids":"other"},"n":8,"x":2,"b":false,"s":"plain"}`,
			`tags:["b"],matrix:[["q"]],filter:{ids:["other"]},nums:[8],floats:[2],flags:[false],text:"plain"`,
			`tags:["b"],matrix:[["q"]]`,
		},
		{
			"empty lists",
			`{"t":[],"m":[],"f":{"ids":[],"matrix":[],"nums":[]},"n":[],"x":[],"b":[],"s":""}`,
			`tags:[],matrix:[],filter:{ids:[],matrix:[],nums:[]},nums:[],floats:[],flags:[],text:""`,
			`tags:[],matrix:[]`,
		},
		{
			"explicit null",
			`{"t":null,"m":null,"f":null,"n":null,"x":null,"b":null,"s":null}`,
			`tags:null,matrix:null,filter:null,nums:null,floats:null,flags:null,text:null`,
			`tags:null,matrix:null`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			literal := fmt.Sprintf(`{
 list_join_owners(order_by:{id:asc}) {
  id team(%s) { args direct:nested(%s) fromFragment:nested(%s) }
 }
}`, tt.arguments, tt.nested, tt.nested)

			baseline := nullableOrderByResponse(
				t,
				router,
				"admin",
				controller.GraphQLRequest{Query: literal},
			)
			if baseline.Errors != nil || baseline.Data == nil {
				t.Fatalf("literal response: %+v", baseline)
			}

			rows := mustTeamList(t, mustTeamMap(t, baseline.Data)["list_join_owners"])
			if len(rows) != 2 {
				t.Fatalf("expected two joined parents, got %#v", rows)
			}

			for i, row := range rows {
				team := mustTeamMap(t, mustTeamMap(t, row)["team"])
				if got := mustTeamMap(t, team["args"])["id"]; got != float64(i+1) {
					t.Fatalf("parent %d: remote id = %v", i+1, got)
				}

				mustTeamMap(t, team["direct"])
				mustTeamMap(t, team["fromFragment"])
			}

			response := nullableOrderByResponse(t, router, "admin", controller.GraphQLRequest{
				Query: query, Variables: decodeCoercionVariables(t, tt.variables),
			})
			if response.Errors != nil {
				t.Fatalf("variable response: %+v", response)
			}

			if diff := cmp.Diff(baseline.Data, response.Data); diff != "" {
				t.Errorf("remote arguments (-literal +variable):\n%s", diff)
			}
		})
	}
}

func relationshipListRemote(t *testing.T) *httptest.Server {
	t.Helper()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
scalar JSON
input ListFilter { ids: [String!], matrix: [[String!]!], nums: [Int!] }
type ListTeam { args: JSON, nested(tags: [String!], matrix: [[String!]!]): JSON }
type Query {
 team(id: Int!, tags: [String!], matrix: [[String!]!], filter: ListFilter,
      nums: [Int!], floats: [Float!], flags: [Boolean!], text: String): ListTeam
}
`})

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var body controller.GraphQLRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		doc, errs := gqlparser.LoadQueryWithRules(schema, body.Query, rules.NewDefaultRules())
		if len(errs) != 0 {
			t.Errorf("remote query validation: %v", errs)
			http.Error(w, "invalid query", http.StatusBadRequest)

			return
		}

		operation := doc.Operations[0]

		data := gqlintrospection.Execute(schema, operation, doc)
		for _, selection := range operation.SelectionSet {
			field, ok := selection.(*ast.Field)
			if !ok || field.Name != "team" {
				continue
			}

			args := relationshipEchoArguments(t, field.Arguments, body.Variables)
			data[field.Alias] = relationshipEchoSelection(
				t,
				field.SelectionSet,
				args,
				body.Variables,
			)
		}

		if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
			t.Errorf("writing remote response: %v", err)
		}
	}))
}

// Echo literal values without further coercion, so a remote cannot repair a
// malformed list emitted by Constellation. Query validation still rejects bad scalars.
func relationshipEchoArguments(
	t *testing.T,
	args ast.ArgumentList,
	variables map[string]any,
) map[string]any {
	t.Helper()

	result := make(map[string]any, len(args))
	for _, arg := range args {
		value, err := arg.Value.Value(variables)
		if err != nil {
			t.Errorf("reading remote argument %s: %v", arg.Name, err)
			continue
		}

		result[arg.Name] = value
	}

	return result
}

func relationshipEchoSelection(
	t *testing.T, selections ast.SelectionSet, args, variables map[string]any,
) map[string]any {
	t.Helper()

	result := make(map[string]any)
	for _, selection := range selections {
		switch sel := selection.(type) {
		case *ast.Field:
			if sel.Name == "args" {
				result[sel.Alias] = args
			} else {
				result[sel.Alias] = relationshipEchoArguments(t, sel.Arguments, variables)
			}
		case *ast.InlineFragment:
			maps.Copy(result, relationshipEchoSelection(t, sel.SelectionSet, args, variables))
		case *ast.FragmentSpread:
			maps.Copy(
				result,
				relationshipEchoSelection(t, sel.Definition.SelectionSet, args, variables),
			)
		}
	}

	return result
}
