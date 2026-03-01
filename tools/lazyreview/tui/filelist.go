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
	panelChrome       = 4 // border top + title + blank line + border bottom
	panelBorderWidth  = 2 // left + right border
	panelPadding      = 2 // left + right padding in panelStyle
	nodePrefix        = 5 // " " + indent_base(0) + icon/spaces(2) + indicator(1) + " "(1)
	indentMultiplier  = 2 // spaces per depth level
	ellipsis          = "..."
)

type treeNode struct {
	Name      string
	FullPath  string
	IsDir     bool
	Expanded  bool
	Children  []*treeNode
	FileIndex int // index into fileStatuses slice; -1 for dirs
	Depth     int
}

type fileTreeModel struct {
	fileStatuses []versioncontrol.FileStatus
	config       versioncontrol.ViewConfig
	root         []*treeNode
	visible      []*treeNode

	selected int
	offset   int
	width    int
	height   int
	focused  bool
}

func newFileTreeModel(
	statuses []versioncontrol.FileStatus,
	config versioncontrol.ViewConfig,
) fileTreeModel {
	m := fileTreeModel{
		fileStatuses: statuses,
		config:       config,
		root:         nil,
		visible:      nil,
		selected:     0,
		offset:       0,
		width:        defaultTreeWidth,
		height:       defaultTreeHeight,
		focused:      true,
	}
	m.root = m.buildTree()
	m.flatten()

	return m
}

func (m *fileTreeModel) buildTree() []*treeNode {
	rootMap := make(map[string]*treeNode)

	var roots []*treeNode

	for i, fs := range m.fileStatuses {
		parts := strings.Split(fs.Path, "/")
		m.insertPath(parts, i, 0, rootMap, &roots)
	}

	sortChildren(roots)

	return roots
}

