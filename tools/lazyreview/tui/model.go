package tui

import (
	"fmt"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/git"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

const (
	panelFiles = iota
	panelDiff
)

// --- Messages ---

type refreshMsg struct {
	Files  []*diff.File
	Hashes []string
	Err    error
}

type gitRefreshMsg struct {
	HeadFiles      []*diff.File
	UnstagedFiles  []*diff.File
	CachedFiles    []*diff.File
	Err            error
}

type stageResultMsg struct {
	Err error
}

type commitDoneMsg struct {
	Err error
}

type pushDoneMsg struct {
	Err error
}

// --- Commands ---

func refreshCmd(base string) tea.Cmd {
	return func() tea.Msg {
		mergeBase, err := git.MergeBase(base)
		if err != nil {
			return refreshMsg{Files: nil, Hashes: nil, Err: err}
		}

		rawDiff, err := git.Diff(mergeBase)
		if err != nil {
			return refreshMsg{Files: nil, Hashes: nil, Err: err}
		}

		files := diff.Parse(rawDiff)

		hashes := make([]string, len(files))
		for i, f := range files {
			hashes[i] = review.Hash(f.RawDiff)
		}

		return refreshMsg{
			Files:  files,
			Hashes: hashes,
			Err:    nil,
		}
	}
}

func gitRefreshCmd() tea.Cmd {
	return func() tea.Msg {
		headRaw, err := git.DiffHead()
		if err != nil {
			return gitRefreshMsg{Err: err}
		}

		unstagedRaw, err := git.DiffUnstaged()
		if err != nil {
			return gitRefreshMsg{Err: err}
		}

		// Append synthetic diffs for untracked files to both head and unstaged
		untracked, err := git.UntrackedFiles()
		if err != nil {
			return gitRefreshMsg{Err: err}
		}

		for _, path := range untracked {
			fileDiff, genErr := git.NewFileDiff(path)
			if genErr != nil {
				continue
			}

			headRaw += fileDiff
			unstagedRaw += fileDiff
		}

		cachedRaw, err := git.DiffStaged()
		if err != nil {
			return gitRefreshMsg{Err: err}
		}

		return gitRefreshMsg{
			HeadFiles:     diff.Parse(headRaw),
			UnstagedFiles: diff.Parse(unstagedRaw),
			CachedFiles:   diff.Parse(cachedRaw),
		}
	}
}

func stageFileCmd(path string) tea.Cmd {
	return stageFilesCmd([]string{path})
}

func unstageFileCmd(path string) tea.Cmd {
	return unstageFilesCmd([]string{path})
}

func stageFilesCmd(paths []string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.StageFiles(paths)}
	}
}

func unstageFilesCmd(paths []string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.UnstageFiles(paths)}
	}
}

func stageHunkCmd(patch string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.StageHunk(patch)}
	}
}

func unstageHunkCmd(patch string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.UnstageHunk(patch)}
	}
}

func commitCmd(message string) tea.Cmd {
	return func() tea.Msg {
		return commitDoneMsg{Err: git.Commit(message)}
	}
}

func pushCmd() tea.Cmd {
	return func() tea.Msg {
		return pushDoneMsg{Err: git.Push()}
	}
}

func pushForceCmd() tea.Cmd {
	return func() tea.Msg {
		return pushDoneMsg{Err: git.PushForce()}
	}
}

// --- Model ---

type pendingAction int

const (
	pendingNone        pendingAction = iota
	pendingHunkAdvance               // advance to next hunk/file after git refresh
	pendingFileAdvance               // advance to next file after git refresh
)

type Model struct { //nolint:recvcheck
	FileTree      FileTreeModel
	DiffView      DiffViewModel
	Help          HelpModel
	Commit        CommitModel
	State         *review.State
	GitState      *review.State
	Files         []*diff.File
	Hashes        []string
	Base          string
	Focus         int
	Width         int
	Height        int
	Mode          AppMode
	StatusMsg     string
	PendingAction pendingAction
}

