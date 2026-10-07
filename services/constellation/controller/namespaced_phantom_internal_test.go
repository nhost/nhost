package controller

import (
	"encoding/json/jsontext"
	"reflect"
	"testing"

	"github.com/nhost/nhost/services/constellation/controller/planner"
	"github.com/nhost/nhost/services/constellation/internal/jsonpath"
)

// TestNamespacedPartialPhantomCleanup covers the connector-error path: it
// bypasses remote resolution but must still decode and strip hidden join keys.
func TestNamespacedPartialPhantomCleanup(t *testing.T) {
	t.Parallel()

	results := map[string]any{
		"catalog": map[string]any{
			"items": jsontext.Value(
				`[{"id":1,"label":"secret","_constellation_phantom_computed":"secret"}]`,
			),
		},
	}
	plan := &planner.QueryPlan{
		PrimaryQueries: []*planner.PrimaryQuery{
			{
				PhantomFields: []*planner.PhantomFieldSpec{
					{
						Path:    jsonpath.Path{"catalog", "items"},
						Fields:  []string{"label", "computed"},
						Aliases: map[string]string{"computed": "_constellation_phantom_computed"},
					},
				},
			},
		},
	}

	if err := unmarshalRawResults(results); err != nil {
		t.Fatal(err)
	}

	removePhantomFieldsFromPlan(results, plan)

	want := map[string]any{
		"catalog": map[string]any{"items": []any{map[string]any{"id": float64(1)}}},
	}
	if !reflect.DeepEqual(results, want) {
		t.Errorf("partial results: %#v want %#v", results, want)
	}
	// The controller must not return partial data if its phantoms cannot be decoded.
	malformed := map[string]any{
		"catalog": map[string]any{"items": jsontext.Value(`[{"id":1,"label":"secret"`)},
	}
	if err := unmarshalRawResults(malformed); err == nil {
		t.Error("malformed nested raw result must fail closed")
	}
}
