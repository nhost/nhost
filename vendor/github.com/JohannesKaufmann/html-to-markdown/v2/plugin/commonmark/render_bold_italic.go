package commonmark

import (
	"bytes"

	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/textutils"
	"golang.org/x/net/html"
)

func (c commonmark) getDelimiter(n *html.Node) []byte {
	name := dom.NodeName(n)
	if name == "strong" || name == "b" {
		return []byte(c.StrongDelimiter)
	} else if name == "em" || name == "i" {
		return []byte(c.EmDelimiter)
	} else {
		return nil
	}
}
func (c commonmark) renderBoldItalic(ctx converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	var buf bytes.Buffer
	ctx.RenderChildNodes(ctx, &buf, n)

	// Depending on the options & whether it is bold or italic there
	// is going to be a different delimiter.
	delimiter := c.getDelimiter(n)
	content := buf.Bytes()

	// If there is a newline character between the start and end delimiter
	// the delimiters won't be recognized. Either we remove all newline characters
	// OR on _every_ line we put start & end delimiters.
	content = textutils.DelimiterForEveryLine(content, delimiter)

	w.Write(content)

	return converter.RenderSuccess
}
