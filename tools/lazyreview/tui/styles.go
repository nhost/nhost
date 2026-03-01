package tui

import "charm.land/lipgloss/v2"

const (
	overlayPaddingV    = 1
	overlayPaddingH    = 2
	modeIndicatorWidth = 10
	commitOverlayWidth = 60
)

func panelStyle(focused bool) lipgloss.Style {
	borderColor := lipgloss.Color("240")
	if focused {
		borderColor = lipgloss.Color("6") // cyan
	}

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 1)
}

func selectedStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Background(lipgloss.Color("237")).
		Bold(true)
}

func addedStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("2")) // green
}

func removedStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("1")) // red
}

func contextStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("245")) // dim
}

func hunkHeaderStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("6")).Bold(true) // cyan bold
}

func reviewedIndicator() string {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("2")).Render("✓") // green
}

func partialIndicator() string {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("3")).Render("◐") // yellow
}

func unreviewedIndicator() string {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render("○") // dim
}

func titleStyle() lipgloss.Style {
	return lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("6"))
}

func helpStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("6")).
		Padding(overlayPaddingV, overlayPaddingH)
}

func hunkBorderReviewed() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("2")).
		SetString("│ ")
}

func hunkBorderActive() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("6")).
		SetString("▎ ")
}

func hunkBorderNormal() lipgloss.Style {
	return lipgloss.NewStyle().
		SetString("  ")
}

func dirExpandedIcon() string {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("245")).Render("▾")
}

func dirCollapsedIcon() string {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("245")).Render("▸")
}

func dirNameStyle() lipgloss.Style {
	return lipgloss.NewStyle().Bold(true)
}

func fileAddedStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("2")) // green
}

func fileDeletedStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("1")) // red
}

func fileChangedStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("3")) // yellow
}

func modeIndicatorStyle(modeName string) lipgloss.Style {
	bg := lipgloss.Color("6") // cyan for review
	if modeName == "GIT" {
		bg = lipgloss.Color("208") // orange for git
	}

	return lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("0")).
		Background(bg).
		Padding(0, 1).
		Width(modeIndicatorWidth).
		Align(lipgloss.Center)
}

func statusBarHintsStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("245"))
}

func statusBarMsgStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("245"))
}

func errorMsgStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("1")).
		Bold(true)
}

func successMsgStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(lipgloss.Color("2")).
		Bold(true)
}

func commitOverlayStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("3")).
		Padding(overlayPaddingV, overlayPaddingH).
		Width(commitOverlayWidth)
}
