package create

import (
	"bytes"
	"strings"
	"testing"
)

// One read is not one key press. A paste, or a fast enough typist, arrives as a
// burst, and every key in it has to land in order.
func TestApplyEdits(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		value string
		buf   string
		want  string
		ended editAction
	}{
		{name: "typing appends", value: "sk", buf: "ate", want: "skate", ended: editNone},
		{
			name:  "backspace inside a burst erases",
			value: "",
			buf:   "ab\x7f\x7fgood-app",
			want:  "good-app",
			ended: editNone,
		},
		{
			name:  "backspace on an empty answer does nothing",
			value: "",
			buf:   "\x7f\x7f",
			want:  "",
			ended: editNone,
		},
		{name: "ctrl-u clears", value: "skate-app", buf: "\x15new", want: "new", ended: editNone},
		{
			name:  "arrow keys leave nothing behind",
			value: "app",
			buf:   "\x1b[A\x1b[B\x1b[C\x1b[D",
			want:  "app",
			ended: editNone,
		},
		{
			name:  "enter ends it, and takes nothing after it",
			value: "skate",
			buf:   "\r-app",
			want:  "skate",
			ended: editSubmit,
		},
		{
			name:  "ctrl-c abandons it",
			value: "skate",
			buf:   "\x03",
			want:  "skate",
			ended: editCancel,
		},
		{
			name:  "unprintable bytes are dropped",
			value: "app",
			buf:   "\x00\x07!",
			want:  "app!",
			ended: editNone,
		},
		{name: "multi-byte runes survive", value: "", buf: "héllo", want: "héllo", ended: editNone},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ended := applyEdits([]rune(tt.value), []byte(tt.buf))

			if string(got) != tt.want {
				t.Errorf("applyEdits() value = %q, want %q", string(got), tt.want)
			}

			if ended != tt.ended {
				t.Errorf("applyEdits() ended = %v, want %v", ended, tt.ended)
			}
		})
	}
}

func TestReadEditReportsAFailedRead(t *testing.T) {
	t.Parallel()

	if _, _, err := readEdit(
		strings.NewReader(""), make([]byte, editBufferSize), nil,
	); err == nil {
		t.Error("readEdit() on a closed reader = nil error, want one")
	}
}

// The editor cannot draw a line the user types into without raw mode, so it
// says so rather than half working, and promptLine falls back to asking plainly.
func TestEditLineNeedsARawTerminal(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	if _, err := editLine(newTestEnv(&output), "Project name", "skate-app"); err == nil {
		t.Error("editLine() without a terminal = nil error, want errNoRawTerminal")
	}

	if output.String() != "" {
		t.Errorf("editLine() drew %q before giving up", output.String())
	}
}
