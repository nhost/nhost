package commonmark

import (
	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/domutils"
	"golang.org/x/net/html"
)

func nameIsBold(node *html.Node) bool {
	name := dom.NodeName(node)
	return name == "strong" || name == "b"
}
func nameIsItalic(node *html.Node) bool {
	name := dom.NodeName(node)
	return name == "em" || name == "i"
}

func nameIsBoldOrItalic(node *html.Node) bool {
	return nameIsBold(node) || nameIsItalic(node)
}
func nameIsBothBoldOrItalic(a, b *html.Node) bool {
	if nameIsBold(a) && nameIsBold(b) {
		return true
	}
	if nameIsItalic(a) && nameIsItalic(b) {
		return true
	}

	return false
}

func nameIsPre(node *html.Node) bool {
	name := dom.NodeName(node)
	return name == "pre"
}
func nameIsInlineCode(node *html.Node) bool {
	name := dom.NodeName(node)
	return name == "code" || name == "var" || name == "samp" || name == "kbd" || name == "tt"
}

func nameIsLink(node *html.Node) bool {
	return dom.NodeName(node) == "a"
}

func nameIsBothLink(a, b *html.Node) bool {
	return dom.NodeName(a) == "a" && dom.NodeName(b) == "a"
}

func nameIsHeading(node *html.Node) bool {
	name := dom.NodeName(node)

	if name == "h1" || name == "h2" || name == "h3" || name == "h4" || name == "h5" || name == "h6" {
		return true
	}
	return false
}

// func nameIsBlockquote(node *html.Node) bool {
// 	return dom.NodeName(node) == "blockquote"
// }

func (c *commonmark) handlePreRender(ctx converter.Context, doc *html.Node) {
	domutils.RenameFakeSpans(ctx, doc)

	// domutils.SplitUp(ctx, doc, nameIsBoldOrItalic, nameIsLink, atom.Span)

	// domutils.SplitUp(ctx, doc, nameIsLink, nameIsHeading, atom.Div)
	// domutils.SplitUp(ctx, doc, nameIsLink, nameIsBlockquote, atom.Div)

	// - - - Bold / Italic - - - //
	domutils.RemoveRedundant(doc, nameIsBothBoldOrItalic)
	domutils.MergeAdjacent(doc, nameIsBoldOrItalic)

	// domutils.MovePunctuation(ctx, doc, nameIsBoldOrItalic)

	// - - - Code - - - //
	domutils.RemoveEmptyCode(ctx, doc)
	domutils.SwapTags(ctx, doc, nameIsInlineCode, nameIsPre)
	domutils.MergeAdjacent(doc, nameIsInlineCode)

	domutils.AddSpace(ctx, doc, nameIsBoldOrItalic, nameIsInlineCode)

	// - - - Link - - - //
	domutils.RemoveRedundant(doc, nameIsBothLink)
	domutils.SwapTags(ctx, doc, nameIsBoldOrItalic, nameIsLink)

	// - - - Heading - - - //
	domutils.SwapTags(ctx, doc, nameIsLink, nameIsHeading)
	domutils.LeafBlockAlternatives(ctx, doc)

	// - - - List - - - //
	domutils.MoveListItems(ctx, doc)
}
