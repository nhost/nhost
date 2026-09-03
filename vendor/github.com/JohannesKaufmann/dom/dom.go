// dom makes it easier to interact with the html document.
//
// Node = return all the nodes
// Element = return all the nodes that are of type Element. This e.g. excludes #text nodes.
package dom

import "golang.org/x/net/html"

// AllNodes recursively gets all the nodes in the tree.
func AllNodes(startNode *html.Node) (allNodes []*html.Node) {
	var finder func(*html.Node)
	finder = func(node *html.Node) {
		allNodes = append(allNodes, node)

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			finder(child)
		}
	}

	finder(startNode)

	return allNodes
}

// - - - - - - - - - - - - - - - //

func AllChildNodes(node *html.Node) (children []*html.Node) {
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		children = append(children, child)
	}
	return children
}

// AllChildElements is similar to AllChildNodes but only returns
// nodes of type `ElementNode`.
func AllChildElements(node *html.Node) (children []*html.Node) {
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode {
			children = append(children, child)
		}
	}
	return children
}

// - - - - - - - - - - - - - - - //

func FirstChildNode(node *html.Node) *html.Node {
	return node.FirstChild
}
func FirstChildElement(node *html.Node) *html.Node {
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		if child.Type == html.ElementNode {
			return child
		}
	}
	return nil
}

// - - - - - - - - - - - - - - - //

func PrevSiblingNode(node *html.Node) *html.Node {
	return node.PrevSibling
}
func PrevSiblingElement(node *html.Node) *html.Node {
	for sibling := node.PrevSibling; sibling != nil; sibling = sibling.PrevSibling {
		if sibling.Type == html.ElementNode {
			return sibling
		}
	}
	return nil
}

// - - - - - - - - - - - - - - - //

func NextSiblingNode(node *html.Node) *html.Node {
	return node.NextSibling
}

// NextSiblingElement returns the element immediately following the passed-in node or nil.
// In contrast to `node.NextSibling` this only returns the next `ElementNode`.
func NextSiblingElement(node *html.Node) *html.Node {
	for sibling := node.NextSibling; sibling != nil; sibling = sibling.NextSibling {
		if sibling.Type == html.ElementNode {
			return sibling
		}
	}
	return nil
}
