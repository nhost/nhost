package tui

import (
	"fmt"
	"sort"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
)

const (
	defaultTreeWidth  = 30
	defaultTreeHeight = 20
	panelChrome       = 3 // border top + title + border bottom
	panelBorderWidth  = 2 // left + right border
	panelPadding      = 2 // left + right padding in panelStyle
	nodePrefix        = 5 // " " + indent_base(0) + icon/spaces(2) + indicator(1) + " "(1)
	indentMultiplier  = 2 // spaces per depth level
	ellipsis          = "..."
)

type TreeNode struct {
	Name      string
	FullPath  string
	IsDir     bool
	Expanded  bool
	Children  []*TreeNode
	FileIndex int // index into FileStatuses slice; -1 for dirs
	Depth     int
}

type FileTreeModel struct {
	FileStatuses []versioncontrol.FileStatus
	Config       versioncontrol.ViewConfig
	Root         []*TreeNode
	Visible      []*TreeNode

	Selected int
	Offset   int
	Width    int
	Height   int
	Focused  bool
}

func NewFileTreeModel(
	statuses []versioncontrol.FileStatus,
	config versioncontrol.ViewConfig,
) FileTreeModel {
	m := FileTreeModel{
		FileStatuses: statuses,
		Config:       config,
		Root:         nil,
		Visible:      nil,
		Selected:     0,
		Offset:       0,
		Width:        defaultTreeWidth,
		Height:       defaultTreeHeight,
		Focused:      true,
	}
	m.Root = m.buildTree()
	m.flatten()

	return m
}

func (m *FileTreeModel) buildTree() []*TreeNode {
	rootMap := make(map[string]*TreeNode)

	var roots []*TreeNode

	for i, fs := range m.FileStatuses {
		parts := strings.Split(fs.Path, "/")
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
			FullPath:  m.FileStatuses[fileIndex].Path,
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
		fullPath := parts[0]
		if depth > 0 {
			// reconstruct full path from file path
			fileParts := strings.Split(m.FileStatuses[fileIndex].Path, "/")
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
	visibleHeight := max(m.Height-panelChrome, 1) // border + title + padding

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
	stagedCount := 0

	for _, fs := range m.FileStatuses {
		if fs.Staged {
			stagedCount++
		}
	}

	title := titleStyle().Render(
		fmt.Sprintf("Files (%d/%d %s)", stagedCount, len(m.FileStatuses), m.Config.ActionLabel),
	)

	visibleHeight := max(m.Height-panelChrome, 1)

	lines := []string{title, ""}

	end := min(m.Offset+visibleHeight, len(m.Visible))

	for i := m.Offset; i < end; i++ {
		node := m.Visible[i]
		line := m.renderNode(node)

		if i == m.Selected {
			line = selectedStyle().Width(m.Width - panelBorderWidth).Render(line)
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
	maxName := m.maxNameWidth(node.Depth)

	if node.IsDir {
		icon := dirExpandedIcon()
		if !node.Expanded {
			icon = dirCollapsedIcon()
		}

		indicator := m.dirIndicator(node)
		dirLabel := truncateName(node.Name+"/", maxName)
		name := dirNameStyle().Render(dirLabel)

		return fmt.Sprintf(" %s%s %s %s", indent, icon, indicator, name)
	}

	indicator := m.fileIndicator(node.FileIndex)
	label := m.fileLabel(node, maxName)

	return fmt.Sprintf(" %s  %s %s", indent, indicator, label)
}

func (m *FileTreeModel) maxNameWidth(depth int) int {
	contentWidth := m.Width - panelBorderWidth - panelPadding
	overhead := nodePrefix + depth*indentMultiplier

	return max(contentWidth-overhead, 1)
}

func truncateName(name string, maxWidth int) string {
	runes := []rune(name)
	if len(runes) <= maxWidth {
		return name
	}

	if maxWidth <= len(ellipsis) {
		return string(runes[:maxWidth])
	}

	return string(runes[:maxWidth-len(ellipsis)]) + ellipsis
}

func (m *FileTreeModel) fileLabel(node *TreeNode, maxWidth int) string {
	if node.FileIndex < 0 || node.FileIndex >= len(m.FileStatuses) {
		return truncateName(node.Name, maxWidth)
	}

	fs := m.FileStatuses[node.FileIndex]

	var text string
	if fs.Kind == versioncontrol.ChangeRenamed && fs.OrigPath != "" {
		text = node.Name + " <- " + fs.OrigPath
	} else {
		text = node.Name
	}

	truncated := truncateName(text, maxWidth)

	switch fs.Kind {
	case versioncontrol.ChangeAdded:
		return fileAddedStyle().Render(truncated)
	case versioncontrol.ChangeDeleted:
		return fileDeletedStyle().Render(truncated)
	case versioncontrol.ChangeRenamed, versioncontrol.ChangeModified:
		return fileChangedStyle().Render(truncated)
	default:
		return truncated
	}
}

func (m *FileTreeModel) fileIndicator(fileIndex int) string {
	if fileIndex < 0 || fileIndex >= len(m.FileStatuses) {
		return unreviewedIndicator()
	}

	fs := m.FileStatuses[fileIndex]

	if fs.Staged {
		return reviewedIndicator()
	}

	if fs.Partial {
		return partialIndicator()
	}

	return unreviewedIndicator()
}

func (m *FileTreeModel) dirIndicator(node *TreeNode) string {
	indices := m.FileIndicesUnder(node)
	if len(indices) == 0 {
		return unreviewedIndicator()
	}

	allStaged := true
	anyStaged := false

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.FileStatuses) {
			allStaged = false

			continue
		}

		fs := m.FileStatuses[idx]

		if fs.Staged {
			anyStaged = true
		} else {
			allStaged = false

			if fs.Partial {
				anyStaged = true
			}
		}
	}

	if allStaged {
		return reviewedIndicator()
	}

	if anyStaged {
		return partialIndicator()
	}

	return unreviewedIndicator()
}
