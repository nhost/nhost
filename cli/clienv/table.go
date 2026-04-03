package clienv

import (
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/lipgloss/table"
)

type Column struct {
	Header string
	Rows   []string
}

func Table(columns ...Column) string {
	if len(columns) == 0 {
		return ""
	}

	headers := make([]string, len(columns))
	for i, col := range columns {
		headers[i] = col.Header
	}

	rowCount := 0
	for _, col := range columns {
		if len(col.Rows) > rowCount {
			rowCount = len(col.Rows)
		}
	}

	rows := make([][]string, rowCount)
	for i := range rowCount {
		row := make([]string, len(columns))
		for j, col := range columns {
			if i < len(col.Rows) {
				row[j] = col.Rows[i]
			}
		}

		rows[i] = row
	}

	headerStyle := lipgloss.NewStyle().
		Foreground(ANSIColorPurple).
		Bold(true)

	t := table.New().
		Headers(headers...).
		Rows(rows...).
		Border(lipgloss.NormalBorder()).
		BorderStyle(lipgloss.NewStyle().Foreground(ANSIColorGray)).
		StyleFunc(func(row, _ int) lipgloss.Style {
			if row == table.HeaderRow {
				return headerStyle
			}

			return lipgloss.NewStyle()
		})

	return t.Render()
}
