package dom

import "golang.org/x/net/html"

func RemoveNode(node *html.Node) {
	if node == nil || node.Parent == nil {
		return
	}

	node.Parent.RemoveChild(node)
}

func ReplaceNode(node, newNode *html.Node) {
	if node.Parent == nil || node == newNode {
		return
	}

	node.Parent.InsertBefore(newNode, node)
	node.Parent.RemoveChild(node)
}

func UnwrapNode(node *html.Node) {
	if node == nil || node.Parent == nil {
		return
	}

	// In each iteration, we once again grab the first child, since
	// the previous first child was just removed.
	for child := node.FirstChild; child != nil; child = node.FirstChild {
		node.RemoveChild(child)
		node.Parent.InsertBefore(child, node)
	}

	node.Parent.RemoveChild(node)
}

// WrapNode wraps the newNode around the existingNode.
func WrapNode(existingNode, newNode *html.Node) *html.Node {
	if existingNode == nil || existingNode.Parent == nil {
		return existingNode
	}

	existingNode.Parent.InsertBefore(newNode, existingNode)
	existingNode.Parent.RemoveChild(existingNode)

	newNode.AppendChild(existingNode)

	return newNode
}
