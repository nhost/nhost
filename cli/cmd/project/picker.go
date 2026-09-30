package project

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"syscall"
	"unicode/utf8"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
	"golang.org/x/term"
)

const (
	keyCtrlC  = 3
	keyCtrlD  = 4
	keyEscape = 27

	// fallbackWidth is what lines are wrapped to when the terminal will not
	// say how wide it is.
	fallbackWidth = 80
	// keyBufferSize is how much of a burst one read takes in. One read is not
	// one key press: autorepeat, a paste, or a link that batches bytes delivers
	// several at once, and the longest single press is six bytes
	// (ESC [ 1 ; 5 C). The buffer is only safe to widen because decodeKey
	// reports how many bytes each press took and pickWithKeys applies every
	// press the read carried; a read wider than the one key it acted on used to
	// throw the rest of the burst away.
	keyBufferSize = 16
	// csiArrowLen is the length of the arrow-key sequences the picker acts on,
	// which is the least a read has to carry for one to be recognised.
	csiArrowLen = 3
)

// errCancelled ends the command quietly when the user aborts a picker. Raw
// mode delivers ctrl-c as a key press rather than a signal, so the picker has
// to end the process itself.
var errCancelled error = cli.Exit("", 1)

// errNoRawTerminal means the picker has no terminal to run on: stdin cannot be
// read key by key, or stdout is not where the user would see it drawn. The
// caller falls back to the numbered prompt.
var errNoRawTerminal = errors.New("stdin or stdout is not a terminal")

// pickerAction is what one key press means to the picker.
type pickerAction int

const (
	actionNone pickerAction = iota
	actionUp
	actionDown
	actionSelect
	actionCancel
)

// pickWithKeys runs the arrow-key picker and returns the index of the chosen
// item. It owns everything it draws: the title and the list are erased on the
// way out so the caller can record the answer on a single line.
func pickWithKeys(
	ce *clienv.CliEnv,
	title string,
	items []pickerItem,
	cursor int,
) (int, error) {
	tty, err := enterRawMode(ce)
	if err != nil {
		return -1, err
	}

	defer tty.restore()

	out, width := tty.out, tty.width

	fmt.Fprintf(out, "\r\x1b[K%s\r\n", barLine())
	fmt.Fprintf(
		out,
		"\r\x1b[K%s\r\n",
		fitQuestion(
			pickerHeading(title), "  ↑/↓ to move, enter to select", width,
		),
	)

	keys := newKeyReader(os.Stdin)

	for {
		renderItems(out, items, cursor, width)

		actions, err := keys.readActions()
		if err != nil {
			abandonPick(out, len(items))

			return -1, err
		}

		for _, action := range actions {
			switch action {
			case actionSelect:
				submitPick(out, pickerHeading(title), items[cursor], len(items), width)

				return cursor, nil
			case actionCancel:
				abandonPick(out, len(items))

				// Not wrapped: only the framework's own exit sentinel reaches
				// HandleExitCoder, and wrapping it would turn a clean cancel back
				// into a printed error.
				return -1, errCancelled //nolint:wrapcheck
			case actionNone, actionUp, actionDown:
				cursor = moveSelection(cursor, action, len(items))
			}
		}

		moveUp(out, len(items)+1)
	}
}

// submitPick replaces the list with the one line that survives it: the question
// marked as answered and the choice under it. The end of the frame goes with
// the list, because the next question continues the same frame.
func submitPick(w io.Writer, heading string, chosen pickerItem, count, width int) {
	// The list, the line that closes the frame under it, and the question
	// itself, all of which the answered form replaces.
	const aroundList = 2

	eraseBlock(w, count+aroundList)
	fmt.Fprintf(
		w,
		"%s\r\n%s\r\n",
		askLine(false, heading),
		optionLine(
			true, truncate(chosen.Label, width-marginWidth()-markWidth()),
		),
	)
}

// abandonPick takes back what a picker drew for a question that was never
// answered, the question included, and closes the frame on a bare corner, so
// the shell prompt that follows is not left under an open question.
func abandonPick(w io.Writer, count int) {
	// The list, the line that closes the frame under it, and the question.
	const aroundList = 2

	eraseBlock(w, count+aroundList)
	fmt.Fprintf(w, "%s\r\n", closeLine(""))
}

// fitQuestion is the open question cut to the one row the erase arithmetic
// counts it as. A question that wrapped would leave its first row behind on
// the screen when it is erased. The hint goes first, since the keys it names
// work without it, and only then is the heading itself cut.
func fitQuestion(heading, hint string, width int) string {
	room := width - utf8.RuneCountInString(frameAsking+frameGap+":")
	if utf8.RuneCountInString(heading+hint) < room {
		return askLine(true, heading) + hintLine(hint)
	}

	return askLine(true, truncate(heading, room))
}