func (m *fileTreeModel) insertPath(
	parts []string,
	fileIndex int,
	depth int,
	siblingMap map[string]*treeNode,
	siblings *[]*treeNode,
) {
	if len(parts) == 1 {
		// leaf file node
		node := &treeNode{
			Name:      parts[0],
			FullPath:  m.fileStatuses[fileIndex].Path,
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
			fileParts := strings.Split(m.fileStatuses[fileIndex].Path, "/")
			fullPath = strings.Join(fileParts[:depth+1], "/")
		}

		dir = &treeNode{
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

	childMap := make(map[string]*treeNode)
	for _, c := range dir.Children {
		if c.IsDir {
			childMap[c.Name] = c
		}
	}

	m.insertPath(parts[1:], fileIndex, depth+1, childMap, &dir.Children)
}

func sortChildren(nodes []*treeNode) {
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

func (m *fileTreeModel) flatten() {
	m.visible = nil
	m.flattenNodes(m.root)
}

func (m *fileTreeModel) flattenNodes(nodes []*treeNode) {
	for _, n := range nodes {
		m.visible = append(m.visible, n)
		if n.IsDir && n.Expanded {
			m.flattenNodes(n.Children)
		}
	}
}

func (m *fileTreeModel) moveDown() {
	if m.selected < len(m.visible)-1 {
		m.selected++
		m.ensureVisible()
	}
}

func (m *fileTreeModel) moveUp() {
	if m.selected > 0 {
		m.selected--
		m.ensureVisible()
	}
}

func (m *fileTreeModel) moveToTop() {
	m.selected = 0
	m.ensureVisible()
}

func (m *fileTreeModel) moveToBottom() {
	if len(m.visible) > 0 {
		m.selected = len(m.visible) - 1
		m.ensureVisible()
	}
}

func (m *fileTreeModel) ensureVisible() {
	visibleHeight := max(m.height-panelChrome, 1) // border + title + padding

	if m.selected < m.offset {
		m.offset = m.selected
	}

	if m.selected >= m.offset+visibleHeight {
		m.offset = m.selected - visibleHeight + 1
	}
}

func (m *fileTreeModel) clampSelected() {
	if m.selected >= len(m.visible) {
		m.selected = len(m.visible) - 1
	}
}

func (m *fileTreeModel) collapse() {
	node := m.selectedNode()
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

func (m *fileTreeModel) expand() {
	node := m.selectedNode()
	if node == nil {
		return
	}

	if node.IsDir && !node.Expanded {
		node.Expanded = true

		m.flatten()
		m.ensureVisible()
	}
}

func (m *fileTreeModel) moveToParent(node *treeNode) {
	if node.Depth == 0 {
		return
	}

	// find parent in visible list: walk backwards to find a dir node with depth = node.Depth - 1
	for i := m.selected - 1; i >= 0; i-- {
		if m.visible[i].IsDir && m.visible[i].Depth == node.Depth-1 {
			m.selected = i
			m.ensureVisible()

			return
		}
	}
}

func (m *fileTreeModel) selectedNode() *treeNode {
	if m.selected < 0 || m.selected >= len(m.visible) {
		return nil
	}

	return m.visible[m.selected]
}

func (m *fileTreeModel) fileIndicesUnder(node *treeNode) []int {
	if !node.IsDir {
		if node.FileIndex >= 0 {
			return []int{node.FileIndex}
		}

		return nil
	}

	var indices []int

	for _, child := range node.Children {
		indices = append(indices, m.fileIndicesUnder(child)...)
	}

	return indices
}

func (m *fileTreeModel) expandedPaths() map[string]bool {
	result := make(map[string]bool)
	m.collectExpandedPaths(m.root, result)

	return result
}

func (m *fileTreeModel) collectExpandedPaths(nodes []*treeNode, result map[string]bool) {
	for _, n := range nodes {
		if n.IsDir && n.Expanded {
			result[n.FullPath] = true
			m.collectExpandedPaths(n.Children, result)
		}
	}
}

func (m *fileTreeModel) selectedPath() string {
	node := m.selectedNode()
	if node == nil {
		return ""
	}

	return node.FullPath
}

func (m *fileTreeModel) restoreViewState(expandedPaths map[string]bool, selectedPath string) {
	m.collapseNotIn(m.root, expandedPaths)
	m.flatten()

	// find and select the node matching selectedPath
	for i, n := range m.visible {
		if n.FullPath == selectedPath {
			m.selected = i
			m.ensureVisible()

			return
		}
	}

	// fall back to first file node (skip directories)
	for i, n := range m.visible {
		if !n.IsDir {
			m.selected = i
			m.ensureVisible()

			return
		}
	}

	// last resort: first node
	m.selected = 0
	m.ensureVisible()
}

func (m *fileTreeModel) collapseNotIn(nodes []*treeNode, expandedPaths map[string]bool) {
	for _, n := range nodes {
		if n.IsDir {
			n.Expanded = expandedPaths[n.FullPath]
			m.collapseNotIn(n.Children, expandedPaths)
		}
	}
}

func (m *fileTreeModel) view() string {
	stagedCount := 0

	for _, fs := range m.fileStatuses {
		if fs.Staged {
			stagedCount++
		}
	}

	title := titleStyle().Render(
		fmt.Sprintf("Files (%d/%d %s)", stagedCount, len(m.fileStatuses), m.config.ActionLabel),
	)

	visibleHeight := max(m.height-panelChrome, 1)

	lines := []string{title, ""}

	end := min(m.offset+visibleHeight, len(m.visible))

	for i := m.offset; i < end; i++ {
		node := m.visible[i]
		line := m.renderNode(node)

		if i == m.selected {
			line = selectedStyle().Width(m.width - panelBorderWidth).Render(line)
		}

		lines = append(lines, line)
	}

	content := strings.Join(lines, "\n")

	return panelStyle(m.focused).
		Width(m.width).
		MaxWidth(m.width).
		Height(m.height).
		MaxHeight(m.height).
		Render(content)
}

func (m *fileTreeModel) renderNode(node *treeNode) string {
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

func (m *fileTreeModel) maxNameWidth(depth int) int {
	contentWidth := m.width - panelBorderWidth - panelPadding
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

func (m *fileTreeModel) fileLabel(node *treeNode, maxWidth int) string {
	if node.FileIndex < 0 || node.FileIndex >= len(m.fileStatuses) {
		return truncateName(node.Name, maxWidth)
	}

	fs := m.fileStatuses[node.FileIndex]

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

func (m *fileTreeModel) fileIndicator(fileIndex int) string {
	if fileIndex < 0 || fileIndex >= len(m.fileStatuses) {
		return unreviewedIndicator()
	}

	fs := m.fileStatuses[fileIndex]

	if fs.Staged {
		return reviewedIndicator()
	}

	if fs.Partial {
		return partialIndicator()
	}

	return unreviewedIndicator()
}

func (m *fileTreeModel) dirIndicator(node *treeNode) string {
	indices := m.fileIndicesUnder(node)
	if len(indices) == 0 {
		return unreviewedIndicator()
	}

	allStaged := true
	anyStaged := false

	for _, idx := range indices {
		if idx < 0 || idx >= len(m.fileStatuses) {
			allStaged = false

			continue
		}

		fs := m.fileStatuses[idx]

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
