//nolint:gochecknoglobals
package tui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
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

func Info(msg string, a ...any) string {
	return info(fmt.Sprintf(msg, a...))
}

var warn = lipgloss.NewStyle().
	Foreground(ANSIColorYellow).
	Render

func Warn(msg string, a ...any) string {
	return warn(fmt.Sprintf(msg, a...))
}

var promptMessage = lipgloss.NewStyle().
	Foreground(ANSIColorCyan).
	Bold(true).
	Render

func PromptMessage(msg string, a ...any) string {
	return promptMessage("- " + fmt.Sprintf(msg, a...))
}
