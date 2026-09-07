package domutils

import (
	"context"
	"slices"
	"strings"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func swapTagsOfNodes(node1, node2 *html.Node) {
	if node1.Type != html.ElementNode || node2.Type != html.ElementNode {
		panic("swap only works with element nodes")
	}

	tempDataAtom := node1.DataAtom
	tempData := node1.Data
	tempAttr := node1.Attr

	node1.DataAtom = node2.DataAtom
	node1.Data = node2.Data
	node1.Attr = node2.Attr

	node2.DataAtom = tempDataAtom
	node2.Data = tempData
	node2.Attr = tempAttr
}

func isEmptyText(node *html.Node) bool {
	return node.Type == html.TextNode && strings.TrimSpace(node.Data) == ""
}
func SwapTags(ctx context.Context, doc *html.Node, isOuterNode, isInnerNode func(*html.Node) bool) {
	var finder func(*html.Node)
	finder = func(node *html.Node) {
		if isOuterNode(node) {
			childs := dom.AllChildNodes(node)
			childs = slices.DeleteFunc(childs, isEmptyText)

			if len(childs) == 1 && isInnerNode(childs[0]) {
				swapTagsOfNodes(node, childs[0])
				return
			}
		}

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			finder(child)
		}
	}
	finder(doc)
}