func NewModel(
	files []*diff.File,
	hashes []string,
	state *review.State,
	base string,
) Model {
	mode := ModeReview

	fileTree := NewFileTreeModel(files, hashes, state, mode)
	diffView := NewDiffViewModel(state)
	help := NewHelpModel(mode)
	commit := NewCommitModel()

	m := Model{
		FileTree:      fileTree,
		DiffView:      diffView,
		Help:          help,
		Commit:        commit,
		State:         state,
		GitState:      review.NewTransientState(),
		Files:         files,
		Hashes:        hashes,
		Base:          base,
		Focus:         panelFiles,
		Width:         0,
		Height:        0,
		Mode:          mode,
		StatusMsg:     "",
		PendingAction: pendingNone,
	}

	if len(files) > 0 {
		m.DiffView.SetFile(files[0], hashes[0])
	}

	return m
}

func (m *Model) activeState() *review.State {
	if m.Mode == ModeGit {
		return m.GitState
	}

	return m.State
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:cyclop,ireturn
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.layoutPanels()

		return m, nil

	case refreshMsg:
		return m.handleRefreshMsg(msg), nil

	case gitRefreshMsg:
		return m.handleGitRefreshMsg(msg), nil

	case stageResultMsg:
		return m.handleStageResult(msg)

	case commitDoneMsg:
		return m.handleCommitDone(msg)

	case pushDoneMsg:
		return m.handlePushDone(msg), nil

	case commitCancelMsg:
		return m, nil

	case commitSubmitMsg:
		m.StatusMsg = "Committing..."

		return m, commitCmd(msg.Message)

	case tea.KeyMsg:
		if m.Commit.Visible {
			return m, m.Commit.Update(msg)
		}

		if m.Help.Visible {
			m.Help.Toggle()

			return m, nil
		}

		return m.handleKey(msg)
	}

	return m, nil
}

func (m Model) handleRefreshMsg(msg refreshMsg) Model {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m
	}

	expandedPaths := m.FileTree.ExpandedPaths()
	selectedPath := m.FileTree.SelectedPath()

	m.Files = msg.Files
	m.Hashes = msg.Hashes
	m.State.Reconcile(msg.Files)
	m.FileTree = NewFileTreeModel(msg.Files, msg.Hashes, m.State, m.Mode)
	m.FileTree.RestoreViewState(expandedPaths, selectedPath)
	m.FileTree.Focused = m.Focus == panelFiles
	m.DiffView.State = m.State
	m.syncDiffToFile()
	m.layoutPanels()
	_ = m.State.Save()

	return m
}

func (m Model) handleGitRefreshMsg(msg gitRefreshMsg) Model {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m
	}

	// Save active hunk before syncDiffToFile resets it via SetFile
	savedHunk := m.DiffView.ActiveHunk

	expandedPaths := m.FileTree.ExpandedPaths()
	selectedPath := m.FileTree.SelectedPath()

	m.Files = msg.HeadFiles
	m.Hashes = make([]string, len(msg.HeadFiles))

	for i, f := range msg.HeadFiles {
		m.Hashes[i] = review.Hash(f.RawDiff)
	}

	m.GitState = buildGitState(msg.HeadFiles, m.Hashes, msg.UnstagedFiles, msg.CachedFiles)

	m.FileTree = NewFileTreeModel(msg.HeadFiles, m.Hashes, m.GitState, m.Mode)
	m.FileTree.RestoreViewState(expandedPaths, selectedPath)
	m.FileTree.Focused = m.Focus == panelFiles
	m.DiffView.State = m.GitState
	m.syncDiffToFile()
	m.layoutPanels()

	// Execute pending advance from stage/unstage action
	switch m.PendingAction {
	case pendingHunkAdvance:
		if m.DiffView.File != nil && savedHunk < len(m.DiffView.File.Hunks) {
			m.DiffView.ActiveHunk = savedHunk
		}

		m.advanceAfterHunkToggle()
	case pendingFileAdvance:
		m.FileTree.MoveDown()
		m.syncDiffToFile()
	case pendingNone:
	}

	m.PendingAction = pendingNone

	return m
}

