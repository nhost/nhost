package commonmark

import (
	"bytes"
	"strings"

	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/textutils"
	"golang.org/x/net/html"
)

func escapeAlt(altString string) string {
	alt := []byte(altString)

	var buf bytes.Buffer
	for i := range alt {
		if alt[i] == '[' || alt[i] == ']' {
			prevIndex := i - 1
			if prevIndex < 0 || alt[prevIndex] != '\\' {
				buf.WriteRune('\\')
			}
		}
		buf.WriteByte(alt[i])
	}

	return buf.String()
}

func (c *commonmark) renderImage(ctx converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	src := dom.GetAttributeOr(n, "src", "")
	src = strings.TrimSpace(src)
	if src == "" {
		return converter.RenderTryNext
	}

	src = ctx.AssembleAbsoluteURL(ctx, "img", src)

	title := dom.GetAttributeOr(n, "title", "")
	title = strings.ReplaceAll(title, "\n", " ")

	alt := dom.GetAttributeOr(n, "alt", "")
	alt = strings.ReplaceAll(alt, "\n", " ")

	// The alt description will be placed between two square brackets `[alt]`
	// so make sure that those characters are escaped.
	alt = escapeAlt(alt)

	w.WriteRune('!')
	w.WriteRune('[')
	w.WriteString(alt)
	w.WriteRune(']')
	w.WriteRune('(')
	w.WriteString(src)
	if title != "" {
		// The destination and title must be seperated by a space
		w.WriteRune(' ')
		w.Write(textutils.SurroundByQuotes([]byte(title)))
	}
	w.WriteRune(')')

	return converter.RenderSuccess
}
