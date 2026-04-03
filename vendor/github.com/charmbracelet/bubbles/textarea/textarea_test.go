package textarea

import (
	"strings"
	"testing"
	"unicode"

	"github.com/MakeNowJust/heredoc"
	"github.com/aymanbagabas/go-udiff"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
)

func TestVerticalScrolling(t *testing.T) {
	textarea := newTextArea()
	textarea.Prompt = ""
	textarea.ShowLineNumbers = false
	textarea.SetHeight(1)
	textarea.SetWidth(20)
	textarea.CharLimit = 100

	textarea, _ = textarea.Update(nil)

	input := "This is a really long line that should wrap around the text area."

	for _, k := range input {
		textarea, _ = textarea.Update(keyPress(k))
	}

	view := textarea.View()

	// The view should contain the first "line" of the input.
	if !strings.Contains(view, "This is a really") {
		t.Log(view)
		t.Error("Text area did not render the input")
	}

	// But we should be able to scroll to see the next line.
	// Let's scroll down for each line to view the full input.
	lines := []string{
		"long line that",
		"should wrap around",
		"the text area.",
	}
	for _, line := range lines {
		textarea.viewport.ScrollDown(1)
		view = textarea.View()
		if !strings.Contains(view, line) {
			t.Log(view)
			t.Error("Text area did not render the correct scrolled input")
		}
	}
}

func TestWordWrapOverflowing(t *testing.T) {
	// An interesting edge case is when the user enters many words that fill up
	// the text area and then goes back up and inserts a few words which causes
	// a cascading wrap and causes an overflow of the last line.
	//
	// In this case, we should not let the user insert more words if, after the
	// entire wrap is complete, the last line is overflowing.
	textarea := newTextArea()

	textarea.SetHeight(3)
	textarea.SetWidth(20)
	textarea.CharLimit = 500

	textarea, _ = textarea.Update(nil)

	input := "Testing Testing Testing Testing Testing Testing Testing Testing"

	for _, k := range input {
		textarea, _ = textarea.Update(keyPress(k))
		textarea.View()
	}

	// We have essentially filled the text area with input.
	// Let's see if we can cause wrapping to overflow the last line.
	textarea.row = 0
	textarea.col = 0

	input = "Testing"

	for _, k := range input {
		textarea, _ = textarea.Update(keyPress(k))
		textarea.View()
	}

	lastLineWidth := textarea.LineInfo().Width
	if lastLineWidth > 20 {
		t.Log(lastLineWidth)
		t.Log(textarea.View())
		t.Fail()
	}
}

func TestValueSoftWrap(t *testing.T) {
	textarea := newTextArea()
	textarea.SetWidth(16)
	textarea.SetHeight(10)
	textarea.CharLimit = 500

	textarea, _ = textarea.Update(nil)

	input := "Testing Testing Testing Testing Testing Testing Testing Testing"

	for _, k := range []rune(input) {
		textarea, _ = textarea.Update(keyPress(k))
		textarea.View()
	}

	value := textarea.Value()
	if value != input {
		t.Log(value)
		t.Log(input)
		t.Fatal("The text area does not have the correct value")
	}
}

func TestSetValue(t *testing.T) {
	textarea := newTextArea()
	textarea.SetValue(strings.Join([]string{"Foo", "Bar", "Baz"}, "\n"))

	if textarea.row != 2 && textarea.col != 3 {
		t.Log(textarea.row, textarea.col)
		t.Fatal("Cursor Should be on row 2 column 3 after inserting 2 new lines")
	}

	value := textarea.Value()
	if value != "Foo\nBar\nBaz" {
		t.Fatal("Value should be Foo\nBar\nBaz")
	}

	// SetValue should reset text area
	textarea.SetValue("Test")
	value = textarea.Value()
	if value != "Test" {
		t.Log(value)
		t.Fatal("Text area was not reset when SetValue() was called")
	}
}

func TestInsertString(t *testing.T) {
	textarea := newTextArea()

	// Insert some text
	input := "foo baz"

	for _, k := range []rune(input) {
		textarea, _ = textarea.Update(keyPress(k))
	}

	// Put cursor in the middle of the text
	textarea.col = 4

	textarea.InsertString("bar ")

	value := textarea.Value()
	if value != "foo bar baz" {
		t.Log(value)
		t.Fatal("Expected insert string to insert bar between foo and baz")
	}
}