// buildGitState creates a transient review.State where "reviewed" means "staged".
// It uses git diff (unstaged) and git diff --cached (staged) to determine
// per-file and per-hunk staging status directly from git.
func buildGitState(
	headFiles []*diff.File,
	hashes []string,
	unstagedFiles []*diff.File,
	cachedFiles []*diff.File,
) *review.State {
	state := review.NewTransientState()

	unstagedByPath := make(map[string]*diff.File, len(unstagedFiles))
	for _, f := range unstagedFiles {
		unstagedByPath[f.Path] = f
	}

	cachedByPath := make(map[string]bool, len(cachedFiles))
	for _, f := range cachedFiles {
		cachedByPath[f.Path] = true
	}

	for i, f := range headFiles {
		hash := hashes[i]
		hunks := make(map[string]review.HunkState, len(f.Hunks))

		unstaged, hasUnstaged := unstagedByPath[f.Path]
		hasCached := cachedByPath[f.Path]

		switch {
		case hasCached && !hasUnstaged:
			// fully staged — all changes are in the index
			for j := range f.Hunks {
				hunks[strconv.Itoa(j)] = review.HunkState{Reviewed: true}
			}

			state.Files[hash] = review.FileState{
				Path:     f.Path,
				Reviewed: true,
				Hunks:    hunks,
			}

		case hasUnstaged && hasCached:
			// partially staged — match HEAD hunks against unstaged by NewStart
			// (both diffs share the working tree as the "new" side)
			unstagedStarts := make(map[int]bool, len(unstaged.Hunks))
			for _, uh := range unstaged.Hunks {
				unstagedStarts[uh.NewStart] = true
			}

			for j, hunk := range f.Hunks {
				staged := !unstagedStarts[hunk.NewStart]
				hunks[strconv.Itoa(j)] = review.HunkState{Reviewed: staged}
			}

			state.Files[hash] = review.FileState{
				Path:     f.Path,
				Reviewed: false,
				Hunks:    hunks,
			}

		default:
			// fully unstaged (or untracked)
			for j := range f.Hunks {
				hunks[strconv.Itoa(j)] = review.HunkState{Reviewed: false}
			}

			state.Files[hash] = review.FileState{
				Path:     f.Path,
				Reviewed: false,
				Hunks:    hunks,
			}
		}
	}

	return state
}

func (m Model) handleStageResult(msg stageResultMsg) (Model, tea.Cmd) {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m, nil
	}

	m.StatusMsg = ""

	return m, gitRefreshCmd()
}

func (m Model) handleCommitDone(msg commitDoneMsg) (Model, tea.Cmd) {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(fmt.Sprintf("Commit failed: %s", msg.Err))

		return m, nil
	}

	m.StatusMsg = successMsgStyle().Render("Committed!")

	return m, gitRefreshCmd()
}

func (m Model) handlePushDone(msg pushDoneMsg) Model {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(fmt.Sprintf("Push failed: %s", msg.Err))

		return m
	}

	m.StatusMsg = successMsgStyle().Render("Pushed!")

	return m
}

