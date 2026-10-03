package create

import (
	"fmt"
	"io"
	"os"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
)

// A create spends nearly all of its wall clock in two waits the user cannot see
// into: cloning the template, and installing the frontend's dependencies. The
// line that closes the frame carries a spinner through both, so the terminal is
// never still while work is happening, and it says which of the two it is
// waiting on rather than only that something is.
const (
	spinnerInterval = 80 * time.Millisecond

	// clearLine returns to the start of the line and wipes it. The label is
	// rewritten in place on every frame, and a shorter one must not leave the
	// tail of a longer one behind it.
	clearLine = "\r\x1b[K"

	// The cursor is parked at the end of a line that redraws ten times a
	// second, so it is hidden for as long as that line is alive.
	hideCursor = "\x1b[?25l"
	showCursor = "\x1b[?25h"

	// labelSeparator joins what the create is making to the step it is on, so
	// that the project's name stays on screen through both of the long waits
	// rather than being replaced by them.
	labelSeparator = " — "

	// spinnerMarkWidth is the columns a frame and the space after it cost,
	// which the label has that much less of.
	spinnerMarkWidth = 2
)

// spinnerFrames is the braille cycle, one dot further round on each frame.
//
//nolint:gochecknoglobals // a constant table; Go has no const array.
var spinnerFrames = [...]string{"⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"}

//nolint:gochecknoglobals // lipgloss styles are built once and reused.
var spinnerMark = lipgloss.NewStyle().
	Foreground(clienv.ANSIColorCyan).
	Render

// progress is how a create says what it is doing while it does it. A terminal
// gets one line that animates and rewrites itself; everything else gets the
// same messages as ordinary lines, so a pipe, a log or a CI transcript still
// reads top to bottom.
//
// A step is worded as the lower-case clause it is on the animated line --
// "fetching template ..." -- because that is where it has to read as part of a
// longer sentence. Standing on its own it is capitalised back into one.
type progress interface {
	update(msg string, a ...any)
	stop()
	// animating reports whether a line is being redrawn in place. A child
	// process writing to the terminal while that is true tears the line, so
	// its output has to be held back until the line is settled.
	animating() bool
}

// newProgress starts reporting. animate is false whenever there is no frame to
// close: a run that was asked nothing printed no frame, and a run whose stdout
// is not a terminal would only be writing escape sequences into a file.
//
//nolint:ireturn // the two reporters differ in kind, not in shape.
func newProgress(ce *clienv.CliEnv, animate bool, settled string) progress {
	if !animate {
		return loggedProgress{ce: ce}
	}

	// Measured from os.Stdout rather than from the writer: animate is only
	// true when that is the terminal this is drawing on.
	s := &spinner{ //nolint:exhaustruct
		out:     ce.Stdout(),
		settled: settled,
		label:   settled,
		width:   terminalWidth(int(os.Stdout.Fd())),
		done:    make(chan struct{}),
	}
	s.start()

	return s
}

// loggedProgress is what a non-interactive create reports through: the steps
// are worth saying either way, and without a terminal they are just lines.
type loggedProgress struct {
	ce *clienv.CliEnv
}

func (p loggedProgress) update(msg string, a ...any) {
	p.ce.Infoln("%s", capitalize(fmt.Sprintf(msg, a...)))
}

// stop has nothing to undo: nothing was drawn that has to be taken back.
func (p loggedProgress) stop() {}

// animating is false, and stays false: these are whole lines, and a child
// process writing its own between them costs nothing.
func (p loggedProgress) animating() bool { return false }

type spinner struct {
	out io.Writer
	// settled is what the line is left saying once the work is done. It is the
	// summary the frame closed on rather than whichever step happened to be
	// last, so the finished run reads as what it made and not as where it
	// stopped looking busy.
	settled string

	// width is the terminal's, taken once. A line that wraps is two rows, and
	// the redraw only ever clears the one the cursor is on, so the label is cut
	// to what fits rather than allowed to spill.
	width int

	// mu guards label alone: update is called from the goroutine doing the
	// work, and the frames are drawn from another.
	mu    sync.Mutex
	label string

	done    chan struct{}
	drawing sync.WaitGroup
	once    sync.Once
}

func (s *spinner) start() {
	fmt.Fprint(s.out, hideCursor)

	s.drawing.Go(func() {
		ticker := time.NewTicker(spinnerInterval)
		defer ticker.Stop()

		// The first frame is drawn before the first tick, so the line is there
		// from the moment the work starts rather than an interval into it.
		for frame := 0; ; frame++ {
			s.render(spinnerFrames[frame%len(spinnerFrames)])

			select {
			case <-s.done:
				return
			case <-ticker.C:
			}
		}
	})
}

func (s *spinner) render(frame string) {
	s.mu.Lock()
	label := s.label
	s.mu.Unlock()

	// Only the label is cut: the frame and the margin are drawn either way,
	// and measuring them here would be counting the escape sequences that
	// colour them.
	label = truncate(label, s.width-marginWidth()-spinnerMarkWidth)

	fmt.Fprint(s.out, clearLine+closeLine(spinnerMark(frame)+" "+label))
}

// update hangs the step off what the create is making, so the line says both:
// the project is named for as long as the work takes, and the step says which
// of the waits it is in.
func (s *spinner) update(msg string, a ...any) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.label = s.settled + labelSeparator + fmt.Sprintf(msg, a...)
}

// animating is true until the line is settled. A stopped spinner no longer
// owns the line, so there is nothing left to hold output back from.
func (s *spinner) animating() bool {
	select {
	case <-s.done:
		return false
	default:
		return true
	}
}

// capitalize starts a clause as a sentence, for the reporter that has nothing
// to hang it off.
func capitalize(s string) string {
	r, size := utf8.DecodeRuneInString(s)
	if r == utf8.RuneError {
		return s
	}

	return string(unicode.ToUpper(r)) + s[size:]
}

// stop ends the animation and leaves the closing line in its finished form, on
// a line of its own so that whatever prints next starts on a clean one.
//
// It is safe to call more than once, and is called more than once: a create
// stops the spinner itself before warning about a failed install, and stops it
// again on the way out.
func (s *spinner) stop() {
	s.once.Do(func() {
		close(s.done)
		// The drawing goroutine owns the line until it returns; writing the
		// settled form before then would race a frame on top of it.
		s.drawing.Wait()

		fmt.Fprint(s.out, clearLine+closeLine(s.settled)+"\n"+showCursor)
	})
}
