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
	pendingFileDiscard               // select pendingSelectPath after refresh (discard)
	pendingHunkDiscard               // stay on same hunk index after refresh (discard)
)

type Model struct { //nolint:recvcheck
	fileTree          fileTreeModel
	diffView          diffViewModel
	help              helpModel
	commit            commitModel
	review            View
	git               GitView
	active            int
	fileStatuses      []versioncontrol.FileStatus
	focus             int
	width             int
	height            int
	statusMsg         string
	pending           pendingAction
	pendingSelectPath string
	refreshing        bool
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

	ft := newFileTreeModel(initialStatuses, cfg)
	dv := newDiffViewModel()
	h := newHelpModel(activeIdx == 1)
	c := newCommitModel()

	m := Model{
		fileTree:          ft,
		diffView:          dv,
		help:              h,
		commit:            c,
		review:            rv,
		git:               gv,
		active:            activeIdx,
		fileStatuses:      initialStatuses,
		focus:             panelFiles,
		width:             0,
		height:            0,
		statusMsg:         "",
		pending:           pendingNone,
		pendingSelectPath: "",
		refreshing:        false,
	}

	if len(initialStatuses) > 0 {
		m.syncDiffToFileWithCtx(ctx)
	}

	return m
}

func (m *Model) activeView() View { //nolint:ireturn
	if m.active == 0 {
		return m.review
	}

	return m.git
}

func (m Model) Init() tea.Cmd {
	return nil
}

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
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
		m.statusMsg = "Committing..."

		return m, commitCmd(m.git, msg.Message)

	case tea.FocusMsg:
		return m.handleFocus()

	case tea.KeyPressMsg:
		return m.handleKeyMsg(msg)
	}

	return m, nil
}

func (m Model) handleFocus() (tea.Model, tea.Cmd) { //nolint:ireturn
	if m.refreshing {
		return m, nil
	}

	m.refreshing = true

	return m, refreshCmd(m.activeView())
}

func (m Model) handleKeyMsg(msg tea.KeyPressMsg) (Model, tea.Cmd) {
	if m.commit.visible {
		return m, m.commit.update(msg)
	}

	if m.help.visible {
		m.help.toggle()

		return m, nil
	}

	return m.handleKey(msg)
}

func (m Model) handleRefreshDone(msg refreshDoneMsg) Model {
	m.refreshing = false

	if msg.Err != nil {
		m.statusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m
	}

	savedHunk := m.diffView.activeHunk
	expandedPaths := m.fileTree.expandedPaths()
	selectedPath := m.fileTree.selectedPath()

	m.fileStatuses = msg.Statuses

	if m.pending == pendingFileDiscard && m.pendingSelectPath != "" {
		selectedPath = m.pendingSelectPath
	}

	m.fileTree = newFileTreeModel(m.fileStatuses, m.activeConfig())
	m.fileTree.restoreViewState(expandedPaths, selectedPath)
	m.fileTree.focused = m.focus == panelFiles
	m.syncDiffToFile()
	m.layoutPanels()

	m.executePendingAction(savedHunk)
	m.pending = pendingNone
	m.pendingSelectPath = ""

	return m
}

func (m *Model) restoreHunkIfValid(savedHunk int) {
	if m.diffView.detail != nil &&
		m.diffView.detail.File != nil &&
		savedHunk < len(m.diffView.detail.File.Hunks) {
		m.diffView.activeHunk = savedHunk
	}
}

func (m *Model) executePendingAction(savedHunk int) {
	switch m.pending {
	case pendingHunkAdvance:
		m.restoreHunkIfValid(savedHunk)
		m.advanceAfterHunkToggle()
	case pendingHunkDiscard:
		m.restoreHunkIfValid(savedHunk)
		m.diffView.scrollToActiveHunk()
	case pendingFileAdvance:
		m.fileTree.moveDown()
		m.syncDiffToFile()
	case pendingFileDiscard:
		m.syncDiffToFile()
	case pendingNone:
	}
}

func (m Model) handleActionDone(msg actionDoneMsg) (Model, tea.Cmd) {
	if msg.Err != nil {
		m.statusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m, nil
	}

	m.statusMsg = ""
	m.refreshing = true

	return m, refreshCmd(m.activeView())
}

func (m Model) handleCommitDone(msg commitDoneMsg) (Model, tea.Cmd) {
	if msg.Err != nil {
		m.statusMsg = errorMsgStyle().Render(fmt.Sprintf("Commit failed: %s", msg.Err))

		return m, nil
	}

	m.statusMsg = successMsgStyle().Render("Committed!")
	m.refreshing = true

	return m, refreshCmd(m.activeView())
}

