package rust

import (
	"io/fs"
	"regexp"
	"sort"
	"strings"
	"testing"

	"github.com/pb33f/libopenapi/datamodel/high/base"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
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

func TestRustSchemaTypeNullableContainerMembers(t *testing.T) {
	t.Parallel()

	nullable := true
	emptyExtensions := orderedmap.New[string, *yaml.Node]()
	nullableString := base.CreateSchemaProxy(&base.Schema{
		Type:       []string{schemaTypeString},
		Nullable:   &nullable,
		Extensions: emptyExtensions,
	})

	tests := []struct {
		name   string
		schema *base.SchemaProxy
		want   string
	}{
		{
			name: "array item",
			schema: base.CreateSchemaProxy(&base.Schema{
				Type:       []string{"array"},
				Extensions: emptyExtensions,
				Items: &base.DynamicValue[*base.SchemaProxy, bool]{
					A: nullableString,
				},
			}),
			want: "Vec<Option<String>>",
		},
		{
			name: "map value",
			schema: base.CreateSchemaProxy(&base.Schema{
				Type:       []string{"object"},
				Extensions: emptyExtensions,
				AdditionalProperties: &base.DynamicValue[*base.SchemaProxy, bool]{
					A: nullableString,
				},
			}),
			want: "HashMap<String, Option<String>>",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := rustSchemaType(test.schema); got != test.want {
				t.Errorf("rustSchemaType() = %q, want %q", got, test.want)
			}
		})
	}
}

func TestRustStringLiteral(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value string
		want  string
	}{
		{name: "plain", value: "field-name", want: `"field-name"`},
		{name: "quote and backslash", value: "field\"name\\path", want: `"field\"name\\path"`},
		{
			name:  "standard escapes",
			value: "line\nbreak\rreturn\ttab\x00null",
			want:  `"line\nbreak\rreturn\ttab\0null"`,
		},
		{name: "Go-only escapes", value: "\a\b\f\v", want: `"\u{7}\u{8}\u{c}\u{b}"`},
		{name: "Unicode", value: "café\u2028line", want: `"café\u{2028}line"`},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := rustStringLiteral(test.value); got != test.want {
				t.Errorf("rustStringLiteral(%q) = %q, want %q", test.value, got, test.want)
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

func TestRustClientTemplateMethodsAreReserved(t *testing.T) {
	t.Parallel()

	contents, err := fs.ReadFile(templatesFS, "templates/client.tmpl")
	if err != nil {
		t.Fatalf("failed to read Rust client template: %v", err)
	}

	const (
		clientDefinitionMarker = `{{- define "client" -}}`
		implMarker             = "impl Client {"
	)

	clientDefinitionStart := strings.Index(string(contents), clientDefinitionMarker)
	if clientDefinitionStart < 0 {
		t.Fatalf("Rust client template does not contain %q", clientDefinitionMarker)
	}

	implStart := strings.Index(string(contents), implMarker)
	if implStart < 0 {
		t.Fatalf("Rust client template does not contain %q", implMarker)
	}

	methodTemplates := string(contents[:clientDefinitionStart]) + string(contents[implStart:])
	methodDefinition := regexp.MustCompile(
		`(?m)^[\t ]*(?:pub(?:\(crate\))?[\t ]+)?(?:async[\t ]+)?fn[\t ]+([a-z][a-z0-9_]*)[\t ]*\(`,
	)

	found := make(map[string]struct{})
	for _, match := range methodDefinition.FindAllStringSubmatch(methodTemplates, -1) {
		found[match[1]] = struct{}{}
		if _, ok := rustReservedClientMethodNames[match[1]]; !ok {
			t.Errorf(
				"Rust client template method %q is missing from rustReservedClientMethodNames",
				match[1],
			)
		}
	}

	for name := range rustReservedClientMethodNames {
		if _, ok := found[name]; !ok {
			t.Errorf("reserved Rust client method %q is not emitted by the template", name)
		}
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
