package base

import (
	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"golang.org/x/net/html"
)

// RenderAsHTML will render the node as HTML using `html.Render()`
// Newlines will be inserted depending on the configured `TagType`.
//
// As an example, you could do such a combination:
//
//	"A text with <strong>bold</strong> and *italic* text"`
func RenderAsHTML(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	tagName := dom.NodeName(node)
	tagType, _ := ctx.GetTagType(tagName)

	if tagType == converter.TagTypeBlock {
		w.WriteString("\n\n")
	}
	_ = html.Render(w, node) // TODO: what to do with error?
	if tagType == converter.TagTypeBlock {
		w.WriteString("\n\n")
	}

	return converter.RenderSuccess
}

// RenderAsHTMLWrapper will render the node as HTML
// and render the children as markdown.
func RenderAsHTMLWrapper(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	name := dom.NodeName(node)

	w.WriteString("<")
	w.WriteString(name)
	// TODO: also render the attributes?
	w.WriteString(">\n\n")

	ctx.RenderChildNodes(ctx, w, node)

	w.WriteString("\n\n</")
	w.WriteString(name)
	w.WriteString(">")
	return converter.RenderSuccess
}

// RenderAsPlaintextWrapper will keep the children of this node as markdown.
func RenderAsPlaintextWrapper(ctx converter.Context, w converter.Writer, node *html.Node) converter.RenderStatus {
	tagName := dom.NodeName(node)
	tagType, _ := ctx.GetTagType(tagName)

	if tagType == converter.TagTypeBlock {
		w.WriteString("\n\n")
	}
	ctx.RenderChildNodes(ctx, w, node)
	if tagType == converter.TagTypeBlock {
		w.WriteString("\n\n")
	}

	return converter.RenderSuccess
}
