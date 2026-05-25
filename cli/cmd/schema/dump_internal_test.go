package schema

import (
	"reflect"
	"testing"
)

func TestBuildHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		extra       []string
		role        string
		adminSecret string
		want        []string
	}{
		{
			name:        "empty role, empty secret, no extras",
			extra:       nil,
			role:        "",
			adminSecret: "",
			want:        []string{},
		},
		{
			name:        "role only",
			extra:       nil,
			role:        "user",
			adminSecret: "",
			want:        []string{"X-Hasura-Role: user"},
		},
		{
			name:        "secret only",
			extra:       nil,
			role:        "",
			adminSecret: "s3cret",
			want:        []string{"X-Hasura-Admin-Secret: s3cret"},
		},
		{
			name:        "role plus secret",
			extra:       nil,
			role:        "user",
			adminSecret: "s3cret",
			want: []string{
				"X-Hasura-Role: user",
				"X-Hasura-Admin-Secret: s3cret",
			},
		},
		{
			// Documented invariant: explicit -H entries come last so the user's
			// override wins on duplicate keys when parseHeaders folds the list
			// into a map.
			name:        "extras appended last so they override derived defaults",
			extra:       []string{"X-Hasura-Role: admin"},
			role:        "user",
			adminSecret: "s3cret",
			want: []string{
				"X-Hasura-Role: user",
				"X-Hasura-Admin-Secret: s3cret",
				"X-Hasura-Role: admin",
			},
		},
		{
			name:        "extras only, no role, no secret",
			extra:       []string{"X-Custom: value", "X-Other: thing"},
			role:        "",
			adminSecret: "",
			want:        []string{"X-Custom: value", "X-Other: thing"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := buildHeaders(tt.extra, tt.role, tt.adminSecret)
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("buildHeaders() = %v, want %v", got, tt.want)
			}
		})
	}
}

// TestBuildHeadersDuplicateKeysLastWins asserts the end-to-end invariant:
// buildHeaders puts user-supplied -H entries last and parseHeaders folds
// duplicates into a map by overwriting, so the last entry for a given key
// wins. If this ever flips to first-wins the buildHeaders contract is broken.
func TestBuildHeadersDuplicateKeysLastWins(t *testing.T) {
	t.Parallel()

	raw := buildHeaders(
		[]string{"X-Hasura-Role: admin"},
		"user",
		"s3cret",
	)

	headers, err := parseHeaders(raw)
	if err != nil {
		t.Fatalf("parseHeaders returned error: %v", err)
	}

	if got, want := headers["X-Hasura-Role"], "admin"; got != want {
		t.Errorf("X-Hasura-Role = %q, want %q (extras must override derived defaults)", got, want)
	}
}

func TestParseHeaders(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		raw     []string
		want    map[string]string
		wantErr bool
	}{
		{
			name:    "empty input",
			raw:     nil,
			want:    map[string]string{},
			wantErr: false,
		},
		{
			name: "single header",
			raw:  []string{"X-Foo: bar"},
			want: map[string]string{"X-Foo": "bar"},
		},
		{
			name: "multiple headers",
			raw: []string{
				"X-Foo: bar",
				"X-Hasura-Role: admin",
			},
			want: map[string]string{
				"X-Foo":         "bar",
				"X-Hasura-Role": "admin",
			},
		},
		{
			name: "whitespace trimming around name and value",
			raw:  []string{"  X-Foo  :   bar   "},
			want: map[string]string{"X-Foo": "bar"},
		},
		{
			name: "empty value is permitted",
			raw:  []string{"X-Foo:"},
			want: map[string]string{"X-Foo": ""},
		},
		{
			// parseHeaders folds duplicates into a map, so the last occurrence
			// wins. This pairs with buildHeaders' "extras last" ordering.
			name: "duplicate header keys: last wins",
			raw: []string{
				"X-Hasura-Role: user",
				"X-Hasura-Role: admin",
			},
			want: map[string]string{"X-Hasura-Role": "admin"},
		},
		{
			name:    "missing colon",
			raw:     []string{"X-Foo bar"},
			wantErr: true,
		},
		{
			name:    "empty name",
			raw:     []string{": bar"},
			wantErr: true,
		},
		{
			name:    "whitespace-only name",
			raw:     []string{"   : bar"},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseHeaders(tt.raw)
			if (err != nil) != tt.wantErr {
				t.Fatalf("parseHeaders() err = %v, wantErr %v", err, tt.wantErr)
			}

			if tt.wantErr {
				return
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("parseHeaders() = %v, want %v", got, tt.want)
			}
		})
	}
}
