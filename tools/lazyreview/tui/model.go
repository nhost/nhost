package tui

import (
	"context"
	"fmt"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
)

const (
	keyHome = "home"
	keyEnd  = "end"
)

const (
	panelFiles = iota
	panelDiff
)

const (
	fileTreeWidthPct = 3  // numerator of file tree width ratio
	fileTreeWidthDiv = 10 // denominator of file tree width ratio
	statusBarLines   = 2  // lines reserved for status bar
)

func reviewViewConfig() versioncontrol.ViewConfig {
	return versioncontrol.ViewConfig{
		ModeName:    "REVIEW",
		ActionLabel: "reviewed",
		StageVerb:   "Toggle reviewed",
	}
}

func gitViewConfig() versioncontrol.ViewConfig {
	return versioncontrol.ViewConfig{
		ModeName:    "GIT",
		ActionLabel: "staged",
		StageVerb:   "Stage / unstage",
	}
}

// --- Messages ---

type refreshDoneMsg struct {
	Err      error
	Statuses []versioncontrol.FileStatus
}

type actionDoneMsg struct {
	Err error
}

type commitDoneMsg struct {
	Err error
}

type pushDoneMsg struct {
	Err error
}

// --- Commands ---

func refreshCmd(view View) tea.Cmd {
	return func() tea.Msg {
		statuses, err := view.GetStatus(context.Background())

		return refreshDoneMsg{Err: err, Statuses: statuses}
	}
}

func stageHunkCmd(view View, fs versioncontrol.FileStatus, hunkIndex int) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: view.StageHunk(context.Background(), fs, hunkIndex)}
	}
}

func unstageHunkCmd(view View, fs versioncontrol.FileStatus, hunkIndex int) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: view.UnstageHunk(context.Background(), fs, hunkIndex)}
	}
}

func stageFileCmd(view View, path string) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: view.StageFile(context.Background(), path)}
	}
}

func unstageFileCmd(view View, path string) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: view.UnstageFile(context.Background(), path)}
	}
}

func stageFolderCmd(view View, folder string) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: view.StageFolder(context.Background(), folder)}
	}
}

func unstageFolderCmd(view View, folder string) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: view.UnstageFolder(context.Background(), folder)}
	}
}

func discardFileCmd(gv GitView, path string) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: gv.DiscardFile(context.Background(), path)}
	}
}

func discardFolderCmd(gv GitView, folder string) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: gv.DiscardFolder(context.Background(), folder)}
	}
}

func discardHunkCmd(gv GitView, fs versioncontrol.FileStatus, hunkIndex int) tea.Cmd {
	return func() tea.Msg {
		return actionDoneMsg{Err: gv.DiscardHunk(context.Background(), fs, hunkIndex)}
	}
}

func commitCmd(gv GitView, message string) tea.Cmd {
	return func() tea.Msg {
		return commitDoneMsg{Err: gv.Commit(context.Background(), message)}
	}
}

func pushCmd(gv GitView) tea.Cmd {
	return func() tea.Msg {
		return pushDoneMsg{Err: gv.Push(context.Background())}
	}
}

func pushForceCmd(gv GitView) tea.Cmd {
	return func() tea.Msg {
		return pushDoneMsg{Err: gv.PushForce(context.Background())}
	}
}

// --- Model ---

type pendingAction int

const (
	pendingNone        pendingAction = iota
	pendingHunkAdvance               // advance to next hunk/file after refresh
	pendingFileAdvance               // advance to next file after refresh
	pendingFileDiscard               // select PendingSelectPath after refresh (discard)
	pendingHunkDiscard               // stay on same hunk index after refresh (discard)
)

type Model struct { //nolint:recvcheck
	FileTree          FileTreeModel
	DiffView          DiffViewModel
	Help              HelpModel
	Commit            CommitModel
	Review            View
	Git               GitView
	active            int
	FileStatuses      []versioncontrol.FileStatus
	Focus             int
	Width             int
	Height            int
	StatusMsg         string
	PendingAction     pendingAction
	PendingSelectPath string
}

func (m *Model) activeConfig() versioncontrol.ViewConfig {
	if m.active == 0 {
		return reviewViewConfig()
	}

	return gitViewConfig()
}

