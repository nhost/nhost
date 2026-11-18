package sdl_test

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/cmd/api/internal/sdl"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func TestFormat(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		description string
	}{
		{name: "delimiter", description: `before """ after`},
		{name: "escaped delimiter", description: `before \""" after`},
		{name: "both and multiline", description: "first \"\"\"\nsecond \\\"\"\" end"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			source := fmt.Sprintf(`
%[1]s directive @example(%[1]s arg: String) on FIELD_DEFINITION
%[1]s type Query {
  %[1]s field(%[1]s arg: Input): Choice
}
%[1]s input Input {
  %[1]s value: String
}
%[1]s enum Choice {
  %[1]s VALUE
}
`, strconv.Quote(tt.description))

			t.Run("document", func(t *testing.T) {
				t.Parallel()

				doc := parse(t, source)
				original := parse(t, source)
				first := sdl.FormatSchemaDocument(doc)
				second := sdl.FormatSchemaDocument(doc)
				checkStable(t, first, second, doc, original)
				checkDescriptions(t, parse(t, string(first)), tt.description)
			})
			t.Run("schema", func(t *testing.T) {
				t.Parallel()

				schema := load(t, source)
				original := load(t, source)
				first := sdl.FormatSchema(schema)
				second := sdl.FormatSchema(schema)
				checkStable(t, first, second, schema, original)
				checkDescriptions(t, parse(t, string(first)), tt.description)
				load(t, string(first))
			})
		})
	}
}

func checkStable(t *testing.T, first, second []byte, input, original any) {
	t.Helper()

	if string(first) != string(second) {
		t.Fatal("formatting the same input twice changed output")
	}

	if !reflect.DeepEqual(input, original) {
		t.Fatal("formatting mutated the input")
	}

	if !strings.Contains(string(first), "\n  ") || strings.Contains(string(first), "\t") {
		t.Errorf("expected two-space indentation:\n%s", first)
	}
}

func checkDescriptions(t *testing.T, doc *ast.SchemaDocument, want string) {
	t.Helper()

	query := doc.Definitions.ForName("Query")
	input := doc.Definitions.ForName("Input")
	choice := doc.Definitions.ForName("Choice")
	directive := doc.Directives.ForName("example")

	got := []string{
		query.Description,
		query.Fields[0].Description,
		query.Fields[0].Arguments[0].Description,
		input.Description,
		input.Fields[0].Description,
		choice.Description,
		choice.EnumValues[0].Description,
		directive.Description,
		directive.Arguments[0].Description,
	}
	for _, value := range got {
		if value != want {
			t.Errorf("description = %q, want %q", value, want)
		}
	}
}

func parse(t *testing.T, source string) *ast.SchemaDocument {
	t.Helper()

	doc, err := parser.ParseSchema(&ast.Source{Input: source})
	if err != nil {
		t.Fatal(err)
	}

	return doc
}

func load(t *testing.T, source string) *ast.Schema {
	t.Helper()

	schema, err := gqlparser.LoadSchema(&ast.Source{Input: source})
	if err != nil {
		t.Fatal(err)
	}

	return schema
}
