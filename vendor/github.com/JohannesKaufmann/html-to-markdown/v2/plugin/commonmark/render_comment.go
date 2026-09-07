package commonmark

import (
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/domutils"
	"golang.org/x/net/html"
)

func (c *commonmark) renderComment(_ converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {

	if n.Data == domutils.ListEndCommentData {
		// We definitely want to render the list end comments
		// that were just added
		w.WriteRune('\n')
		w.WriteRune('\n')
		_ = html.Render(w, n)
		w.WriteRune('\n')
		w.WriteRune('\n')
		return converter.RenderSuccess

	}

	// Fallback to the normal settings for comments
	return converter.RenderTryNext
}
