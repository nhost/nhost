package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

const (
	panelFiles = iota
	panelDiff
)

type Model struct {
	FileTree FileTreeModel
	DiffView DiffViewModel
	Help     HelpModel
	State    *review.State
	Files    []*diff.File
	Hashes   []string
	Focus    int
	Width    int
	Height   int
}

func NewModel(files []*diff.File, hashes []string, state *review.State) Model {
	fileTree := NewFileTreeModel(files, hashes, state)
	diffView := NewDiffViewModel(state)
	help := NewHelpModel()

	m := Model{
		FileTree: fileTree,
		DiffView: diffView,
		Help:     help,
		State:    state,
		Files:    files,
		Hashes:   hashes,
		Focus:    panelFiles,
	}

	if len(files) > 0 {
		m.DiffView.SetFile(files[0], hashes[0])
	}

	return m
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:cyclop
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.layoutPanels()

		return m, nil

	case tea.KeyMsg:
		if m.Help.Visible {
			m.Help.Toggle()

			return m, nil
		}

		return m.handleKey(msg)
	}

	return m, nil
}

func (m Model) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) { //nolint:cyclop
	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit

	case "?":
		m.Help.Toggle()

	case "tab":
		m.toggleFocus()

	case "enter":
		if m.Focus == panelFiles {
			node := m.FileTree.SelectedNode()
			if node != nil && node.IsDir {
				m.FileTree.Expand()
			} else {
				m.toggleFocus()
			}
		}

	case "l", "right":
		if m.Focus == panelFiles {
			node := m.FileTree.SelectedNode()
			if node != nil && node.IsDir {
				m.FileTree.Expand()
			} else {
				m.toggleFocus()
			}
		}

	case "h", "left":
		if m.Focus == panelFiles {
			m.FileTree.Collapse()
			m.syncDiffToFile()
		}

	case "a", " ":
		if m.Focus == panelDiff {
			m.DiffView.ToggleCurrentHunk()
			m.advanceAfterHunkToggle()
		} else {
			m.toggleCurrentNode()
			m.FileTree.MoveDown()
			m.syncDiffToFile()
		}

	case "j", "down":
		if m.Focus == panelFiles {
			m.FileTree.MoveDown()
			m.syncDiffToFile()
		} else {
			m.DiffView.NextHunk()
		}

	case "k", "up":
		if m.Focus == panelFiles {
			m.FileTree.MoveUp()
			m.syncDiffToFile()
		} else {
			m.DiffView.PrevHunk()
		}

	case "g", "home":
		if m.Focus == panelFiles {
			m.FileTree.MoveToTop()
			m.syncDiffToFile()
		} else {
			m.DiffView.ScrollToTop()
		}

	case "G", "end":
		if m.Focus == panelFiles {
			m.FileTree.MoveToBottom()
			m.syncDiffToFile()
		} else {
			m.DiffView.ScrollToBottom()
		}

	case "J":
		if m.Focus == panelDiff {
			m.DiffView.ScrollDown()
		}

	case "K":
		if m.Focus == panelDiff {
			m.DiffView.ScrollUp()
		}
	}

	return m, nil
}

func (m *Model) toggleFocus() {
	if m.Focus == panelFiles {
		m.Focus = panelDiff
	} else {
		m.Focus = panelFiles
	}

	m.FileTree.Focused = m.Focus == panelFiles
	m.DiffView.Focused = m.Focus == panelDiff
}

func (m *Model) advanceAfterHunkToggle() {
	if m.DiffView.File == nil {
		return
	}

	// if there's a next hunk, move to it
	if m.DiffView.ActiveHunk < len(m.DiffView.File.Hunks)-1 {
		m.DiffView.NextHunk()

		return
	}

	// last hunk: advance to next file
	m.FileTree.MoveDown()
	m.syncDiffToFile()
}

func (m *Model) syncDiffToFile() {
	if len(m.Files) == 0 {
		return
	}

	node := m.FileTree.SelectedNode()
	if node == nil || node.IsDir {
		return
	}

	idx := node.FileIndex
	if idx >= 0 && idx < len(m.Files) {
		m.DiffView.SetFile(m.Files[idx], m.Hashes[idx])
	}
}

func (m *Model) toggleCurrentNode() { //nolint:cyclop
	if len(m.Files) == 0 {
		return
	}

	node := m.FileTree.SelectedNode()
	if node == nil {
		return
	}

	if !node.IsDir {
		if node.FileIndex >= 0 && node.FileIndex < len(m.Hashes) {
			m.State.ToggleFileReviewed(m.Hashes[node.FileIndex])
		}

		return
	}

	// directory: collect all file indices under this dir
	indices := m.FileTree.FileIndicesUnder(node)
	if len(indices) == 0 {
		return
	}

	hashes := make([]string, 0, len(indices))

	for _, idx := range indices {
		if idx >= 0 && idx < len(m.Hashes) {
			hashes = append(hashes, m.Hashes[idx])
		}
	}

	// determine target state: if any file is unreviewed, mark all reviewed; otherwise unmark all
	reviewed := true

	for _, h := range hashes {
		fs, ok := m.State.Files[h]
		if !ok || !fs.Reviewed {
			reviewed = false

			break
		}
	}

	if reviewed {
		// all are reviewed, so unmark all
		m.State.SetFilesReviewed(hashes, false)
	} else {
		// some unreviewed, mark all as reviewed
		m.State.SetFilesReviewed(hashes, true)
	}
}

func (m *Model) layoutPanels() {
	leftWidth := m.Width * 3 / 10 //nolint:mnd
	rightWidth := m.Width - leftWidth - 1
	height := m.Height - 1

	m.FileTree.Width = leftWidth
	m.FileTree.Height = height
	m.DiffView.Width = rightWidth
	m.DiffView.Height = height
	m.Help.Width = m.Width
	m.Help.Height = m.Height
}

func (m Model) View() string {
	if m.Help.Visible {
		return m.Help.View()
	}

	left := m.FileTree.View()
	right := m.DiffView.View()

	return lipgloss.JoinHorizontal(lipgloss.Top, left, right)
}