func NewModel(
	ctx context.Context,
	rv View,
	gv GitView,
	activeIdx int,
	initialStatuses []versioncontrol.FileStatus,
) Model {
	cfg := reviewViewConfig()
	if activeIdx == 1 {
		cfg = gitViewConfig()
	}

	fileTree := NewFileTreeModel(initialStatuses, cfg)
	diffView := NewDiffViewModel()
	help := NewHelpModel(activeIdx == 1)
	commit := NewCommitModel()

	m := Model{
		FileTree:          fileTree,
		DiffView:          diffView,
		Help:              help,
		Commit:            commit,
		Review:            rv,
		Git:               gv,
		active:            activeIdx,
		FileStatuses:      initialStatuses,
		Focus:             panelFiles,
		Width:             0,
		Height:            0,
		StatusMsg:         "",
		PendingAction:     pendingNone,
		PendingSelectPath: "",
	}

	if len(initialStatuses) > 0 {
		m.syncDiffToFileWithCtx(ctx)
	}

	return m
}

func (m *Model) activeView() View { //nolint:ireturn
	if m.active == 0 {
		return m.Review
	}

	return m.Git
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.Width = msg.Width
		m.Height = msg.Height
		m.layoutPanels()

		return m, nil

	case refreshDoneMsg:
		return m.handleRefreshDone(msg), nil

	case actionDoneMsg:
		return m.handleActionDone(msg)

	case commitDoneMsg:
		return m.handleCommitDone(msg)

	case pushDoneMsg:
		return m.handlePushDone(msg), nil

	case commitCancelMsg:
		return m, nil

	case commitSubmitMsg:
		m.StatusMsg = "Committing..."

		return m, commitCmd(m.Git, msg.Message)

	case tea.KeyPressMsg:
		return m.handleKeyMsg(msg)
	}

	return m, nil
}

func (m Model) handleKeyMsg(msg tea.KeyPressMsg) (Model, tea.Cmd) {
	if m.Commit.Visible {
		return m, m.Commit.Update(msg)
	}

	if m.Help.Visible {
		m.Help.Toggle()

		return m, nil
	}

	return m.handleKey(msg)
}

func (m Model) handleRefreshDone(msg refreshDoneMsg) Model {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m
	}

	savedHunk := m.DiffView.ActiveHunk
	expandedPaths := m.FileTree.ExpandedPaths()
	selectedPath := m.FileTree.SelectedPath()

	m.FileStatuses = msg.Statuses

	if m.PendingAction == pendingFileDiscard && m.PendingSelectPath != "" {
		selectedPath = m.PendingSelectPath
	}

	m.FileTree = NewFileTreeModel(m.FileStatuses, m.activeConfig())
	m.FileTree.RestoreViewState(expandedPaths, selectedPath)
	m.FileTree.Focused = m.Focus == panelFiles
	m.syncDiffToFile()
	m.layoutPanels()

	m.executePendingAction(savedHunk)
	m.PendingAction = pendingNone
	m.PendingSelectPath = ""

	return m
}

func (m *Model) restoreHunkIfValid(savedHunk int) {
	if m.DiffView.Detail != nil &&
		m.DiffView.Detail.File != nil &&
		savedHunk < len(m.DiffView.Detail.File.Hunks) {
		m.DiffView.ActiveHunk = savedHunk
	}
}

func (m *Model) executePendingAction(savedHunk int) {
	switch m.PendingAction {
	case pendingHunkAdvance:
		m.restoreHunkIfValid(savedHunk)
		m.advanceAfterHunkToggle()
	case pendingHunkDiscard:
		m.restoreHunkIfValid(savedHunk)
		m.DiffView.scrollToActiveHunk()
	case pendingFileAdvance:
		m.FileTree.MoveDown()
		m.syncDiffToFile()
	case pendingFileDiscard:
		m.syncDiffToFile()
	case pendingNone:
	}
}

func (m Model) handleActionDone(msg actionDoneMsg) (Model, tea.Cmd) {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m, nil
	}

	m.StatusMsg = ""

	return m, refreshCmd(m.activeView())
}

func (m Model) handleCommitDone(msg commitDoneMsg) (Model, tea.Cmd) {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(fmt.Sprintf("Commit failed: %s", msg.Err))

		return m, nil
	}

	m.StatusMsg = successMsgStyle().Render("Committed!")

	return m, refreshCmd(m.activeView())
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
	msg tea.KeyPressMsg,
) (Model, tea.Cmd) {
	key := msg.String()

	if model, cmd, handled := m.handleModeKey(key); handled {
		return model, cmd
	}

	switch key {
	case "q", "ctrl+c":
		return m, tea.Quit

	case "?":
		m.Help.Toggle()

	case "tab":
		m.toggleFocus()

	case "enter", "l", "right":
		m.handleExpandOrFocus()

	case "h", "left":
		if m.Focus == panelFiles {
			m.FileTree.Collapse()
			m.syncDiffToFile()
		}

	case "a", "space":
		return m.handleToggleAction()

	default:
		m.handleNavigationKey(key)
	}

	return m, nil
}

