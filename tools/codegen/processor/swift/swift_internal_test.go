package swift

import (
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestSwiftIdentifierBare(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		value      string
		upperCamel bool
		expected   string
	}{
		{name: "lower camel", value: "redirect_to", upperCamel: false, expected: "redirectTo"},
		{name: "upper camel", value: "file metadata", upperCamel: true, expected: "FileMetadata"},
		{name: "already camel", value: "refreshToken", upperCamel: false, expected: "refreshToken"},
		{name: "acronym run kept", value: "createPAT", upperCamel: false, expected: "createPAT"},
		{
			name:       "acronym mid word",
			value:      "signInOTPEmail",
			upperCamel: false,
			expected:   "signInOTPEmail",
		},
		{name: "plural acronym", value: "getJWKs", upperCamel: false, expected: "getJWKs"},
		{
			name:       "acronym then word",
			value:      "getOpenIDConfiguration",
			upperCamel: false,
			expected:   "getOpenIDConfiguration",
		},
		{
			name:       "acronym suffix",
			value:      "getFilePresignedURL",
			upperCamel: false,
			expected:   "getFilePresignedURL",
		},
		{
			name:       "acronym run before word",
			value:      "HTTPServer",
			upperCamel: true,
			expected:   "HTTPServer",
		},
		{
			name:       "leading acronym lowered",
			value:      "URLThing",
			upperCamel: false,
			expected:   "urlThing",
		},
		{name: "digit acronym", value: "signInMFA2", upperCamel: false, expected: "signInMFA2"},
		{
			name:       "leading digit lower",
			value:      "2fa enabled",
			upperCamel: false,
			expected:   "value2faEnabled",
		},
		{
			name:       "leading digit upper",
			value:      "2fa enabled",
			upperCamel: true,
			expected:   "Value2faEnabled",
		},
		{name: "empty", value: "", upperCamel: false, expected: "value"},
		{name: "symbols only", value: "--", upperCamel: true, expected: "Value"},
		{name: "wire name with brackets", value: "file[]", upperCamel: false, expected: "file"},
		{name: "kebab case", value: "x-hasura-role", upperCamel: false, expected: "xHasuraRole"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := swiftIdentifierBare(tc.value, tc.upperCamel); got != tc.expected {
				t.Errorf(
					"swiftIdentifierBare(%q, %t) = %q, want %q",
					tc.value, tc.upperCamel, got, tc.expected,
				)
			}
		})
	}
}

func TestEscapeSwiftKeyword(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		value    string
		expected string
	}{
		{name: "keyword", value: "default", expected: "`default`"},
		{name: "capitalized keyword", value: "Type", expected: "`Type`"},
		{name: "contextual keyword", value: "willSet", expected: "`willSet`"},
		{name: "non keyword", value: "defaultValue", expected: "defaultValue"},
		{name: "empty", value: "", expected: ""},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := escapeSwiftKeyword(tc.value); got != tc.expected {
				t.Errorf("escapeSwiftKeyword(%q) = %q, want %q", tc.value, got, tc.expected)
			}
		})
	}
}

func TestIsAcronymWord(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		value    string
		expected bool
	}{
		{name: "acronym", value: "PAT", expected: true},
		{name: "plural acronym", value: "JWKs", expected: true},
		{name: "acronym with digit", value: "S3", expected: true},
		{name: "single letter", value: "A", expected: false},
		{name: "single letter plural", value: "As", expected: false},
		{name: "title case word", value: "Server", expected: false},
		{name: "lowercase word", value: "token", expected: false},
		{name: "digits only", value: "401", expected: false},
		{name: "empty", value: "", expected: false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := isAcronymWord(tc.value); got != tc.expected {
				t.Errorf("isAcronymWord(%q) = %t, want %t", tc.value, got, tc.expected)
			}
		})
	}
}

func TestSwiftEnumCaseDeclarations(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		values      []any
		expected    []string
		expectedErr string
	}{
		{
			name:   "string values",
			values: []any{"email-password", "webauthn"},
			expected: []string{
				`case emailPassword = "email-password"`,
				`case webauthn = "webauthn"`,
			},
		},
		{
			name:   "keyword and leading digit cases",
			values: []any{"default", "2fa-enabled"},
			expected: []string{
				"case `default` = \"default\"",
				`case value2faEnabled = "2fa-enabled"`,
			},
		},
		{
			name:   "duplicate bare names get numeric suffixes",
			values: []any{"foo-bar", "foo_bar", "fooBar"},
			expected: []string{
				`case fooBar = "foo-bar"`,
				`case fooBar2 = "foo_bar"`,
				`case fooBar3 = "fooBar"`,
			},
		},
		{
			name:   "numeric suffixes remain unique",
			values: []any{"foo-bar", "foo_bar", "fooBar2"},
			expected: []string{
				`case fooBar = "foo-bar"`,
				`case fooBar2 = "foo_bar"`,
				`case fooBar22 = "fooBar2"`,
			},
		},
		{
			name:   "integer values",
			values: []any{int64(0), float64(2)},
			expected: []string{
				"case value0 = 0",
				"case value2 = 2",
			},
		},
		{
			name:        "duplicate string raw values rejected",
			values:      []any{"active", "active"},
			expectedErr: `duplicate raw value "active"`,
		},
		{
			name:        "equivalent integer raw values rejected",
			values:      []any{int64(1), float64(1)},
			expectedErr: "duplicate raw value 1",
		},
		{
			name:        "mixed kinds rejected",
			values:      []any{"a", int64(1)},
			expectedErr: "all raw values to be strings or all raw values to be integers",
		},
		{
			name:        "non integer float rejected",
			values:      []any{1.5},
			expectedErr: "string and integer raw values",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := swiftEnumCaseDeclarations(tc.values)
			if tc.expectedErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.expectedErr) {
					t.Fatalf("expected error containing %q, got %v", tc.expectedErr, err)
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expected, got); diff != "" {
				t.Errorf("unexpected enum cases (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSwiftStringLiteral(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		value    string
		expected string
	}{
		{name: "plain", value: "hello", expected: `"hello"`},
		{name: "quote and backslash", value: `say "hi" \o/`, expected: `"say \"hi\" \\o/"`},
		{name: "newline and tab", value: "a\nb\tc", expected: `"a\nb\tc"`},
		{name: "carriage return", value: "a\rb", expected: `"a\rb"`},
		{name: "control character", value: "a\x01b", expected: `"a\u{1}b"`},
		{name: "unicode passthrough", value: "héllo", expected: `"héllo"`},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := swiftStringLiteral(tc.value); got != tc.expected {
				t.Errorf("swiftStringLiteral(%q) = %s, want %s", tc.value, got, tc.expected)
			}
		})
	}
}
