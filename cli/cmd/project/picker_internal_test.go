package project

import (
	"bytes"
	"errors"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/creack/pty"
	"github.com/nhost/nhost/cli/clienv"
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

// screen replays what a picker wrote the way a terminal of the given width
// would, so a test can check what is left on the screen rather than which
// escapes put it there. It follows only the escapes the picker writes.
type screen struct {
	width int
	rows  [][]rune
	row   int
	col   int
}

func (s *screen) write(b []byte) {
	text := []rune(string(b))

	for i := 0; i < len(text); i++ {
		switch text[i] {
		case '\r':
			s.col = 0
		case '\n':
			s.row++
		case keyEscape:
			i = s.escape(text, i)
		default:
			s.put(text[i])
		}
	}
}

// escape applies the CSI sequence starting at text[i] and returns the index
// of its final byte.
func (s *screen) escape(text []rune, i int) int {
	end := i + 2
	for end < len(text) && (text[end] < 0x40 || text[end] > 0x7e) {
		end++
	}

	if end >= len(text) {
		return len(text)
	}

	s.line()

	switch text[end] {
	case 'A':
		n, _ := strconv.Atoi(string(text[i+2 : end]))
		s.row = max(s.row-max(n, 1), 0)
	case 'K':
		s.rows[s.row] = s.rows[s.row][:min(s.col, len(s.rows[s.row]))]
	case 'J':
		s.rows[s.row] = s.rows[s.row][:min(s.col, len(s.rows[s.row]))]
		s.rows = s.rows[:s.row+1]
	}

	return end
}

// put writes one character, wrapping onto the next row when the last one is
// full, which is what throws the picker's row arithmetic off.
func (s *screen) put(r rune) {
	if s.col == s.width {
		s.row++
		s.col = 0
	}

	line := s.line()
	for len(*line) <= s.col {
		*line = append(*line, ' ')
	}

	(*line)[s.col] = r
	s.col++
}

func (s *screen) line() *[]rune {
	for len(s.rows) <= s.row {
		s.rows = append(s.rows, nil)
	}

	return &s.rows[s.row]
}

func (s *screen) lines() []string {
	lines := make([]string, 0, len(s.rows))
	for _, row := range s.rows {
		lines = append(lines, strings.TrimRight(string(row), " "))
	}

	for len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}

	return lines
}

// runOnTerminal runs a picker on a pseudo-terminal of the given width, types
// keys once the list is up, and returns the screen it leaves behind.
func runOnTerminal(
	t *testing.T,
	width uint16,
	keys string,
	run func(ce *clienv.CliEnv) error,
) ([]string, error) {
	t.Helper()

	ptmx, tty, err := pty.Open()
	if err != nil {
		t.Skipf("no pseudo-terminal: %v", err)
	}

	t.Cleanup(func() {
		ptmx.Close()
		tty.Close()
	})

	size := &pty.Winsize{Rows: 24, Cols: width, X: 0, Y: 0}
	if err := pty.Setsize(ptmx, size); err != nil {
		t.Fatalf("size the terminal: %v", err)
	}

	orig := os.Stdin
	os.Stdin = tty

	t.Cleanup(func() { os.Stdin = orig })

	chunks := make(chan []byte, 64)

	go func() {
		for {
			buf := make([]byte, 4096)

			n, err := ptmx.Read(buf)
			if n > 0 {
				chunks <- buf[:n]
			}

			if err != nil {
				return
			}
		}
	}()

	var seen []byte

	waitFor := func(want string) {
		t.Helper()

		timeout := time.After(5 * time.Second)
		for !bytes.Contains(seen, []byte(want)) {
			select {
			case chunk := <-chunks:
				seen = append(seen, chunk...)
			case <-timeout:
				t.Fatalf("terminal never showed %q:\n%q", want, seen)
			}
		}
	}

	done := make(chan error, 1)

	ce := clienv.New(tty, tty, nil, "", "", "", "", "", "", "")

	go func() { done <- run(ce) }()

	waitFor(frameClose)

	if _, err := ptmx.WriteString(keys); err != nil {
		t.Fatalf("type %q: %v", keys, err)
	}

	select {
	case err = <-done:
	case <-time.After(5 * time.Second):
		t.Fatalf("picker did not return after %q:\n%q", keys, seen)
	}

	// Written once the picker has returned, so everything it drew is in front.
	const sentinel = "\x00end"
	if _, err := tty.WriteString(sentinel); err != nil {
		t.Fatalf("write sentinel: %v", err)
	}

	waitFor(sentinel)

	scr := &screen{width: int(width), rows: nil, row: 0, col: 0}
	scr.write(bytes.TrimSuffix(seen, []byte(sentinel)))

	return scr.lines(), err
}