func (m Model) handleModeKey(key string) (Model, tea.Cmd, bool) {
	switch key {
	case "1":
		return m.handleSwitchView(0)
	case "2":
		return m.handleSwitchView(1)
	case "r":
		return m, refreshCmd(m.activeView()), true
	default:
		return m.handleGitKey(key)
	}
}

func (m Model) handleSwitchView(idx int) (Model, tea.Cmd, bool) {
	if m.active == idx {
		return m, nil, false
	}

	m.active = idx
	m.Help.IsGitMode = idx == 1
	m.StatusMsg = ""

	return m, refreshCmd(m.activeView()), true
}

func (m Model) handleGitKey(key string) (Model, tea.Cmd, bool) {
	if m.active != 1 {
		return m, nil, false
	}

	switch key {
	case "c":
		m.Commit.Open()

		return m, nil, true
	case "p":
		m.StatusMsg = "Pushing..."

		return m, pushCmd(m.Git), true
	case "P":
		m.StatusMsg = "Force pushing..."

		return m, pushForceCmd(m.Git), true
	case "d":
		return m.handleDiscardAction()
	}

	return m, nil, false
}

func (m *Model) handleExpandOrFocus() {
	if m.Focus != panelFiles {
		return
	}

	node := m.FileTree.SelectedNode()
	if node != nil && node.IsDir {
		m.FileTree.Expand()
	} else {
		m.toggleFocus()
	}
}

func (m *Model) handleNavigationKey(key string) {
	if m.Focus == panelFiles {
		m.handleFileNavigation(key)
	} else {
		m.handleDiffNavigation(key)
	}
}

func (m *Model) handleFileNavigation(key string) {
	switch key {
	case "j", "down":
		m.FileTree.MoveDown()
	case "k", "up":
		m.FileTree.MoveUp()
	case "g", keyHome:
		m.FileTree.MoveToTop()
	case "G", keyEnd:
		m.FileTree.MoveToBottom()
	default:
		return
	}

	m.syncDiffToFile()
}

func (m *Model) handleDiffNavigation(key string) {
	switch key {
	case "j", "down":
		m.DiffView.NextHunk()
	case "k", "up":
		m.DiffView.PrevHunk()
	case "g", keyHome:
		m.DiffView.ScrollToTop()
	case "G", keyEnd:
		m.DiffView.ScrollToBottom()
	case "J":
		m.DiffView.ScrollDown()
	case "K":
		m.DiffView.ScrollUp()
	}
}

func (m *Model) selectedFileStatus() (versioncontrol.FileStatus, bool) {
	node := m.FileTree.SelectedNode()
	if node == nil || node.IsDir ||
		node.FileIndex < 0 || node.FileIndex >= len(m.FileStatuses) {
		return versioncontrol.FileStatus{
			Path:     "",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   false,
			Partial:  false,
		}, false
	}

	return m.FileStatuses[node.FileIndex], true
}

func (m Model) handleToggleAction() (Model, tea.Cmd) {
	view := m.activeView()

	if m.Focus == panelDiff {
		detail := m.DiffView.Detail
		if detail == nil {
			return m, nil
		}

		fs, ok := m.selectedFileStatus()
		if !ok {
			return m, nil
		}

		m.PendingAction = pendingHunkAdvance
		activeHunk := m.DiffView.ActiveHunk
		sourceIndex := detail.Hunks[activeHunk].SourceIndex

		if detail.Hunks[activeHunk].Staged {
			return m, unstageHunkCmd(view, fs, sourceIndex)
		}

		return m, stageHunkCmd(view, fs, sourceIndex)
	}

	// File list: stage/unstage file or directory
	node := m.FileTree.SelectedNode()
	if node == nil {
		return m, nil
	}

	m.PendingAction = pendingFileAdvance

	if !node.IsDir {
		if node.FileIndex < 0 || node.FileIndex >= len(m.FileStatuses) {
			return m, nil
		}

		path := m.FileStatuses[node.FileIndex].Path

		if m.FileStatuses[node.FileIndex].Staged {
			return m, unstageFileCmd(view, path)
		}

		return m, stageFileCmd(view, path)
	}

	return m.handleStageDirAction(node)
}