func (m Model) handlePushDone(msg pushDoneMsg) Model {
	if msg.Err != nil {
		m.statusMsg = errorMsgStyle().Render(fmt.Sprintf("Push failed: %s", msg.Err))

		return m
	}

	m.statusMsg = successMsgStyle().Render("Pushed!")

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
		m.help.toggle()

	case "tab":
		m.toggleFocus()

	case "enter", "l", "right":
		m.handleExpandOrFocus()

	case "h", "left":
		if m.focus == panelFiles {
			m.fileTree.collapse()
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
		m.refreshing = true

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
	m.help.isGitMode = idx == 1
	m.statusMsg = ""
	m.refreshing = true

	return m, refreshCmd(m.activeView()), true
}

func (m Model) handleGitKey(key string) (Model, tea.Cmd, bool) {
	if m.active != 1 {
		return m, nil, false
	}

	switch key {
	case "c":
		m.commit.open()

		return m, nil, true
	case "p":
		m.statusMsg = "Pushing..."

		return m, pushCmd(m.git), true
	case "P":
		m.statusMsg = "Force pushing..."

		return m, pushForceCmd(m.git), true
	case "d":
		return m.handleDiscardAction()
	}

	return m, nil, false
}

func (m *Model) handleExpandOrFocus() {
	if m.focus != panelFiles {
		return
	}

	node := m.fileTree.selectedNode()
	if node != nil && node.IsDir {
		m.fileTree.expand()
	} else {
		m.toggleFocus()
	}
}

func (m *Model) handleNavigationKey(key string) {
	if m.focus == panelFiles {
		m.handleFileNavigation(key)
	} else {
		m.handleDiffNavigation(key)
	}
}

func (m *Model) handleFileNavigation(key string) {
	switch key {
	case "j", "down":
		m.fileTree.moveDown()
	case "k", "up":
		m.fileTree.moveUp()
	case "g", keyHome:
		m.fileTree.moveToTop()
	case "G", keyEnd:
		m.fileTree.moveToBottom()
	default:
		return
	}

	m.syncDiffToFile()
}

func (m *Model) handleDiffNavigation(key string) {
	switch key {
	case "j", "down":
		m.diffView.nextHunk()
	case "k", "up":
		m.diffView.prevHunk()
	case "g", keyHome:
		m.diffView.scrollToTop()
	case "G", keyEnd:
		m.diffView.scrollToBottom()
	case "J":
		m.diffView.scrollDown()
	case "K":
		m.diffView.scrollUp()
	}
}

func (m *Model) selectedFileStatus() (versioncontrol.FileStatus, bool) {
	node := m.fileTree.selectedNode()
	if node == nil || node.IsDir ||
		node.FileIndex < 0 || node.FileIndex >= len(m.fileStatuses) {
		return versioncontrol.FileStatus{
			Path:     "",
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
			Staged:   false,
			Partial:  false,
		}, false
	}

	return m.fileStatuses[node.FileIndex], true
}

func (m Model) handleToggleAction() (Model, tea.Cmd) {
	view := m.activeView()

	if m.focus == panelDiff {
		detail := m.diffView.detail
		if detail == nil {
			return m, nil
		}

		fs, ok := m.selectedFileStatus()
		if !ok {
			return m, nil
		}

		m.pending = pendingHunkAdvance
		activeHunk := m.diffView.activeHunk
		sourceIndex := detail.Hunks[activeHunk].SourceIndex

		if detail.Hunks[activeHunk].Staged {
			return m, unstageHunkCmd(view, fs, sourceIndex)
		}

		return m, stageHunkCmd(view, fs, sourceIndex)
	}

	// File list: stage/unstage file or directory
	node := m.fileTree.selectedNode()
	if node == nil {
		return m, nil
	}

	m.pending = pendingFileAdvance

	if !node.IsDir {
		if node.FileIndex < 0 || node.FileIndex >= len(m.fileStatuses) {
			return m, nil
		}

		path := m.fileStatuses[node.FileIndex].Path

		if m.fileStatuses[node.FileIndex].Staged {
			return m, unstageFileCmd(view, path)
		}

		return m, stageFileCmd(view, path)
	}

	return m.handleStageDirAction(node)
}

func (m Model) handleStageDirAction(node *treeNode) (Model, tea.Cmd) {
	view := m.activeView()

	indices := m.fileTree.fileIndicesUnder(node)
	if len(indices) == 0 {
		return m, nil
	}

	allStaged := true

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.fileStatuses) {
			continue
		}

		if !m.fileStatuses[idx].Staged {
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
	if m.focus == panelDiff {
		detail := m.diffView.detail
		if detail == nil {
			return m, nil, true
		}

		fs, ok := m.selectedFileStatus()
		if !ok {
			return m, nil, true
		}

		activeHunk := m.diffView.activeHunk

		if fs.Partial && detail.Hunks[activeHunk].Staged {
			m.statusMsg = errorMsgStyle().Render("Cannot discard a staged hunk; unstage it first")

			return m, nil, true
		}

		m.pending = pendingHunkDiscard

		return m, discardHunkCmd(m.git, fs, detail.Hunks[activeHunk].SourceIndex), true
	}

	node := m.fileTree.selectedNode()
	if node == nil {
		return m, nil, true
	}

	m.pending = pendingFileDiscard
	m.pendingSelectPath = m.nextFilePath()

	if !node.IsDir {
		if node.FileIndex < 0 || node.FileIndex >= len(m.fileStatuses) {
			return m, nil, true
		}

		path := m.fileStatuses[node.FileIndex].Path

		return m, discardFileCmd(m.git, path), true
	}

	folder := node.FullPath

	return m, discardFolderCmd(m.git, folder), true
}

// nextFilePath returns the path of the next file node after the current
// selection. If no next file exists, it returns the previous file's path.
func (m *Model) nextFilePath() string {
	for i := m.fileTree.selected + 1; i < len(m.fileTree.visible); i++ {
		if !m.fileTree.visible[i].IsDir {
			return m.fileTree.visible[i].FullPath
		}
	}

	for i := m.fileTree.selected - 1; i >= 0; i-- {
		if !m.fileTree.visible[i].IsDir {
			return m.fileTree.visible[i].FullPath
		}
	}

	return ""
}

func (m *Model) toggleFocus() {
	if m.focus == panelFiles {
		m.focus = panelDiff
	} else {
		m.focus = panelFiles
	}

	m.fileTree.focused = m.focus == panelFiles
	m.diffView.focused = m.focus == panelDiff
}

func (m *Model) advanceAfterHunkToggle() {
	if m.diffView.detail == nil || m.diffView.detail.File == nil {
		return
	}

	// if there's a next hunk, move to it
	if m.diffView.activeHunk < len(m.diffView.detail.File.Hunks)-1 {
		m.diffView.nextHunk()

		return
	}

	// last hunk: advance to next file
	m.fileTree.moveDown()
	m.syncDiffToFile()
}

func (m *Model) syncDiffToFile() {
	m.syncDiffToFileWithCtx(context.Background())
}

func (m *Model) syncDiffToFileWithCtx(ctx context.Context) {
	if len(m.fileStatuses) == 0 {
		return
	}

	node := m.fileTree.selectedNode()
	if node == nil || node.IsDir {
		return
	}

	idx := node.FileIndex
	if idx >= 0 && idx < len(m.fileStatuses) {
		detail, err := m.activeView().GetChangeDetails(ctx, m.fileStatuses[idx])
		if err != nil {
			m.statusMsg = errorMsgStyle().Render(err.Error())

			return
		}

		m.diffView.setDetail(detail)
	}
}

func (m *Model) layoutPanels() {
	leftWidth := m.width * fileTreeWidthPct / fileTreeWidthDiv
	rightWidth := m.width - leftWidth - 1
	height := m.height - statusBarLines

	m.fileTree.width = leftWidth
	m.fileTree.height = height
	m.diffView.width = rightWidth
	m.diffView.height = height
	m.help.width = m.width
	m.help.height = m.height
}

func (m Model) View() tea.View {
	var content string

	switch {
	case m.commit.visible:
		content = m.commit.view(m.width, m.height)
	case m.help.visible:
		content = m.help.render()
	default:
		left := m.fileTree.view()
		right := m.diffView.render()
		panels := lipgloss.JoinHorizontal(lipgloss.Top, left, right)

		statusBar := m.renderStatusBar()
		content = panels + "\n" + statusBar
	}

	v := tea.NewView(content)
	v.AltScreen = true
	v.ReportFocus = true

	return v
}

func (m Model) renderStatusBar() string {
	modeName := m.activeConfig().ModeName

	modeTag := modeIndicatorStyle(modeName).Render(modeName)

	hints := statusBarHintsStyle().Render(" 1:Review 2:Git ?:Help")

	left := modeTag + hints
	leftWidth := lipgloss.Width(left)

	right := ""
	if m.statusMsg != "" {
		right = m.statusMsg
	}

	rightWidth := lipgloss.Width(right)

	gap := max(m.width-leftWidth-rightWidth, 1)

	padding := statusBarMsgStyle().Render(strings.Repeat(" ", gap))

	return left + padding + right
}
