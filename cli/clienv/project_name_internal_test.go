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
			contents:  "   \n",
			writeFile: true,
			want:      "",
			wantFound: false,
		},
		{
			name:      "file without usable characters is not a source",
			contents:  "...\n",
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
			name:      "name is lowercased and sanitized",
			contents:  "My.App\n",
			writeFile: true,
			want:      "my-app",
			wantFound: true,
		},
		// The file is committed, so it is hand-editable. A body compose would
		// refuse has to fall through to the directory name rather than reach
		// `docker compose -p` and fail there.
		{
			name:      "a leading dash is trimmed rather than passed to compose",
			contents:  "-app\n",
			writeFile: true,
			want:      "app",
			wantFound: true,
		},
		{
			name:      "a body compose could never accept is not a source",
			contents:  "--__\n",
			writeFile: true,
			want:      "",
			wantFound: false,
		},
		{
			name:      "only the first line is used",
			contents:  "my-app\nleftovers\n",
			writeFile: true,
			want:      "my-app",
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

			got, found := src.Lookup()
			if got != tt.want || found != tt.wantFound {
				t.Fatalf(
					"Lookup() = (%q, %t), want (%q, %t)",
					got, found, tt.want, tt.wantFound,
				)
			}
		})
	}
}
