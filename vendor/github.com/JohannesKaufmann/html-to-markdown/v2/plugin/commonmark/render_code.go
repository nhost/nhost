package commonmark

import (
	"bytes"
	"strings"
	"unicode/utf8"

	"github.com/JohannesKaufmann/dom"
	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/textutils"
	"github.com/JohannesKaufmann/html-to-markdown/v2/marker"
	"golang.org/x/net/html"
)

func (c *commonmark) renderInlineCode(_ converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	// TODO: configure delimeter in options?
	fenceChar := '`'

	codeContent, _ := getCodeWithoutTags(n)

	// TODO: debug flag?
	if len(codeContent) == 0 {
		// fmt.Println("expected an empty inline code to be already removed")
		// panic("expected an empty inline code to be already removed")
	}
	// TODO: configurable function to decide if inline or block?
	if bytes.Contains(codeContent, []byte("\n")) {
		// fmt.Println("inline code contains newlines")
		// return c.renderBlockCode(ctx, w, n, render)
	}

	if bytes.TrimSpace(codeContent) == nil {
		// No stripping occurs if the code span contains _only_ spaces:
		w.WriteRune(fenceChar)
		w.Write(codeContent)
		w.WriteRune(fenceChar)
		return converter.RenderSuccess
	}

	// Newlines in the text aren't great, since this is inline code and not a code block.
	// Newlines will be stripped anyway in the browser, but it won't be recognized as code
	// from the markdown parser when there is more than one newline.
	codeContent = textutils.CollapseInlineCodeContent(codeContent)

	code := string(codeContent)

	maxCount := textutils.CalculateCodeFenceOccurrences(fenceChar, code)
	maxCount++

	fence := strings.Repeat(string(fenceChar), maxCount)

	// Code contains a backtick as first character
	if strings.HasPrefix(code, "`") {
		code = " " + code
	}
	// Code contains a backtick as last character
	if strings.HasSuffix(code, "`") {
		code = code + " "
	}

	w.WriteString(fence)
	w.WriteString(code)
	w.WriteString(fence)

	return converter.RenderSuccess
}
func (c *commonmark) renderBlockCode(_ converter.Context, w converter.Writer, n *html.Node) converter.RenderStatus {
	code, infoString := getCodeWithoutTags(n)

	if bytes.HasSuffix(code, []byte("\n")) {
		code = code[:len(code)-1]
	}

	fenceChar, _ := utf8.DecodeRuneInString(c.CodeBlockFence)
	fence := textutils.CalculateCodeFence(fenceChar, string(code))

	// We want to keep the original content inside the code block untouched.
	// Because multiple newlines would be trimmed, we temporarily replace it with another character.
	code = bytes.ReplaceAll(code, []byte("\n"), marker.BytesMarkerCodeBlockNewline)

	w.WriteString("\n\n")
	w.WriteString(fence)
	w.WriteString(infoString)
	w.WriteRune('\n')
	w.Write(code)
	w.WriteRune('\n')
	w.WriteString(fence)
	w.WriteString("\n\n")

	return converter.RenderSuccess
}

func getCodeLanguage(n *html.Node) string {
	class := dom.GetAttributeOr(n, "class", "")

	parts := strings.Split(class, " ")
	for _, part := range parts {
		if !strings.Contains(part, "language-") && !strings.Contains(part, "lang-") {
			continue
		}

		part = strings.Replace(part, "language-", "", 1)
		part = strings.Replace(part, "lang-", "", 1)

		return part
	}

	return ""
}
func getCodeWithoutTags(startNode *html.Node) ([]byte, string) {
	var buf bytes.Buffer
	var infoString string

	var f func(*html.Node)
	f = func(n *html.Node) {
		if n.Type == html.ElementNode && (n.Data == "code" || n.Data == "pre") {

			// TODO: what if multiple elements have an info string?
			if infoString == "" {
				infoString = getCodeLanguage(n)
			}
		}

		// - - - //

		if n.Type == html.ElementNode && (n.Data == "style" || n.Data == "script" || n.Data == "textarea") {
			return
		}
		if n.Type == html.ElementNode && (n.Data == "br" || n.Data == "div") {
			buf.WriteString("\n")
		}

		if n.Type == html.TextNode {
			// if strings.TrimSpace(n.Data) == "" && strings.Contains(n.Data, "\n") {
			// 	buf.WriteString("\n")
			// }
			buf.WriteString(n.Data)
			return
		}

		for c := n.FirstChild; c != nil; c = c.NextSibling {
			f(c)
		}
	}

	f(startNode)

	return buf.Bytes(), infoString
}
