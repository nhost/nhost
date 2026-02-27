package tui

import (
	"fmt"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

type FileListModel struct {
	Files    []*diff.File
	Hashes   []string
	State    *review.State
	Selected int
	Offset   int
	Width    int
	Height   int
	Focused  bool
}

func NewFileListModel(files []*diff.File, hashes []string, state *review.State) FileListModel {
	return FileListModel{
		Files:    files,
		Hashes:   hashes,
		State:    state,
		Selected: 0,
		Offset:   0,
		Width:    30,  //nolint:mnd
		Height:   20,  //nolint:mnd
		Focused:  true,
	}
}

func (m *FileListModel) MoveDown() {
	if m.Selected < len(m.Files)-1 {
		m.Selected++
		m.ensureVisible()
	}
}

func (m *FileListModel) MoveUp() {
	if m.Selected > 0 {
		m.Selected--
		m.ensureVisible()
	}
}

func (m *FileListModel) ensureVisible() {
	visibleHeight := m.Height - 3 //nolint:mnd // border + title + padding
	if visibleHeight < 1 {
		visibleHeight = 1
	}

	if m.Selected < m.Offset {
		m.Offset = m.Selected
	}

	if m.Selected >= m.Offset+visibleHeight {
		m.Offset = m.Selected - visibleHeight + 1
	}
}

func (m *FileListModel) View() string {
	reviewed := m.State.ReviewedFileCount()
	title := titleStyle().Render(fmt.Sprintf("Files (%d/%d reviewed)", reviewed, len(m.Files)))

	visibleHeight := m.Height - 3 //nolint:mnd
	if visibleHeight < 1 {
		visibleHeight = 1
	}

	var lines []string
	lines = append(lines, title)
	lines = append(lines, "")

	end := m.Offset + visibleHeight
	if end > len(m.Files) {
		end = len(m.Files)
	}

	maxPathWidth := m.Width - 6 //nolint:mnd // indicator + spaces + border padding

	for i := m.Offset; i < end; i++ {
		f := m.Files[i]
		hash := m.Hashes[i]
		indicator := m.fileIndicator(hash)

		path := f.Path
		if len(path) > maxPathWidth && maxPathWidth > 3 { //nolint:mnd
			path = "..." + path[len(path)-maxPathWidth+3:]
		}

		line := fmt.Sprintf(" %s %s", indicator, path)

		if i == m.Selected {
			line = selectedStyle().Width(m.Width - 2).Render(line) //nolint:mnd
		}

		lines = append(lines, line)
	}

	content := strings.Join(lines, "\n")

	return panelStyle(m.Focused).
		Width(m.Width).
		Height(m.Height).
		Render(content)
}

func (m *FileListModel) fileIndicator(hash string) string {
	fs, ok := m.State.Files[hash]
	if !ok {
		return unreviewedIndicator()
	}

	if fs.Reviewed {
		return reviewedIndicator()
	}

	for _, h := range fs.Hunks {
		if h.Reviewed {
			return partialIndicator()
		}
	}

	return unreviewedIndicator()
}
