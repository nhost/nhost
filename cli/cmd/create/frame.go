package create

import (
	"unicode/utf8"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
)

// The prompts are drawn in a frame: a bar down the left margin that opens on
// the first question, carries the eye from one answer to the next, and closes
// when there is nothing left to ask. Each question owns one block of it, a
// symbol and a label on one line and the answer on the next, so a finished run
// reads as the list of decisions it was.
const (
	frameOpen   = "┌"
	frameBar    = "│"
	frameClose  = "└"
	frameAsking = "◆"
	frameAsked  = "◇"
	frameOn     = "●"
	frameOff    = "○"

	// frameGap separates the margin from what a line says. Two spaces is what
	// lines the bar up under the symbols, since both are one column wide.
	frameGap = "  "
)

//nolint:gochecknoglobals // lipgloss styles are built once and reused.
var (
	frameMargin = lipgloss.NewStyle().
			Foreground(clienv.ANSIColorGray).
			Render

	frameAskingMark = lipgloss.NewStyle().
			Foreground(clienv.ANSIColorCyan).
			Render

	frameAskedMark = lipgloss.NewStyle().
			Foreground(clienv.ANSIColorGreen).
			Render

	frameAnswer = lipgloss.NewStyle().
			Foreground(clienv.ANSIColorCyan).
			Bold(true).
			Render
)

// openLine starts the frame, naming what is being set up.
func openLine(title string) string {
	return frameMargin(frameOpen) + frameGap + title
}

// barLine is the length of margin between one block and the next.
func barLine() string {
	return frameMargin(frameBar)
}

// askLine is a question, asking while it is the one being answered and answered
// once the user has moved on.
func askLine(asking bool, label string) string {
	mark := frameAskedMark(frameAsked)
	if asking {
		mark = frameAskingMark(frameAsking)
	}

	return mark + frameGap + label + ":"
}

// hintLine is the aside a question carries while it is open, telling the user
// which keys it answers to. It goes dim, and it goes away with the question.
func hintLine(text string) string {
	return frameMargin(text)
}

// placeholder is an answer the user has not given yet, dimmed so that it reads
// as the offer it is rather than as something already typed.
func placeholder(text string) string {
	return frameMargin(text)
}

// answerLine is what a question was answered with, on the margin under it.
func answerLine(text string) string {
	return frameMargin(frameBar) + frameGap + text
}

// optionLine is one choice in a list, marked when it is the one the cursor is
// on. The mark rather than the position is what says which is selected, so the
// line reads the same once the list is gone and only the answer is left.
func optionLine(selected bool, label string) string {
	if selected {
		return frameMargin(frameBar) + frameGap + frameAnswer(frameOn+" "+label)
	}

	return frameMargin(frameBar) + frameGap + frameMargin(frameOff+" "+label)
}

// closeLine ends the frame, saying what the answers add up to. An open question
// closes it with nothing, so the corner is all that is drawn.
func closeLine(text string) string {
	if text == "" {
		return frameMargin(frameClose)
	}

	return frameMargin(frameClose) + frameGap + text
}

// marginWidth is the columns a frame line spends on its margin before it says
// anything, which the cursor arithmetic in raw mode has to account for. The bar
// is one column and three bytes, so this is counted rather than measured.
func marginWidth() int {
	return utf8.RuneCountInString(frameBar + frameGap)
}
