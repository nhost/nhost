package create

import (
	"fmt"
	"strconv"
	"strings"

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
// answer is empty.
func promptLine(ce *clienv.CliEnv, label, defaultValue string) (string, error) {
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

// promptPick prints a numbered list and returns the index of the chosen item,
// falling back to defaultIdx on an empty answer. A single-item list is resolved
// without asking.
func promptPick(ce *clienv.CliEnv, title string, items []pickerItem, defaultIdx int) (int, error) {
	if len(items) == 0 {
		return -1, fmt.Errorf("%s: nothing to choose from", title) //nolint:err113
	}

	if defaultIdx < 0 || defaultIdx >= len(items) {
		defaultIdx = 0
	}

	if len(items) == 1 {
		return 0, nil
	}

	ce.Println("")
	ce.Infoln("%s", title)

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
