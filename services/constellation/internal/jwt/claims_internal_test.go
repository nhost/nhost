package jwt

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

func TestNavigatePath(t *testing.T) {
	t.Parallel()

	data := map[string]any{
		"a": map[string]any{
			"b": map[string]any{
				"c": "value",
			},
			"scalar": "leaf",
		},
		"top": "top-value",
	}

	cases := []struct {
		name    string
		path    string
		want    any
		wantErr bool
	}{
		{name: "dollar-dot prefix", path: "$.a.b.c", want: "value"},
		{name: "dollar prefix only", path: "$a.b.c", want: "value"},
		{name: "no prefix", path: "a.b.c", want: "value"},
		{name: "top-level key", path: "top", want: "top-value"},
		{name: "empty segments collapse", path: "$.a..b.c", want: "value"},
		{name: "missing key", path: "a.b.missing", wantErr: true},
		{name: "scalar mid-path", path: "a.scalar.deeper", wantErr: true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := navigatePath(data, tc.path)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("navigatePath(%q): expected error, got nil", tc.path)
				}

				return
			}

			if err != nil {
				t.Fatalf("navigatePath(%q): unexpected error: %v", tc.path, err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("navigatePath(%q) mismatch (-want +got):\n%s", tc.path, diff)
			}
		})
	}
}

func TestParseClaims(t *testing.T) {
	t.Parallel()

	hasuraObj := map[string]any{"x-hasura-role": "user"}

	cases := []struct {
		name    string
		raw     any
		format  jwtconfig.ClaimsFormat
		want    map[string]any
		wantErr bool
	}{
		{
			name:   "json format with object",
			raw:    hasuraObj,
			format: jwtconfig.ClaimsFormatJSON,
			want:   hasuraObj,
		},
		{
			name:   "empty format defaults to json",
			raw:    hasuraObj,
			format: "",
			want:   hasuraObj,
		},
		{
			name:    "json format with non-object",
			raw:     "not-an-object",
			format:  jwtconfig.ClaimsFormatJSON,
			wantErr: true,
		},
		{
			name:   "stringified json",
			raw:    `{"x-hasura-role":"user"}`,
			format: jwtconfig.ClaimsFormatStringifiedJSON,
			want:   map[string]any{"x-hasura-role": "user"},
		},
		{
			name:    "stringified json with non-string",
			raw:     hasuraObj,
			format:  jwtconfig.ClaimsFormatStringifiedJSON,
			wantErr: true,
		},
		{
			name:    "stringified json with invalid json",
			raw:     "not json",
			format:  jwtconfig.ClaimsFormatStringifiedJSON,
			wantErr: true,
		},
		{
			name:    "unsupported format",
			raw:     hasuraObj,
			format:  jwtconfig.ClaimsFormat("xml"),
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseClaims(tc.raw, tc.format)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("parseClaims: expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("parseClaims: unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("parseClaims mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestResolveClaimsMapEntry(t *testing.T) {
	t.Parallel()

	claims := map[string]any{
		"user": map[string]any{"id": "42"},
	}

	cases := []struct {
		name    string
		entry   jwtconfig.ClaimsMapEntry
		want    any
		wantErr bool
	}{
		{
			name:  "literal value",
			entry: jwtconfig.ClaimsMapEntry{Literal: "fixed"},
			want:  "fixed",
		},
		{
			name:  "path resolves",
			entry: jwtconfig.ClaimsMapEntry{Path: "$.user.id"},
			want:  "42",
		},
		{
			name:  "path missing with default",
			entry: jwtconfig.ClaimsMapEntry{Path: "$.user.missing", Default: "fallback"},
			want:  "fallback",
		},
		{
			name:    "path missing without default",
			entry:   jwtconfig.ClaimsMapEntry{Path: "$.user.missing"},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := resolveClaimsMapEntry(claims, tc.entry)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("resolveClaimsMapEntry: expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("resolveClaimsMapEntry: unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("resolveClaimsMapEntry mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestToStringSlice(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		in      any
		want    []string
		wantErr bool
	}{
		{
			name: "valid string slice",
			in:   []any{"a", "b", "c"},
			want: []string{"a", "b", "c"},
		},
		{
			name: "empty slice",
			in:   []any{},
			want: []string{},
		},
		{
			name:    "not an array",
			in:      "not-an-array",
			wantErr: true,
		},
		{
			name:    "non-string element",
			in:      []any{"a", 42, "c"},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := toStringSlice(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("toStringSlice: expected error, got nil")
				}

				return
			}

			if err != nil {
				t.Fatalf("toStringSlice: unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("toStringSlice mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