// rawTerminal is the terminal a picker holds in raw mode while it asks.
type rawTerminal struct {
	out   *os.File
	width int
	// restore hands the terminal back as it was found and stops watching for
	// the signals that would otherwise end the process with it still raw.
	restore func()
}

// enterRawMode takes the terminal for a picker. Both ends have to be one: the
// picker reads stdin key by key and draws on stdout with cursor escapes, so
// with stdout redirected nobody would see the question it waits on, and the
// escapes would land in whatever stdout went to.
func enterRawMode(ce *clienv.CliEnv) (*rawTerminal, error) {
	in := int(os.Stdin.Fd())

	out, ok := ce.Stdout().(*os.File)
	if !ok || !term.IsTerminal(in) || !term.IsTerminal(int(out.Fd())) {
		return nil, errNoRawTerminal
	}

	state, err := term.MakeRaw(in)
	if err != nil {
		return nil, errNoRawTerminal
	}

	reset := func() {
		_ = term.Restore(in, state)

		fmt.Fprint(out, "\x1b[?25h")
	}

	stop := resetOnSignal(reset, raiseSignal)

	fmt.Fprint(out, "\x1b[?25l")

	return &rawTerminal{
		out:     out,
		width:   terminalWidth(int(out.Fd())),
		restore: func() { stop(); reset() },
	}, nil
}

// resetOnSignal runs reset before a signal from outside ends the process, and
// returns the function that stops watching. Raw mode keeps the keyboard from
// sending signals, but kill, timeout and a cancelled job still do, and they
// end the process without running its deferred calls: the shell would be left
// with no echo and no cursor. Once reset has run the signal is raised again
// with the handler gone, so the process still ends the way the sender asked.
//
// A hangup is left alone, because the terminal it would reset is gone, and so
// is a signal the process was started ignoring, which watching would undo.
func resetOnSignal(reset func(), raise func(os.Signal)) func() {
	var watched []os.Signal

	for _, sig := range []os.Signal{
		syscall.SIGINT, syscall.SIGTERM, syscall.SIGQUIT,
	} {
		if !signal.Ignored(sig) {
			watched = append(watched, sig)
		}
	}

	// Notify with no signals would watch every one of them.
	if len(watched) == 0 {
		return func() {}
	}

	sigs := make(chan os.Signal, 1)
	done := make(chan struct{})

	signal.Notify(sigs, watched...)

	go func() {
		select {
		case sig := <-sigs:
			reset()
			signal.Stop(sigs)
			raise(sig)
		case <-done:
		}
	}()

	return func() {
		signal.Stop(sigs)
		close(done)
	}
}

func raiseSignal(sig os.Signal) {
	if p, err := os.FindProcess(os.Getpid()); err == nil {
		_ = p.Signal(sig)
	}
}

// decodeKey maps the bytes a raw terminal delivers for the next key press to
// the action it stands for, and reports how many bytes that press took so the
// caller can go on to the one behind it. A lone escape byte is ignored rather
// than treated as a cancel, because a terminal that splits an arrow key across
// two reads would otherwise abort the command.
//
// An escape sequence is measured with escapeLen rather than assumed to be the
// three bytes of a plain arrow key, so the tail of a longer one is stepped over
// instead of being decoded as further presses.
func decodeKey(buf []byte) (pickerAction, int) {
	if len(buf) == 0 {
		return actionNone, 0
	}

	if buf[0] == keyEscape {
		n, _ := escapeLen(buf)
		if n >= csiArrowLen && buf[1] == '[' {
			switch buf[2] {
			case 'A':
				return actionUp, n
			case 'B':
				return actionDown, n
			}
		}

		return actionNone, n
	}

	switch buf[0] {
	case '\r', '\n':
		return actionSelect, 1
	case 'k':
		return actionUp, 1
	case 'j':
		return actionDown, 1
	case keyCtrlC, keyCtrlD, 'q':
		return actionCancel, 1
	default:
		return actionNone, 1
	}
}

// moveSelection applies an action to the cursor, wrapping at both ends so one
// arrow key reaches every item.
func moveSelection(cursor int, action pickerAction, count int) int {
	if count == 0 {
		return 0
	}

	switch action {
	case actionUp:
		return (cursor - 1 + count) % count
	case actionDown:
		return (cursor + 1) % count
	case actionNone, actionSelect, actionCancel:
		return cursor
	}

	return cursor
}

// keyReader decodes the key presses a raw terminal delivers, holding on to a
// read that ended part way through an escape sequence so the next one can
// finish it. Without that, a burst long enough to cross the read boundary lost
// the press the boundary fell inside: the truncated head was decoded as an
// ignored press and thrown away, and the bytes that completed it arrived as two
// more ignored presses on the read behind.
type keyReader struct {
	r   io.Reader
	buf []byte
	// held is how many bytes at the front of buf are the unfinished tail of the
	// previous read, waiting for the rest of their sequence.
	held int
}