// The question row is what the erase arithmetic counts as one row, so on a
// narrow terminal it has to stay one, and the answer is cut only by the columns
// the margin and the mark take.
//
//nolint:paralleltest // swaps os.Stdin
func TestPickWithKeysScreen(t *testing.T) {
	items := []pickerItem{
		{Label: "first"},
		{Label: "abcdefghijklmnopqrstuvwx"},
	}

	tests := []struct {
		name    string
		width   uint16
		keys    string
		wantErr error
		want    []string
	}{
		{
			name:    "answer on a narrow terminal",
			width:   30,
			keys:    "j\r",
			wantErr: nil,
			want: []string{
				frameBar,
				frameAsked + "  " + pickerHeading("Template") + ":",
				frameBar + "  " + frameOn + " abcdefghijklmnopqrstuvwx",
			},
		},
		// A cancelled question leaves nothing open behind it: the frame
		// closes on a bare corner where the question was.
		{
			name:    "cancel",
			width:   80,
			keys:    "q",
			wantErr: errCancelled,
			want:    []string{frameBar, frameClose},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := func(ce *clienv.CliEnv) error {
				_, err := pickWithKeys(ce, "Template", items, 0)

				return err
			}

			got, err := runOnTerminal(t, tt.width, tt.keys, run)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("pickWithKeys() error = %v, want %v", err, tt.wantErr)
			}

			if !slices.Equal(got, tt.want) {
				t.Errorf("screen =\n%s\nwant\n%s",
					strings.Join(got, "\n"), strings.Join(tt.want, "\n"))
			}
		})
	}
}

// Typing into a terminal whose output goes somewhere else answers a question
// nobody can see, so the picker has to step aside for the fallback rather than
// go raw and draw into a log.
//
//nolint:paralleltest // swaps os.Stdin
func TestPickWithKeysNeedsATerminalToDrawOn(t *testing.T) {
	logFile, err := os.Create(filepath.Join(t.TempDir(), "init.log"))
	if err != nil {
		t.Fatalf("create log: %v", err)
	}

	t.Cleanup(func() { logFile.Close() })

	tests := []struct {
		name string
		out  io.Writer
	}{
		{name: "a pipe", out: &bytes.Buffer{}},
		{name: "a file", out: logFile},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ptmx, tty, err := pty.Open()
			if err != nil {
				t.Skipf("no pseudo-terminal: %v", err)
			}

			t.Cleanup(func() {
				ptmx.Close()
				tty.Close()
			})

			orig := os.Stdin
			os.Stdin = tty

			t.Cleanup(func() { os.Stdin = orig })

			// Queued so a picker that does go raw returns instead of waiting.
			if _, err := ptmx.WriteString("\r"); err != nil {
				t.Fatalf("type enter: %v", err)
			}

			done := make(chan error, 1)
			ce := clienv.New(tt.out, tt.out, nil, "", "", "", "", "", "", "")
			items := []pickerItem{{Label: "a"}}

			go func() {
				_, err := pickWithKeys(ce, "Template", items, 0)
				done <- err
			}()

			select {
			case err := <-done:
				if !errors.Is(err, errNoRawTerminal) {
					t.Errorf("pickWithKeys() error = %v, want no terminal", err)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("pickWithKeys() waited for keys with nowhere to draw")
			}
		})
	}
}