func (m Model) handleKey(
	msg tea.KeyMsg,
) (tea.Model, tea.Cmd) { //nolint:cyclop,gocognit,funlen,gocyclo,ireturn
	switch msg.String() {
	case "q", "ctrl+c":
		return m, tea.Quit

	case "1":
		if m.Mode != ModeReview {
			m.Mode = ModeReview
			m.Help.Mode = ModeReview
			m.StatusMsg = ""

			return m, refreshCmd(m.Base)
		}

	case "2":
		if m.Mode != ModeGit {
			m.Mode = ModeGit
			m.Help.Mode = ModeGit
			m.StatusMsg = ""

			return m, gitRefreshCmd()
		}

	case "c":
		if m.Mode == ModeGit {
			m.Commit.Open()

			return m, nil
		}

	case "p":
		if m.Mode == ModeGit {
			m.StatusMsg = "Pushing..."

			return m, pushCmd()
		}

	case "P":
		if m.Mode == ModeGit {
			m.StatusMsg = "Force pushing..."

			return m, pushForceCmd()
		}

	case "r":
		if m.Mode == ModeGit {
			return m, gitRefreshCmd()
		}

		return m, refreshCmd(m.Base)

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
		return m.handleToggleAction()

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

func (m Model) handleToggleAction() (Model, tea.Cmd) {
	if m.Mode == ModeGit {
		return m.handleGitStageAction()
	}

	// Review mode
	if m.Focus == panelDiff {
		m.DiffView.ToggleCurrentHunk()
		m.advanceAfterHunkToggle()
	} else {
		m.toggleCurrentNode()
		m.FileTree.MoveDown()
		m.syncDiffToFile()
	}

	return m, nil
}

func (m Model) handleGitStageAction() (Model, tea.Cmd) {
	if m.Focus == panelDiff {
		// Stage/unstage a single hunk
		patch := m.DiffView.CurrentHunkPatch()
		if patch == "" {
			return m, nil
		}

		m.PendingAction = pendingHunkAdvance

		if m.DiffView.IsCurrentHunkReviewed() {
			return m, unstageHunkCmd(patch)
		}

		return m, stageHunkCmd(patch)
	}

	// File list: stage/unstage file(s)
	node := m.FileTree.SelectedNode()
	if node == nil {
		return m, nil
	}

	m.PendingAction = pendingFileAdvance

	if !node.IsDir {
		if node.FileIndex < 0 || node.FileIndex >= len(m.Files) {
			return m, nil
		}

		path := m.Files[node.FileIndex].Path
		hash := m.Hashes[node.FileIndex]

		if m.isFileStaged(hash) {
			return m, unstageFileCmd(path)
		}

		return m, stageFileCmd(path)
	}

	// Directory: stage/unstage all files under dir
	return m.handleGitStageDirAction(node)
}

func (m Model) handleGitStageDirAction(node *TreeNode) (Model, tea.Cmd) {
	indices := m.FileTree.FileIndicesUnder(node)
	if len(indices) == 0 {
		return m, nil
	}

	// if all files are staged, unstage all; otherwise stage all
	allStaged := true

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.Hashes) {
			continue
		}

		if !m.isFileStaged(m.Hashes[idx]) {
			allStaged = false

			break
		}
	}

	paths := make([]string, 0, len(indices))

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.Files) {
			continue
		}

		paths = append(paths, m.Files[idx].Path)
	}

	if allStaged {
		return m, unstageFilesCmd(paths)
	}

	return m, stageFilesCmd(paths)
}

func (m *Model) isFileStaged(hash string) bool {
	fs, ok := m.GitState.Files[hash]
	if !ok {
		return false
	}

	return fs.Reviewed
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
		m.DiffView.State = m.activeState()
		m.DiffView.Mode = m.Mode
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
	height := m.Height - 2 //nolint:mnd // reserve 1 for status bar

	m.FileTree.Width = leftWidth
	m.FileTree.Height = height
	m.DiffView.Width = rightWidth
	m.DiffView.Height = height
	m.Help.Width = m.Width
	m.Help.Height = m.Height
}

func (m Model) View() string {
	if m.Commit.Visible {
		return m.Commit.View(m.Width, m.Height)
	}

	if m.Help.Visible {
		return m.Help.View()
	}

	left := m.FileTree.View()
	right := m.DiffView.View()
	panels := lipgloss.JoinHorizontal(lipgloss.Top, left, right)

	statusBar := m.renderStatusBar()

	return panels + "\n" + statusBar
}

func (m Model) renderStatusBar() string {
	modeName := "REVIEW"
	if m.Mode == ModeGit {
		modeName = "GIT"
	}

	modeTag := modeIndicatorStyle(m.Mode).Render(modeName)

	hints := statusBarHintsStyle().Render(" 1:Review 2:Git ?:Help")

	left := modeTag + hints
	leftWidth := lipgloss.Width(left)

	right := ""
	if m.StatusMsg != "" {
		right = m.StatusMsg
	}

	rightWidth := lipgloss.Width(right)

	gap := max(m.Width-leftWidth-rightWidth, 1)

	padding := statusBarMsgStyle().Render(strings.Repeat(" ", gap))

	return left + padding + right
}
