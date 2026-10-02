package domutils

import (
	"context"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func isFakeSpan(node *html.Node) bool {
	name := dom.NodeName(node)
	if name != "span" {
		return false
	}

	var containsBlockNode = false

	var finder func(*html.Node)
	finder = func(node *html.Node) {
		name := dom.NodeName(node)
		if dom.NameIsBlockNode(name) {
			containsBlockNode = true
			return
		}

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			finder(child)
		}
	}
	finder(node)

	return containsBlockNode
}

// RenameFakeSpans renames all "span" nodes to "div" if
// any block element is found as a child.
func RenameFakeSpans(ctx context.Context, doc *html.Node) {
	var finder func(node *html.Node)
	finder = func(node *html.Node) {
		if isFakeSpan(node) {
			node.Data = "div"
		}

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			finder(child)
		}
	}

	finder(doc)
}
