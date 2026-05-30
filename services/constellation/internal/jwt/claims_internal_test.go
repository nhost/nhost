package jwt

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/constellation/internal/jwt/jwtconfig"
)

// TestJWKSAllowedMethods pins the JWKS algorithm allowlist: it must contain
// only asymmetric (RS*) families that the static-key path also accepts, and
// must never include any symmetric (HS*) algorithm or "none". A symmetric or
// "none" entry would reintroduce the algorithm-confusion surface the allowlist
// exists to close.
func TestJWKSAllowedMethods(t *testing.T) {
	t.Parallel()

	methods := jwksAllowedMethods()
	if len(methods) == 0 {
		t.Fatal("jwksAllowedMethods must not be empty")
	}

	want := map[string]bool{
		string(jwtconfig.AlgorithmRS256): true,
		string(jwtconfig.AlgorithmRS384): true,
		string(jwtconfig.AlgorithmRS512): true,
	}

	for _, m := range methods {
		if !want[m] {
			t.Errorf("unexpected method %q in jwksAllowedMethods", m)
		}

		if strings.HasPrefix(m, "HS") || strings.EqualFold(m, "none") {
			t.Errorf("jwksAllowedMethods must not include symmetric/none method %q", m)
		}
	}
}

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

// TestBuildSessionVariables pins the Hasura-parity contract for the type of
// x-hasura-* session-variable claims: every claim must be a string (Hasura
// rejects non-string session variables with "x-hasura-* claims: parsing Text
// failed, expected String"), with the sole exception of x-hasura-allowed-roles
// which Hasura permits as a string array. golang-jwt decodes JSON numbers to
// float64 and booleans to bool, so a non-conforming issuer that emits e.g.
// {"x-hasura-user-id": 42} must be rejected rather than silently bound as a
// non-string SQL parameter that would diverge from Hasura.
func TestBuildSessionVariables(t *testing.T) {
	t.Parallel()

	baseRoles := func() any { return []any{"user"} }

	cases := []struct {
		name         string
		claims       map[string]any
		roleOverride string
		wantRole     string
		wantVars     map[string]any
		wantErr      bool
	}{
		{
			name: "string claims preserved",
			claims: map[string]any{
				"x-hasura-allowed-roles": baseRoles(),
				"x-hasura-default-role":  "user",
				"x-hasura-user-id":       "42",
				"x-hasura-org-id":        "org-7",
			},
			roleOverride: "",
			wantRole:     "user",
			wantVars: map[string]any{
				"x-hasura-role":          "user",
				"x-hasura-allowed-roles": []any{"user"},
				"x-hasura-default-role":  "user",
				"x-hasura-user-id":       "42",
				"x-hasura-org-id":        "org-7",
			},
			wantErr: false,
		},
		{
			name: "numeric claim rejected (matches Hasura)",
			claims: map[string]any{
				"x-hasura-allowed-roles": baseRoles(),
				"x-hasura-default-role":  "user",
				// golang-jwt decodes JSON numbers as float64.
				"x-hasura-user-id": float64(42),
			},
			roleOverride: "",
			wantRole:     "",
			wantVars:     nil,
			wantErr:      true,
		},
		{
			name: "boolean claim rejected (matches Hasura)",
			claims: map[string]any{
				"x-hasura-allowed-roles": baseRoles(),
				"x-hasura-default-role":  "user",
				"x-hasura-is-admin":      true,
			},
			roleOverride: "",
			wantRole:     "",
			wantVars:     nil,
			wantErr:      true,
		},
		{
			name: "non-allowed-roles array claim rejected (matches Hasura)",
			claims: map[string]any{
				"x-hasura-allowed-roles": baseRoles(),
				"x-hasura-default-role":  "user",
				"x-hasura-org-ids":       []any{"a", "b"},
			},
			roleOverride: "",
			wantRole:     "",
			wantVars:     nil,
			wantErr:      true,
		},
		{
			name: "object claim rejected (matches Hasura)",
			claims: map[string]any{
				"x-hasura-allowed-roles": baseRoles(),
				"x-hasura-default-role":  "user",
				"x-hasura-meta":          map[string]any{"k": "v"},
			},
			roleOverride: "",
			wantRole:     "",
			wantVars:     nil,
			wantErr:      true,
		},
		{
			name: "allowed-roles array is exempt from string check",
			claims: map[string]any{
				"x-hasura-allowed-roles": []any{"user", "editor"},
				"x-hasura-default-role":  "user",
			},
			roleOverride: "",
			wantRole:     "user",
			wantVars: map[string]any{
				"x-hasura-role":          "user",
				"x-hasura-allowed-roles": []any{"user", "editor"},
				"x-hasura-default-role":  "user",
			},
			wantErr: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			role, vars, err := buildSessionVariables(tc.claims, tc.roleOverride)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("buildSessionVariables: expected error, got nil (vars=%+v)", vars)
				}

				return
			}

			if err != nil {
				t.Fatalf("buildSessionVariables: unexpected error: %v", err)
			}

			if role != tc.wantRole {
				t.Errorf("role = %q, want %q", role, tc.wantRole)
			}

			if diff := cmp.Diff(tc.wantVars, vars); diff != "" {
				t.Errorf("session variables mismatch (-want +got):\n%s", diff)
			}

			// Every value other than allowed-roles must be a string.
			for k, v := range vars {
				if k == "x-hasura-allowed-roles" {
					continue
				}

				if _, ok := v.(string); !ok {
					t.Errorf("session variable %q is %T, want string", k, v)
				}
			}
		})
	}
}
