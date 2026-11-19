package controller_test

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/validator/rules"

	"github.com/nhost/nhost/services/constellation/connector"
	"github.com/nhost/nhost/services/constellation/connector/remoteschema"
	"github.com/nhost/nhost/services/constellation/controller"
	gqlintrospection "github.com/nhost/nhost/services/constellation/controller/introspection"
	"github.com/nhost/nhost/services/constellation/metadata"
)

//nolint:paralleltest,tparallel // Sequential shapes verify warm-document reuse, with concurrent callers inside each case.
func TestRecursiveListVariablesRemote(t *testing.T) {
	t.Parallel()

	remote := recursiveListRemote(t)
	defer remote.Close()

	conn, err := remoteschema.New(t.Context(), &metadata.RemoteSchemaMetadata{
		Name:       "echo",
		Definition: metadata.RemoteSchemaDefinition{URL: metadata.EnvString(remote.URL)},
	}, remote.Client())
	if err != nil {
		t.Fatal(err)
	}

	t.Cleanup(conn.Close)

	ctrl, err := controller.NewFromConnectors(testAdminSecret,
		map[string]connector.Connector{"echo": conn}, nil, slog.New(slog.DiscardHandler))
	if err != nil {
		t.Fatal(err)
	}

	ctx := adminSessionContext(t)
	tests := []struct {
		name, query, variables, want string
	}{
		{
			"explicit",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":[["a"],["b"]]}`,
			`{"echo":[["a"],["b"]]}`,
		},
		{
			"flat warm query",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":["a","b"]}`,
			`{"echo":[["a"],["b"]]}`,
		},
		{
			"scalar warm query",
			`query($xs:[[String!]!]!){echo(xs:$xs)}`,
			`{"xs":"{a,b}"}`,
			`{"echo":[["{a,b}"]]}`,
		},
		{
			"nested input",
			`query($input:Filter!){echo(input:$input)}`,
			`{"input":{"xs":["{a,b}"],"children":{"xs":"b"}}}`,
			`{"echo":{"xs":[["{a,b}"]],"children":[{"xs":[["b"]]}]}}`,
		},
		{
			"default",
			`query($xs:[[String!]!]!=["a","b"]){echo(xs:$xs)}`,
			`{}`,
			`{"echo":[["a"],["b"]]}`,
		},
		{
			"default override",
			`query($xs:[[String!]!]!=["a","b"]){echo(xs:$xs)}`,
			`{"xs":"z"}`,
			`{"echo":[["z"]]}`,
		},
		{
			"default after override",
			`query($xs:[[String!]!]!=["a","b"]){echo(xs:$xs)}`,
			`{}`,
			`{"echo":[["a"],["b"]]}`,
		},
	}
	// Reuse each request's input objects as well as the cached query across callers.
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := controller.GraphQLRequest{
				Query:     tt.query,
				Variables: decodeCoercionVariables(t, tt.variables),
			}
			want := decodeCoercionVariables(t, tt.want)

			var callers sync.WaitGroup
			for range 8 {
				callers.Go(func() {
					response, err := ctrl.Resolve(ctx, req)
					if err != nil || response.Errors != nil {
						t.Errorf("Resolve: response=%+v error=%v", response, err)
						return
					}

					if diff := cmp.Diff(want, response.Data); diff != "" {
						t.Errorf("remote payload (-want +got):\n%s", diff)
					}
				})
			}

			callers.Wait()
		})
	}
}

// Echo the wire input without running variable coercion again, so the remote
// cannot silently repair a shallow variable tree forwarded by the controller.
func recursiveListRemote(t *testing.T) *httptest.Server {
	t.Helper()

	schema := gqlparser.MustLoadSchema(&ast.Source{Input: `
scalar JSON
input Filter { xs: [[String!]!]!, children: [Filter!] }
type Query { echo(xs: [[String!]!], input: Filter): JSON }
`})

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var body controller.GraphQLRequest
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}

		doc, errs := gqlparser.LoadQueryWithRules(schema, body.Query, rules.NewDefaultRules())
		if len(errs) != 0 {
			http.Error(w, "invalid query", http.StatusBadRequest)
			t.Errorf("remote query: %v", errs)

			return
		}

		operation := doc.Operations[0]

		data := gqlintrospection.Execute(schema, operation, doc)
		for _, selection := range operation.SelectionSet {
			field, ok := selection.(*ast.Field)
			if !ok || field.Name != "echo" {
				continue
			}

			value, err := field.Arguments[0].Value.Value(body.Variables)
			if err != nil {
				t.Errorf("reading remote operand: %v", err)
				return
			}

			data[field.Alias] = value
		}

		if err := json.NewEncoder(w).Encode(map[string]any{"data": data}); err != nil {
			t.Errorf("writing remote response: %v", err)
		}
	}))
}

func decodeCoercionVariables(t *testing.T, raw string) map[string]any {
	t.Helper()

	var variables map[string]any
	if err := json.Unmarshal([]byte(raw), &variables); err != nil {
		t.Fatal(err)
	}

	return variables
}
