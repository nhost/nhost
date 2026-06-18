package hasura

import (
	json "encoding/json/v2"
	"strings"
	"testing"
)

// These tests assert the exact wire shape the custom MarshalJSON methods emit.
// The round-trip tests compare re-parsed structs, which is blind to exactly
// these distinctions: column:"x" and columns:["x"] both unmarshal to
// Columns:["x"]; check:null and an absent check both become a nil expression;
// columns:"*" and columns:["*"] both become ["*"]. A regression in the
// drop-in-fidelity marshalers would pass the round-trip suite silently, so the
// emitted bytes are asserted directly here.

func marshalString(t *testing.T, v any) string {
	t.Helper()

	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}

	return string(b)
}

func TestSelectPermissionConfig_MarshalColumnsWildcard(t *testing.T) {
	t.Parallel()

	got := marshalString(t, SelectPermissionConfig{Columns: []string{"*"}})
	if !strings.Contains(got, `"columns":"*"`) {
		t.Errorf("got %s, want columns wildcard string \"columns\":\"*\"", got)
	}
}

func TestSelectPermissionConfig_MarshalSingleColumnIsArray(t *testing.T) {
	t.Parallel()

	// A one-element non-wildcard list must stay an array, not collapse to the
	// "*" string form.
	got := marshalString(t, SelectPermissionConfig{Columns: []string{"id"}})
	if !strings.Contains(got, `"columns":["id"]`) {
		t.Errorf("got %s, want \"columns\":[\"id\"]", got)
	}
}

func TestUpdatePermissionConfig_MarshalCheckAlwaysPresent(t *testing.T) {
	t.Parallel()

	t.Run("nil check emits null", func(t *testing.T) {
		t.Parallel()

		got := marshalString(t, UpdatePermissionConfig{Columns: []string{"id"}})
		if !strings.Contains(got, `"check":null`) {
			t.Errorf("got %s, want \"check\":null for nil check", got)
		}
	})

	t.Run("empty check emits object", func(t *testing.T) {
		t.Parallel()

		got := marshalString(t, UpdatePermissionConfig{
			Columns: []string{"id"},
			Check:   PermissionExpression{},
		})
		if !strings.Contains(got, `"check":{}`) {
			t.Errorf("got %s, want \"check\":{} for empty check", got)
		}
	})
}

func TestForeignKeyConstraint_MarshalColumnShape(t *testing.T) {
	t.Parallel()

	t.Run("single column is singular", func(t *testing.T) {
		t.Parallel()

		got := marshalString(t, ForeignKeyConstraint{
			Columns: []string{"author_id"},
			Table:   TableSource{Schema: "public", Name: "authors"},
		})
		if !strings.Contains(got, `"column":"author_id"`) {
			t.Errorf("got %s, want singular \"column\":\"author_id\"", got)
		}

		if strings.Contains(got, `"columns"`) {
			t.Errorf("got %s, want no plural \"columns\" key for single-column FK", got)
		}
	})

	t.Run("composite is plural array", func(t *testing.T) {
		t.Parallel()

		got := marshalString(t, ForeignKeyConstraint{
			Columns: []string{"a", "b"},
			Table:   TableSource{Schema: "public", Name: "authors"},
		})
		if !strings.Contains(got, `"columns":["a","b"]`) {
			t.Errorf("got %s, want \"columns\":[\"a\",\"b\"] for composite FK", got)
		}

		if strings.Contains(got, `"column":`) {
			t.Errorf("got %s, want no singular \"column\" key for composite FK", got)
		}
	})
}
