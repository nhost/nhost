package tui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/review"
)

type TreeNode struct {
	Name      string
	FullPath  string
	IsDir     bool
	Expanded  bool
	Children  []*TreeNode
	FileIndex int // index into Files/Hashes slices; -1 for dirs
	Depth     int
}

type FileTreeModel struct {
	Files   []*diff.File
	Hashes  []string
	State   *review.State
	Root    []*TreeNode
	Visible []*TreeNode

	Selected int
	Offset   int
	Width    int
	Height   int
	Focused  bool
	Mode     AppMode
}

func NewFileTreeModel(
	files []*diff.File,
	hashes []string,
	state *review.State,
	mode AppMode,
) FileTreeModel {
	m := FileTreeModel{
		Files:    files,
		Hashes:   hashes,
		State:    state,
		Root:     nil,
		Visible:  nil,
		Selected: 0,
		Offset:   0,
		Width:    30, //nolint:mnd
		Height:   20, //nolint:mnd
		Focused:  true,
		Mode:     mode,
	}
	m.Root = m.buildTree()
	m.flatten()

	return m
}

func (m *FileTreeModel) buildTree() []*TreeNode {
	rootMap := make(map[string]*TreeNode)

	var roots []*TreeNode

	for i, f := range m.Files {
		parts := strings.Split(f.Path, "/")
		m.insertPath(parts, i, 0, rootMap, &roots)
	}

	sortChildren(roots)

	return roots
}

func (m *FileTreeModel) insertPath(
	parts []string,
	fileIndex int,
	depth int,
	siblingMap map[string]*TreeNode,
	siblings *[]*TreeNode,
) {
	if len(parts) == 1 {
		// leaf file node
		node := &TreeNode{
			Name:      parts[0],
			FullPath:  m.Files[fileIndex].Path,
			IsDir:     false,
			Expanded:  false,
			Children:  nil,
			FileIndex: fileIndex,
			Depth:     depth,
		}
		*siblings = append(*siblings, node)

		return
	}

	// directory node
	dirName := parts[0]

	dir, exists := siblingMap[dirName]
	if !exists {
		fullPath := strings.Join(parts[:1], "/")
		if depth > 0 {
			// reconstruct full path from file path
			fileParts := strings.Split(m.Files[fileIndex].Path, "/")
			fullPath = strings.Join(fileParts[:depth+1], "/")
		}

		dir = &TreeNode{
			Name:      dirName,
			FullPath:  fullPath,
			IsDir:     true,
			Expanded:  true,
			Children:  nil,
			FileIndex: -1,
			Depth:     depth,
		}
		siblingMap[dirName] = dir
		*siblings = append(*siblings, dir)
	}

	childMap := make(map[string]*TreeNode)
	for _, c := range dir.Children {
		if c.IsDir {
			childMap[c.Name] = c
		}
	}

	m.insertPath(parts[1:], fileIndex, depth+1, childMap, &dir.Children)
}

func sortChildren(nodes []*TreeNode) {
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].IsDir != nodes[j].IsDir {
			return nodes[i].IsDir
		}

		return nodes[i].Name < nodes[j].Name
	})

	for _, n := range nodes {
		if n.IsDir && len(n.Children) > 0 {
			sortChildren(n.Children)
		}
	}
}

func (m *FileTreeModel) flatten() {
	m.Visible = nil
	m.flattenNodes(m.Root)
}

func (m *FileTreeModel) flattenNodes(nodes []*TreeNode) {
	for _, n := range nodes {
		m.Visible = append(m.Visible, n)
		if n.IsDir && n.Expanded {
			m.flattenNodes(n.Children)
		}
	}
}

func (m *FileTreeModel) MoveDown() {
	if m.Selected < len(m.Visible)-1 {
		m.Selected++
		m.ensureVisible()
	}
}

func (m *FileTreeModel) MoveUp() {
	if m.Selected > 0 {
		m.Selected--
		m.ensureVisible()
	}
}

func (m *FileTreeModel) MoveToTop() {
	m.Selected = 0
	m.ensureVisible()
}

func (m *FileTreeModel) MoveToBottom() {
	if len(m.Visible) > 0 {
		m.Selected = len(m.Visible) - 1
		m.ensureVisible()
	}
}

func (m *FileTreeModel) ensureVisible() {
	visibleHeight := max(m.Height-3, 1) //nolint:mnd // border + title + padding

	if m.Selected < m.Offset {
		m.Offset = m.Selected
	}

	if m.Selected >= m.Offset+visibleHeight {
		m.Offset = m.Selected - visibleHeight + 1
	}
}

func (m *FileTreeModel) clampSelected() {
	if m.Selected >= len(m.Visible) {
		m.Selected = len(m.Visible) - 1
	}
}

func (m *FileTreeModel) ToggleExpand() {
	node := m.SelectedNode()
	if node == nil || !node.IsDir {
		return
	}

	node.Expanded = !node.Expanded

	m.flatten()
	m.clampSelected()
	m.ensureVisible()
}

func (m *FileTreeModel) Collapse() {
	node := m.SelectedNode()
	if node == nil {
		return
	}

	if node.IsDir && node.Expanded {
		node.Expanded = false

		m.flatten()
		m.clampSelected()
		m.ensureVisible()

		return
	}

	// move to parent dir
	m.moveToParent(node)
}

func (m *FileTreeModel) Expand() {
	node := m.SelectedNode()
	if node == nil {
		return
	}

	if node.IsDir && !node.Expanded {
		node.Expanded = true

		m.flatten()
		m.ensureVisible()
	}
}

