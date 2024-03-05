package controller_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/hasura-auth/go/controller"
)

func TestCustomClaims(t *testing.T) {
	t.Parallel()

	data := map[string]any{
		"m": map[string]any{
			"k": "v",
			"l": []any{"a", "b", "c"},
			"lm": []map[string]any{
				{"id": 1},
				{"id": 2},
				{"id": 3},
			},
		},
		"metadata": map[string]any{
			"m1": 1,
		},
	}

	cases := []struct {
		name            string
		claims          string
		expectedGraphql string
		expectedData    map[string]any
	}{
		{
			name: "",
			claims: `{
                "root": "m",
                "key": "m.k",
                "element": "m.l[2]",
                "array[]": "m.l[]",
                "array[*]": "m.l[*]",
                "array[].ids": "m.lm[*].id",
                "metadata.m1": "metadata.m1",
                "nonexistent": "nonexistent.nonexistent"
            }`,
			expectedGraphql: "query GetClaims($id: uuid!) { user(id:$id) {m{k l lm{id }}metadata nonexistent{nonexistent }} }",
			expectedData: map[string]any{
				"root":        data["m"],
				"key":         "v",
				"element":     "c",
				"array[]":     []any{"a", "b", "c"},
				"array[*]":    []any{"a", "b", "c"},
				"array[].ids": []any{1, 2, 3},
				"metadata.m1": 1,
				"nonexistent": nil,
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			c, err := controller.NewCustomClaims(tc.claims, nil, "")
			if err != nil {
				t.Fatalf("failed to get custom claims: %v", err)
			}

			if diff := cmp.Diff(tc.expectedGraphql, c.GraphQLQuery()); diff != "" {
				t.Fatalf("unexpected result (-want +got):\n%s", diff)
			}

			gotData, err := c.ExtractClaims(data)
			if err != nil {
				t.Fatalf("failed to extract claims: %v", err)
			}

			if diff := cmp.Diff(tc.expectedData, gotData); diff != "" {
				t.Fatalf("unexpected result (-want +got):\n%s", diff)
			}
		})
	}
}
