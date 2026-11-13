package schemadiff_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/internal/schemadiff"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/validator"
)

func writeSchema(t *testing.T, sdl string) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "schema.graphql")
	if err := os.WriteFile(path, []byte(sdl), 0o600); err != nil {
		t.Fatalf("write schema: %v", err)
	}

	return path
}

func TestLoadEmptyInputs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, sdl, input string
		fields           []string
	}{
		{
			name: "Hasura insert input",
			sdl: `schema { query: query_root mutation: mutation_root }
				type query_root { id: Int }
				type mutation_root { insert_solo_one(object: solo_insert_input!): Int }
				input solo_insert_input`,
			input: "solo_insert_input",
		},
		{
			name: "customized input name without SQL provenance",
			sdl: `type Query { create(object: CreateRow!): Int }
				input CreateRow`,
			input: "CreateRow",
		},
		{
			name: "multiple empty inputs",
			sdl: `type Query { create(object: CreateRow!, other: Other): Int }
				input CreateRow
				input Other`,
			input: "CreateRow",
		},
		{
			name: "directive on empty input",
			sdl: `type Query { create(object: CreateRow!): Int }
				directive @tag on INPUT_OBJECT
				input CreateRow @tag`,
			input: "CreateRow",
		},
		{
			name: "extension adds a field",
			sdl: `type Query { create(object: CreateRow!): Int }
				input CreateRow
				extend input CreateRow { _constellation_validation_only: Int }`,
			input: "CreateRow", fields: []string{"_constellation_validation_only"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			schema, err := schemadiff.Load(writeSchema(t, tt.sdl))
			if err != nil {
				t.Fatalf("Load: %v", err)
			}

			input := schema.Types[tt.input]
			if input == nil || !sameFieldNames(input.Fields, tt.fields) {
				t.Fatalf("loaded input = %+v, want fields %v", input, tt.fields)
			}

			schemadiff.SortFields(schema)
			sdl := schemadiff.ToSDL(schema, false)

			reloaded, err := schemadiff.Load(writeSchema(t, sdl))
			if err != nil {
				t.Fatalf("reload formatted SDL: %v", err)
			}

			schemadiff.SortFields(reloaded)

			if got := schemadiff.ToSDL(reloaded, false); got != sdl {
				t.Fatalf("SDL changed on round trip:\n%s\nwant:\n%s", got, sdl)
			}
		})
	}
}

func TestLoadEmptyInputsPreservesValidation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name, sdl, wantError string
	}{
		{"syntax", `input Broken {`, "Expected Name"},
		{"empty output", `type Empty`, "must define one or more fields"},
		{"empty interface", `interface Empty`, "must define one or more fields"},
		{"empty enum", `enum Empty`, "must define one or more unique enum values"},
		{"undefined field type", `input Broken { id: Missing }`, "Undefined type"},
		{"output as input", `input Broken { id: Query }`, "field must be one of"},
		{"duplicate fields", `input Broken { id: Int id: Int }`, "can only be defined once"},
		{"duplicate empty input", `input CreateRow`, "Cannot redeclare type"},
		{"undefined directive", `extend input CreateRow @missing`, "Undefined directive"},
		{
			"wrong directive location", `directive @tag on OBJECT
				extend input CreateRow @tag`, "not applicable",
		},
		{"reserved input name", `input __private`, "must not begin with"},
		{"wrong extension kind", `extend type CreateRow { id: Int }`, "Cannot extend type"},
		{
			"undefined extension field", `extend input CreateRow { id: Missing }`, "Undefined type",
		},
		{
			"duplicate extension fields", `extend input CreateRow { id: Int }
				extend input CreateRow { id: Int }`, "can only be defined once",
		},
		{
			"dangling schema root", `schema { query: Missing }`, "does not exist",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := writeSchema(t, `type Query { create(object: CreateRow!): Int }
				input CreateRow
				`+tt.sdl)

			_, err := schemadiff.Load(path)
			if err == nil || !strings.Contains(err.Error(), tt.wantError) ||
				!strings.Contains(err.Error(), "parsing schema file "+path) {
				t.Fatalf("Load error = %v, want wrapped %q", err, tt.wantError)
			}
		})
	}
}

func TestLoadEmptyInputsRejectsHiddenFields(t *testing.T) {
	t.Parallel()

	schema, err := schemadiff.Load(writeSchema(t, `type Query { create(object: CreateRow!): Int }
		input CreateRow`))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	tests := []struct {
		name, field string
		wantError   bool
	}{
		{name: "empty object"},
		{name: "identity", field: "id", wantError: true},
		{name: "preset", field: "user_id", wantError: true},
		{name: "validation-only field", field: "_constellation_validation_only", wantError: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			literal := "{}"

			object := map[string]any{}
			if tt.field != "" {
				literal = "{" + tt.field + ": 42}"
				object[tt.field] = 42
			}

			_, errs := gqlparser.LoadQueryWithRules(schema, `{ create(object: `+literal+`) }`, nil)
			if (errs != nil) != tt.wantError {
				t.Errorf("literal errors = %v, want error %v", errs, tt.wantError)
			}

			doc, errs := gqlparser.LoadQueryWithRules(schema,
				`query($object: CreateRow!) { create(object: $object) }`, nil)
			if errs != nil {
				t.Fatalf("variable query: %v", errs)
			}

			_, err := validator.VariableValues(
				schema,
				doc.Operations[0],
				map[string]any{"object": object},
			)
			if (err != nil) != tt.wantError {
				t.Errorf("variable error = %v, want error %v", err, tt.wantError)
			}
		})
	}
}
