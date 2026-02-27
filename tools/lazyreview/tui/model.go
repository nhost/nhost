package tui

import (
	"context"
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

// --- Messages ---

type refreshMsg struct {
	Files  []*diff.File
	Hashes []string
	Err    error
}

type gitRefreshMsg struct {
	HeadFiles     []*diff.File
	UnstagedFiles []*diff.File
	CachedFiles   []*diff.File
	Err           error
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
		ctx := context.Background()

		mergeBase, err := git.MergeBase(ctx, base)
		if err != nil {
			return refreshMsg{Files: nil, Hashes: nil, Err: err}
		}

		rawDiff, err := git.Diff(ctx, mergeBase)
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
		ctx := context.Background()

		headRaw, err := git.DiffHead(ctx)
		if err != nil {
			return gitRefreshMsg{HeadFiles: nil, UnstagedFiles: nil, CachedFiles: nil, Err: err}
		}

		unstagedRaw, err := git.DiffUnstaged(ctx)
		if err != nil {
			return gitRefreshMsg{HeadFiles: nil, UnstagedFiles: nil, CachedFiles: nil, Err: err}
		}

		// Append synthetic diffs for untracked files to both head and unstaged
		untracked, err := git.UntrackedFiles(ctx)
		if err != nil {
			return gitRefreshMsg{HeadFiles: nil, UnstagedFiles: nil, CachedFiles: nil, Err: err}
		}

		var (
			headRawSb94     strings.Builder
			unstagedRawSb94 strings.Builder
		)

		for _, path := range untracked {
			fileDiff, genErr := git.NewFileDiff(path)
			if genErr != nil {
				continue
			}

			headRawSb94.WriteString(fileDiff)
			unstagedRawSb94.WriteString(fileDiff)
		}

		headRaw += headRawSb94.String()
		unstagedRaw += unstagedRawSb94.String()

		cachedRaw, err := git.DiffStaged(ctx)
		if err != nil {
			return gitRefreshMsg{HeadFiles: nil, UnstagedFiles: nil, CachedFiles: nil, Err: err}
		}

		return gitRefreshMsg{
			HeadFiles:     diff.Parse(headRaw),
			UnstagedFiles: diff.Parse(unstagedRaw),
			CachedFiles:   diff.Parse(cachedRaw),
			Err:           nil,
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
		return stageResultMsg{Err: git.StageFiles(context.Background(), paths)}
	}
}

func unstageFilesCmd(paths []string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.UnstageFiles(context.Background(), paths)}
	}
}

func stageHunkCmd(patch string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.StageHunk(context.Background(), patch)}
	}
}

func unstageHunkCmd(patch string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.UnstageHunk(context.Background(), patch)}
	}
}

func discardFileCmd(path string) tea.Cmd {
	return discardFilesCmd([]string{path})
}

func discardFilesCmd(paths []string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.DiscardFiles(context.Background(), paths)}
	}
}

func discardHunkCmd(patch string) tea.Cmd {
	return func() tea.Msg {
		return stageResultMsg{Err: git.DiscardHunk(context.Background(), patch)}
	}
}

func commitCmd(message string) tea.Cmd {
	return func() tea.Msg {
		return commitDoneMsg{Err: git.Commit(context.Background(), message)}
	}
}

func pushCmd() tea.Cmd {
	return func() tea.Msg {
		return pushDoneMsg{Err: git.Push(context.Background())}
	}
}

func pushForceCmd() tea.Cmd {
	return func() tea.Msg {
		return pushDoneMsg{Err: git.PushForce(context.Background())}
	}
}

// --- Model ---

type pendingAction int

const (
	pendingNone        pendingAction = iota
	pendingHunkAdvance               // advance to next hunk/file after git refresh
	pendingFileAdvance               // advance to next file after git refresh
	pendingFileDiscard               // select PendingSelectPath after git refresh (discard)
	pendingHunkDiscard               // stay on same hunk index after git refresh (discard)
)

type Model struct { //nolint:recvcheck
	FileTree          FileTreeModel
	DiffView          DiffViewModel
	Help              HelpModel
	Commit            CommitModel
	Highlighter       *Highlighter
	State             *review.State
	GitState          *review.State
	Files             []*diff.File
	Hashes            []string
	Base              string
	Focus             int
	Width             int
	Height            int
	Mode              AppMode
	StatusMsg         string
	PendingAction     pendingAction
	PendingSelectPath string // path to select after refresh (used by discard)
}

