package api

import (
	"bytes"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/nhost/nhost/cli/cmd/api/internal/sdl"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

// Golden updates are opt-in through Go's process-wide test flag registry.
var update = flag.Bool("update", false, "update subset golden files") //nolint:gochecknoglobals

func TestSummarize(t *testing.T) {
	t.Parallel()

	encoded, err := json.Marshal(summarize(fixtureSchema(t)))
	if err != nil {
		t.Fatal(err)
	}

	const want = `{"query":["app","apps","node","search"],"mutation":["updateApp","updateConfig"]}`
	if string(encoded) != want {
		t.Errorf("summary JSON = %s, want %s", encoded, want)
	}
}

func fixtureSchema(t *testing.T) *ast.Schema {
	t.Helper()

	data, err := os.ReadFile("testdata/schema.graphql")
	if err != nil {
		t.Fatal(err)
	}

	return loadSchema(t, string(data))
}

func loadSchema(t *testing.T, source string) *ast.Schema {
	t.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{Name: "fixture", Input: source})
	if err != nil {
		t.Fatal(err)
	}

	return schema
}

func TestSubset(t *testing.T) {
	t.Parallel()

	schema := fixtureSchema(t)
	bothRoots := loadSchema(t, `
		type Query { item: String }
		type Mutation { item: String }
	`)

	tests := []struct {
		name     string
		schema   *ast.Schema
		names    []string
		depth    uint
		golden   string
		wantErr  string
		validate bool
	}{
		{
			name:   "apps depth 0",
			schema: schema,
			names:  []string{"apps"},
			depth:  0,
			golden: "apps_depth0",
		},
		{
			name:   "apps depth 1",
			schema: schema,
			names:  []string{"apps"},
			depth:  1,
			golden: "apps_depth1",
		},
		{
			name:   "apps depth 2",
			schema: schema,
			names:  []string{"apps"},
			depth:  2,
			golden: "apps_depth2",
		},
		{
			name:     "shortest path",
			schema:   schema,
			names:    []string{"apps"},
			depth:    3,
			golden:   "apps_depth3",
			validate: true,
		},
		{
			name:   "mutation only",
			schema: schema,
			names:  []string{"updateConfig"},
			depth:  1,
			golden: "mutation",
		},
		{
			name:     "mixed roots complete",
			schema:   schema,
			names:    []string{"apps", "node", "search", "updateConfig", "updateApp"},
			depth:    10,
			golden:   "mixed",
			validate: true,
		},
		{
			name:   "interface boundary",
			schema: schema,
			names:  []string{"node"},
			depth:  1,
			golden: "interface_depth1",
		},
		{
			name:   "interface implementations",
			schema: schema,
			names:  []string{"node"},
			depth:  2,
			golden: "interface_depth2",
		},
		{
			name:   "union boundary",
			schema: schema,
			names:  []string{"search"},
			depth:  1,
			golden: "union_depth1",
		},
		{
			name:   "union members",
			schema: schema,
			names:  []string{"search"},
			depth:  2,
			golden: "union_depth2",
		},
		{
			name:   "duplicates and reverse order",
			schema: schema,
			names:  []string{"updateConfig", "updateApp", "updateApp", "app", "apps", "apps"},
			depth:  1,
			golden: "selection_order",
		},
		{
			name:    "all unknown names",
			schema:  schema,
			names:   []string{"zQuery", "__schema", "aQuery", "zQuery", "aMutation", "__typename"},
			wantErr: `invalid schema selection: unknown field "__schema"; unknown field "__typename"; unknown field "aMutation"; unknown field "aQuery"; unknown field "zQuery"`,
		},
		{
			name:     "name on both roots",
			schema:   bothRoots,
			names:    []string{"item"},
			depth:    0,
			golden:   "both_roots",
			validate: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, err := subset(tt.schema, tt.names, tt.depth)
			if tt.wantErr != "" {
				if err == nil || err.Error() != tt.wantErr {
					t.Fatalf("error = %v, want %q", err, tt.wantErr)
				}

				return
			}

			if err != nil {
				t.Fatal(err)
			}

			output := sdl.FormatSchemaDocument(doc)
			checkSubsetGolden(t, tt.golden, output)

			if tt.validate {
				loadSchema(t, string(output))
			}
		})
	}
}

func checkSubsetGolden(t *testing.T, name string, output []byte) {
	t.Helper()

	path := filepath.Join("testdata", "subset_"+name+".graphql")
	if *update {
		if err := os.WriteFile(path, output, 0o600); err != nil {
			t.Fatal(err)
		}
	}

	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(output, want) {
		t.Errorf("subset differs from %s:\n%s", path, output)
	}

	if _, err := parser.ParseSchema(&ast.Source{Name: path, Input: string(want)}); err != nil {
		t.Fatalf("invalid expected SDL: %v", err)
	}
}

func TestSubsetDoesNotMutate(t *testing.T) {
	t.Parallel()

	schema := fixtureSchema(t)
	original := fixtureSchema(t)

	var previous []byte

	for range 2 {
		doc, err := subset(schema, []string{"apps", "node", "search", "updateApp"}, 10)
		if err != nil {
			t.Fatal(err)
		}

		first := sdl.FormatSchemaDocument(doc)

		second := sdl.FormatSchemaDocument(doc)
		if !bytes.Equal(first, second) || (previous != nil && !bytes.Equal(previous, first)) {
			t.Fatal("repeated subset selection and formatting changed output")
		}

		previous = first
	}

	reordered, err := subset(
		schema,
		[]string{"updateApp", "search", "node", "apps", "apps", "updateApp"},
		10,
	)
	if err != nil {
		t.Fatal(err)
	}

	if !bytes.Equal(previous, sdl.FormatSchemaDocument(reordered)) {
		t.Fatal("name order or duplicates changed output")
	}

	if !reflect.DeepEqual(schema, original) {
		t.Fatal("subset selection or formatting mutated the loaded schema")
	}
}
