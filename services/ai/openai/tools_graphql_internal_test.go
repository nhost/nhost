package openai

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/parser"
)

const graphqlToolsTestSchema = `
schema {
  query: query_root
}

type query_root {
  account: AccountQuery
  greet(name: String!): String!
}

type AccountQuery {
  status: String!
}
`

func TestGetSchemaLayout(t *testing.T) {
	t.Parallel()

	document := parseGraphqlToolsTestSchema(t)

	expected := `type query {
    account {
      status: String!

    }
    greet(...): String!
}

`

	if diff := cmp.Diff(expected, getSchemaLayout(document)); diff != "" {
		t.Errorf("unexpected schema layout (-want +got):\n%s", diff)
	}
}

func TestGetSpecificMethod(t *testing.T) {
	t.Parallel()

	document := parseGraphqlToolsTestSchema(t)

	cases := []struct {
		name     string
		method   string
		expected string
	}{
		{
			name:   "method with arguments",
			method: "greet",
			expected: `query {
  greet(
    name: String!
  ): String!

}
`,
		},
		{
			name:   "nested query",
			method: "account",
			expected: `query {
  account {
    status: String!

  }

}
`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			actual := getSpecificMethod(document, "query_root", tc.method)
			if diff := cmp.Diff(tc.expected, actual); diff != "" {
				t.Errorf("unexpected method schema (-want +got):\n%s", diff)
			}
		})
	}
}

func parseGraphqlToolsTestSchema(t *testing.T) *ast.SchemaDocument {
	t.Helper()

	document, err := parser.ParseSchema(&ast.Source{
		Name:    "schema.graphql",
		Input:   graphqlToolsTestSchema,
		BuiltIn: false,
	})
	if err != nil {
		t.Fatalf("failed to parse test schema: %v", err)
	}

	return document
}
