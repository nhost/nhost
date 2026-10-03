package create

import (
	"bytes"
	"slices"
	"strings"
	"testing"
)

func TestDecodeKey(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		buf          []byte
		want         pickerAction
		wantConsumed int
	}{
		{name: "arrow up", buf: []byte{keyEscape, '[', 'A'}, want: actionUp, wantConsumed: 3},
		{name: "arrow down", buf: []byte{keyEscape, '[', 'B'}, want: actionDown, wantConsumed: 3},
		{
			name: "arrow right is ignored",
			buf:  []byte{keyEscape, '[', 'C'}, want: actionNone, wantConsumed: 3,
		},
		// Delete and a modified arrow run past the three bytes of a plain
		// arrow key. Measuring them is what keeps their tail from being
		// decoded as further presses.
		{
			name: "delete is ignored whole",
			buf:  []byte{keyEscape, '[', '3', '~'}, want: actionNone, wantConsumed: 4,
		},
		{
			name: "ctrl-right is ignored whole",
			buf:  []byte("\x1b[1;5C"), want: actionNone, wantConsumed: 6,
		},
		{name: "vim up", buf: []byte("k"), want: actionUp, wantConsumed: 1},
		{name: "vim down", buf: []byte("j"), want: actionDown, wantConsumed: 1},
		{name: "enter", buf: []byte("\r"), want: actionSelect, wantConsumed: 1},
		{name: "newline", buf: []byte("\n"), want: actionSelect, wantConsumed: 1},
		{name: "ctrl-c", buf: []byte{keyCtrlC}, want: actionCancel, wantConsumed: 1},
		{name: "ctrl-d", buf: []byte{keyCtrlD}, want: actionCancel, wantConsumed: 1},
		{name: "q", buf: []byte("q"), want: actionCancel, wantConsumed: 1},
		// A terminal that delivers the escape byte on its own must not be
		// read as a cancel, or an arrow key would abort the command.
		{name: "lone escape", buf: []byte{keyEscape}, want: actionNone, wantConsumed: 1},
		{name: "other letters", buf: []byte("x"), want: actionNone, wantConsumed: 1},
		{name: "nothing read", buf: nil, want: actionNone, wantConsumed: 0},
		// The first press of a burst is decoded without reaching into the one
		// behind it.
		{
			name: "a burst decodes its first press only",
			buf:  []byte("\x1b[B\r"), want: actionDown, wantConsumed: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, consumed := decodeKey(tt.buf)
			if got != tt.want {
				t.Errorf("decodeKey(%q) = %v, want %v", tt.buf, got, tt.want)
			}

			if consumed != tt.wantConsumed {
				t.Errorf(
					"decodeKey(%q) consumed %d bytes, want %d",
					tt.buf, consumed, tt.wantConsumed,
				)
			}
		})
	}
}

// One read is not one key press. Holding an arrow key down, or pressing it and
// enter in quick succession over a link that batches bytes, lands several
// presses in a single read, and acting on the first while dropping the rest of
// the buffer loses every press behind it -- the picker appears stuck, or eats
// the enter that was meant to choose.
func TestReadActionsAppliesEveryPressInOneRead(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  []pickerAction
	}{
		{name: "one arrow", input: "\x1b[B", want: []pickerAction{actionDown}},
		{
			name:  "two arrows in one read",
			input: "\x1b[B\x1b[B",
			want:  []pickerAction{actionDown, actionDown},
		},
		{
			name:  "five arrows in one read",
			input: strings.Repeat("\x1b[B", 5),
			want: []pickerAction{
				actionDown, actionDown, actionDown, actionDown, actionDown,
			},
		},
		{
			name:  "an arrow and the enter behind it",
			input: "\x1b[B\r",
			want:  []pickerAction{actionDown, actionSelect},
		},
		{
			name:  "a longer sequence does not leave a tail",
			input: "\x1b[3~\x1b[B",
			want:  []pickerAction{actionNone, actionDown},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := newKeyReader(strings.NewReader(tt.input)).readActions()
			if err != nil {
				t.Fatalf("readActions: %v", err)
			}

			if !slices.Equal(got, tt.want) {
				t.Errorf("readActions(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

// The moves a burst carries have to land on the cursor, not just be decoded.
func TestReadActionsMovesTheCursorOncePerPress(t *testing.T) {
	t.Parallel()

	const items = 4

	actions, err := newKeyReader(
		strings.NewReader(strings.Repeat("\x1b[B", 3)),
	).readActions()
	if err != nil {
		t.Fatalf("readActions: %v", err)
	}

	cursor := 0
	for _, action := range actions {
		cursor = moveSelection(cursor, action, items)
	}

	if cursor != 3 {
		t.Errorf("cursor after three down presses in one read = %d, want 3", cursor)
	}
}

// A burst longer than one read splits a key press across the boundary, and the
// press the split falls inside has to survive it. Six arrows are 18 bytes: the
// first read takes 16 and ends holding the bare ESC of the sixth, whose `[B`
// arrives on the read behind it. That sixth press used to be lost three times
// over -- the ESC decoded as an ignored press and the tail thrown away, then
// `[` and `B` decoded as two more ignored presses -- leaving five moves where
// the user made six.
func TestReadActionsKeepsAPressSplitAcrossReads(t *testing.T) {
	t.Parallel()

	// More items than presses, so the moves cannot wrap around and land on a
	// cursor a shorter run of them would also reach.
	const (
		presses = 6
		items   = 10
	)

	if presses*csiArrowLen <= keyBufferSize {
		t.Fatalf(
			"%d arrows fit in one read of %d bytes, so nothing is split",
			presses, keyBufferSize,
		)
	}

	keys := newKeyReader(strings.NewReader(strings.Repeat("\x1b[B", presses)))

	cursor := 0
	moves := 0

	for moves < presses {
		// A read past the end of the burst fails, which is how a lost press
		// shows up here: the moves never add up to the presses made.
		actions, err := keys.readActions()
		if err != nil {
			t.Fatalf("readActions after %d of %d moves: %v", moves, presses, err)
		}

		for _, action := range actions {
			if action == actionDown {
				moves++
			}

			cursor = moveSelection(cursor, action, items)
		}
	}

	if moves != presses {
		t.Errorf("moves from %d arrows split across reads = %d, want %d", presses, moves, presses)
	}

	if cursor != presses {
		t.Errorf(
			"cursor after %d arrows split across reads = %d, want %d",
			presses, cursor, presses,
		)
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

func TestReadActionsReportsAClosedTerminal(t *testing.T) {
	t.Parallel()

	if _, err := newKeyReader(strings.NewReader("")).readActions(); err == nil {
		t.Error("readActions() error = nil, want a failure")
	}
}
