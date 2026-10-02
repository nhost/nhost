package domutils

import (
	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func collectAdjacentNodes(node *html.Node, matchFn func(n *html.Node) bool) []*html.Node {
	var collectedNodes []*html.Node

	node = node.NextSibling
	for node != nil {
		name := dom.NodeName(node)
		if name == "span" {
			// A span has no special meaning. So we just skip it...
			node = dom.GetNextNeighborNode(node)
		} else if matchFn(node) {
			collectedNodes = append(collectedNodes, node)
			node = dom.GetNextNeighborNodeExcludingOwnChild(node)
		} else {
			// Return the collected nodes
			return collectedNodes
		}
	}

	return collectedNodes
}

func mergeChildren(destinationNode *html.Node, nodes ...*html.Node) {
	for _, node := range nodes {
		// We move all the children to the `destinationNode`.
		children := dom.AllChildNodes(node)
		for _, child := range children {
			dom.RemoveNode(child)
			destinationNode.AppendChild(child)
		}
		dom.RemoveNode(node)
	}
}

func MergeAdjacent(doc *html.Node, matchFn func(*html.Node) bool) {
	node := doc

	for node != nil {
		if matchFn(node) {
			nextNodes := collectAdjacentNodes(node, matchFn)

			mergeChildren(node, nextNodes...)
		}

		node = dom.GetNextNeighborElement(node)
	}
}

// - - - - - - - - //

func MergeAdjacentTextNodes(n *html.Node) {
	if n == nil {
		return
	}

	var prev *html.Node
	for c := n.FirstChild; c != nil; {
		next := c.NextSibling
		if c.Type == html.TextNode && prev != nil && prev.Type == html.TextNode {
			// Combine adjacent text nodes
			prev.Data += c.Data
			n.RemoveChild(c)
		} else {
			MergeAdjacentTextNodes(c)
			prev = c
		}
		c = next
	}
}
