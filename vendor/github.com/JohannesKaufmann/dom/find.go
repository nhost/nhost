package dom

import "golang.org/x/net/html"

func ContainsNode(startNode *html.Node, matchFn func(node *html.Node) bool) bool {
	return FindFirstNode(startNode, matchFn) != nil
}

func FindFirstNode(startNode *html.Node, matchFn func(node *html.Node) bool) *html.Node {
	nextFunc := UNSTABLE_initGetNeighbor(
		FirstChildNode,
		NextSiblingNode,
		func(node *html.Node) bool {
			// We should not get higher up than the startNode...
			return node == startNode
		},
	)

	child := startNode.FirstChild
	for child != nil {
		if matchFn(child) {
			return child
		}

		child = nextFunc(child)
	}
	return nil
}

func FindAllNodes(startNode *html.Node, matchFn func(node *html.Node) bool) (foundNodes []*html.Node) {
	nextFunc := UNSTABLE_initGetNeighbor(
		FirstChildNode,
		NextSiblingNode,
		func(node *html.Node) bool {
			// We should not get higher up than the startNode...
			return node == startNode
		},
	)

	child := startNode.FirstChild
	for child != nil {
		if matchFn(child) {
			foundNodes = append(foundNodes, child)
		}

		child = nextFunc(child)
	}
	return foundNodes
}
