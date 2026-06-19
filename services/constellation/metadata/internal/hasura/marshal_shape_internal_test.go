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

func TestInsertPermissionConfig_MarshalShape(t *testing.T) {
	t.Parallel()

	t.Run("columns wildcard, nil check and set omitted", func(t *testing.T) {
		t.Parallel()

		got := marshalString(t, InsertPermissionConfig{Columns: []string{"*"}})
		if !strings.Contains(got, `"columns":"*"`) {
			t.Errorf("got %s, want wildcard \"columns\":\"*\"", got)
		}

		if strings.Contains(got, `"check"`) {
			t.Errorf("got %s, want no \"check\" key for nil check", got)
		}

		if strings.Contains(got, `"set"`) {
			t.Errorf("got %s, want no \"set\" key for nil set", got)
		}
	})

	t.Run("single column stays array", func(t *testing.T) {
		t.Parallel()

		got := marshalString(t, InsertPermissionConfig{Columns: []string{"id"}})
		if !strings.Contains(got, `"columns":["id"]`) {
			t.Errorf("got %s, want \"columns\":[\"id\"]", got)
		}
	})

	t.Run("present-but-empty check kept as object", func(t *testing.T) {
		t.Parallel()

		// A non-nil empty check must emit "check":{} (Hasura keeps it), distinct
		// from the nil case which omits the key entirely.
		got := marshalString(t, InsertPermissionConfig{
			Columns: []string{"id"},
			Check:   PermissionExpression{},
		})
		if !strings.Contains(got, `"check":{}`) {
			t.Errorf("got %s, want \"check\":{} for present-but-empty check", got)
		}
	})
}

func TestRemoteSchemaMetadata_MarshalCommentOmittedWhenUnset(t *testing.T) {
	t.Parallel()

	// Hasura omits remote_schemas[].comment when no comment is set (verified
	// against live Hasura by the parity suite's add_remote_schema case), and
	// emits it only when present. A faithful drop-in export does the same. The
	// round-trip suite's EquateEmpty is blind to ""-vs-absent, so assert bytes here.
	if got := marshalString(t, RemoteSchemaMetadata{Name: "weather"}); strings.Contains(
		got, `"comment"`,
	) {
		t.Errorf("got %s, want no \"comment\" key for unset comment", got)
	}

	comment := "forecast service"
	if got := marshalString(t, RemoteSchemaMetadata{Name: "weather", Comment: &comment}); !strings.Contains(
		got, `"comment":"forecast service"`,
	) {
		t.Errorf("got %s, want \"comment\":\"forecast service\" when set", got)
	}
}
