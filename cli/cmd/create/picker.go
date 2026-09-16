package create

import (
	"errors"
	"fmt"
	"io"
	"os"
	"unicode/utf8"

	"github.com/charmbracelet/lipgloss"
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
	// keyBufferSize holds the longest sequence a single key press produces,
	// which is the three bytes of an arrow key.
	keyBufferSize = 3
)

//nolint:gochecknoglobals // A lipgloss style is built once and reused.
var (
	pickerTitle = lipgloss.NewStyle().
			Foreground(clienv.ANSIColorCyan).
			Render

	pickerSelected = lipgloss.NewStyle().
			Foreground(clienv.ANSIColorCyan).
			Bold(true).
			Render
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

	fmt.Fprintf(out, "\r\n\x1b[K%s\r\n", pickerTitle(title+" (↑/↓ to move, enter to select)"))
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
			eraseBlock(out, len(items)+1)

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

		moveUp(out, len(items))
	}
}

// decodeKey maps the bytes a raw terminal delivers for one key press to the
// action it stands for. A lone escape byte is ignored rather than treated as a
// cancel, because a terminal that splits an arrow key across two reads would
// otherwise abort the command.
func decodeKey(buf []byte) pickerAction {
	if len(buf) == 0 {
		return actionNone
	}

	if len(buf) >= keyBufferSize && buf[0] == keyEscape && buf[1] == '[' {
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

// renderItems draws the list in place, one terminal row per item. Raw mode
// does not turn a newline into a carriage return, so every row starts at
// column 0 explicitly and clears whatever the previous draw left there.
func renderItems(w io.Writer, items []pickerItem, cursor, width int) {
	for i, item := range items {
		line := "  " + itemLabel(item)
		if i == cursor {
			line = pickerSelected(truncate("> "+itemLabel(item), width))
		} else {
			line = truncate(line, width)
		}

		fmt.Fprintf(w, "\r\x1b[K%s\r\n", line)
	}
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
