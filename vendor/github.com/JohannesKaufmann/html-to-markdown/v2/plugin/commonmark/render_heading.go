package commonmark

import (
	"bytes"
	"regexp"

	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/textutils"
	"github.com/JohannesKaufmann/html-to-markdown/v2/marker"
	"golang.org/x/net/html"
)

// TODO: remove regex
var multipleSpacesR = regexp.MustCompile(`  +`)

func (r *commonmark) setextUnderline(level int, width int) []byte {
	line := "-"
	if level == 1 {
		line = "="
	}

	return bytes.Repeat([]byte(line), width)
}
func (r *commonmark) atxPrefix(level int) []byte {
	return bytes.Repeat([]byte("#"), level)
}

func getHeadingLevel(name string) int {
	switch name {
	case "h1":
		return 1
	case "h2":
		return 2
	case "h3":
		return 3
	case "h4":
		return 4
	case "h5":
		return 5
	case "h6":
		return 6
	default:
		return 6
	}
}
func runeCount(chars []rune) (count int) {
	for _, char := range chars {
		if char == marker.MarkerEscaping {
			continue
		}
		count++
	}
	return
}
func getUnderlineWidth(content []byte, minVal int) int {
	var width int

	parts := bytes.Split(content, []byte("\n"))
	for _, part := range parts {
		// Count how wide the line should be,
		// while using RuneCount to correctly count ä, ö, ...
		//
		// TODO: optimize function w := utf8.RuneCount(part)
		w := runeCount([]rune(string(part)))
		if w > width {
			width = w
		}
	}

	// Technically the minimum value is only one character,
	// but one dash could easily trigger a heading.
	if width < minVal {
		return minVal
	}

	return width
}

func escapePoundSignAtEnd(s []byte) []byte {
	// -1 #
	// -2 placeholder
	// -3 maybe \

	if s[len(s)-1] != '#' {
		// We don't have a # at the end,
		// so there is no work to do...
		return s
	}
	if len(s) >= 3 && s[len(s)-3] == '\\' {
		// It is already escaped,
		// so there is no work to do...
		return s
	}

	// Because we have a # at the end,
	// we should manually force the escaping
	// by overriding the placeholder.
	s[len(s)-2] = '\\'

	return s
}

func (c *commonmark) renderHeading(ctx converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	// ctx = context.WithValue(ctx, "is_inside_heading", true)

	level := getHeadingLevel(dom.NodeName(n))

	var buf bytes.Buffer
	ctx.RenderChildNodes(ctx, &buf, n)
	content := buf.Bytes()

	if len(bytes.TrimSpace(content)) == 0 {
		return converter.RenderSuccess
	}

	if c.HeadingStyle == HeadingStyleSetext && level < 3 {
		// Note: We don't want to use `TrimUnnecessaryHardLineBreaks` here,
		// since `EscapeMultiLine` also takes care of newlines.
		content = textutils.TrimConsecutiveNewlines(content)
		content = textutils.EscapeMultiLine(content)

		width := getUnderlineWidth(content, 3)
		underline := c.setextUnderline(level, width)

		w.WriteString("\n\n")
		w.Write(content)
		w.WriteRune('\n')
		w.Write(underline)
		w.WriteString("\n\n")
	} else {
		content = bytes.ReplaceAll(content, []byte("\n"), []byte(" "))
		content = bytes.ReplaceAll(content, []byte("\r"), []byte(" "))
		// Replace multiple spaces by one space.
		content = multipleSpacesR.ReplaceAll(content, []byte(" "))

		content = bytes.TrimSpace(content)

		// A # sign at the end would be removed otherwise
		content = escapePoundSignAtEnd(content)

		w.WriteString("\n\n")
		w.Write(c.atxPrefix(level))
		w.WriteRune(' ')
		w.Write(content)
		w.WriteString("\n\n")
	}

	return converter.RenderSuccess
}
