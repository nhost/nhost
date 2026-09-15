package domutils

import (
	"context"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

// TODO: make this configurable via the options???
func getMarkdownStructure(name string) string {
	switch name {
	case "#document", "html", "head", "body",
		"blockquote", "ul", "ol", "li":
		// A container block can also contain other blocks.
		return "container_block"

	// Note: "p" would also be part of "leaf_block"
	case "hr", "pre",
		"h1", "h2", "h3", "h4", "h5", "h6":
		// Leaf blocks can contain inline content
		// but NOT other blocks.
		return "leaf_block"

	case "#text", "span", "code",
		"b", "strong", "i", "em",
		"a", "img", "br":
		return "inline"

	case "div", "p":
		// Since these are just placing newlines,
		// we dont categorize them.
		return ""

	default:
		return ""
	}
}

func headingAlternative(ctx context.Context, node *html.Node) {
	node.Data = "strong"

	newChild := &html.Node{
		Type: html.ElementNode,
		Data: "br",
	}
	node.Parent.InsertBefore(newChild, node.NextSibling)
}
func blockquoteAlternative(ctx context.Context, node *html.Node) {
	newBefore := &html.Node{Type: html.TextNode, Data: ` "`}
	node.Parent.InsertBefore(newBefore, node)

	node.Data = "span"

	newAfter := &html.Node{Type: html.TextNode, Data: `" `}
	node.Parent.InsertBefore(newAfter, node.NextSibling)
}
func preAlternative(ctx context.Context, node *html.Node) {
	node.Data = "code"
}
func hrAlternative(ctx context.Context, node *html.Node) {
	dom.RemoveNode(node)
}

// TODO: make this configurable via the options?
var alternatives = map[string]func(ctx context.Context, node *html.Node){
	"h1":         headingAlternative,
	"h2":         headingAlternative,
	"h3":         headingAlternative,
	"h4":         headingAlternative,
	"h5":         headingAlternative,
	"h6":         headingAlternative,
	"blockquote": blockquoteAlternative,
	"pre":        preAlternative,
	"hr":         hrAlternative,
}

func LeafBlockAlternatives(ctx context.Context, doc *html.Node) {
	var finder func(node *html.Node, isInsideLeafBlock bool, isInsideInline bool)
	finder = func(node *html.Node, isInsideLeafBlock bool, isInsideInline bool) {
		name := dom.NodeName(node)

		structure := getMarkdownStructure(name)
		if (structure == "container_block" || structure == "leaf_block") && (isInsideLeafBlock || isInsideInline) {
			// A block inside an inline OR a block inside a leaf-block
			// is not valid markdown so cannot be rendered.
			//
			// For example, you cannot place a blockquote inside a heading.
			//
			// Instead of this weird output (## Heading > My Quote)
			// we try to find alternatives (## Heading "My Quote")
			fn, ok := alternatives[name]
			if ok {
				fn(ctx, node)
			} else {
				node.Data = "span"
			}
		}

		// - - - - - - - - - - - - - - - - - - - - - - //

		if structure == "leaf_block" {
			isInsideLeafBlock = true
		}
		if structure == "inline" {
			isInsideInline = true
		}

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			defer finder(child, isInsideLeafBlock, isInsideInline)
		}
	}
	finder(doc, false, false)
}
