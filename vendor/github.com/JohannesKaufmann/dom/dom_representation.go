package dom

import (
	"bytes"
	"fmt"
	"strings"

	"golang.org/x/net/html"
)

func writePipeChar(buf *bytes.Buffer, index int) {
	if index == 0 {
		return
	}
	buf.WriteString(strings.Repeat("│ ", index-1))
	buf.WriteString("├─")
}
func writeNode(buf *bytes.Buffer, node *html.Node) {
	name := NodeName(node)
	buf.WriteString(name)

	if len(node.Attr) != 0 {
		buf.WriteString(" (")
	}
	for i, attr := range node.Attr {
		buf.WriteString(fmt.Sprintf("%s=%q", attr.Key, attr.Val))

		if i < len(node.Attr)-1 {
			buf.WriteString(" ")
		}
	}
	if len(node.Attr) != 0 {
		buf.WriteString(")")
	}

	if name == "#text" {
		buf.WriteString(fmt.Sprintf(" %q", node.Data))
	}

}

// RenderRepresentation is useful for debugging.
// It renders out the *structure* of the dom.
func RenderRepresentation(startNode *html.Node) string {
	var buf bytes.Buffer
	var finder func(*html.Node, int)
	finder = func(node *html.Node, index int) {
		writePipeChar(&buf, index)
		writeNode(&buf, node)
		buf.WriteRune('\n')

		for child := node.FirstChild; child != nil; child = child.NextSibling {
			finder(child, index+1)
		}
	}

	if startNode.Parent == nil {
		finder(startNode, 0)
	} else {
		finder(startNode, 1)
	}

	return strings.TrimSpace(buf.String())
}
