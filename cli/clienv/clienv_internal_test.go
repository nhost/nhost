package clienv

import (
	"testing"
)

func TestSanitizeName(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "a valid name is kept", input: "my-app", want: "my-app"},
		{name: "a name is lowercased", input: "My_App", want: "my_app"},
		// Dropping the dot is what main always did. Existing projects with a
		// dot in their directory name keep their compose project and volume.
		{name: "a dot is dropped", input: "example.com", want: "examplecom"},
		{name: "a leading dot is dropped", input: ".app", want: "app"},
		{name: "a leading digit is kept", input: "9lives", want: "9lives"},
		{name: "nothing usable", input: "...", want: ""},
		{name: "only unicode", input: "\u65e5\u672c\u8a9e", want: ""},
		// Trimming these would join a sibling project already running under
		// the trimmed name.
		{name: "a leading dash", input: "-myapp", want: ""},
		{name: "a leading underscore", input: "_myapp", want: ""},
		{name: "only separators", input: "--__", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := sanitizeName(tt.input); got != tt.want {
				t.Fatalf(
					"sanitizeName(%q) = %q, want %q", tt.input, got, tt.want,
				)
			}
		})
	}
}
