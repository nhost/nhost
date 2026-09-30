package project

import (
	"unicode/utf8"

	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/cli/clienv"
)

// The picker is drawn in a frame: a bar down the left margin that carries the
// eye from the question to the options under it, and closes once the answer is
// chosen. The question owns one block of it, a symbol and a label on one line
// and the options on the lines below, so a finished run reads as the decision
// it was.
const (
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

// optionLine is one choice in a list, marked when it is the one the cursor is
// on. The mark rather than the position is what says which is selected, so the
// line reads the same once the list is gone and only the answer is left.
func optionLine(selected bool, label string) string {
	if selected {
		return frameMargin(frameBar) + frameGap + frameAnswer(frameOn+" "+label)
	}

	return frameMargin(frameBar) + frameGap + frameMargin(frameOff+" "+label)
}

// closeLine ends the frame, saying what the answer adds up to. An abandoned
// question closes it with nothing, so the corner is all that is drawn.
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

// markWidth is the columns an option's mark takes before its label, counted
// for the same reason: the mark is one column and three bytes.
func markWidth() int {
	return utf8.RuneCountInString(frameOn + " ")
}
