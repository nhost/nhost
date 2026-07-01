//nolint:gochecknoglobals
package tui

import "github.com/charmbracelet/lipgloss"

const (
	colorGreen  = lipgloss.Color("10")
	colorYellow = lipgloss.Color("11")
	colorRed    = lipgloss.Color("9")
	colorCyan   = lipgloss.Color("14")
	colorGray   = lipgloss.Color("8")
)

var (
	headerStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(colorCyan)

	uptimeStyle = lipgloss.NewStyle().
			Foreground(colorGray)

	sectionTitle = lipgloss.NewStyle().
			Bold(true)

	subsectionTitle = lipgloss.NewStyle()

	dotHealthy = lipgloss.NewStyle().
			Foreground(colorGreen).
			Render("\u25cf")

	dotStarting = lipgloss.NewStyle().
			Foreground(colorYellow).
			Render("\u25cf")

	dotFailed = lipgloss.NewStyle().
			Foreground(colorRed).
			Render("\u25cf")

	dotWaiting = lipgloss.NewStyle().
			Foreground(colorGray).
			Render("\u25cf")

	statusHealthy = lipgloss.NewStyle().
			Foreground(colorGreen)

	statusStarting = lipgloss.NewStyle().
			Foreground(colorYellow)

	statusFailed = lipgloss.NewStyle().
			Foreground(colorRed)

	statusWaiting = lipgloss.NewStyle().
			Foreground(colorGray)

	logService = lipgloss.NewStyle().
			Foreground(colorCyan).
			Width(14) //nolint:mnd

	logSep = lipgloss.NewStyle().
		Foreground(colorGray).
		Render("\u2502")

	logDim = lipgloss.NewStyle().
		Foreground(colorGray)

	helpStyle = lipgloss.NewStyle().
			Foreground(colorGray)

	helpKey = lipgloss.NewStyle().
		Bold(true)

	phaseCheck = lipgloss.NewStyle().
			Foreground(colorGreen).
			Render("\u2713")

	phaseCross = lipgloss.NewStyle().
			Foreground(colorRed).
			Render("\u2717")

	phaseSkip = lipgloss.NewStyle().
			Foreground(colorYellow).
			Render("-")

	phasePending = lipgloss.NewStyle().
			Foreground(colorGray)

	urlStyle = lipgloss.NewStyle().
			Foreground(colorCyan).
			Underline(true)
)
