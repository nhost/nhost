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
			"k":  "v",
			"l":  []any{"a", "b", "c"},
			"l2": []any{"a"},
			"lm": []map[string]any{
				{"id": 1},
				{"id": 2},
				{"id": 3},
			},
			"ln": []any{
				[]any{
					map[string]any{"id": 1},
					map[string]any{"id": 2},
				},
				[]any{
					map[string]any{"id": 3},
					map[string]any{"id": 4},
				},
			},
			"d": []any{
				map[string]any{
					"id": 1,
					"v":  "a",
				},
				map[string]any{
					"id": 2,
					"v":  "b",
				},
				map[string]any{
					"id": 3,
					"v":  "a",
				},
			},
		},
		"metadata": map[string]any{
			"m1": 1,
		},
	}

	cases := []struct {
		name                 string
		claims               map[string]string
		expectedGraphql      string
		expectedData         map[string]any
		customClaimsDefaults map[string]any
	}{
		{
			name: "without custom claim defaults",
			claims: map[string]string{
				"root":              "m",
				"key":               "m.k",
				"element":           "m.l[2]",
				"array[]":           "m.l[]",
				"array[*]":          "m.l[*]",
				"array[].ids":       "m.lm[].id",
				"array[*].ids":      "m.lm[*].id",
				"array.ids[]":       "m.lm.id[]",
				"arrayOneElement[]": "m.l2[]",
				"metadata.m1":       "metadata.m1",
				"nonexistent":       "nonexistent.nonexistent",
				"filtered":          "m.d[?(@.v == 'a')].id",
			},
			expectedGraphql: "query GetClaims($id: uuid!) { user(id:$id) {m{d{id v }k l l2 lm{id }}metadata nonexistent{nonexistent }} }", //nolint:lll
			expectedData: map[string]any{
				"root":              data["m"],
				"key":               "v",
				"element":           "c",
				"arrayOneElement[]": []any{string("a")},
				"array[]":           []any{"a", "b", "c"},
				"array[*]":          []any{"a", "b", "c"},
				"array[].ids":       []any{1, 2, 3},
				"array[*].ids":      []any{1, 2, 3},
				"array.ids[]":       []any{1, 2, 3},
				"metadata.m1":       1,
				"nonexistent":       nil,
				"filtered": []any{
					1,
					3,
				},
			},
			customClaimsDefaults: nil,
		},
		{
			name: "with custom claims defaults",
			claims: map[string]string{
				"root":              "m",
				"key":               "m.k",
				"element":           "m.l[2]",
				"array[]":           "m.l[]",
				"array[*]":          "m.l[*]",
				"array[].ids":       "m.lm[].id",
				"array[*].ids":      "m.lm[*].id",
				"array.ids[]":       "m.lm.id[]",
				"arrayOneElement[]": "m.l2[]",
				"metadata.m1":       "metadata.m1",
				"nonexistent":       "nonexistent.nonexistent",
			},
			expectedGraphql: "query GetClaims($id: uuid!) { user(id:$id) {m{k l l2 lm{id }}metadata nonexistent{nonexistent }} }", //nolint:lll
			expectedData: map[string]any{
				"root":              data["m"],
				"key":               "v",
				"element":           "c",
				"arrayOneElement[]": []any{string("a")},
				"array[]":           []any{"a", "b", "c"},
				"array[*]":          []any{"a", "b", "c"},
				"array[].ids":       []any{1, 2, 3},
				"array[*].ids":      []any{1, 2, 3},
				"array.ids[]":       []any{1, 2, 3},
				"metadata.m1":       1,
				"nonexistent":       "defaultNonExistent",
			},
			customClaimsDefaults: map[string]any{
				"root":        "defaultRoot",
				"nonexistent": "defaultNonExistent",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c, err := controller.NewCustomClaims(tc.claims, nil, "", tc.customClaimsDefaults)
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
