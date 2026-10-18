package textstats_test

import (
	"bytes"
	"math"
	"os"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/tools/writing/internal/textstats"
)

func TestEditRatio(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		a    string
		b    string
		// trimB drops b's final newline, so no fixture lacks one.
		trimB bool
		want  float64
	}{
		{name: "identical files", a: "ten.txt", b: "ten-copy.txt", want: 0},
		{name: "no line in common", a: "ten.txt", b: "disjoint.txt", want: 1},
		{
			// One line changed (1 deletion, 1 insertion) and one appended
			// (1 insertion) over 10 + 11 lines.
			name: "one line changed and one added",
			a:    "ten.txt",
			b:    "small-edit.txt",
			want: 3.0 / 21,
		},
		{
			name: "symmetric",
			a:    "small-edit.txt",
			b:    "ten.txt",
			want: 3.0 / 21,
		},
		{
			// The last line differs by its newline, as in `git diff`.
			name:  "missing final newline",
			a:     "ten.txt",
			b:     "ten-copy.txt",
			trimB: true,
			want:  2.0 / 20,
		},
		{name: "one side empty", a: "empty.txt", b: "ten.txt", want: 1},
		{name: "both empty", a: "empty.txt", b: "empty.txt", want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			a, err := os.ReadFile(filepath.Join("testdata", tt.a))
			if err != nil {
				t.Fatalf("reading %s: %v", tt.a, err)
			}

			b, err := os.ReadFile(filepath.Join("testdata", tt.b))
			if err != nil {
				t.Fatalf("reading %s: %v", tt.b, err)
			}

			if tt.trimB {
				b = bytes.TrimSuffix(b, []byte("\n"))
			}

			if got := textstats.EditRatio(a, b); math.Abs(got-tt.want) > 1e-12 {
				t.Errorf("EditRatio() = %v, want %v", got, tt.want)
			}
		})
	}
}
