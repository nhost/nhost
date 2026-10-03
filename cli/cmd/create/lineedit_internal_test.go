package create

import (
	"bytes"
	"errors"
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

// Every escape sequence has to be swallowed whole. Taking a fixed three bytes
// left the tail of the longer ones in the answer, and the two SS3 forms landed
// a name validateName accepts, so Home became "skate-appOH" without a word.
func TestApplyEditsSwallowsWholeEscapeSequences(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		buf  string
		want string
	}{
		{name: "left arrow", buf: "\x1b[D", want: "skate-app"},
		{name: "delete", buf: "\x1b[3~", want: "skate-app"},
		{name: "page up", buf: "\x1b[5~", want: "skate-app"},
		{name: "home in application-cursor mode", buf: "\x1bOH", want: "skate-app"},
		{name: "end in application-cursor mode", buf: "\x1bOF", want: "skate-app"},
		{name: "ctrl-right", buf: "\x1b[1;5C", want: "skate-app"},
		{name: "f5", buf: "\x1b[15~", want: "skate-app"},
		{
			name: "a sequence still leaves what follows it",
			buf:  "\x1b[3~!",
			want: "skate-app!",
		},
		{name: "a read cut off mid-sequence adds nothing", buf: "\x1b[1;", want: "skate-app"},
		{name: "a read ending on the introducer adds nothing", buf: "\x1b[", want: "skate-app"},
		{name: "a lone escape adds nothing", buf: "\x1b", want: "skate-app"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, ended := applyEdits([]rune("skate-app"), []byte(tt.buf))

			if string(got) != tt.want {
				t.Errorf("applyEdits(%q) value = %q, want %q", tt.buf, string(got), tt.want)
			}

			if ended != editNone {
				t.Errorf("applyEdits(%q) ended = %v, want %v", tt.buf, ended, editNone)
			}

			if err := validateName(string(got)); err != nil && tt.want == "skate-app" {
				t.Errorf("applyEdits(%q) left an unusable name: %v", tt.buf, err)
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
//
// It has to be errNoRawTerminal specifically: promptLine dispatches on
// errors.Is, so any other error aborts `nhost create` instead of falling back.
// stdin is pinned rather than inherited, because a test binary run under a pty
// gets a real terminal and the raw loop then fails on the read instead.
//
//nolint:paralleltest // swaps os.Stdin
func TestEditLineNeedsARawTerminal(t *testing.T) {
	withStdin(t, "")

	var output bytes.Buffer

	if _, err := editLine(
		newTestEnv(&output), "Project name", "skate-app",
	); !errors.Is(err, errNoRawTerminal) {
		t.Errorf("editLine() without a terminal = %v, want errNoRawTerminal", err)
	}

	if output.String() != "" {
		t.Errorf("editLine() drew %q before giving up", output.String())
	}
}
