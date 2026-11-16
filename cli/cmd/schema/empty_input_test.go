package schema_test

import (
	json "encoding/json/v2"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/cmd/schema"
	"github.com/nhost/nhost/cli/internal/schemadiff"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/controller/introspection"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/vektah/gqlparser/v2"
)

// Exercise the public URL dump and offline diff commands, including the loss of
// SQL provenance at the introspection/SDL boundary. No database or Nhost stack
// is needed to reproduce this loader compatibility boundary.
func TestDumpDiffEmptyInsertInput(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, input string
	}{
		{name: "Hasura input name", input: "solo_insert_input"},
		{name: "customized input name", input: "CreateSolo"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			endpoint := emptyInsertEndpoint(t, tt.input)
			pathA := filepath.Join(t.TempDir(), "dump.graphql")
			pathB := filepath.Join(t.TempDir(), "roundtrip.graphql")

			if err := schema.Command().Run(t.Context(), []string{
				"schema", "dump", "--url", endpoint.URL, "--output", pathA,
			}); err != nil {
				t.Fatalf("dump: %v", err)
			}

			dumped, err := os.ReadFile(pathA)
			if err != nil {
				t.Fatalf("read dump: %v", err)
			}

			if !strings.Contains(string(dumped), "input "+tt.input+"\n") ||
				strings.Contains(string(dumped), "_constellation_validation_only") {
				t.Fatalf("dump did not retain a genuinely empty input:\n%s", dumped)
			}

			loaded, err := schemadiff.Load(pathA)
			if err != nil {
				t.Fatalf("load dump: %v", err)
			}

			if len(loaded.Types[tt.input].Fields) != 0 ||
				loaded.Mutation.Fields.ForName("insert_solo_one") == nil {
				t.Fatal("load lost the insert root or exposed an input field")
			}

			schemadiff.SortFields(loaded)

			if err := os.WriteFile(
				pathB,
				[]byte(schemadiff.ToSDL(loaded, false)),
				0o600,
			); err != nil {
				t.Fatalf("write roundtrip: %v", err)
			}

			for _, extra := range [][]string{nil, {"--no-clean"}} {
				args := append([]string{"schema", "diff", "--a", pathA, "--b", pathB}, extra...)
				if err := schema.Command().Run(t.Context(), args); err != nil {
					t.Fatalf("diff %v: %v", extra, err)
				}
			}
		})
	}
}

func emptyInsertEndpoint(t *testing.T, inputName string) *httptest.Server {
	t.Helper()

	_, validated, err := schemamerge.BuildValidatedSchema(&graph.Schema{
		QueryType: new("Query"), MutationType: new("Mutation"),
		Types: []*graph.ObjectType{
			{
				Name:   "Query",
				Fields: []*graph.Field{{Name: "ping", Type: graph.NewNamedType("String")}},
			},
			{Name: "Mutation", Fields: []*graph.Field{
				{
					Name: "insert_solo_one",
					Type: graph.NewNamedType("Solo"),
					Arguments: []*graph.Argument{
						{Name: "object", Type: graph.NewNonNullType(inputName)},
					},
				},
			}},
			{Name: "Solo", Fields: []*graph.Field{{Name: "id", Type: graph.NewNamedType("Int")}}},
		},
		Inputs: []*graph.InputObjectType{{Name: inputName, EmptySQLInsert: true}},
	}, "admin")
	if err != nil {
		t.Fatalf("build source schema: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			Query string `json:"query"`
		}
		if err := json.UnmarshalRead(r.Body, &request); err != nil {
			t.Errorf("decode introspection query: %v", err)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		doc, errs := gqlparser.LoadQueryWithRules(validated, request.Query, nil)
		if errs != nil {
			t.Errorf("validate introspection query: %v", errs)
			w.WriteHeader(http.StatusBadRequest)

			return
		}

		data := introspection.Execute(validated, doc.Operations[0], doc)
		if err := json.MarshalWrite(w, map[string]any{"data": data}); err != nil {
			t.Errorf("encode introspection response: %v", err)
		}
	}))
	t.Cleanup(server.Close)

	return server
}
