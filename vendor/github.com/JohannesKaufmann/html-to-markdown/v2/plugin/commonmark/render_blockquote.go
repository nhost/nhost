package commonmark

import (
	"bytes"

	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/textutils"
	"golang.org/x/net/html"
)

func (c *commonmark) renderBlockquote(ctx converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	var buf bytes.Buffer
	ctx.RenderChildNodes(ctx, &buf, n)

	content := buf.Bytes()
	content = bytes.TrimSpace(content)
	if content == nil {
		return converter.RenderSuccess
	}

	content = textutils.TrimConsecutiveNewlines(content)
	content = textutils.TrimUnnecessaryHardLineBreaks(content)
	content = textutils.PrefixLines(content, []byte{'>', ' '})

	w.WriteRune('\n')
	w.WriteRune('\n')
	w.Write(content)
	w.WriteRune('\n')
	w.WriteRune('\n')

	return converter.RenderSuccess
}
