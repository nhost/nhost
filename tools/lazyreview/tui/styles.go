package tui

import "github.com/charmbracelet/lipgloss"

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
		Padding(1, 2).
		Align(lipgloss.Center)
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
