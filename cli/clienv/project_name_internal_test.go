package clienv

import (
	"os"
	"path/filepath"
	"testing"
)

func TestProjectNameFileSourceLookup(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		contents  string
		writeFile bool
		want      string
		wantFound bool
	}{
		{
			name:      "missing file is not a source",
			contents:  "",
			writeFile: false,
			want:      "",
			wantFound: false,
		},
		{
			name:      "empty file is not a source",
			contents:  "",
			writeFile: true,
			want:      "",
			wantFound: false,
		},
		{
			name:      "blank file is not a source",
			contents:  "   \n\n",
			writeFile: true,
			want:      "",
			wantFound: false,
		},
		{
			name:      "trailing newline is trimmed",
			contents:  "my-app\n",
			writeFile: true,
			want:      "my-app",
			wantFound: true,
		},
		{
			name:      "surrounding whitespace is trimmed",
			contents:  "  my-app \r\n",
			writeFile: true,
			want:      "my-app",
			wantFound: true,
		},
		{
			name:      "leading blank lines are skipped",
			contents:  "\n  \nmy-app\n",
			writeFile: true,
			want:      "my-app",
			wantFound: true,
		},
		{
			name:      "only the first line is used",
			contents:  "my-app\nleftovers\n",
			writeFile: true,
			want:      "my-app",
			wantFound: true,
		},
		// Refusing a name compose cannot take is resolveProjectName's job, so
		// the file reports it as written rather than as nothing.
		{
			name:      "a name compose would refuse is reported as written",
			contents:  "_myapp\n",
			writeFile: true,
			want:      "_myapp",
			wantFound: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := filepath.Join(t.TempDir(), "project-name")
			if tt.writeFile {
				if err := os.WriteFile(path, []byte(tt.contents), 0o600); err != nil {
					t.Fatalf("write fixture: %v", err)
				}
			}

			src := &projectNameFileSource{path: path}

			got, found, err := src.Lookup()
			if err != nil {
				t.Fatalf("Lookup: %v", err)
			}

			if got != tt.want || found != tt.wantFound {
				t.Fatalf(
					"Lookup() = (%q, %t), want (%q, %t)",
					got, found, tt.want, tt.wantFound,
				)
			}
		})
	}
}

func TestProjectNameFileSourceLookupUnreadable(t *testing.T) {
	t.Parallel()

	src := &projectNameFileSource{path: t.TempDir()}

	if got, found, err := src.Lookup(); err == nil {
		t.Fatalf("Lookup() = (%q, %t, nil), want an error", got, found)
	}
}

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