func NewModel(
	files []*diff.File,
	hashes []string,
	state *review.State,
	base string,
) Model {
	mode := ModeReview

	hl := NewHighlighter()
	fileTree := NewFileTreeModel(files, hashes, state, mode)
	diffView := NewDiffViewModel(state, hl)
	help := NewHelpModel(mode)
	commit := NewCommitModel()

	m := Model{
		FileTree:          fileTree,
		DiffView:          diffView,
		Help:              help,
		Commit:            commit,
		Highlighter:       hl,
		State:             state,
		GitState:          review.NewTransientState(),
		Files:             files,
		Hashes:            hashes,
		Base:              base,
		Focus:             panelFiles,
		Width:             0,
		Height:            0,
		Mode:              mode,
		StatusMsg:         "",
		PendingAction:     pendingNone,
		PendingSelectPath: "",
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

func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) { //nolint:ireturn
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
		return m.handleKeyMsg(msg)
	}

	return m, nil
}

func (m Model) handleKeyMsg(msg tea.KeyMsg) (Model, tea.Cmd) {
	if m.Commit.Visible {
		return m, m.Commit.Update(msg)
	}

	if m.Help.Visible {
		m.Help.Toggle()

		return m, nil
	}

	return m.handleKey(msg)
}

func (m Model) handleRefreshMsg(msg refreshMsg) Model {
	if msg.Err != nil {
		m.StatusMsg = errorMsgStyle().Render(msg.Err.Error())

		return m
	}

	m.Highlighter.Clear()

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

	m.Highlighter.Clear()

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

	// For discard, override selectedPath with the pre-computed next file
	if m.PendingAction == pendingFileDiscard && m.PendingSelectPath != "" {
		selectedPath = m.PendingSelectPath
	}

	m.FileTree = NewFileTreeModel(msg.HeadFiles, m.Hashes, m.GitState, m.Mode)
	m.FileTree.RestoreViewState(expandedPaths, selectedPath)
	m.FileTree.Focused = m.Focus == panelFiles
	m.DiffView.State = m.GitState
	m.syncDiffToFile()
	m.layoutPanels()

	m.executePendingAction(savedHunk)

	m.PendingAction = pendingNone
	m.PendingSelectPath = ""

	return m
}

func (m *Model) executePendingAction(savedHunk int) {
	switch m.PendingAction {
	case pendingHunkAdvance:
		if m.DiffView.File != nil && savedHunk < len(m.DiffView.File.Hunks) {
			m.DiffView.ActiveHunk = savedHunk
		}

		m.advanceAfterHunkToggle()
	case pendingHunkDiscard:
		if m.DiffView.File != nil && savedHunk < len(m.DiffView.File.Hunks) {
			m.DiffView.ActiveHunk = savedHunk
		}

		m.DiffView.scrollToActiveHunk()
	case pendingFileAdvance:
		m.FileTree.MoveDown()
		m.syncDiffToFile()
	case pendingFileDiscard:
		m.syncDiffToFile()
	case pendingNone:
	}
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
		unstaged, hasUnstaged := unstagedByPath[f.Path]
		hasCached := cachedByPath[f.Path]
		state.Files[hashes[i]] = buildFileGitState(f, hasCached, hasUnstaged, unstaged)
	}

	return state
}

func buildFileGitState(
	f *diff.File,
	hasCached, hasUnstaged bool,
	unstaged *diff.File,
) review.FileState {
	switch {
	case hasCached && !hasUnstaged:
		// fully staged
		return review.FileState{
			Path:     f.Path,
			Reviewed: true,
			Hunks:    buildHunkStates(f.Hunks, true),
		}
	case hasUnstaged && hasCached:
		// partially staged
		return buildPartiallyStaged(f, unstaged)
	default:
		// fully unstaged (or untracked)
		return review.FileState{
			Path:     f.Path,
			Reviewed: false,
			Hunks:    buildHunkStates(f.Hunks, false),
		}
	}
}

