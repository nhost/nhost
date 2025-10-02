package graphql_test

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/cli/mcp/graphql"
)

func TestParse(t *testing.T) {
	t.Parallel()

	b, err := os.ReadFile("testdata/schema.json")
	if err != nil {
		t.Fatalf("failed to read file: %v", err)
	}

	var response graphql.ResponseIntrospection
	if err := json.Unmarshal(b, &response); err != nil {
		t.Fatalf("failed to unmarshal json: %v", err)
	}

	cases := []struct {
		name   string
		filter graphql.Filter
	}{
		{
			name: "without_filter",
			filter: graphql.Filter{
				AllowQueries:   nil,
				AllowMutations: nil,
			},
		},
		{
			name: "with_filter",
			filter: graphql.Filter{
				AllowQueries: []graphql.Queries{
					{
						Name:           "app",
						DisableNesting: false,
					},
					{
						Name:           "apps",
						DisableNesting: false,
					},
				},
				AllowMutations: []graphql.Queries{
					{
						Name:           "updateApp",
						DisableNesting: false,
					},
					{
						Name:           "updateConfig",
						DisableNesting: false,
					},
				},
			},
		},
		{
			name: "with_filter_and_disable_nesting",
			filter: graphql.Filter{
				AllowQueries: []graphql.Queries{
					{
						Name:           "app",
						DisableNesting: true,
					},
					{
						Name:           "apps",
						DisableNesting: true,
					},
				},
				AllowMutations: []graphql.Queries{
					{
						Name:           "updateApp",
						DisableNesting: true,
					},
					{
						Name:           "updateConfig",
						DisableNesting: false,
					},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := graphql.ParseSchema(response, tc.filter)

			// if err := os.WriteFile("testdata/"+tc.name+".graphql", []byte(got), 0o644); err != nil {
			// 	t.Fatalf("failed to write file: %v", err)
			// }

			b, err := os.ReadFile("testdata/" + tc.name + ".graphql")
			if err != nil {
				t.Fatalf("failed to read file: %v", err)
			}

			if diff := cmp.Diff(string(b), got); diff != "" {
				t.Errorf("ParseSchema() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