func TestCanHandleEmoji(t *testing.T) {
	textarea := newTextArea()
	input := "🧋"

	for _, k := range []rune(input) {
		textarea, _ = textarea.Update(keyPress(k))
	}

	value := textarea.Value()
	if value != input {
		t.Log(value)
		t.Fatal("Expected emoji to be inserted")
	}

	input = "🧋🧋🧋"

	textarea.SetValue(input)

	value = textarea.Value()
	if value != input {
		t.Log(value)
		t.Fatal("Expected emoji to be inserted")
	}

	if textarea.col != 3 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the third character")
	}

	if charOffset := textarea.LineInfo().CharOffset; charOffset != 6 {
		t.Log(charOffset)
		t.Fatal("Expected cursor to be on the sixth character")
	}
}

func TestVerticalNavigationKeepsCursorHorizontalPosition(t *testing.T) {
	textarea := newTextArea()
	textarea.SetWidth(20)

	textarea.SetValue(strings.Join([]string{"你好你好", "Hello"}, "\n"))

	textarea.row = 0
	textarea.col = 2

	// 你好|你好
	// Hell|o
	// 1234|

	// Let's imagine our cursor is on the first line where the pipe is.
	// We press the down arrow to get to the next line.
	// The issue is that if we keep the cursor on the same column, the cursor will jump to after the `e`.
	//
	// 你好|你好
	// He|llo
	//
	// But this is wrong because visually we were at the 4th character due to
	// the first line containing double-width runes.
	// We want to keep the cursor on the same visual column.
	//
	// 你好|你好
	// Hell|o
	//
	// This test ensures that the cursor is kept on the same visual column by
	// ensuring that the column offset goes from 2 -> 4.

	lineInfo := textarea.LineInfo()
	if lineInfo.CharOffset != 4 || lineInfo.ColumnOffset != 2 {
		t.Log(lineInfo.CharOffset)
		t.Log(lineInfo.ColumnOffset)
		t.Fatal("Expected cursor to be on the fourth character because there are two double width runes on the first line.")
	}

	downMsg := tea.KeyMsg{Type: tea.KeyDown, Alt: false, Runes: []rune{}}
	textarea, _ = textarea.Update(downMsg)

	lineInfo = textarea.LineInfo()
	if lineInfo.CharOffset != 4 || lineInfo.ColumnOffset != 4 {
		t.Log(lineInfo.CharOffset)
		t.Log(lineInfo.ColumnOffset)
		t.Fatal("Expected cursor to be on the fourth character because we came down from the first line.")
	}
}

func TestVerticalNavigationShouldRememberPositionWhileTraversing(t *testing.T) {
	textarea := newTextArea()
	textarea.SetWidth(40)

	// Let's imagine we have a text area with the following content:
	//
	// Hello
	// World
	// This is a long line.
	//
	// If we are at the end of the last line and go up, we should be at the end
	// of the second line.
	// And, if we go up again we should be at the end of the first line.
	// But, if we go back down twice, we should be at the end of the last line
	// again and not the fifth (length of second line) character of the last line.
	//
	// In other words, we should remember the last horizontal position while
	// traversing vertically.

	textarea.SetValue(strings.Join([]string{"Hello", "World", "This is a long line."}, "\n"))

	// We are at the end of the last line.
	if textarea.col != 20 || textarea.row != 2 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the 20th character of the last line")
	}

	// Let's go up.
	upMsg := tea.KeyMsg{Type: tea.KeyUp, Alt: false, Runes: []rune{}}
	textarea, _ = textarea.Update(upMsg)

	// We should be at the end of the second line.
	if textarea.col != 5 || textarea.row != 1 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the 5th character of the second line")
	}

	// And, again.
	textarea, _ = textarea.Update(upMsg)

	// We should be at the end of the first line.
	if textarea.col != 5 || textarea.row != 0 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the 5th character of the first line")
	}

	// Let's go down, twice.
	downMsg := tea.KeyMsg{Type: tea.KeyDown, Alt: false, Runes: []rune{}}
	textarea, _ = textarea.Update(downMsg)
	textarea, _ = textarea.Update(downMsg)

	// We should be at the end of the last line.
	if textarea.col != 20 || textarea.row != 2 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the 20th character of the last line")
	}

	// Now, for correct behavior, if we move right or left, we should forget
	// (reset) the saved horizontal position. Since we assume the user wants to
	// keep the cursor where it is horizontally. This is how most text areas
	// work.

	textarea, _ = textarea.Update(upMsg)
	leftMsg := tea.KeyMsg{Type: tea.KeyLeft, Alt: false, Runes: []rune{}}
	textarea, _ = textarea.Update(leftMsg)

	if textarea.col != 4 || textarea.row != 1 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the 5th character of the second line")
	}

	// Going down now should keep us at the 4th column since we moved left and
	// reset the horizontal position saved state.
	textarea, _ = textarea.Update(downMsg)
	if textarea.col != 4 || textarea.row != 2 {
		t.Log(textarea.col)
		t.Fatal("Expected cursor to be on the 4th character of the last line")
	}
}