// A signal from outside ends the process without running its deferred calls,
// so the terminal is reset first and only then is the signal let through. The
// raise is faked here, since the real one would end the test binary.
//
//nolint:paralleltest // a signal reaches the whole process
func TestResetOnSignal(t *testing.T) {
	if signal.Ignored(syscall.SIGTERM) {
		t.Skip("SIGTERM is ignored in this process")
	}

	reset := make(chan struct{}, 1)
	raised := make(chan os.Signal, 1)

	stop := resetOnSignal(
		func() { reset <- struct{}{} },
		func(sig os.Signal) {
			select {
			case <-reset:
			default:
				t.Error("signal raised again before the terminal was reset")
			}

			raised <- sig
		},
	)
	t.Cleanup(stop)

	raiseSignal(syscall.SIGTERM)

	select {
	case sig := <-raised:
		if sig != syscall.SIGTERM {
			t.Errorf("raised %v, want %v", sig, syscall.SIGTERM)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("SIGTERM never reached the handler")
	}
}

func TestRenderItems(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	renderItems(&output, []pickerItem{
		{Label: "pnpm"},
		{Label: "npm"},
	}, 1, 80)

	got := output.String()

	// One row per item, plus the row that closes the frame under them while the
	// question is still open.
	if strings.Count(got, "\r\n") != 3 {
		t.Errorf("rendered rows = %d, want 3:\n%q", strings.Count(got, "\r\n"), got)
	}

	for _, want := range []string{frameOff + " pnpm", frameOn + " npm", frameClose} {
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

// A checklist says two things per row, so the mark and the brightness have to
// vary independently: the cursor can sit on an unchecked row, and a checked row
// stays checked once the cursor leaves it.
func TestRenderChecklist(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	renderChecklist(&output, []pickerItem{
		{Label: "Email and password"},
		{Label: "Magic link"},
		{Label: "Email code"},
	}, []bool{true, false, true}, 1, 80)

	got := output.String()

	if strings.Count(got, "\r\n") != 4 {
		t.Errorf("rendered rows = %d, want 4:\n%q", strings.Count(got, "\r\n"), got)
	}

	for _, want := range []string{
		frameOn + " Email and password",
		frameOff + " Magic link",
		frameOn + " Email code",
		frameClose,
	} {
		if !strings.Contains(got, want) {
			t.Errorf("render missing %q:\n%q", want, got)
		}
	}

	if strings.Contains(got, "pick at least one") {
		t.Errorf("a selection that has something picked is being told to pick:\n%q", got)
	}
}

// Enter does nothing while the list is empty, so the frame has to say why.
// A key that is silently ignored reads as a broken picker.
func TestRenderChecklistSaysWhyEnterIsIgnored(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	renderChecklist(&output, []pickerItem{
		{Label: "Email and password"},
		{Label: "Magic link"},
	}, []bool{false, false}, 0, 80)

	if got := output.String(); !strings.Contains(got, "pick at least one") {
		t.Errorf("nothing is picked and the frame does not say so:\n%q", got)
	}
}

func TestMultiOptionLine(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		checked  bool
		cursor   bool
		wantMark string
	}{
		{name: "checked, cursor on it", checked: true, cursor: true, wantMark: frameOn},
		{name: "checked, cursor elsewhere", checked: true, cursor: false, wantMark: frameOn},
		{name: "unchecked, cursor on it", checked: false, cursor: true, wantMark: frameOff},
		{name: "unchecked, cursor elsewhere", checked: false, cursor: false, wantMark: frameOff},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got := multiOptionLine(tt.checked, tt.cursor, "otp")

			if !strings.Contains(got, tt.wantMark+" otp") {
				t.Errorf("multiOptionLine = %q, want the %q mark", got, tt.wantMark)
			}
		})
	}
}

func TestAnyChecked(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		checked []bool
		want    bool
	}{
		{name: "none", checked: []bool{false, false}, want: false},
		{name: "one", checked: []bool{false, true}, want: true},
		{name: "all", checked: []bool{true, true}, want: true},
		{name: "empty", checked: nil, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := anyChecked(tt.checked); got != tt.want {
				t.Errorf("anyChecked(%v) = %v, want %v", tt.checked, got, tt.want)
			}
		})
	}
}

// Space is what a checklist adds to the key map, and it has to stay a no-op
// for the single-answer picker that shares the decoder.
func TestDecodeKeyToggle(t *testing.T) {
	t.Parallel()

	action, size := decodeKey([]byte{' '})

	if action != actionToggle {
		t.Errorf("decodeKey(space) = %v, want actionToggle", action)
	}

	if size != 1 {
		t.Errorf("decodeKey(space) size = %d, want 1", size)
	}

	if got := moveSelection(2, actionToggle, 4); got != 2 {
		t.Errorf("moveSelection with actionToggle = %d, want the cursor left at 2", got)
	}
}

// The checklist shares the single-answer picker's frame, so it is held to the
// same screen: one row for the question however narrow the terminal, and a
// bare corner where a cancelled question was.
//
//nolint:paralleltest // swaps os.Stdin
func TestPickMultiWithKeysScreen(t *testing.T) {
	items := []pickerItem{{Label: "Email and password"}, {Label: "Magic link"}}

	tests := []struct {
		name    string
		width   uint16
		keys    string
		wantErr error
		want    []string
	}{
		{
			name:    "answer on a narrow terminal",
			width:   30,
			keys:    "j \r",
			wantErr: nil,
			want: []string{
				frameBar,
				frameAsked + "  " + pickerHeading("Sign-in methods") + ":",
				frameBar + "  " + frameOn + " Email and password, Magi",
			},
		},
		{
			name:    "cancel",
			width:   80,
			keys:    "q",
			wantErr: errCancelled,
			want:    []string{frameBar, frameClose},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			run := func(ce *clienv.CliEnv) error {
				_, err := pickMultiWithKeys(
					ce, "Sign-in methods", items, []bool{true, false}, 0,
				)

				return err
			}

			got, err := runOnTerminal(t, tt.width, tt.keys, run)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("pickMultiWithKeys() = %v, want %v", err, tt.wantErr)
			}

			if !slices.Equal(got, tt.want) {
				t.Errorf("screen =\n%s\nwant\n%s",
					strings.Join(got, "\n"), strings.Join(tt.want, "\n"))
			}
		})
	}
}
