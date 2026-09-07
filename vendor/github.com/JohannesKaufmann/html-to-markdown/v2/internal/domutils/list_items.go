package domutils

import (
	"context"
	"strings"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
	"golang.org/x/net/html/atom"
)

// MoveListItems moves non-"li" nodes into the previous "li" nodes.
func MoveListItems(ctx context.Context, n *html.Node) {
	if n.Type == html.ElementNode && (n.Data == "ol" || n.Data == "ul") {
		var previousLi *html.Node

		// Collect children to avoid modifying the slice while iterating.
		children := dom.AllChildNodes(n)

		for _, child := range children {
			if child.Type == html.ElementNode && child.Data == "li" {
				previousLi = child
			} else if child.Type == html.TextNode && strings.TrimSpace(child.Data) == "" {
				// Skip the node, probably just formatting of code
			} else {
				// We expect that inside an "ol"/"ul" there are *only* "li" nodes.
				// But sometimes that is not the case...

				if previousLi != nil {
					// There is a previous "li" node,
					// so we move this content into the other "li" node.
					n.RemoveChild(child)

					previousLi.AppendChild(child)
				} else {
					// There is no previous "li" node,
					// so we wrap this node with it's own "li" node.

					newNode := &html.Node{
						Type:     html.ElementNode,
						DataAtom: atom.Li,
						Data:     "li",
					}
					previousLi = dom.WrapNode(child, newNode)
				}
			}
		}
	}

	for c := n.FirstChild; c != nil; c = c.NextSibling {
		MoveListItems(ctx, c)
	}
}