func (m *FileTreeModel) moveToParent(node *TreeNode) {
	if node.Depth == 0 {
		return
	}

	// find parent in visible list: walk backwards to find a dir node with depth = node.Depth - 1
	for i := m.Selected - 1; i >= 0; i-- {
		if m.Visible[i].IsDir && m.Visible[i].Depth == node.Depth-1 {
			m.Selected = i
			m.ensureVisible()

			return
		}
	}
}

func (m *FileTreeModel) SelectedNode() *TreeNode {
	if m.Selected < 0 || m.Selected >= len(m.Visible) {
		return nil
	}

	return m.Visible[m.Selected]
}

func (m *FileTreeModel) FileIndicesUnder(node *TreeNode) []int {
	if !node.IsDir {
		if node.FileIndex >= 0 {
			return []int{node.FileIndex}
		}

		return nil
	}

	var indices []int

	for _, child := range node.Children {
		indices = append(indices, m.FileIndicesUnder(child)...)
	}

	return indices
}

func (m *FileTreeModel) ExpandedPaths() map[string]bool {
	result := make(map[string]bool)
	m.collectExpandedPaths(m.Root, result)

	return result
}

func (m *FileTreeModel) collectExpandedPaths(nodes []*TreeNode, result map[string]bool) {
	for _, n := range nodes {
		if n.IsDir && n.Expanded {
			result[n.FullPath] = true
			m.collectExpandedPaths(n.Children, result)
		}
	}
}

func (m *FileTreeModel) SelectedPath() string {
	node := m.SelectedNode()
	if node == nil {
		return ""
	}

	return node.FullPath
}

func (m *FileTreeModel) RestoreViewState(expandedPaths map[string]bool, selectedPath string) {
	m.collapseNotIn(m.Root, expandedPaths)
	m.flatten()

	// find and select the node matching selectedPath
	for i, n := range m.Visible {
		if n.FullPath == selectedPath {
			m.Selected = i
			m.ensureVisible()

			return
		}
	}

	// fall back to first file node (skip directories)
	for i, n := range m.Visible {
		if !n.IsDir {
			m.Selected = i
			m.ensureVisible()

			return
		}
	}

	// last resort: first node
	m.Selected = 0
	m.ensureVisible()
}

func (m *FileTreeModel) collapseNotIn(nodes []*TreeNode, expandedPaths map[string]bool) {
	for _, n := range nodes {
		if n.IsDir {
			n.Expanded = expandedPaths[n.FullPath]
			m.collapseNotIn(n.Children, expandedPaths)
		}
	}
}

func (m *FileTreeModel) View() string {
	var title string

	switch m.Mode { //nolint:exhaustive
	case ModeGit:
		staged := m.State.ReviewedFileCount()
		title = titleStyle().Render(fmt.Sprintf("Files (%d/%d staged)", staged, len(m.Files)))
	default:
		reviewed := m.State.ReviewedFileCount()
		title = titleStyle().Render(fmt.Sprintf("Files (%d/%d reviewed)", reviewed, len(m.Files)))
	}

	visibleHeight := max(m.Height-3, 1) //nolint:mnd

	lines := []string{title, ""}

	end := min(m.Offset+visibleHeight, len(m.Visible))

	for i := m.Offset; i < end; i++ {
		node := m.Visible[i]
		line := m.renderNode(node)

		if i == m.Selected {
			line = selectedStyle().Width(m.Width - 2).Render(line) //nolint:mnd
		}

		lines = append(lines, line)
	}

	content := strings.Join(lines, "\n")

	return panelStyle(m.Focused).
		Width(m.Width).
		MaxWidth(m.Width).
		Height(m.Height).
		MaxHeight(m.Height).
		Render(content)
}

func (m *FileTreeModel) renderNode(node *TreeNode) string {
	indent := strings.Repeat("  ", node.Depth)

	if node.IsDir {
		icon := dirExpandedIcon()
		if !node.Expanded {
			icon = dirCollapsedIcon()
		}

		indicator := m.dirIndicator(node)
		name := dirNameStyle().Render(node.Name + "/")

		return fmt.Sprintf(" %s%s %s %s", indent, icon, indicator, name)
	}

	indicator := m.fileIndicator(node.FileIndex)

	return fmt.Sprintf(" %s  %s %s", indent, indicator, node.Name)
}

func (m *FileTreeModel) fileIndicator(fileIndex int) string {
	if fileIndex < 0 || fileIndex >= len(m.Hashes) {
		return unreviewedIndicator()
	}

	hash := m.Hashes[fileIndex]

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

func (m *FileTreeModel) dirIndicator(node *TreeNode) string {
	indices := m.FileIndicesUnder(node)
	if len(indices) == 0 {
		return unreviewedIndicator()
	}

	allReviewed := true
	anyReviewed := false

	for _, idx := range indices {
		hash := m.Hashes[idx]

		fs, ok := m.State.Files[hash]
		if !ok {
			allReviewed = false

			continue
		}

		if fs.Reviewed {
			anyReviewed = true
		} else {
			allReviewed = false

			// check if any hunks are reviewed
			for _, h := range fs.Hunks {
				if h.Reviewed {
					anyReviewed = true

					break
				}
			}
		}
	}

	if allReviewed {
		return reviewedIndicator()
	}

	if anyReviewed {
		return partialIndicator()
	}

	return unreviewedIndicator()
}
