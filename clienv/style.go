//nolint:gochecknoglobals
package clienv

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"syscall"

	"github.com/charmbracelet/lipgloss"
	"golang.org/x/term"
)

const (
	ANSIColorWhite  = lipgloss.Color("15")
	ANSIColorCyan   = lipgloss.Color("14")
	ANSIColorPurple = lipgloss.Color("13")
	ANSIColorBlue   = lipgloss.Color("12")
	ANSIColorYellow = lipgloss.Color("11")
	ANSIColorGreen  = lipgloss.Color("10")
	ANSIColorRed    = lipgloss.Color("9")
	ANSIColorGray   = lipgloss.Color("8")
)

const (
	IconInfo = "ℹ️"
	IconWarn = "⚠"
)

var info = lipgloss.NewStyle().
	Foreground(ANSIColorCyan).
	Render

var warn = lipgloss.NewStyle().
	Foreground(ANSIColorYellow).
	Render

var promptMessage = lipgloss.NewStyle().
	Foreground(ANSIColorCyan).
	Bold(true).
	Render

func (ce *CliEnv) Println(msg string, a ...any) {
	if _, err := fmt.Fprintln(ce.stdout, fmt.Sprintf(msg, a...)); err != nil {
		panic(err)
	}
}

func (ce *CliEnv) Infoln(msg string, a ...any) {
	if _, err := fmt.Fprintln(ce.stdout, info(fmt.Sprintf(msg, a...))); err != nil {
		panic(err)
	}
}

func (ce *CliEnv) Warnln(msg string, a ...any) {
	if _, err := fmt.Fprintln(ce.stdout, warn(fmt.Sprintf(msg, a...))); err != nil {
		panic(err)
	}
}

func (ce *CliEnv) PromptMessage(msg string, a ...any) {
	if _, err := fmt.Fprint(ce.stdout, promptMessage("- "+fmt.Sprintf(msg, a...))); err != nil {
		panic(err)
	}
}

func (ce *CliEnv) PromptInput(hide bool) (string, error) {
	reader := bufio.NewReader(os.Stdin)

	var (
		response string
		err      error
	)

	if !hide {
		response, err = reader.ReadString('\n')
		if err != nil {
			return "", fmt.Errorf("failed to read input: %w", err)
		}
	} else {
		output, err := term.ReadPassword(syscall.Stdin)
		if err != nil {
			return "", fmt.Errorf("failed to read input: %w", err)
		}

		response = string(output)
	}

	return strings.TrimSpace(response), err
}
