package commonmark

import (
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"golang.org/x/net/html"
)

func (c *commonmark) renderBreak(_ converter.Context, w converter.Writer, _ *html.Node) converter.RenderStatus {
	// Render a "hard line break"
	w.WriteString("  \n")
	return converter.RenderSuccess
}
