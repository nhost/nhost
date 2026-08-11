package sql //nolint:revive,nolintlint // package name "sql" shadows database/sql; see sql.go for the rationale.

import (
	"encoding/json/jsontext"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

// TestParseGroupedAggregateResult is white-box because parseGroupedAggregateResult
// is unexported.
func TestParseGroupedAggregateResult(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		raw         any
		wantErr     bool
		wantErrSub  string
		wantKeys    []string
		wantNonNil  bool
		checkValues func(t *testing.T, out map[string]any)
	}{
		{
			name:       "nil input returns empty map",
			raw:        nil,
			wantNonNil: true,
		},
		{
			name:       "wrong type returns error",
			raw:        "not a jsontext value",
			wantErr:    true,
			wantErrSub: "unexpected grouped aggregate result type",
		},
		{
			name:       "malformed JSON returns error",
			raw:        jsontext.Value(`{not json`),
			wantErr:    true,
			wantErrSub: "failed to unmarshal grouped aggregate result",
		},
		{
			name:       "row missing _join_key returns error",
			raw:        jsontext.Value(`[{"aggregate":{"count":1},"nodes":[]}]`),
			wantErr:    true,
			wantErrSub: "grouped aggregate row missing _join_key",
		},
		{
			name: "single row well-formed",
			raw: jsontext.Value(
				`[{"_join_key":"abc","aggregate":{"count":2},"nodes":[{"id":1}]}]`,
			),
			wantKeys: []string{"abc"},
			checkValues: func(t *testing.T, out map[string]any) {
				t.Helper()

				entry, ok := out["abc"].(map[string]any)
				if !ok {
					t.Fatalf("entry for abc is not map[string]any: %T", out["abc"])
				}

				if _, ok := entry["aggregate"]; !ok {
					t.Errorf("entry missing aggregate")
				}

				if _, ok := entry["nodes"]; !ok {
					t.Errorf("entry missing nodes")
				}
			},
		},
		{
			name: "aliased aggregate and nodes are preserved",
			raw: jsontext.Value(
				`[{"_join_key":"abc","stats":{"total":2},"rows":[{"role_name":"admin"}],"__typename":"user_departments_aggregate"}]`,
			),
			wantKeys: []string{"abc"},
			checkValues: func(t *testing.T, out map[string]any) {
				t.Helper()

				want := map[string]any{
					"stats": map[string]any{"total": float64(2)},
					"rows": []any{
						map[string]any{"role_name": "admin"},
					},
					"__typename": "user_departments_aggregate",
				}
				if diff := cmp.Diff(want, out["abc"]); diff != "" {
					t.Errorf("aliased entry mismatch (-want +got):\n%s", diff)
				}
			},
		},
		{
			name: "multiple rows with numeric join keys",
			raw: jsontext.Value(
				`[{"_join_key":1,"aggregate":{"count":1},"nodes":[]},` +
					`{"_join_key":2,"aggregate":{"count":3},"nodes":[{"id":7}]}]`,
			),
			wantKeys: []string{"1", "2"},
		},
		{
			name:     "row missing aggregate/nodes still keyed by _join_key",
			raw:      jsontext.Value(`[{"_join_key":"k"}]`),
			wantKeys: []string{"k"},
			checkValues: func(t *testing.T, out map[string]any) {
				t.Helper()

				entry, ok := out["k"].(map[string]any)
				if !ok {
					t.Fatalf("entry for k is not map[string]any: %T", out["k"])
				}

				if len(entry) != 0 {
					t.Errorf("expected empty entry, got %v", entry)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			out, err := parseGroupedAggregateResult(tt.raw)
			if tt.wantErr {
				checkParseErr(t, err, tt.wantErrSub)

				return
			}

			checkParseOK(t, out, err, tt.wantNonNil, tt.wantKeys, tt.checkValues)
		})
	}
}

func checkParseErr(t *testing.T, err error, wantErrSub string) {
	t.Helper()

	if err == nil {
		t.Fatalf("expected error, got nil")
	}

	if wantErrSub != "" && !strings.Contains(err.Error(), wantErrSub) {
		t.Errorf("error %q missing substring %q", err.Error(), wantErrSub)
	}
}

func checkParseOK(
	t *testing.T,
	out map[string]any,
	err error,
	wantNonNil bool,
	wantKeys []string,
	checkValues func(t *testing.T, out map[string]any),
) {
	t.Helper()

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if wantNonNil && out == nil {
		t.Fatal("expected non-nil map")
	}

	if len(out) != len(wantKeys) {
		t.Fatalf("got %d keys %v, want %d %v", len(out), keys(out), len(wantKeys), wantKeys)
	}

	for _, k := range wantKeys {
		if _, ok := out[k]; !ok {
			t.Errorf("missing key %q in %v", k, keys(out))
		}
	}

	if checkValues != nil {
		checkValues(t, out)
	}
}

func keys(m map[string]any) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}

	return out
}
