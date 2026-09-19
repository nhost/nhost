package create

import (
	"bytes"
	"context"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode/utf8"
)

// newTestSpinner is a spinner drawing into a buffer the test can read, already
// running. Stopping it twice is free, so the cleanup covers a test that fails
// before its own stop.
func newTestSpinner(t *testing.T) (*spinner, *syncBuffer) {
	t.Helper()

	drawn := &syncBuffer{}
	s := &spinner{
		out:     drawn,
		settled: "Creating demo",
		label:   "Creating demo",
		width:   fallbackWidth,
		done:    make(chan struct{}),
	}

	s.start()
	t.Cleanup(s.stop)

	return s, drawn
}

// syncBuffer is a buffer the spinner's drawing goroutine and the test can both
// touch. The spinner writes from a goroutine of its own, so an unguarded buffer
// would be a race rather than a test.
type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.Write(p) //nolint:wrapcheck // a test double; the error is the buffer's own.
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.buf.String()
}

// waitForFrame waits until the spinner has drawn a line carrying want. The
// first frame goes out before the first tick, so this is the interval at worst
// rather than a poll that has to outlast the animation.
func waitForFrame(t *testing.T, out *syncBuffer, want string) {
	t.Helper()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if strings.Contains(out.String(), want) {
			return
		}

		time.Sleep(spinnerInterval / 4)
	}

	t.Fatalf("spinner never drew %q:\n%s", want, out.String())
}

func hasSpinnerFrame(s string) bool {
	for _, frame := range spinnerFrames {
		if strings.Contains(s, frame) {
			return true
		}
	}

	return false
}

// Without a terminal the steps are still worth saying, so they come out as the
// lines they would have been before there was anything to animate. Nothing that
// only a terminal understands may reach a run that is being piped to a file.
func TestProgressWithoutATerminalWritesPlainLines(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	prog := newProgress(newTestEnv(&output), false, "Creating demo")
	prog.update("fetching template %q...", "nextjs-shadcn")
	prog.stop()

	got := output.String()

	// The step is written as the clause a spinner hangs off its label. With no
	// label to hang off it stands alone, so it is said as a sentence.
	if !strings.Contains(got, `Fetching template "nextjs-shadcn"...`) {
		t.Errorf("the step was never said as a sentence:\n%s", got)
	}

	if strings.Contains(got, "\x1b[K") || strings.Contains(got, hideCursor) {
		t.Errorf("escape sequences reached a run with no terminal:\n%q", got)
	}

	// The closing line belongs to the frame, and a run that was asked nothing
	// drew no frame for it to close.
	if strings.Contains(got, "Creating demo") {
		t.Errorf("a frame that was never opened was closed:\n%s", got)
	}
}

// The spinner animates on the frame's closing corner and leaves it there,
// saying what the create set out to do rather than whichever step it happened
// to be on when the work finished.
func TestSpinnerSettlesOnTheClosingLine(t *testing.T) {
	t.Parallel()

	s, out := newTestSpinner(t)

	s.update("fetching template %q...", "nextjs-shadcn")

	// The project stays named through the wait; the step says which wait it is.
	waitForFrame(t, out, `Creating demo — fetching template "nextjs-shadcn"...`)
	s.stop()

	got := out.String()

	if !strings.Contains(got, hideCursor) {
		t.Errorf("the cursor was left blinking on an animating line:\n%q", got)
	}

	if want := clearLine + closeLine("Creating demo") + "\n" + showCursor; !strings.HasSuffix(
		got, want,
	) {
		t.Errorf("spinner settled as %q, want it to end %q", got[max(0, len(got)-120):], want)
	}

	// Whatever the line said mid-flight has to be gone, frame included: the
	// settled line is written over it, not after it.
	settled := got[strings.LastIndex(got, clearLine):]
	if hasSpinnerFrame(settled) {
		t.Errorf("a spinner frame survived the settle: %q", settled)
	}
}

// stop is called twice on the way out of a failed install: once so the warning
// has a clean line to land on, and again by the create's own defer.
func TestSpinnerStopIsIdempotent(t *testing.T) {
	t.Parallel()

	s, out := newTestSpinner(t)

	s.stop()

	settled := out.String()

	s.stop()

	if got := out.String(); got != settled {
		t.Errorf("a second stop drew %q", got[len(settled):])
	}
}

// A line that wraps is two rows, and the redraw only clears the one the cursor
// is on, so a label longer than the terminal is cut rather than left to spill.
func TestSpinnerCutsALabelToTheTerminal(t *testing.T) {
	t.Parallel()

	const width = 40

	out := &syncBuffer{}
	s := &spinner{
		out:     out,
		settled: "Creating demo",
		label:   "Creating demo",
		width:   width,
		done:    make(chan struct{}),
	}

	s.update("fetching template %q at %s...", "nextjs-shadcn", strings.Repeat("a-long-ref", 8))
	s.render(spinnerFrames[0])

	drawn := strings.TrimPrefix(out.String(), clearLine)
	for _, seq := range []string{"\x1b[90m", "\x1b[96m", "\x1b[0m"} {
		drawn = strings.ReplaceAll(drawn, seq, "")
	}

	// One column short of the terminal, so the row cannot wrap on its own.
	if got := utf8.RuneCountInString(drawn); got >= width {
		t.Errorf("spinner drew %d columns into a %d-column terminal: %q", got, width, drawn)
	}

	if !strings.HasPrefix(drawn, closeLine("")+"  ") {
		t.Errorf("the cut took the margin with it: %q", drawn)
	}
}

// A package manager draws its own progress, and it is worth seeing: the
// spinner settles and hands the terminal over rather than fighting it for the
// line.
//
//nolint:paralleltest // mutates the runInstallFn test seam
func TestInstallSettlesTheSpinnerFirst(t *testing.T) {
	stubInstall(t, func(context.Context, string, string) error {
		return nil
	})

	var output bytes.Buffer

	s, drawn := newTestSpinner(t)

	installFrontendDependencies(
		context.Background(),
		newTestEnv(&output),
		s,
		choices{packageManager: "bun", installNow: true},
		t.TempDir(),
	)

	if s.animating() {
		t.Error("the install started with the spinner still holding the line")
	}

	if !strings.HasSuffix(drawn.String(), closeLine("Creating demo")+"\n"+showCursor) {
		t.Errorf("the line was not settled before the handover:\n%q", drawn.String())
	}

	if !strings.Contains(output.String(), "Installing frontend dependencies with bun...") {
		t.Errorf("the install was never announced:\n%s", output.String())
	}
}
