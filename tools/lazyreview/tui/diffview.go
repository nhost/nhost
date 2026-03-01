package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/x/ansi"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
)

const (
	diffViewHeaderLines = 2 // title + blank line
	defaultDiffWidth    = 60
	defaultDiffHeight   = 20
)

type diffViewModel struct {
	detail      *versioncontrol.ChangeDetail
	activeHunk  int
	scrollY     int
	width       int
	height      int
	focused     bool
	renderedLen int
}

func newDiffViewModel() diffViewModel {
	return diffViewModel{
		detail:      nil,
		activeHunk:  0,
		scrollY:     0,
		width:       defaultDiffWidth,
		height:      defaultDiffHeight,
		focused:     false,
		renderedLen: 0,
	}
}

func (m *diffViewModel) setDetail(d *versioncontrol.ChangeDetail) {
	m.detail = d
	m.activeHunk = 0
	m.scrollY = 0
	m.renderedLen = m.computeRenderedLen()
}

func (m *diffViewModel) computeRenderedLen() int {
	if m.detail == nil || m.detail.File == nil {
		return 0
	}

	total := 0

	for _, hunk := range m.detail.File.Hunks {
		total += 1 + len(hunk.Lines) // header + lines
	}

	return total
}

func (m *diffViewModel) scrollDown() {
	if m.scrollY < m.renderedLen-m.viewHeight() {
		m.scrollY++
	}
}

func (m *diffViewModel) scrollUp() {
	if m.scrollY > 0 {
		m.scrollY--
	}
}

func (m *diffViewModel) scrollToTop() {
	m.scrollY = 0
}

func (m *diffViewModel) scrollToBottom() {
	bottom := m.renderedLen - m.viewHeight()
	if bottom > 0 {
		m.scrollY = bottom
	}
}

func (m *diffViewModel) viewHeight() int {
	return max(m.height-panelChrome, 1)
}

func (m *diffViewModel) nextHunk() {
	if m.detail == nil || m.detail.File == nil {
		return
	}

	if m.activeHunk < len(m.detail.File.Hunks)-1 {
		m.activeHunk++
		m.scrollToActiveHunk()
	}
}

func (m *diffViewModel) prevHunk() {
	if m.activeHunk > 0 {
		m.activeHunk--
		m.scrollToActiveHunk()
	}
}

func (m *diffViewModel) scrollToActiveHunk() {
	if m.detail == nil || m.detail.File == nil {
		return
	}

	lineNum := 0
	for i := range m.activeHunk {
		lineNum += 1 + len(m.detail.File.Hunks[i].Lines) // header + lines
	}

	if lineNum < m.scrollY || lineNum >= m.scrollY+m.viewHeight() {
		m.scrollY = lineNum
	}
}

func (m *diffViewModel) render() string {
	if m.detail == nil || m.detail.File == nil {
		content := contextStyle().Render("No file selected")

		return panelStyle(m.focused).
			Width(m.width).
			MaxWidth(m.width).
			Height(m.height).
			MaxHeight(m.height).
			Render(content)
	}

	allLines := m.renderHunks()
	m.renderedLen = len(allLines)
	m.clampScroll(len(allLines))

	viewH := m.viewHeight()
	end := min(m.scrollY+viewH, len(allLines))
	visible := allLines[m.scrollY:end]

	scrollInfo := ""
	if len(allLines) > viewH {
		scrollInfo = fmt.Sprintf(" [%d/%d]", m.scrollY+1, len(allLines))
	}

	titleText := m.detail.Path
	if m.detail.Kind == versioncontrol.ChangeRenamed && m.detail.OrigPath != "" {
		titleText = m.detail.Path + " <- " + m.detail.OrigPath
	}

	title := titleStyle().Render(titleText)
	lines := make([]string, 0, diffViewHeaderLines+len(visible))
	lines = append(lines, title+contextStyle().Render(scrollInfo))
	lines = append(lines, "")
	lines = append(lines, visible...)

	maxW := m.width - panelBorderWidth - panelPadding
	for i, line := range lines {
		lines[i] = ansi.Truncate(line, maxW, "")
	}

	content := strings.Join(lines, "\n")

	return panelStyle(m.focused).
		Width(m.width).
		MaxWidth(m.width).
		Height(m.height).
		MaxHeight(m.height).
		Render(content)
}

func (m *diffViewModel) renderHunks() []string {
	var allLines []string

	for hunkIdx, hunk := range m.detail.File.Hunks {
		isActive := hunkIdx == m.activeHunk && m.focused
		isStaged := m.detail.Hunks[hunkIdx].Staged

		headerPrefix := "  "
		if isStaged {
			headerPrefix = reviewedIndicator() + " "
		}

		allLines = append(allLines, headerPrefix+hunkHeaderStyle().Render(hunk.Header))

		border := m.hunkBorder(isActive, isStaged)

		for _, line := range hunk.Lines {
			allLines = append(allLines, border+m.styleLine(line))
		}
	}

	return allLines
}

func (m *diffViewModel) hunkBorder(isActive, isStaged bool) string {
	switch {
	case isActive:
		return hunkBorderActive().String()
	case isStaged:
		return hunkBorderReviewed().String()
	default:
		return hunkBorderNormal().String()
	}
}

func (m *diffViewModel) clampScroll(totalLines int) {
	viewH := m.viewHeight()

	if m.scrollY > totalLines-viewH {
		m.scrollY = totalLines - viewH
	}

	if m.scrollY < 0 {
		m.scrollY = 0
	}
}

func (m *diffViewModel) styleLine(line diff.Line) string {
	switch line.Type {
	case diff.Added:
		return addedStyle().Render(line.Content)
	case diff.Removed:
		return removedStyle().Render(line.Content)
	case diff.Context:
		return contextStyle().Render(line.Content)
	}

	return contextStyle().Render(line.Content)
}