func TestView(t *testing.T) {
	t.Parallel()

	type want struct {
		view      string
		cursorRow int
		cursorCol int
	}

	tests := []struct {
		name      string
		modelFunc func(Model) Model
		want      want
	}{
		{
			name: "placeholder",
			want: want{
				view: heredoc.Doc(`
					>   1 Hello, World!
					>
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "single line",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line")

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 the first line
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 14,
			},
		},
		{
			name: "multiple lines",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line\nthe second line\nthe third line")

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 the first line
					>   2 the second line
					>   3 the third line
					>
					>
					>
				`),
				cursorRow: 2,
				cursorCol: 14,
			},
		},
		{
			name: "single line without line numbers",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line")
				m.ShowLineNumbers = false

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> the first line
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 14,
			},
		},
		{
			name: "multipline lines without line numbers",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line\nthe second line\nthe third line")
				m.ShowLineNumbers = false

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> the first line
					> the second line
					> the third line
					>
					>
					>
				`),
				cursorRow: 2,
				cursorCol: 14,
			},
		},
		{
			name: "single line and custom end of buffer character",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line")
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 the first line
					> *
					> *
					> *
					> *
					> *
				`),
				cursorRow: 0,
				cursorCol: 14,
			},
		},
		{
			name: "multiple lines and custom end of buffer character",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line\nthe second line\nthe third line")
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 the first line
					>   2 the second line
					>   3 the third line
					> *
					> *
					> *
				`),
				cursorRow: 2,
				cursorCol: 14,
			},
		},
		{
			name: "single line without line numbers and custom end of buffer character",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line")
				m.ShowLineNumbers = false
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> the first line
					> *
					> *
					> *
					> *
					> *
				`),
				cursorRow: 0,
				cursorCol: 14,
			},
		},
		{
			name: "multiple lines without line numbers and custom end of buffer character",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line\nthe second line\nthe third line")
				m.ShowLineNumbers = false
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> the first line
					> the second line
					> the third line
					> *
					> *
					> *
				`),
				cursorRow: 2,
				cursorCol: 14,
			},
		},
		{
			name: "single line and custom prompt",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line")
				m.Prompt = "* "

				return m
			},
			want: want{
				view: heredoc.Doc(`
					*   1 the first line
					*
					*
					*
					*
					*
				`),
				cursorRow: 0,
				cursorCol: 14,
			},
		},
		{
			name: "multiple lines and custom prompt",
			modelFunc: func(m Model) Model {
				m.SetValue("the first line\nthe second line\nthe third line")
				m.Prompt = "* "

				return m
			},
			want: want{
				view: heredoc.Doc(`
					*   1 the first line
					*   2 the second line
					*   3 the third line
					*
					*
					*
				`),
				cursorRow: 2,
				cursorCol: 14,
			},
		},
		{
			name: "type single line",
			modelFunc: func(m Model) Model {
				input := "foo"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 foo
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 3,
			},
		},
		{
			name: "type multiple lines",
			modelFunc: func(m Model) Model {
				input := "foo\nbar\nbaz"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 foo
					>   2 bar
					>   3 baz
					>
					>
					>
				`),
				cursorRow: 2,
				cursorCol: 3,
			},
		},
		{
			name: "softwrap",
			modelFunc: func(m Model) Model {
				m.ShowLineNumbers = false
				m.Prompt = ""
				m.SetWidth(5)

				input := "foo bar baz"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					foo
					bar
					baz



				`),
				cursorRow: 2,
				cursorCol: 3,
			},
		},
		{
			name: "single line character limit",
			modelFunc: func(m Model) Model {
				m.CharLimit = 7

				input := "foo bar baz"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 foo bar
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 7,
			},
		},
		{
			name: "multiple lines character limit",
			modelFunc: func(m Model) Model {
				m.CharLimit = 19

				input := "foo bar baz\nfoo bar baz"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 foo bar baz
					>   2 foo bar
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 7,
			},
		},
		{
			name: "set width",
			modelFunc: func(m Model) Model {
				m.SetWidth(10)

				input := "12"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 12
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 2,
			},
		},
		{
			name: "set width max length text minus one",
			modelFunc: func(m Model) Model {
				m.SetWidth(10)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 123
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 3,
			},
		},
		{
			name: "set width max length text",
			modelFunc: func(m Model) Model {
				m.SetWidth(10)

				input := "1234"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 1234
					>
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 0,
			},
		},
		{
			name: "set width max length text plus one",
			modelFunc: func(m Model) Model {
				m.SetWidth(10)

				input := "12345"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 1234
					>     5
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 1,
			},
		},
		{
			name: "set width set max width minus one",
			modelFunc: func(m Model) Model {
				m.MaxWidth = 10
				m.SetWidth(11)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 123
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 3,
			},
		},
		{
			name: "set width set max width",
			modelFunc: func(m Model) Model {
				m.MaxWidth = 10
				m.SetWidth(11)

				input := "1234"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 1234
					>
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 0,
			},
		},
		{
			name: "set width set max width plus one",
			modelFunc: func(m Model) Model {
				m.MaxWidth = 10
				m.SetWidth(11)

				input := "12345"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 1234
					>     5
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 1,
			},
		},
		{
			name: "set width min width minus one",
			modelFunc: func(m Model) Model {
				m.SetWidth(6)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 1
					>     2
					>     3
					>
					>
					>
				`),
				cursorRow: 3,
				cursorCol: 0,
			},
		},
		{
			name: "set width min width",
			modelFunc: func(m Model) Model {
				m.SetWidth(7)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 1
					>     2
					>     3
					>
					>
					>
				`),
				cursorRow: 3,
				cursorCol: 0,
			},
		},
		{
			name: "set width min width no line numbers",
			modelFunc: func(m Model) Model {
				m.ShowLineNumbers = false
				m.SetWidth(0)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 1
					> 2
					> 3
					>
					>
					>
				`),
				cursorRow: 3,
				cursorCol: 0,
			},
		},
		{
			name: "set width min width no line numbers no prompt",
			modelFunc: func(m Model) Model {
				m.ShowLineNumbers = false
				m.Prompt = ""
				m.SetWidth(0)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					1
					2
					3



				`),
				cursorRow: 3,
				cursorCol: 0,
			},
		},
		{
			name: "set width min width plus one",
			modelFunc: func(m Model) Model {
				m.SetWidth(8)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 12
					>     3
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 1,
			},
		},
		{
			name: "set width without line numbers max length text minus one",
			modelFunc: func(m Model) Model {
				m.ShowLineNumbers = false
				m.SetWidth(6)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 123
					>
					>
					>
					>
					>
				`),
				cursorRow: 0,
				cursorCol: 3,
			},
		},
		{
			name: "set width without line numbers max length text",
			modelFunc: func(m Model) Model {
				m.ShowLineNumbers = false
				m.SetWidth(6)

				input := "1234"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 1234
					>
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 0,
			},
		},
		{
			name: "set width without line numbers max length text plus one",
			modelFunc: func(m Model) Model {
				m.ShowLineNumbers = false
				m.SetWidth(6)

				input := "12345"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 1234
					> 5
					>
					>
					>
					>
				`),
				cursorRow: 1,
				cursorCol: 1,
			},
		},
		{
			name: "set width with style",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.SetWidth(12)

				input := "1"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│>   1 1   │
					│>         │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 0,
				cursorCol: 1,
			},
		},
		{
			name: "set width with style max width minus one",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.SetWidth(12)

				input := "123"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│>   1 123 │
					│>         │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 0,
				cursorCol: 3,
			},
		},
		{
			name: "set width with style max width",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.SetWidth(12)

				input := "1234"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│>   1 1234│
					│>         │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 1,
				cursorCol: 0,
			},
		},
		{
			name: "set width with style max width plus one",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.SetWidth(12)

				input := "12345"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│>   1 1234│
					│>     5   │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 1,
				cursorCol: 1,
			},
		},
		{
			name: "set width without line numbers with style",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.ShowLineNumbers = false
				m.SetWidth(12)

				input := "123456"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│> 123456  │
					│>         │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 0,
				cursorCol: 6,
			},
		},
		{
			name: "set width without line numbers with style max width minus one",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.ShowLineNumbers = false
				m.SetWidth(12)

				input := "1234567"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│> 1234567 │
					│>         │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 0,
				cursorCol: 7,
			},
		},
		{
			name: "set width without line numbers with style max width",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.ShowLineNumbers = false
				m.SetWidth(12)

				input := "12345678"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│> 12345678│
					│>         │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 1,
				cursorCol: 0,
			},
		},
		{
			name: "set width without line numbers with style max width plus one",
			modelFunc: func(m Model) Model {
				m.FocusedStyle.Base = lipgloss.NewStyle().Border(lipgloss.NormalBorder())
				m.Focus()

				m.ShowLineNumbers = false
				m.SetWidth(12)

				input := "123456789"
				m = sendString(m, input)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					┌──────────┐
					│> 12345678│
					│> 9       │
					│>         │
					│>         │
					│>         │
					│>         │
					└──────────┘
				`),
				cursorRow: 1,
				cursorCol: 1,
			},
		},
		{
			name: "placeholder min width",
			modelFunc: func(m Model) Model {
				m.SetWidth(0)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 H
					>     e
					>     l
					>     l
					>     o
					>     ,
				`),
			},
		},
		{
			name: "placeholder single line",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line"
				m.ShowLineNumbers = false

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> placeholder the first line
					>
					>
					>
					>
					>
					`),
			},
		},
		{
			name: "placeholder multiple lines",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line\nplaceholder the second line\nplaceholder the third line"
				m.ShowLineNumbers = false

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> placeholder the first line
					> placeholder the second line
					> placeholder the third line
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line with line numbers",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line"
				m.ShowLineNumbers = true

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 placeholder the first line
					>
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines with line numbers",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line\nplaceholder the second line\nplaceholder the third line"
				m.ShowLineNumbers = true

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 placeholder the first line
					>     placeholder the second line
					>     placeholder the third line
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line with end of buffer character",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line"
				m.ShowLineNumbers = false
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> placeholder the first line
					> *
					> *
					> *
					> *
					> *
				`),
			},
		},
		{
			name: "placeholder multiple lines with with end of buffer character",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line\nplaceholder the second line\nplaceholder the third line"
				m.ShowLineNumbers = false
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> placeholder the first line
					> placeholder the second line
					> placeholder the third line
					> *
					> *
					> *
				`),
			},
		},
		{
			name: "placeholder single line with line numbers and end of buffer character",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line"
				m.ShowLineNumbers = true
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 placeholder the first line
					> *
					> *
					> *
					> *
					> *
				`),
			},
		},
		{
			name: "placeholder multiple lines with line numbers and end of buffer character",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line\nplaceholder the second line\nplaceholder the third line"
				m.ShowLineNumbers = true
				m.EndOfBufferCharacter = '*'

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 placeholder the first line
					>     placeholder the second line
					>     placeholder the third line
					> *
					> *
					> *
				`),
			},
		},
		{
			name: "placeholder single line that is longer than max width",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line that is longer than the max width"
				m.SetWidth(40)
				m.ShowLineNumbers = false

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> placeholder the first line that is
					> longer than the max width
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines that are longer than max width",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line that is longer than the max width\nplaceholder the second line that is longer than the max width"
				m.ShowLineNumbers = false
				m.SetWidth(40)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> placeholder the first line that is
					> longer than the max width
					> placeholder the second line that is
					> longer than the max width
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line that is longer than max width with line numbers",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line that is longer than the max width"
				m.ShowLineNumbers = true
				m.SetWidth(40)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 placeholder the first line that is
					>     longer than the max width
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines that are longer than max width with line numbers",
			modelFunc: func(m Model) Model {
				m.Placeholder = "placeholder the first line that is longer than the max width\nplaceholder the second line that is longer than the max width"
				m.ShowLineNumbers = true
				m.SetWidth(40)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 placeholder the first line that is
					>     longer than the max width
					>     placeholder the second line that
					>     is longer than the max width
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line that is longer than max width at limit",
			modelFunc: func(m Model) Model {
				m.Placeholder = "123456789012345678"
				m.ShowLineNumbers = false
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 123456789012345678
					>
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line that is longer than max width at limit plus one",
			modelFunc: func(m Model) Model {
				m.Placeholder = "1234567890123456789"
				m.ShowLineNumbers = false
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 123456789012345678
					> 9
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line that is longer than max width with line numbers at limit",
			modelFunc: func(m Model) Model {
				m.Placeholder = "12345678901234"
				m.ShowLineNumbers = true
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 12345678901234
					>
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder single line that is longer than max width with line numbers at limit plus one",
			modelFunc: func(m Model) Model {
				m.Placeholder = "123456789012345"
				m.ShowLineNumbers = true
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 12345678901234
					>     5
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines that are longer than max width at limit",
			modelFunc: func(m Model) Model {
				m.Placeholder = "123456789012345678\n123456789012345678"
				m.ShowLineNumbers = false
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 123456789012345678
					> 123456789012345678
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines that are longer than max width at limit plus one",
			modelFunc: func(m Model) Model {
				m.Placeholder = "1234567890123456789\n1234567890123456789"
				m.ShowLineNumbers = false
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					> 123456789012345678
					> 9
					> 123456789012345678
					> 9
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines that are longer than max width with line numbers at limit",
			modelFunc: func(m Model) Model {
				m.Placeholder = "12345678901234\n12345678901234"
				m.ShowLineNumbers = true
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 12345678901234
					>     12345678901234
					>
					>
					>
					>
				`),
			},
		},
		{
			name: "placeholder multiple lines that are longer than max width with line numbers at limit plus one",
			modelFunc: func(m Model) Model {
				m.Placeholder = "123456789012345\n123456789012345"
				m.ShowLineNumbers = true
				m.SetWidth(20)

				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 12345678901234
					>     5
					>     12345678901234
					>     5
					>
					>
				`),
			},
		},
		{
			name: "placeholder chinese character",
			modelFunc: func(m Model) Model {
				m.Placeholder = "输入消息..."
				m.ShowLineNumbers = true
				m.SetWidth(20)
				return m
			},
			want: want{
				view: heredoc.Doc(`
					>   1 输入消息...
					>
					>
					>
					>
					>

				`),
			},
		},
	}

	for _, tt := range tests {
		tt := tt

		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			textarea := newTextArea()

			if tt.modelFunc != nil {
				textarea = tt.modelFunc(textarea)
			}

			view := stripString(textarea.View())
			wantView := stripString(tt.want.view)

			if view != wantView {
				t.Log(udiff.Unified("expected", "got", wantView, view))
				t.Fatalf("Want:\n%v\nGot:\n%v\n", wantView, view)
			}

			cursorRow := textarea.cursorLineNumber()
			cursorCol := textarea.LineInfo().ColumnOffset
			if tt.want.cursorRow != cursorRow || tt.want.cursorCol != cursorCol {
				format := "Want cursor at row: %v, col: %v Got: row: %v col: %v\n"
				t.Fatalf(format, tt.want.cursorRow, tt.want.cursorCol, cursorRow, cursorCol)
			}
		})
	}
}

func newTextArea() Model {
	textarea := New()

	textarea.Prompt = "> "
	textarea.Placeholder = "Hello, World!"

	textarea.Focus()

	textarea, _ = textarea.Update(nil)

	return textarea
}

func keyPress(key rune) tea.Msg {
	return tea.KeyMsg{Type: tea.KeyRunes, Runes: []rune{key}, Alt: false}
}

func sendString(m Model, str string) Model {
	for _, k := range []rune(str) {
		m, _ = m.Update(keyPress(k))
	}

	return m
}

func stripString(str string) string {
	s := ansi.Strip(str)
	ss := strings.Split(s, "\n")

	var lines []string
	for _, l := range ss {
		trim := strings.TrimRightFunc(l, unicode.IsSpace)
		if trim != "" {
			lines = append(lines, trim)
		}
	}

	return strings.Join(lines, "\n")
}
