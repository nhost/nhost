package tui

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

const (
	diffViewHeaderLines = 2 // title + blank line
	defaultDiffWidth    = 60
	defaultDiffHeight   = 20
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
	Mode        AppMode
	renderedLen int
	highlighter *Highlighter
	hlCache     []string
}

func NewDiffViewModel(state *review.State, hl *Highlighter) DiffViewModel {
	return DiffViewModel{
		File:        nil,
		Hash:        "",
		State:       state,
		ActiveHunk:  0,
		ScrollY:     0,
		Width:       defaultDiffWidth,
		Height:      defaultDiffHeight,
		Focused:     false,
		Mode:        ModeReview,
		renderedLen: 0,
		highlighter: hl,
		hlCache:     nil,
	}
}

func (m *DiffViewModel) SetFile(f *diff.File, hash string) {
	m.File = f
	m.Hash = hash
	m.ActiveHunk = 0
	m.ScrollY = 0
	m.renderedLen = m.computeRenderedLen()
	m.hlCache = m.highlighter.HighlightFile(f)
}

func (m *DiffViewModel) computeRenderedLen() int {
	if m.File == nil {
		return 0
	}

	total := 0

	for _, hunk := range m.File.Hunks {
		total += 1 + len(hunk.Lines) // header + lines
	}

	return total
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

func (m *DiffViewModel) ScrollToTop() {
	m.ScrollY = 0
}

func (m *DiffViewModel) ScrollToBottom() {
	bottom := m.renderedLen - m.viewHeight()
	if bottom > 0 {
		m.ScrollY = bottom
	}
}

func (m *DiffViewModel) viewHeight() int {
	return max(m.Height-panelChrome, 1)
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
	for i := range m.ActiveHunk {
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

func (m *DiffViewModel) IsCurrentHunkReviewed() bool {
	if m.File == nil || m.Hash == "" {
		return false
	}

	return m.State.IsHunkReviewed(m.Hash, m.ActiveHunk)
}

func (m *DiffViewModel) CurrentHunkPatch() string {
	if m.File == nil {
		return ""
	}

	return diff.HunkPatch(m.File.RawDiff, m.ActiveHunk)
}

func (m *DiffViewModel) View() string {
	if m.File == nil {
		content := contextStyle().Render("No file selected")

		return panelStyle(m.Focused).
			Width(m.Width).
			MaxWidth(m.Width).
			Height(m.Height).
			MaxHeight(m.Height).
			Render(content)
	}

	allLines := m.renderHunks()
	m.renderedLen = len(allLines)
	m.clampScroll(len(allLines))

	viewH := m.viewHeight()
	end := min(m.ScrollY+viewH, len(allLines))
	visible := allLines[m.ScrollY:end]

	scrollInfo := ""
	if len(allLines) > viewH {
		scrollInfo = fmt.Sprintf(" [%d/%d]", m.ScrollY+1, len(allLines))
	}

	title := titleStyle().Render(m.File.Path)
	lines := make([]string, 0, diffViewHeaderLines+len(visible))
	lines = append(lines, title+contextStyle().Render(scrollInfo))
	lines = append(lines, "")
	lines = append(lines, visible...)

	content := strings.Join(lines, "\n")

	return panelStyle(m.Focused).
		Width(m.Width).
		MaxWidth(m.Width).
		Height(m.Height).
		MaxHeight(m.Height).
		Render(content)
}

func (m *DiffViewModel) renderHunks() []string {
	var allLines []string

	lineIdx := 0

	for hunkIdx, hunk := range m.File.Hunks {
		isActive := hunkIdx == m.ActiveHunk && m.Focused
		isReviewed := m.State.IsHunkReviewed(m.Hash, hunkIdx)

		headerPrefix := "  "
		if isReviewed {
			headerPrefix = reviewedIndicator() + " "
		}

		allLines = append(allLines, headerPrefix+hunkHeaderStyle().Render(hunk.Header))
		lineIdx++ // hunk header

		border := m.hunkBorder(isActive, isReviewed)

		for _, line := range hunk.Lines {
			allLines = append(allLines, border+m.styleLine(line, lineIdx))
			lineIdx++
		}
	}

	return allLines
}

func (m *DiffViewModel) hunkBorder(isActive, isReviewed bool) string {
	switch {
	case isActive:
		return hunkBorderActive().String()
	case isReviewed:
		return hunkBorderReviewed().String()
	default:
		return hunkBorderNormal().String()
	}
}

func (m *DiffViewModel) clampScroll(totalLines int) {
	viewH := m.viewHeight()

	if m.ScrollY > totalLines-viewH {
		m.ScrollY = totalLines - viewH
	}

	if m.ScrollY < 0 {
		m.ScrollY = 0
	}
}

func (m *DiffViewModel) styleLine(line diff.Line, lineIdx int) string {
	plain := m.plainStyleLine(line)

	var highlight string
	if lineIdx >= 0 && lineIdx < len(m.hlCache) {
		highlight = m.hlCache[lineIdx]
	}

	return m.highlighter.StyleLine(line, highlight, plain)
}

func (m *DiffViewModel) plainStyleLine(line diff.Line) string {
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
