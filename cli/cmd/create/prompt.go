package create

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/nhost/nhost/cli/clienv"
)

//nolint:gochecknoglobals // Test seams for the interactive prompts.
var (
	runPrompt  = promptLine
	runConfirm = promptConfirm
	runPicker  = promptPick
)

// pickerItem is one selectable option in a numbered prompt.
type pickerItem struct {
	Label string
	Desc  string
}

// promptLine asks for a single line of input, returning defaultValue when the
// answer is empty. It prefers the frame's editor, which starts with the default
// already typed in, and falls back to a plain prompt that offers it in brackets
// when the terminal cannot be read key by key.
func promptLine(ce *clienv.CliEnv, label, defaultValue string) (string, error) {
	value, err := editLine(ce, label, defaultValue)
	if !errors.Is(err, errNoRawTerminal) {
		return value, err
	}

	if defaultValue == "" {
		ce.PromptMessage("%s: ", label)
	} else {
		ce.PromptMessage("%s [%s]: ", label, defaultValue)
	}

	input, err := ce.PromptInput(false)
	if err != nil {
		return "", fmt.Errorf("failed to read %s: %w", strings.ToLower(label), err)
	}

	if input = strings.TrimSpace(input); input != "" {
		return input, nil
	}

	return defaultValue, nil
}

// promptConfirm asks a yes/no question, returning defaultYes when the answer is
// empty.
func promptConfirm(ce *clienv.CliEnv, message string, defaultYes bool) (bool, error) {
	hint := "y/N"
	if defaultYes {
		hint = "Y/n"
	}

	ce.PromptMessage("%s [%s]: ", message, hint)

	input, err := ce.PromptInput(false)
	if err != nil {
		return false, fmt.Errorf("failed to read confirmation: %w", err)
	}

	switch strings.ToLower(strings.TrimSpace(input)) {
	case "":
		return defaultYes, nil
	case "y", "yes":
		return true, nil
	default:
		return false, nil
	}
}

// pickerHeading phrases a picker's title as the question it is asking. The
// title itself stays the bare noun, because it is also what the answer is
// recorded under once the menu is gone, and because a heading reads as a
// sentence rather than a column label.
func pickerHeading(title string) string {
	if title == "" {
		return "Select one"
	}

	first, rest := utf8.DecodeRuneInString(title)

	return "Select a " + string(unicode.ToLower(first)) + title[rest:]
}

// promptPick asks which of the items to use, preferring the arrow-key picker
// and falling back to a numbered list when stdin cannot be read key by key. A
// list with one item is still asked about: what is on offer is part of what the
// prompt is for, and skipping it would leave the create choosing a template
// without ever naming it.
func promptPick(ce *clienv.CliEnv, title string, items []pickerItem, defaultIdx int) (int, error) {
	if len(items) == 0 {
		return -1, fmt.Errorf("%s: nothing to choose from", title) //nolint:err113
	}

	if defaultIdx < 0 || defaultIdx >= len(items) {
		defaultIdx = 0
	}

	idx, err := pickWithKeys(ce, title, items, defaultIdx)

	switch {
	case errors.Is(err, errNoRawTerminal):
		return pickByNumber(ce, title, items, defaultIdx)
	case err != nil:
		return -1, err
	}

	// The picker leaves the answer on screen in the frame, so there is nothing
	// to record here.
	return idx, nil
}

// pickByNumber prints a numbered list and returns the index of the chosen
// item, falling back to defaultIdx on an empty answer. It is what runs when
// input is piped in rather than typed.
func pickByNumber(
	ce *clienv.CliEnv,
	title string,
	items []pickerItem,
	defaultIdx int,
) (int, error) {
	ce.Println("")
	ce.Infoln("%s", pickerHeading(title))

	for i, item := range items {
		if item.Desc == "" {
			ce.Println("  %d. %s", i+1, item.Label)
		} else {
			ce.Println("  %d. %s - %s", i+1, item.Label, item.Desc)
		}
	}

	ce.PromptMessage("Select # [%d]: ", defaultIdx+1)

	input, err := ce.PromptInput(false)
	if err != nil {
		return -1, fmt.Errorf("failed to read selection: %w", err)
	}

	input = strings.TrimSpace(input)
	if input == "" {
		return defaultIdx, nil
	}

	idx, err := strconv.Atoi(input)
	if err != nil || idx < 1 || idx > len(items) {
		return -1, fmt.Errorf( //nolint:err113
			"invalid selection %q: choose a number between 1 and %d", input, len(items),
		)
	}

	return idx - 1, nil
}
