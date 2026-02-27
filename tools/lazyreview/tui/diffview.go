package tui

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

type DiffViewModel struct {
	File        *diff.File
	Hash        string
	State       *review.State
	ActiveHunk  int
	ScrollY     int
	Width       int
	Height      int
	Focused     bool
	renderedLen int
}

func NewDiffViewModel(state *review.State) DiffViewModel {
	return DiffViewModel{
		File:    nil,
		Hash:    "",
		State:   state,
		Width:   60, //nolint:mnd
		Height:  20, //nolint:mnd
		Focused: false,
	}
}

func (m *DiffViewModel) SetFile(f *diff.File, hash string) {
	m.File = f
	m.Hash = hash
	m.ActiveHunk = 0
	m.ScrollY = 0
}

func (m *DiffViewModel) ScrollDown() {
	if m.ScrollY < m.renderedLen-m.viewHeight() {
		m.ScrollY++
	}
}

func (m *DiffViewModel) ScrollUp() {
	if m.ScrollY > 0 {
		m.ScrollY--
	}
}

func (m *DiffViewModel) viewHeight() int {
	h := m.Height - 3 //nolint:mnd
	if h < 1 {
		h = 1
	}

	return h
}

func (m *DiffViewModel) NextHunk() {
	if m.File == nil {
		return
	}

	if m.ActiveHunk < len(m.File.Hunks)-1 {
		m.ActiveHunk++
		m.scrollToActiveHunk()
	}
}

func (m *DiffViewModel) PrevHunk() {
	if m.ActiveHunk > 0 {
		m.ActiveHunk--
		m.scrollToActiveHunk()
	}
}

func (m *DiffViewModel) scrollToActiveHunk() {
	lineNum := 0
	for i := 0; i < m.ActiveHunk; i++ {
		lineNum += 1 + len(m.File.Hunks[i].Lines) // header + lines
	}

	if lineNum < m.ScrollY || lineNum >= m.ScrollY+m.viewHeight() {
		m.ScrollY = lineNum
	}
}

func (m *DiffViewModel) ToggleCurrentHunk() {
	if m.File == nil || m.Hash == "" {
		return
	}

	m.State.ToggleHunkReviewed(m.Hash, m.ActiveHunk)
}

func (m *DiffViewModel) View() string {
	if m.File == nil {
		content := contextStyle().Render("No file selected")

		return panelStyle(m.Focused).
			Width(m.Width).
			Height(m.Height).
			Render(content)
	}

	title := titleStyle().Render(m.File.Path)

	var allLines []string

	for hunkIdx, hunk := range m.File.Hunks {
		isActive := hunkIdx == m.ActiveHunk && m.Focused
		isReviewed := m.State.IsHunkReviewed(m.Hash, hunkIdx)

		headerPrefix := "  "
		if isReviewed {
			headerPrefix = reviewedIndicator() + " "
		}

		headerLine := headerPrefix + hunkHeaderStyle().Render(hunk.Header)
		allLines = append(allLines, headerLine)

		for _, line := range hunk.Lines {
			var border string

			switch {
			case isActive:
				border = hunkBorderActive().String()
			case isReviewed:
				border = hunkBorderReviewed().String()
			default:
				border = hunkBorderNormal().String()
			}

			styled := m.styleLine(line)
			allLines = append(allLines, border+styled)
		}
	}

	m.renderedLen = len(allLines)

	viewH := m.viewHeight()

	if m.ScrollY > len(allLines)-viewH {
		m.ScrollY = len(allLines) - viewH
	}

	if m.ScrollY < 0 {
		m.ScrollY = 0
	}

	end := m.ScrollY + viewH
	if end > len(allLines) {
		end = len(allLines)
	}

	visible := allLines[m.ScrollY:end]

	scrollInfo := ""
	if len(allLines) > viewH {
		scrollInfo = fmt.Sprintf(" [%d/%d]", m.ScrollY+1, len(allLines))
	}

	var lines []string
	lines = append(lines, title+contextStyle().Render(scrollInfo))
	lines = append(lines, "")
	lines = append(lines, visible...)

	content := strings.Join(lines, "\n")

	return panelStyle(m.Focused).
		Width(m.Width).
		Height(m.Height).
		Render(content)
}

func (m *DiffViewModel) styleLine(line diff.Line) string {
	switch line.Type {
	case diff.Added:
		return addedStyle().Render(line.Content)
	case diff.Removed:
		return removedStyle().Render(line.Content)
	default:
		return contextStyle().Render(line.Content)
	}
}
