package clienv

import "github.com/charmbracelet/lipgloss"

type Column struct {
	Header string
	Rows   []string
}

func Table(columns ...Column) string {
	list := lipgloss.NewStyle().
		Border(lipgloss.NormalBorder(), false, true, false, false).
		BorderForeground(ANSIColorGray).
		Padding(1)
	// Width(30 + 1) //nolint:mnd

	listHeader := lipgloss.NewStyle().
		Foreground(ANSIColorPurple).
		Render

	listItem := lipgloss.NewStyle().Render

	strs := make([]string, len(columns))
	for i, col := range columns {
		c := make([]string, len(col.Rows)+1)

		c[0] = listHeader(col.Header)
		for i, row := range col.Rows {
			c[i+1] = listItem(row)
		}

		strs[i] = list.Render(
			lipgloss.JoinVertical(
				lipgloss.Left,
				c...,
			),
		)
	}

	return lipgloss.JoinHorizontal(
		lipgloss.Top,
		strs...,
	)
}
