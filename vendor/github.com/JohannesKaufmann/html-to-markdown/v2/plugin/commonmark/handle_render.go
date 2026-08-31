package commonmark

import (
	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"golang.org/x/net/html"
)

func (c *commonmark) handleRender(ctx converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	name := dom.NodeName(n)

	switch name {
	case "strong", "b",
		"em", "i":
		return c.renderBoldItalic(ctx, w, n)
	case "hr":
		return c.renderDivider(ctx, w, n)
	case "br":
		return c.renderBreak(ctx, w, n)
	case "ul", "ol":
		return c.renderListContainer(ctx, w, n)

	case "pre":
		return c.renderBlockCode(ctx, w, n)
	case "code",
		"var", "samp", "kbd", "tt":
		return c.renderInlineCode(ctx, w, n)

	case "blockquote":
		return c.renderBlockquote(ctx, w, n)

	case "h1", "h2", "h3", "h4", "h5", "h6":
		return c.renderHeading(ctx, w, n)

	case "img":
		return c.renderImage(ctx, w, n)

	case "a":
		return c.renderLink(ctx, w, n)

	case "#comment":
		return c.renderComment(ctx, w, n)
	}

	return converter.RenderTryNext

}