func (m Model) handleStageDirAction(node *TreeNode) (Model, tea.Cmd) {
	view := m.activeView()

	indices := m.FileTree.FileIndicesUnder(node)
	if len(indices) == 0 {
		return m, nil
	}

	allStaged := true

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.FileStatuses) {
			continue
		}

		if !m.FileStatuses[idx].Staged {
			allStaged = false

			break
		}
	}

	folder := node.FullPath

	if allStaged {
		return m, unstageFolderCmd(view, folder)
	}

	return m, stageFolderCmd(view, folder)
}

func (m Model) handleDiscardAction() (Model, tea.Cmd, bool) {
	if m.Focus == panelDiff {
		detail := m.DiffView.Detail
		if detail == nil {
			return m, nil, true
		}

		fs, ok := m.selectedFileStatus()
		if !ok {
			return m, nil, true
		}

		activeHunk := m.DiffView.ActiveHunk

		if fs.Partial && detail.Hunks[activeHunk].Staged {
			m.StatusMsg = errorMsgStyle().Render("Cannot discard a staged hunk; unstage it first")

			return m, nil, true
		}

		m.PendingAction = pendingHunkDiscard

		return m, discardHunkCmd(m.Git, fs, detail.Hunks[activeHunk].SourceIndex), true
	}

	node := m.FileTree.SelectedNode()
	if node == nil {
		return m, nil, true
	}

	m.PendingAction = pendingFileDiscard
	m.PendingSelectPath = m.nextFilePath()

	if !node.IsDir {
		if node.FileIndex < 0 || node.FileIndex >= len(m.FileStatuses) {
			return m, nil, true
		}

		path := m.FileStatuses[node.FileIndex].Path

		return m, discardFileCmd(m.Git, path), true
	}

	folder := node.FullPath

	return m, discardFolderCmd(m.Git, folder), true
}

// nextFilePath returns the path of the next file node after the current
// selection. If no next file exists, it returns the previous file's path.
func (m *Model) nextFilePath() string {
	for i := m.FileTree.Selected + 1; i < len(m.FileTree.Visible); i++ {
		if !m.FileTree.Visible[i].IsDir {
			return m.FileTree.Visible[i].FullPath
		}
	}

	for i := m.FileTree.Selected - 1; i >= 0; i-- {
		if !m.FileTree.Visible[i].IsDir {
			return m.FileTree.Visible[i].FullPath
		}
	}

	return ""
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
	if m.DiffView.Detail == nil || m.DiffView.Detail.File == nil {
		return
	}

	// if there's a next hunk, move to it
	if m.DiffView.ActiveHunk < len(m.DiffView.Detail.File.Hunks)-1 {
		m.DiffView.NextHunk()

		return
	}

	// last hunk: advance to next file
	m.FileTree.MoveDown()
	m.syncDiffToFile()
}

func (m *Model) syncDiffToFile() {
	m.syncDiffToFileWithCtx(context.Background())
}

func (m *Model) syncDiffToFileWithCtx(ctx context.Context) {
	if len(m.FileStatuses) == 0 {
		return
	}

	node := m.FileTree.SelectedNode()
	if node == nil || node.IsDir {
		return
	}

	idx := node.FileIndex
	if idx >= 0 && idx < len(m.FileStatuses) {
		detail, err := m.activeView().GetChangeDetails(ctx, m.FileStatuses[idx])
		if err != nil {
			m.StatusMsg = errorMsgStyle().Render(err.Error())

			return
		}

		m.DiffView.SetDetail(detail)
	}
}

func (m *Model) layoutPanels() {
	leftWidth := m.Width * fileTreeWidthPct / fileTreeWidthDiv
	rightWidth := m.Width - leftWidth - 1
	height := m.Height - statusBarLines

	m.FileTree.Width = leftWidth
	m.FileTree.Height = height
	m.DiffView.Width = rightWidth
	m.DiffView.Height = height
	m.Help.Width = m.Width
	m.Help.Height = m.Height
}

func (m Model) View() tea.View {
	var content string

	switch {
	case m.Commit.Visible:
		content = m.Commit.View(m.Width, m.Height)
	case m.Help.Visible:
		content = m.Help.Render()
	default:
		left := m.FileTree.View()
		right := m.DiffView.Render()
		panels := lipgloss.JoinHorizontal(lipgloss.Top, left, right)

		statusBar := m.renderStatusBar()
		content = panels + "\n" + statusBar
	}

	v := tea.NewView(content)
	v.AltScreen = true

	return v
}

func (m Model) renderStatusBar() string {
	modeName := m.activeConfig().ModeName

	modeTag := modeIndicatorStyle(modeName).Render(modeName)

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
