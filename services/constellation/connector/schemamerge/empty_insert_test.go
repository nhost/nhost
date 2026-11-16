package schemamerge_test

import (
	"testing"

	"github.com/nhost/nhost/services/constellation/connector/customization"
	"github.com/nhost/nhost/services/constellation/connector/schemamerge"
	"github.com/nhost/nhost/services/constellation/graph"
	"github.com/nhost/nhost/services/constellation/metadata"
	"github.com/vektah/gqlparser/v2"
	"github.com/vektah/gqlparser/v2/validator"
)

func emptyInsertSchema() *graph.Schema {
	return &graph.Schema{
		QueryType: new("Query"),
		Types: []*graph.ObjectType{{Name: "Query", Fields: []*graph.Field{
			{
				Name: "insert",
				Type: graph.NewNamedType("Boolean"),
				Arguments: []*graph.Argument{
					{Name: "object", Type: graph.NewNonNullType("row_insert_input")},
				},
			},
		}}},
		Inputs: []*graph.InputObjectType{{Name: "row_insert_input", EmptySQLInsert: true}},
	}
}

func TestBuildValidatedSchema_EmptySQLInsertBoundary(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		change    func(*graph.Schema)
		wantError bool
	}{
		{name: "generated empty insert"},
		{name: "name alone is not provenance", change: func(s *graph.Schema) {
			s.Inputs[0].EmptySQLInsert = false
		}, wantError: true},
		{name: "unrelated empty input", change: func(s *graph.Schema) {
			s.Inputs = append(s.Inputs, &graph.InputObjectType{Name: "unrelated"})
		}, wantError: true},
		{name: "unknown input field type", change: func(s *graph.Schema) {
			s.Inputs[0].Fields = []*graph.InputField{
				{Name: "bad", Type: graph.NewNamedType("Missing")},
			}
		}, wantError: true},
		{name: "duplicate input fields", change: func(s *graph.Schema) {
			s.Inputs[0].Fields = []*graph.InputField{
				{Name: "bad", Type: graph.NewNamedType("Boolean")},
				{Name: "bad", Type: graph.NewNamedType("Boolean")},
			}
		}, wantError: true},
		{name: "empty object", change: func(s *graph.Schema) {
			s.Types = append(s.Types, &graph.ObjectType{Name: "Empty"})
		}, wantError: true},
		{name: "invalid directive on empty input", change: func(s *graph.Schema) {
			s.Inputs[0].Directives = []*graph.Directive{{Name: "unknown"}}
		}, wantError: true},
		{name: "dangling root", change: func(s *graph.Schema) {
			s.QueryType = new("Missing")
		}, wantError: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			s := emptyInsertSchema()
			if tt.change != nil {
				tt.change(s)
			}

			for range 2 {
				doc, validated, err := schemamerge.BuildValidatedSchema(s, "writer")
				if (err != nil) != tt.wantError {
					t.Fatalf("BuildValidatedSchema error = %v, want error %v", err, tt.wantError)
				}

				if err == nil {
					if len(doc.Definitions.ForName("row_insert_input").Fields) != 0 ||
						len(
							validated.Types["row_insert_input"].Fields,
						) != 0 || len(s.Inputs[0].Fields) != 0 {
						t.Fatal("validation leaked a field into a published or source input")
					}
				}
			}
		})
	}
}

func TestBuildValidatedSchema_EmptySQLInsertOperations(t *testing.T) {
	t.Parallel()

	_, schema, err := schemamerge.BuildValidatedSchema(emptyInsertSchema(), "writer")
	if err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name, query string
		variables   map[string]any
		wantError   bool
	}{
		{name: "literal", query: `{ insert(object: {}) }`},
		{
			name:      "variable",
			query:     `query($object: row_insert_input!) { insert(object: $object) }`,
			variables: map[string]any{"object": map[string]any{}},
		},
		{
			name:  "variable default",
			query: `query($object: row_insert_input! = {}) { insert(object: $object) }`,
		},
		{name: "hidden literal", query: `{ insert(object: {id: 42}) }`, wantError: true},
		{
			name:      "validation-only field",
			query:     `{ insert(object: {_constellation_validation_only: true}) }`,
			wantError: true,
		},
		{
			name:      "hidden variable",
			query:     `query($object: row_insert_input!) { insert(object: $object) }`,
			variables: map[string]any{"object": map[string]any{"id": 42}},
			wantError: true,
		},
		{
			name:  "validation-only variable field",
			query: `query($object: row_insert_input!) { insert(object: $object) }`,
			variables: map[string]any{
				"object": map[string]any{"_constellation_validation_only": true},
			},
			wantError: true,
		},
		{
			name:      "null object",
			query:     `query($object: row_insert_input!) { insert(object: $object) }`,
			variables: map[string]any{"object": nil},
			wantError: true,
		},
		{
			name:      "scalar object",
			query:     `query($object: row_insert_input!) { insert(object: $object) }`,
			variables: map[string]any{"object": 42},
			wantError: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			doc, errs := gqlparser.LoadQueryWithRules(schema, tt.query, nil)

			gotError := errs != nil
			if !gotError {
				_, err := validator.VariableValues(schema, doc.Operations[0], tt.variables)
				gotError = err != nil
			}

			if gotError != tt.wantError {
				t.Errorf(
					"operation error = %v, want %v (parse errors: %v)",
					gotError,
					tt.wantError,
					errs,
				)
			}
		})
	}
}

func TestBuildValidatedSchema_CustomizedEmptySQLInsert(t *testing.T) {
	t.Parallel()

	original := emptyInsertSchema()
	customized := customization.New(metadata.Customization{
		TypeNamesMapping: map[string]string{"row_insert_input": "RenamedInput"},
	}, customization.FlavorDatabase).Apply(original)

	_, schema, err := schemamerge.BuildValidatedSchema(customized, "writer")
	if err != nil {
		t.Fatalf("validate customized input: %v", err)
	}

	if input := schema.Types["RenamedInput"]; input == nil || len(input.Fields) != 0 {
		t.Fatal("customization lost empty SQL insert provenance")
	}

	if original.Inputs[0].Name != "row_insert_input" || len(original.Inputs[0].Fields) != 0 {
		t.Fatal("customization mutated the source schema")
	}
}

func TestMergeConnectorSchema_EmptyInputProvenance(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		first, second bool
		wantError     bool
	}{
		{name: "two generated inputs", first: true, second: true},
		{name: "unrelated input first", first: false, second: true, wantError: true},
		{name: "unrelated input second", first: true, second: false, wantError: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			combined := &graph.Schema{}
			for i, marked := range []bool{tt.first, tt.second} {
				s := &graph.Schema{
					Inputs: []*graph.InputObjectType{
						{Name: "row_insert_input", EmptySQLInsert: marked},
					},
				}

				err := schemamerge.MergeConnectorSchema(
					s,
					combined,
					"source",
					map[string]string{},
					nil,
				)
				if (err != nil) != (i == 1 && tt.wantError) {
					t.Fatalf("merge %d error = %v", i, err)
				}
			}

			if !tt.wantError && !combined.Inputs[0].EmptySQLInsert {
				t.Fatal("merge lost empty SQL insert provenance")
			}
		})
	}
}
