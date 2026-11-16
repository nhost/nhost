package domutils

import (
	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func RemoveRedundant(doc *html.Node, matchFn func(*html.Node, *html.Node) bool) {
	for _, node := range dom.AllNodes(doc) {
		if hasSameTypeAncestor(node, matchFn) {
			dom.UnwrapNode(node)
		}
	}

}

func hasSameTypeAncestor(n *html.Node, matchFn func(*html.Node, *html.Node) bool) bool {
	if !matchFn(n, n) {
		return false
	}

	for p := n.Parent; p != nil; p = p.Parent {
		if matchFn(n, p) {
			return true
		}
	}

	return false
}
