package create

import (
	"bytes"
	"strings"
	"testing"
)

func TestDecodeKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		buf  []byte
		want pickerAction
	}{
		{name: "arrow up", buf: []byte{keyEscape, '[', 'A'}, want: actionUp},
		{name: "arrow down", buf: []byte{keyEscape, '[', 'B'}, want: actionDown},
		{name: "arrow right is ignored", buf: []byte{keyEscape, '[', 'C'}, want: actionNone},
		{name: "vim up", buf: []byte("k"), want: actionUp},
		{name: "vim down", buf: []byte("j"), want: actionDown},
		{name: "enter", buf: []byte("\r"), want: actionSelect},
		{name: "newline", buf: []byte("\n"), want: actionSelect},
		{name: "ctrl-c", buf: []byte{keyCtrlC}, want: actionCancel},
		{name: "ctrl-d", buf: []byte{keyCtrlD}, want: actionCancel},
		{name: "q", buf: []byte("q"), want: actionCancel},
		// A terminal that delivers the escape byte on its own must not be
		// read as a cancel, or an arrow key would abort the command.
		{name: "lone escape", buf: []byte{keyEscape}, want: actionNone},
		{name: "other letters", buf: []byte("x"), want: actionNone},
		{name: "nothing read", buf: nil, want: actionNone},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := decodeKey(tt.buf); got != tt.want {
				t.Errorf("decodeKey(%q) = %v, want %v", tt.buf, got, tt.want)
			}
		})
	}
}

func TestMoveSelection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		cursor int
		action pickerAction
		count  int
		want   int
	}{
		{name: "down", cursor: 0, action: actionDown, count: 3, want: 1},
		{name: "up", cursor: 2, action: actionUp, count: 3, want: 1},
		{name: "down wraps to the top", cursor: 2, action: actionDown, count: 3, want: 0},
		{name: "up wraps to the bottom", cursor: 0, action: actionUp, count: 3, want: 2},
		{name: "select holds still", cursor: 1, action: actionSelect, count: 3, want: 1},
		{name: "unknown key holds still", cursor: 1, action: actionNone, count: 3, want: 1},
		{name: "empty list", cursor: 0, action: actionDown, count: 0, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := moveSelection(tt.cursor, tt.action, tt.count); got != tt.want {
				t.Errorf("moveSelection() = %d, want %d", got, tt.want)
			}
		})
	}
}

// A line that wraps would occupy two terminal rows, and the redraw counts rows,
// so every rendered line has to fit inside the width.
func TestTruncate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		line  string
		width int
		want  string
	}{
		{name: "fits", line: "npm", width: 80, want: "npm"},
		{name: "cut one column short", line: "abcdef", width: 4, want: "abc"},
		{name: "counts runes, not bytes", line: "→→→→", width: 4, want: "→→→"},
		{name: "unknown width", line: "npm", width: 0, want: "npm"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := truncate(tt.line, tt.width); got != tt.want {
				t.Errorf("truncate(%q, %d) = %q, want %q", tt.line, tt.width, got, tt.want)
			}
		})
	}
}

func TestRenderItems(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	renderItems(&output, []pickerItem{
		{Label: "pnpm", Desc: ""},
		{Label: "npm", Desc: "the default"},
	}, 1, 80)

	got := output.String()

	// One row per item, plus the row that closes the frame under them while the
	// question is still open.
	if strings.Count(got, "\r\n") != 3 {
		t.Errorf("rendered rows = %d, want 3:\n%q", strings.Count(got, "\r\n"), got)
	}

	for _, want := range []string{frameOff + " pnpm", frameOn + " npm - the default", frameClose} {
		if !strings.Contains(got, want) {
			t.Errorf("render missing %q:\n%q", want, got)
		}
	}
}

func TestReadAction(t *testing.T) {
	t.Parallel()

	buf := make([]byte, keyBufferSize)

	got, err := readAction(strings.NewReader("\x1b[B"), buf)
	if err != nil {
		t.Fatalf("readAction: %v", err)
	}

	if got != actionDown {
		t.Errorf("readAction() = %v, want %v", got, actionDown)
	}
}

func TestReadActionReportsAClosedTerminal(t *testing.T) {
	t.Parallel()

	buf := make([]byte, keyBufferSize)

	if _, err := readAction(strings.NewReader(""), buf); err == nil {
		t.Error("readAction() error = nil, want a failure")
	}
}
