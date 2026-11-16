package dom

import "golang.org/x/net/html"

// Warning: It is not meant to be called directly and may change signature from release to release!
func UNSTABLE_initGetNeighbor(
	firstChildFunc func(node *html.Node) *html.Node,
	prevNextFunc func(node *html.Node) *html.Node,
	goUpUntilFunc func(node *html.Node) bool,
) func(*html.Node) *html.Node {

	return func(node *html.Node) *html.Node {
		// First look at the children
		if child := firstChildFunc(node); child != nil {
			return child
		}

		// Otherwise my prev/next sibling
		if sibling := prevNextFunc(node); sibling != nil {
			return sibling
		}

		for {
			// Finally, continously go upwards until we find an element with a sibling
			node = node.Parent
			if node == nil {
				// We reached the top
				return nil
			}

			if goUpUntilFunc(node) {
				// Don't go too far up...
				return nil
			}

			sibling := prevNextFunc(node)
			if sibling != nil {
				return sibling
			}
		}
	}
}

// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - //
// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - //

var goUpForever = func(node *html.Node) bool { return false }
var skipFirstChild = func(node *html.Node) *html.Node { return nil }

func GetPrevNeighborNode(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		FirstChildNode,
		PrevSiblingNode,
		goUpForever,
	)(node)
}
func GetPrevNeighborElement(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		FirstChildElement,
		PrevSiblingElement,
		goUpForever,
	)(node)
}
func GetPrevNeighborNodeExcludingOwnChild(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		skipFirstChild,
		PrevSiblingNode,
		goUpForever,
	)(node)
}
func GetPrevNeighborElementExcludingOwnChild(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		skipFirstChild,
		PrevSiblingElement,
		goUpForever,
	)(node)
}

// - - - - - - - - //

func GetNextNeighborNode(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		FirstChildNode,
		NextSiblingNode,
		goUpForever,
	)(node)
}
func GetNextNeighborElement(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		FirstChildElement,
		NextSiblingElement,
		goUpForever,
	)(node)
}
func GetNextNeighborNodeExcludingOwnChild(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		skipFirstChild,
		NextSiblingNode,
		goUpForever,
	)(node)
}
func GetNextNeighborElementExcludingOwnChild(node *html.Node) *html.Node {
	return UNSTABLE_initGetNeighbor(
		skipFirstChild,
		NextSiblingElement,
		goUpForever,
	)(node)
}
