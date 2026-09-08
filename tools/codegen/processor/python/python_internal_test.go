package python

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/pb33f/libopenapi"
)

func TestToSnakeCase(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "camel case", input: "camelCase", want: "camel_case"},
		{name: "kebab case", input: "kebab-case", want: "kebab_case"},
		{name: "dotted", input: "profile.name", want: "profile_name"},
		{name: "acronym run", input: "clientDataJSON", want: "client_data_json"},
		{name: "leading acronym", input: "JSONClientData", want: "json_client_data"},
		{name: "multipart array suffix", input: "files[]", want: "files"},
		{name: "leading digit", input: "2faMethod", want: "2fa_method"},
		{name: "punctuation only", input: "[]", want: ""},
		{name: "empty", input: "", want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := toSnakeCase(test.input); got != test.want {
				t.Errorf("toSnakeCase(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestUnderscoreBeforeUpper(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		index int
		want  bool
	}{
		{name: "initial uppercase", input: "Client", index: 0, want: false},
		{name: "after lowercase", input: "clientData", index: 6, want: true},
		{name: "after digit", input: "v2Client", index: 2, want: true},
		{name: "inside acronym", input: "JSON", index: 2, want: false},
		{name: "end of acronym before word", input: "JSONData", index: 4, want: true},
		{name: "after separator", input: "client-Data", index: 7, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := underscoreBeforeUpper([]rune(test.input), test.index); got != test.want {
				t.Errorf(
					"underscoreBeforeUpper(%q, %d) = %t, want %t",
					test.input,
					test.index,
					got,
					test.want,
				)
			}
		})
	}
}

func TestSafeIdentifier(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "empty", input: "", want: "field"},
		{name: "leading digit", input: "2fa", want: "field_2fa"},
		{name: "hard keyword", input: "class", want: "class_"},
		{name: "soft keyword type", input: "type", want: "type"},
		{name: "soft keyword match", input: "match", want: "match"},
		{name: "soft keyword case", input: "case", want: "case"},
		{name: "pydantic protected prefix", input: "model_dump", want: "model_dump_"},
		{name: "ordinary identifier", input: "display_name", want: "display_name"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := safeIdentifier(test.input); got != test.want {
				t.Errorf("safeIdentifier(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestFieldDefinition(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		fieldName   string
		rawName     string
		typeName    string
		description string
		optional    bool
		missable    bool
		sensitive   bool
		want        string
	}{
		{
			name:      "required plain field",
			fieldName: "name",
			rawName:   "name",
			typeName:  "str",
			want:      "name: str",
		},
		{
			name:      "nullable required field",
			fieldName: "name",
			rawName:   "name",
			typeName:  "str",
			optional:  true,
			want:      "name: str | None",
		},
		{
			name:      "missable field",
			fieldName: "name",
			rawName:   "name",
			typeName:  "str",
			optional:  true,
			missable:  true,
			want:      "name: str | None = None",
		},
		{
			name:      "aliased missable field",
			fieldName: "display_name",
			rawName:   "displayName",
			typeName:  "str",
			optional:  true,
			missable:  true,
			want: "display_name: str | None = Field(default=None, " +
				`alias="displayName")`,
		},
		{
			name:      "sensitive alias is redacted",
			fieldName: "access_token",
			rawName:   "accessToken",
			typeName:  "str",
			sensitive: true,
			want:      `access_token: str = Field(alias="accessToken", repr=False)`,
		},
		{
			name:        "documented field",
			fieldName:   "name",
			rawName:     "name",
			typeName:    "str",
			description: "Display name.",
			want: "name: str = Field(\n" +
				`        description="Display name.",` + "\n" +
				"    )",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got := fieldDefinition(
				test.fieldName,
				test.rawName,
				test.typeName,
				test.description,
				test.optional,
				test.missable,
				test.sensitive,
			)
			if got != test.want {
				t.Errorf("fieldDefinition() = %q, want %q", got, test.want)
			}
		})
	}
}

