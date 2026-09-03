package rust

import (
	"io/fs"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestSensitiveFieldName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		want bool
	}{
		{name: "accessToken", want: true},
		{name: "refresh_token", want: true},
		{name: "personalAccessToken", want: true},
		{name: "password", want: true},
		{name: "newPassword", want: true},
		{name: "clientSecret", want: true},
		{name: "totpSecret", want: true},
		{name: "ticket", want: true},
		{name: "otp", want: true},
		{name: "code", want: true},
		{name: "codeVerifier", want: true},
		{name: "signature", want: true},
		{name: "authorization", want: true},
		{name: "credential", want: true},
		{name: "apiKey", want: true},
		{name: "privateKey", want: true},
		{name: "cookie", want: true},
		{name: "accessTokenExpiresIn", want: false},
		{name: "refreshTokenId", want: false},
		{name: "tokenType", want: false},
		{name: "tokenEndpoint", want: false},
		{name: "codeChallenge", want: false},
		{name: "statusCode", want: false},
		{name: "publicKey", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := sensitiveFieldName(test.name); got != test.want {
				t.Errorf("sensitiveFieldName(%q) = %t, want %t", test.name, got, test.want)
			}
		})
	}
}

func TestToPascalReservedSuffixStaysUnique(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
	}{
		{input: "Error", want: "ErrorType"},
		{input: "ErrorType", want: "ErrorTypeType"},
		{input: "ErrorTypeType", want: "ErrorTypeTypeType"},
		{input: "FilePart", want: "FilePartType"},
	}

	for _, test := range tests {
		t.Run(test.input, func(t *testing.T) {
			t.Parallel()

			if got := toPascal(test.input); got != test.want {
				t.Errorf("toPascal(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestRustPathSegments(t *testing.T) {
	t.Parallel()

	tests := []struct {
		path string
		want string
	}{
		{path: "", want: ""},
		{path: "/files", want: `"files"`},
		{path: "/files/{id}", want: `"files", id`},
		{
			path: "/signin/provider/{provider}/callback",
			want: `"signin", "provider", provider, "callback"`,
		},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			t.Parallel()

			if got := rustPathSegments(test.path); got != test.want {
				t.Errorf("rustPathSegments(%q) = %q, want %q", test.path, got, test.want)
			}
		})
	}
}

func TestRustTemplateImportsAreReserved(t *testing.T) {
	t.Parallel()

	templateNames, err := fs.Glob(templatesFS, "templates/*.tmpl")
	if err != nil {
		t.Fatalf("failed to list Rust templates: %v", err)
	}

	useStatement := regexp.MustCompile(`(?ms)^[\t ]*use[\t ]+([^;]+);`)
	pascalIdentifier := regexp.MustCompile(`\b[A-Z][A-Za-z0-9_]*\b`)
	missing := make(map[string][]string)

	for _, templateName := range templateNames {
		contents, err := fs.ReadFile(templatesFS, templateName)
		if err != nil {
			t.Fatalf("failed to read Rust template %s: %v", templateName, err)
		}

		for _, statement := range useStatement.FindAllSubmatch(contents, -1) {
			for _, identifier := range pascalIdentifier.FindAllString(string(statement[1]), -1) {
				if _, ok := rustReservedTypeNames[identifier]; !ok {
					missing[identifier] = append(missing[identifier], templateName)
				}
			}
		}
	}

	missingNames := make([]string, 0, len(missing))
	for name := range missing {
		missingNames = append(missingNames, name)
	}

	sort.Strings(missingNames)

	for _, name := range missingNames {
		t.Errorf(
			"Rust template import %q in %s is missing from rustReservedTypeNames",
			name,
			strings.Join(missing[name], ", "),
		)
	}
}
