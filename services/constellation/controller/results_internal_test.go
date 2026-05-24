package controller

import (
	"encoding/json/jsontext"
	"errors"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
)

func TestUnmarshalRawResults(t *testing.T) {
	t.Parallel()

	t.Run("happy path parses jsontext values", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"users": jsontext.Value(`[{"id":1},{"id":2}]`),
			"count": jsontext.Value(`{"total":5}`),
		}

		if err := unmarshalRawResults(results); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := map[string]any{
			"users": []any{
				map[string]any{"id": float64(1)},
				map[string]any{"id": float64(2)},
			},
			"count": map[string]any{"total": float64(5)},
		}
		if diff := cmp.Diff(want, results); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("non-raw values are left untouched", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"existing": map[string]any{"already": "parsed"},
		}

		if err := unmarshalRawResults(results); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		want := map[string]any{
			"existing": map[string]any{"already": "parsed"},
		}
		if diff := cmp.Diff(want, results); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("nil jsontext value is skipped without error", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"nullValue": jsontext.Value(nil),
		}

		if err := unmarshalRawResults(results); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// nil jsontext.Value stays present as nil — the parser only acts on non-nil raws.
		got, ok := results["nullValue"]
		if !ok {
			t.Fatal("expected nullValue to still be present")
		}

		raw, isRaw := got.(jsontext.Value)
		if !isRaw || raw != nil {
			t.Errorf("expected nil jsontext value preserved, got %T(%v)", got, got)
		}
	})

	t.Run("invalid JSON returns wrapped error with key", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"broken": jsontext.Value(`{not json`),
		}

		err := unmarshalRawResults(results)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		// Error should be wrapped with the offending key for debugging.
		if got := err.Error(); !containsSubstr(got, `key "broken"`) {
			t.Errorf("expected error to mention key 'broken', got %q", got)
		}

		// Underlying syntax error should still be reachable via errors.Unwrap.
		if errors.Unwrap(err) == nil {
			t.Error("expected wrapped error chain, got terminal error")
		}
	})
}

func TestRemovePhantomFieldsFromPlan(t *testing.T) {
	t.Parallel()

	t.Run("nil plan is a no-op", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{"users": []any{map[string]any{"id": 1, "phantom": "x"}}}
		removePhantomFieldsFromPlan(results, nil)

		want := map[string]any{"users": []any{map[string]any{"id": 1, "phantom": "x"}}}
		if diff := cmp.Diff(want, results); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("removes phantom fields at the spec path", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"users": []any{
				map[string]any{"id": 1, "departmentId": "d1", "name": "Alice"},
				map[string]any{"id": 2, "departmentId": "d2", "name": "Bob"},
			},
		}

		plan := &planner.QueryPlan{
			PrimaryQueries: []*planner.PrimaryQuery{
				{
					Connector:      "db1",
					CleanOperation: nil,
					CleanFragments: nil,
					PhantomFields: []*planner.PhantomFieldSpec{
						{
							Path:            jsonpath.Parse("users"),
							Fields:          []string{"departmentId"},
							ForRelationship: "department",
						},
					},
				},
			},
			RemoteQueries: nil,
		}

		removePhantomFieldsFromPlan(results, plan)

		want := map[string]any{
			"users": []any{
				map[string]any{"id": 1, "name": "Alice"},
				map[string]any{"id": 2, "name": "Bob"},
			},
		}
		if diff := cmp.Diff(want, results); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})

	t.Run("de-duplicates phantom paths", func(t *testing.T) {
		t.Parallel()

		results := map[string]any{
			"users": []any{
				map[string]any{"id": 1, "phantom_a": "x", "phantom_b": "y"},
			},
		}

		plan := &planner.QueryPlan{
			PrimaryQueries: []*planner.PrimaryQuery{
				{
					Connector:      "db1",
					CleanOperation: nil,
					CleanFragments: nil,
					PhantomFields: []*planner.PhantomFieldSpec{
						{
							Path:            jsonpath.Parse("users"),
							Fields:          []string{"phantom_a", "phantom_b"},
							ForRelationship: "rel1",
						},
						// Same path again — should be deduped.
						{
							Path:            jsonpath.Parse("users"),
							Fields:          []string{"phantom_a"},
							ForRelationship: "rel2",
						},
					},
				},
			},
			RemoteQueries: nil,
		}

		removePhantomFieldsFromPlan(results, plan)

		want := map[string]any{
			"users": []any{
				map[string]any{"id": 1},
			},
		}
		if diff := cmp.Diff(want, results); diff != "" {
			t.Errorf("results mismatch (-want +got):\n%s", diff)
		}
	})
}

func containsSubstr(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}

	return false
}