func buildHunkStates(hunks []*diff.Hunk, reviewed bool) map[string]review.HunkState {
	states := make(map[string]review.HunkState, len(hunks))
	for j := range hunks {
		states[strconv.Itoa(j)] = review.HunkState{Reviewed: reviewed}
	}

	return states
}

func buildPartiallyStaged(f *diff.File, unstaged *diff.File) review.FileState {
	// match HEAD hunks against unstaged by NewStart
	// (both diffs share the working tree as the "new" side)
	unstagedStarts := make(map[int]bool, len(unstaged.Hunks))
	for _, uh := range unstaged.Hunks {
		unstagedStarts[uh.NewStart] = true
	}

	hunks := make(map[string]review.HunkState, len(f.Hunks))
	for j, hunk := range f.Hunks {
		staged := !unstagedStarts[hunk.NewStart]
		hunks[strconv.Itoa(j)] = review.HunkState{Reviewed: staged}
	}

	return review.FileState{
		Path:     f.Path,
		Reviewed: false,
		Hunks:    hunks,
	}
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

	case "a", " ":
		return m.handleToggleAction()

	default:
		m.handleNavigationKey(key)
	}

	return m, nil
}

func (m Model) handleModeKey(key string) (Model, tea.Cmd, bool) {
	switch key {
	case "1":
		if m.Mode != ModeReview {
			m.Mode = ModeReview
			m.Help.Mode = ModeReview
			m.StatusMsg = ""

			return m, refreshCmd(m.Base), true
		}

	case "2":
		if m.Mode != ModeGit {
			m.Mode = ModeGit
			m.Help.Mode = ModeGit
			m.StatusMsg = ""

			return m, gitRefreshCmd(), true
		}

	case "r":
		if m.Mode == ModeGit {
			return m, gitRefreshCmd(), true
		}

		return m, refreshCmd(m.Base), true

	default:
		return m.handleGitModeKey(key)
	}

	return m, nil, false
}

func (m Model) handleGitModeKey(key string) (Model, tea.Cmd, bool) {
	if m.Mode != ModeGit {
		return m, nil, false
	}

	switch key {
	case "c":
		m.Commit.Open()

		return m, nil, true

	case "p":
		m.StatusMsg = "Pushing..."

		return m, pushCmd(), true

	case "P":
		m.StatusMsg = "Force pushing..."

		return m, pushForceCmd(), true

	case "d":
		return m.handleGitDiscardAction()
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

func (m Model) handleGitDiscardAction() (Model, tea.Cmd, bool) {
	if m.Focus == panelDiff {
		patch := m.DiffView.CurrentHunkPatch()
		if patch == "" {
			return m, nil, true
		}

		m.PendingAction = pendingHunkDiscard

		return m, discardHunkCmd(patch), true
	}

	node := m.FileTree.SelectedNode()
	if node == nil {
		return m, nil, true
	}

	m.PendingAction = pendingFileDiscard
	m.PendingSelectPath = m.nextFilePath()

	if !node.IsDir {
		if node.FileIndex < 0 || node.FileIndex >= len(m.Files) {
			return m, nil, true
		}

		path := m.Files[node.FileIndex].Path

		return m, discardFileCmd(path), true
	}

	return m.handleGitDiscardDirAction(node)
}

func (m Model) handleGitDiscardDirAction(node *TreeNode) (Model, tea.Cmd, bool) {
	indices := m.FileTree.FileIndicesUnder(node)
	if len(indices) == 0 {
		return m, nil, true
	}

	paths := make([]string, 0, len(indices))

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.Files) {
			continue
		}

		paths = append(paths, m.Files[idx].Path)
	}

	return m, discardFilesCmd(paths), true
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

func (m *Model) toggleCurrentNode() {
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

	m.toggleDirNode(node)
}

func (m *Model) toggleDirNode(node *TreeNode) {
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

	// if any file is unreviewed, mark all reviewed; otherwise unmark all
	if m.allFilesReviewed(hashes) {
		m.State.SetFilesReviewed(hashes, false)
	} else {
		m.State.SetFilesReviewed(hashes, true)
	}
}

func (m *Model) allFilesReviewed(hashes []string) bool {
	for _, h := range hashes {
		fs, ok := m.State.Files[h]
		if !ok || !fs.Reviewed {
			return false
		}
	}

	return true
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