// renderPythonSpec renders an OpenAPI document through this plugin, returning
// the generated Python and any generation error. It exists because the external
// test helpers live in package python_test and cannot reach the unexported
// identifiers these tests assert on.
func renderPythonSpec(spec []byte) (string, error) {
	document, err := libopenapi.NewDocument(spec)
	if err != nil {
		return "", fmt.Errorf("cannot create document: %w", err)
	}

	model, modelErrors := document.BuildV3Model()
	if len(modelErrors) > 0 {
		var wrapped error

		for i := range modelErrors {
			wrapped = errors.Join(wrapped, modelErrors[i])
		}

		return "", fmt.Errorf("cannot build v3 model: %w", wrapped)
	}

	ir, err := processor.NewInterMediateRepresentation(model, &Python{})
	if err != nil {
		return "", fmt.Errorf("cannot build intermediate representation: %w", err)
	}

	buf := bytes.NewBuffer(nil)
	if err := ir.Render(buf); err != nil {
		return "", err //nolint:wrapcheck // Callers assert on the generation error.
	}

	return buf.String(), nil
}

// clientClassBody returns the body of the generated `class Client:` block,
// stopping at the next top-level statement.
func clientClassBody(t *testing.T, source string) string {
	t.Helper()

	const marker = "\nclass Client:\n"

	_, body, found := strings.Cut(source, marker)
	if !found {
		t.Fatal("generated source has no `class Client:` block")
	}

	// The class ends at the first line that is neither blank nor indented.
	for offset := 0; ; {
		newline := strings.IndexByte(body[offset:], '\n')
		if newline < 0 {
			return body
		}

		line := body[offset : offset+newline]
		if line != "" && !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") {
			return body[:offset]
		}

		offset += newline + 1
	}
}

// TestPythonClientReservedNamesMatchTemplate ties the collision guard to the
// client the template actually emits.
//
// The guard fails open: an entry naming a member the template no longer
// generates protects nothing, while the member that replaced it is left free for
// an operation to shadow. That is how `_chain_functions` and
// `push_chain_function` outlived the rename to `_middleware` and
// `add_middleware`, so this compares the two sets directly rather than trusting
// either one.
func TestPythonClientReservedNamesMatchTemplate(t *testing.T) {
	t.Parallel()

	// A spec with no operations still renders the full Client scaffolding, which
	// is exactly the surface the guard has to cover.
	spec, err := os.ReadFile("../testdata/types.yaml")
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	source, err := renderPythonSpec(spec)
	if err != nil {
		t.Fatalf("failed to render fixture: %v", err)
	}

	body := clientClassBody(t, source)

	// `self.<name> = ...` attributes and `def <name>(` methods, async or not.
	attributePattern := regexp.MustCompile(`(?m)^\s+self\.([A-Za-z_][A-Za-z0-9_]*)\s*=`)
	methodPattern := regexp.MustCompile(`(?m)^\s+(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(`)

	emitted := map[string]struct{}{}

	for _, match := range attributePattern.FindAllStringSubmatch(body, -1) {
		emitted[match[1]] = struct{}{}
	}

	for _, match := range methodPattern.FindAllStringSubmatch(body, -1) {
		emitted[match[1]] = struct{}{}
	}

	if len(emitted) == 0 {
		t.Fatal("found no Client members; the extraction patterns have gone stale")
	}

	reserved := pythonClientReservedNames()

	for name := range emitted {
		if _, ok := reserved[name]; !ok {
			t.Errorf(
				"generated Client member %q is not reserved; an operation of that name would shadow it",
				name,
			)
		}
	}

	for name := range reserved {
		if _, ok := emitted[name]; !ok {
			t.Errorf(
				"reserved name %q is not generated by the Client template; the guard protects nothing",
				name,
			)
		}
	}
}

// TestRejectsOperationCollidingWithMiddlewareMethod is the behavioural half of
// the guard: an operation named after the client's own middleware hook must be
// refused. Before the reserved set was corrected this generated without error,
// silently overriding `add_middleware` in the emitted client.
func TestRejectsOperationCollidingWithMiddlewareMethod(t *testing.T) {
	t.Parallel()

	const spec = `openapi: "3.0.0"
paths:
  /middleware:
    get:
      operationId: addMiddleware
      responses:
        "204": {description: Done}
`

	_, err := renderPythonSpec([]byte(spec))
	if !errors.Is(err, processor.ErrUnsupportedFeature) {
		t.Fatalf("generation error = %v, want ErrUnsupportedFeature", err)
	}

	for _, want := range []string{
		`generated Client method "add_middleware"`,
		`operation "addMiddleware"`,
		`identifier "add_middleware"`,
	} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("generation error = %q, want it to contain %q", err, want)
		}
	}
}
