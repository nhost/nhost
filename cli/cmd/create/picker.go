package create

import (
	"errors"
	"fmt"
	"io"
	"os"
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
	// keyBufferSize is large enough to hold the longest sequence a single key
	// press produces. A plain arrow key is three bytes, but Delete is four
	// (ESC [ 3 ~) and a modified arrow is six (ESC [ 1 ; 5 C), so a buffer of
	// three splits those across reads and decodes the tail as further key
	// presses.
	keyBufferSize = 16
	// csiArrowLen is the length of the arrow-key sequences the picker acts on,
	// which is the least a read has to carry for one to be recognised.
	csiArrowLen = 3
)

// errCancelled ends the command quietly when the user aborts a picker. Raw
// mode delivers ctrl-c as a key press rather than a signal, so the picker has
// to end the process itself.
var errCancelled error = cli.Exit("", 1)

// errNoRawTerminal means stdin cannot be read key by key, which is what the
// arrow-key picker needs. The caller falls back to the numbered prompt.
var errNoRawTerminal = errors.New("stdin is not an interactive terminal")

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
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return -1, errNoRawTerminal
	}

	state, err := term.MakeRaw(fd)
	if err != nil {
		return -1, errNoRawTerminal
	}

	defer func() { _ = term.Restore(fd, state) }()

	out := ce.Stdout()
	width := terminalWidth(fd)

	fmt.Fprintf(out, "\r\x1b[K%s\r\n", barLine())
	fmt.Fprintf(
		out,
		"\r\x1b[K%s\r\n",
		askLine(true, pickerHeading(title))+hintLine("  ↑/↓ to move, enter to select"),
	)
	fmt.Fprint(out, "\x1b[?25l")

	defer fmt.Fprint(out, "\x1b[?25h")

	buf := make([]byte, keyBufferSize)

	for {
		renderItems(out, items, cursor, width)

		action, err := readAction(os.Stdin, buf)
		if err != nil {
			return -1, err
		}

		switch action {
		case actionSelect:
			submitPick(out, pickerHeading(title), items[cursor], len(items), width)

			return cursor, nil
		case actionCancel:
			eraseBlock(out, len(items)+1)

			// Not wrapped: only the framework's own exit sentinel reaches
			// HandleExitCoder, and wrapping it would turn a clean cancel back
			// into a printed error.
			return -1, errCancelled //nolint:wrapcheck
		case actionNone, actionUp, actionDown:
			cursor = moveSelection(cursor, action, len(items))
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
		optionLine(true, truncate(chosen.Label, width-marginWidth()-len(frameOn+" "))),
	)
}

// decodeKey maps the bytes a raw terminal delivers for one key press to the
// action it stands for. A lone escape byte is ignored rather than treated as a
// cancel, because a terminal that splits an arrow key across two reads would
// otherwise abort the command.
func decodeKey(buf []byte) pickerAction {
	if len(buf) == 0 {
		return actionNone
	}

	if len(buf) >= csiArrowLen && buf[0] == keyEscape && buf[1] == '[' {
		switch buf[2] {
		case 'A':
			return actionUp
		case 'B':
			return actionDown
		default:
			return actionNone
		}
	}

	switch buf[0] {
	case '\r', '\n':
		return actionSelect
	case 'k':
		return actionUp
	case 'j':
		return actionDown
	case keyCtrlC, keyCtrlD, 'q':
		return actionCancel
	default:
		return actionNone
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

func readAction(r io.Reader, buf []byte) (pickerAction, error) {
	n, err := r.Read(buf)
	if err != nil {
		return actionNone, fmt.Errorf("failed to read a key press: %w", err)
	}

	return decodeKey(buf[:n]), nil
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
