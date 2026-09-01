package domutils

import (
	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func getNextTextNode(startNode *html.Node) *html.Node {
	node := dom.GetNextNeighborNodeExcludingOwnChild(startNode)

	for node != nil {
		if node.Type == html.TextNode {
			return node
		}

		if dom.NodeName(node) == "span" {
			// A span has no special meaning. So we just skip it...
			node = dom.GetNextNeighborNode(node)
			continue
		}

		return nil
	}
	return nil
}
func getPrevTextNode(startNode *html.Node) *html.Node {
	node := dom.GetPrevNeighborNodeExcludingOwnChild(startNode)

	for node != nil {
		if node.Type == html.TextNode {
			return node
		}

		if dom.NodeName(node) == "span" {
			// A span has no special meaning. So we just skip it...
			node = dom.GetPrevNeighborNode(node)
			continue
		}

		return nil
	}
	return nil
}
