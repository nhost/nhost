package commonmark

import (
	"bytes"
	"fmt"
	"strconv"
	"unicode/utf8"

	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/textutils"
	"github.com/JohannesKaufmann/html-to-markdown/v2/marker"
	"golang.org/x/net/html"
)

func getStartAt(node *html.Node) int {
	startVal := dom.GetAttributeOr(node, "start", "1")
	startAt, err := strconv.Atoi(startVal)
	if err != nil {
		startAt = 1
	}

	return startAt
}

func (c commonmark) getPrefixFunc(n *html.Node, sliceLength int) func(int) string {
	startAt := getStartAt(n)

	return func(sliceIndex int) string {
		if n.Data == "ul" {
			return c.BulletListMarker + " "
		}

		currentIndex := startAt + sliceIndex
		lastIndex := startAt + sliceLength - 1
		maxLength := utf8.RuneCountInString(strconv.Itoa(lastIndex))

		// Pad the numbers so that all prefix numbers in the list take up the same space
		// `%02d.` -> "01. "
		format := `%0` + strconv.Itoa(maxLength) + `d. `
		return fmt.Sprintf(format, currentIndex)
	}
}

func renderMultiLineListItem(w converter.Writer, content []byte, indentCount int) {
	lines := bytes.Split(content, []byte("\n"))
	indent := bytes.Repeat([]byte(" "), indentCount)

	indentedCodeBlockNewline := append(marker.BytesMarkerCodeBlockNewline, indent...)

	for i := range lines {
		// Add indent to code block newlines
		line := bytes.ReplaceAll(lines[i], marker.BytesMarkerCodeBlockNewline, indentedCodeBlockNewline)

		if i != 0 {
			// The first line is already indented through the prefix,
			// all other lines need the correct amount of spaces.
			w.Write(indent)
		}
		w.Write(line)

		if i < len(lines)-1 {
			w.WriteRune('\n')
		}
	}
}

func (c commonmark) renderListContainer(ctx converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	children := dom.AllChildNodes(n)
	items := make([][]byte, 0, len(children))

	for _, child := range children {
		var buf bytes.Buffer
		ctx.RenderNodes(ctx, &buf, child)

		content := buf.Bytes()
		content = bytes.TrimSpace(content)
		if content == nil {
			continue
		}

		items = append(items, content)
	}

	if len(items) == 0 {
		return converter.RenderSuccess
	}

	getPrefix := c.getPrefixFunc(n, len(items))
	indentCount := utf8.RuneCountInString(getPrefix(0))

	w.WriteString("\n\n")
	for i, item := range items {
		w.WriteString(getPrefix(i))

		item = textutils.TrimConsecutiveNewlines(item)
		item = textutils.TrimUnnecessaryHardLineBreaks(item)
		item = ctx.UnEscapeContent(item)

		// An item might have different lines that each
		// must be indented with the correct count of spaces.
		renderMultiLineListItem(w, item, indentCount)

		if i < len(items)-1 {
			w.WriteRune('\n')
		}
	}
	w.WriteString("\n\n")

	return converter.RenderSuccess
}
