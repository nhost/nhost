package rust

import (
	"io/fs"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestToPascalReservedSuffixStaysUnique(t *testing.T) {
	t.Parallel()

	tests := []struct {
		input string
		want  string
	}{
		{input: "Error", want: "ErrorType"},
		{input: "ErrorType", want: "ErrorTypeType"},
		{input: "ErrorTypeType", want: "ErrorTypeTypeType"},
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
