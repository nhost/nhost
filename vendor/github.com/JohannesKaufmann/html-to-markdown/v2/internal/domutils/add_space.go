package domutils

import (
	"context"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func getFirstChildNode(startNode *html.Node, matchFn func(n *html.Node) bool) *html.Node {
	node := startNode.FirstChild
	for node != nil {
		name := dom.NodeName(node)
		if name == "span" {
			// A span has no special meaning. So we just skip it...
			node = dom.GetNextNeighborNode(node)
		} else if matchFn(node) {
			return node
		} else {
			return nil
		}
	}

	return nil
}

func getLastChildNode(startNode *html.Node, matchFn func(n *html.Node) bool) *html.Node {
	node := startNode.LastChild
	for node != nil {
		name := dom.NodeName(node)
		if name == "span" {
			// A span has no special meaning. So we just skip it...
			node = dom.GetPrevNeighborNode(node)
		} else if matchFn(node) {
			return node
		} else {
			return nil
		}
	}

	return nil
}
func AddSpace(ctx context.Context, doc *html.Node, isOuterNode, isInnerNode func(*html.Node) bool) {
	node := doc
	for node != nil {
		if isOuterNode(node) {
			firstChild := getFirstChildNode(node, isInnerNode)
			if firstChild != nil {
				prev := getPrevTextNode(node)
				if prev != nil {
					prev.Data = prev.Data + " "
				}
			}

			lastChild := getLastChildNode(node, isInnerNode)
			if lastChild != nil {
				next := getNextTextNode(node)
				if next != nil {
					next.Data = " " + next.Data
				}
			}
		}

		node = dom.GetNextNeighborElement(node)
	}
}
