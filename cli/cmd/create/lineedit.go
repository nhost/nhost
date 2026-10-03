package create

import (
	"fmt"
	"io"
	"os"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/term"

	"github.com/nhost/nhost/cli/clienv"
)

const (
	keyBackspace    = 127
	keyBackspaceAlt = 8
	keyCtrlU        = 21

	// editBufferSize is large enough that a pasted line arrives as one read
	// rather than a burst the redraw has to keep up with.
	editBufferSize = 1024
)

// editAction is how a read of the terminal ended: with the answer given, with
// the command abandoned, or with neither, which means keep editing.
type editAction int

const (
	editNone editAction = iota
	editSubmit
	editCancel
)

// editLine asks for one line, showing the default in place of the answer until
// there is one. Enter takes the default, and typing replaces it rather than
// adding to it, which is what makes it a placeholder rather than a head start:
// the name is derived from the directory the command was pointed at, so it is
// being offered, not imposed.
//
// It needs raw mode to draw the line as it is typed, so a terminal that will
// not give it up falls back to a plain prompt.
func editLine(ce *clienv.CliEnv, label, defaultValue string) (string, error) {
	fd := int(os.Stdin.Fd())
	if !term.IsTerminal(fd) {
		return "", errNoRawTerminal
	}

	state, err := term.MakeRaw(fd)
	if err != nil {
		return "", errNoRawTerminal
	}

	defer func() { _ = term.Restore(fd, state) }()

	out := ce.Stdout()
	width := terminalWidth(fd)

	// Empty means the placeholder is still standing in for an answer, so enter
	// takes the default and the first keystroke starts a fresh one.
	var value []rune

	fmt.Fprintf(out, "\r\x1b[K%s\r\n", barLine())
	fmt.Fprintf(out, "\r\x1b[K%s\r\n", askLine(true, label))

	buf := make([]byte, editBufferSize)

	for {
		renderEdit(out, value, defaultValue, width)

		var ending editAction

		value, ending, err = readEdit(os.Stdin, buf, value)
		if err != nil {
			return "", err
		}

		switch ending {
		case editSubmit:
			answer := strings.TrimSpace(string(value))
			if answer == "" {
				answer = defaultValue
			}

			submitEdit(out, label, answer)

			return answer, nil
		case editCancel:
			// Not wrapped, for the same reason the picker does not wrap it:
			// only the framework's own exit sentinel reaches HandleExitCoder.
			return "", errCancelled
		case editNone:
		}
	}
}

// renderEdit draws the answer being typed and the end of the frame under it,
// then puts the cursor back where the next character goes. With nothing typed
// the default is drawn in its place, dimmed so it reads as the offer it is, and
// the cursor sits at the front of it. Raw mode leaves the carriage return to
// the writer, so every row starts at column 0 explicitly.
func renderEdit(w io.Writer, value []rune, defaultValue string, width int) {
	text := truncate(string(value), width-marginWidth())
	if len(value) == 0 {
		text = placeholder(truncate(defaultValue, width-marginWidth()))
	}

	fmt.Fprintf(w, "\r\x1b[K%s\r\n", answerLine(text))
	fmt.Fprintf(w, "\r\x1b[K%s\r\n", closeLine(""))

	// Two rows back up to the answer, then right to the end of what is typed.
	fmt.Fprintf(w, "\x1b[2A\r\x1b[%dC", marginWidth()+len(value))
}

// submitEdit replaces the block the editor drew with the answered form of it:
// the question marked as answered, the answer under it, and no end of frame,
// because the next question continues the same one.
func submitEdit(w io.Writer, label, answer string) {
	fmt.Fprintf(
		w,
		"\r\x1b[1A\x1b[J%s\r\n%s\r\n",
		askLine(false, label),
		answerLine(answer),
	)
}

// readEdit folds one read of the terminal into the answer so far.
func readEdit(r io.Reader, buf []byte, value []rune) ([]rune, editAction, error) {
	n, err := r.Read(buf)
	if err != nil {
		return value, editNone, fmt.Errorf("failed to read a key press: %w", err)
	}

	value, action := applyEdits(value, buf[:n])

	return value, action, nil
}

// applyEdits works through a read key by key rather than reading the first byte
// and taking it for the whole thing. One read is not one key press: a paste, or
// a fast enough typist, delivers a burst, and a backspace in the middle of one
// has to erase rather than be dropped as unprintable.
//
// An escape sequence is swallowed whole so that an arrow key does not leave its
// bracket and letter in the answer, and the first key that ends the editing
// stops the fold, so nothing pasted after a newline is read as more answer.
func applyEdits(value []rune, buf []byte) ([]rune, editAction) {
	for i := 0; i < len(buf); {
		switch buf[i] {
		case '\r', '\n':
			return value, editSubmit
		case keyCtrlC, keyCtrlD:
			return value, editCancel
		case keyEscape:
			n, _ := escapeLen(buf[i:])
			i += n

			continue
		case keyBackspace, keyBackspaceAlt:
			if len(value) > 0 {
				value = value[:len(value)-1]
			}

			i++

			continue
		case keyCtrlU:
			value = value[:0]
			i++

			continue
		}

		r, size := utf8.DecodeRune(buf[i:])
		if unicode.IsPrint(r) && (r != utf8.RuneError || size > 1) {
			value = append(value, r)
		}

		i += size
	}

	return value, editNone
}

// escapeLen is how much of a buffer one escape sequence takes up, and whether
// the buffer held all of it. Both forms a key press produces -- CSI, which is
// ESC '[', and SS3, which is ESC 'O' -- run until a final byte in 0x40-0x7e, so
// their length is only found by scanning for it. Assuming the three bytes of a
// plain arrow key instead left the tail of every longer sequence in the answer:
// Delete (ESC [ 3 ~) added a '~', and Home and End in application-cursor mode
// (ESC O H, ESC O F) added "OH" and "OF", which validateName accepts, so the
// project was silently named after a keystroke.
//
// A sequence the read cut short is reported incomplete, along with a trailing
// ESC that has nothing behind it yet, so a caller that can wait for the rest of
// it -- readActions -- knows to. A caller that cannot, applyEdits, takes the
// length and ignores the press, as it does for a lone escape byte and for an
// ESC that introduces neither form.
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
