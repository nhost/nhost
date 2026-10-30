package controller_test

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/auth/go/controller"
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
			expectedGraphql: "query GetClaims($id: uuid!) { user(id:$id) {m{d{id v }k l l2 lm{id }}metadata nonexistent{nonexistent }} }",
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
			expectedGraphql: "query GetClaims($id: uuid!) { user(id:$id) {m{k l l2 lm{id }}metadata nonexistent{nonexistent }} }",
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
		{
			name: "empty claim path",
			claims: map[string]string{
				"empty": "",
			},
			expectedGraphql: "",
			expectedData: map[string]any{
				"empty": nil,
			},
			customClaimsDefaults: nil,
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

func TestCustomClaimsGetClaims(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                 string
		claims               map[string]string
		customClaimsDefaults map[string]any
		expectedGraphql      string
		expectedData         map[string]any
	}{
		{
			name:                 "empty path without defaults",
			claims:               map[string]string{"empty": ""},
			customClaimsDefaults: nil,
			expectedGraphql:      "",
			expectedData:         map[string]any{"empty": nil},
		},
		{
			name:                 "empty path with defaults",
			claims:               map[string]string{"empty": ""},
			customClaimsDefaults: map[string]any{"empty": "dflt"},
			expectedGraphql:      "",
			expectedData:         map[string]any{"empty": "dflt"},
		},
		{
			name:                 "mixed paths without defaults",
			claims:               map[string]string{"key": "m.k", "empty": ""},
			customClaimsDefaults: nil,
			expectedGraphql:      "query GetClaims($id: uuid!) { user(id:$id) {m{k }} }",
			expectedData:         map[string]any{"key": "v", "empty": nil},
		},
		{
			name:                 "mixed paths with defaults",
			claims:               map[string]string{"key": "m.k", "empty": ""},
			customClaimsDefaults: map[string]any{"key": "fallback", "empty": "dflt"},
			expectedGraphql:      "query GetClaims($id: uuid!) { user(id:$id) {m{k }} }",
			expectedData:         map[string]any{"key": "v", "empty": "dflt"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			userID := "db477732-48fa-4289-b694-2886a646b6eb"

			var requests atomic.Int32

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					requests.Add(1)

					if tc.expectedGraphql == "" {
						t.Error("unexpected GraphQL request for empty claim paths")
						http.Error(w, "unexpected request", http.StatusBadRequest)

						return
					}

					w.Header().Set("Content-Type", "application/json")

					if _, err := w.Write([]byte(`{"data":{"user":{"m":{"k":"v"}}}}`)); err != nil {
						t.Errorf("failed to write response: %v", err)
					}
				}),
			)
			defer server.Close()

			c, err := controller.NewCustomClaims(
				tc.claims,
				server.Client(),
				server.URL,
				tc.customClaimsDefaults,
			)
			if err != nil {
				t.Fatalf("failed to get custom claims: %v", err)
			}

			if diff := cmp.Diff(tc.expectedGraphql, c.GraphQLQuery()); diff != "" {
				t.Fatalf("unexpected query (-want +got):\n%s", diff)
			}

			got, err := c.GetClaims(t.Context(), userID)
			if err != nil {
				t.Fatalf("failed to get claims: %v", err)
			}

			if diff := cmp.Diff(tc.expectedData, got); diff != "" {
				t.Errorf("unexpected claims (-want +got):\n%s", diff)
			}

			var expectedRequests int32
			if tc.expectedGraphql != "" {
				expectedRequests = 1
			}

			if got := requests.Load(); got != expectedRequests {
				t.Errorf("unexpected request count: got %d, want %d", got, expectedRequests)
			}
		})
	}
}