func newKeyReader(r io.Reader) *keyReader {
	return &keyReader{r: r, buf: make([]byte, keyBufferSize), held: 0}
}

// readActions takes in one read and decodes every key press it completed. A
// read that held a burst -- an arrow key repeated, or an arrow key and the
// enter behind it -- yields one action per press, because acting on the first
// and dropping the rest of the buffer loses the presses the user made.
func (kr *keyReader) readActions() ([]pickerAction, error) {
	n, err := kr.r.Read(kr.buf[kr.held:])
	if err != nil {
		return nil, fmt.Errorf("failed to read a key press: %w", err)
	}

	read := kr.buf[:kr.held+n]
	kr.held = 0

	var actions []pickerAction

	for len(read) > 0 {
		if kr.hold(read) {
			break
		}

		action, size := decodeKey(read)
		actions = append(actions, action)
		read = read[size:]
	}

	return actions, nil
}

// hold keeps an unfinished escape sequence for the next read to complete, and
// reports whether it did. A sequence that has already filled the whole buffer
// is not held: nothing a key press produces is that long, and waiting on bytes
// there is no room for would leave the picker reading into a full buffer
// forever.
func (kr *keyReader) hold(read []byte) bool {
	if read[0] != keyEscape || len(read) == len(kr.buf) {
		return false
	}

	if _, complete := escapeLen(read); complete {
		return false
	}

	kr.held = copy(kr.buf, read)

	return true
}

// renderItems draws the list in place, one terminal row per item, and closes
// the frame under it while the question is still open. Raw mode does not turn a
// newline into a carriage return, so every row starts at column 0 explicitly
// and clears whatever the previous draw left there.
func renderItems(w io.Writer, items []pickerItem, cursor, width int) {
	for i, item := range items {
		fmt.Fprintf(w, "\r\x1b[K%s\r\n", optionLine(i == cursor, fitLabel(item, width)))
	}

	fmt.Fprintf(w, "\r\x1b[K%s\r\n", closeLine(""))
}

// fitLabel cuts an item to what is left of the row once the margin and the mark
// have taken their columns. The cut happens before the colour is applied, so a
// narrow terminal never truncates an escape sequence half way through.
func fitLabel(item pickerItem, width int) string {
	return truncate(itemLabel(item), width-marginWidth()-len(frameOn+" "))
}

func itemLabel(item pickerItem) string {
	if item.Desc == "" {
		return item.Label
	}

	return item.Label + " - " + item.Desc
}

func moveUp(w io.Writer, lines int) {
	fmt.Fprintf(w, "\x1b[%dA", lines)
}

// eraseBlock rewinds over the given number of rows and clears everything below
// them.
func eraseBlock(w io.Writer, lines int) {
	fmt.Fprintf(w, "\x1b[%dA\r\x1b[J", lines)
}

// truncate cuts a line to the terminal width, one column short of it so that
// the terminal does not wrap the row and throw off the redraw arithmetic.
func truncate(line string, width int) string {
	limit := width - 1
	if limit <= 0 || utf8.RuneCountInString(line) <= limit {
		return line
	}

	return string([]rune(line)[:limit])
}

func terminalWidth(fd int) int {
	width, _, err := term.GetSize(fd)
	if err != nil || width <= 0 {
		return fallbackWidth
	}

	return width
}

// escapeLen is how much of a buffer one escape sequence takes up, and whether
// the buffer held all of it. Both forms a key press produces -- CSI, which is
// ESC '[', and SS3, which is ESC 'O' -- run until a final byte in 0x40-0x7e, so
// their length is only found by scanning for it. Assuming the three bytes of a
// plain arrow key instead would leave the tail of every longer sequence behind
// to be read as further presses: Delete (ESC [ 3 ~) would leave a '~', and Home
// and End in application-cursor mode (ESC O H, ESC O F) would leave "OH" and
// "OF".
//
// A sequence the read cut short is reported incomplete, along with a trailing
// ESC that has nothing behind it yet, so readActions knows to wait for the rest
// of it rather than acting on a partial press.
func escapeLen(buf []byte) (int, bool) {
	// The byte after ESC that says which form this is, and the range the byte
	// ending either form falls in.
	const (
		introducerLen = 2
		finalByteMin  = 0x40
		finalByteMax  = 0x7e
	)

	if len(buf) < introducerLen {
		return 1, false
	}

	if buf[1] != '[' && buf[1] != 'O' {
		return 1, true
	}

	for i := introducerLen; i < len(buf); i++ {
		if buf[i] >= finalByteMin && buf[i] <= finalByteMax {
			return i + 1, true
		}
	}

	return len(buf), false
}
