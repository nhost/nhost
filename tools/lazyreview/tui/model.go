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
	FileList FileListModel
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
	fileList := NewFileListModel(files, hashes, state)
	diffView := NewDiffViewModel(state)
	help := NewHelpModel()

	m := Model{
		FileList: fileList,
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

	case "enter", "l":
		if m.Focus == panelFiles {
			m.toggleFocus()
		}

	case "a":
		m.toggleCurrentFile()

	case " ":
		if m.Focus == panelDiff {
			m.DiffView.ToggleCurrentHunk()
		}

	case "j", "down":
		m.handleDown()

	case "k", "up":
		m.handleUp()

	case "J":
		if m.Focus == panelDiff {
			m.DiffView.NextHunk()
		}

	case "K":
		if m.Focus == panelDiff {
			m.DiffView.PrevHunk()
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

	m.FileList.Focused = m.Focus == panelFiles
	m.DiffView.Focused = m.Focus == panelDiff
}

func (m *Model) handleDown() {
	if m.Focus == panelFiles {
		m.FileList.MoveDown()
		m.syncDiffToFile()
	} else {
		m.DiffView.ScrollDown()
	}
}

func (m *Model) handleUp() {
	if m.Focus == panelFiles {
		m.FileList.MoveUp()
		m.syncDiffToFile()
	} else {
		m.DiffView.ScrollUp()
	}
}

func (m *Model) syncDiffToFile() {
	if len(m.Files) == 0 {
		return
	}

	idx := m.FileList.Selected
	m.DiffView.SetFile(m.Files[idx], m.Hashes[idx])
}

func (m *Model) toggleCurrentFile() {
	if len(m.Files) == 0 {
		return
	}

	idx := m.FileList.Selected
	m.State.ToggleFileReviewed(m.Hashes[idx])
}

func (m *Model) layoutPanels() {
	leftWidth := m.Width * 3 / 10  //nolint:mnd
	rightWidth := m.Width - leftWidth - 1
	height := m.Height - 1

	m.FileList.Width = leftWidth
	m.FileList.Height = height
	m.DiffView.Width = rightWidth
	m.DiffView.Height = height
	m.Help.Width = m.Width
	m.Help.Height = m.Height
}

func (m Model) View() string {
	if m.Help.Visible {
		return m.Help.View()
	}

	left := m.FileList.View()
	right := m.DiffView.View()

	return lipgloss.JoinHorizontal(lipgloss.Top, left, right)
}
