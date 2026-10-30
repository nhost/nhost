package graphql

import (
	"testing"

	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

func TestRenderDescription(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		description string
		want        string
	}{
		{
			name:        "plain text",
			description: "fetch data",
			want:        `"""fetch data"""`,
		},
		{
			name:        "trailing quote",
			description: `fetch data from the table: "apps"`,
			want:        `"""fetch data from the table: "apps"` + "\n  " + `"""`,
		},
		{
			name:        "inner triple quotes",
			description: `say """hi""" now`,
			want:        `"""say \"""hi\""" now"""`,
		},
		{
			name:        "trailing triple quotes",
			description: `ends with """`,
			want:        `"""ends with \"""` + "\n  " + `"""`,
		},
		{
			name:        "trailing backslash",
			description: `path\`,
			want:        `"""path\` + "\n  " + `"""`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := renderDescription(tt.description)
			if got != tt.want {
				t.Fatalf("renderDescription() = %q, want %q", got, tt.want)
			}

			doc, err := parser.ParseSchema(&ast.Source{
				Name:    "schema.graphql",
				Input:   "type Query {\n  " + got + "\n  field: String\n}\n",
				BuiltIn: false,
			})
			if err != nil {
				t.Fatalf("failed to parse rendered description: %v", err)
			}

			if parsed := doc.Definitions[0].Fields[0].Description; parsed != tt.description {
				t.Errorf("parsed description = %q, want %q", parsed, tt.description)
			}
		})
	}
}
