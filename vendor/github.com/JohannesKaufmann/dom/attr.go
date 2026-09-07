package dom

import (
	"bytes"
	"strings"

	"golang.org/x/net/html"
)

func GetAttribute(node *html.Node, key string) (string, bool) {
	for _, attr := range node.Attr {
		if attr.Key == key {
			return attr.Val, true
		}
	}
	return "", false
}
func GetAttributeOr(node *html.Node, key string, fallback string) string {
	for _, attr := range node.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return fallback
}

func GetClasses(node *html.Node) []string {
	val, found := GetAttribute(node, "class")
	if !found {
		return nil
	}

	return strings.Fields(val)
}

func HasID(node *html.Node, expectedID string) bool {
	val, found := GetAttribute(node, "id")
	if !found {
		return false
	}
	return strings.TrimSpace(val) == expectedID
}
func HasClass(node *html.Node, expectedClass string) bool {
	classes := GetClasses(node)
	for _, class := range classes {
		if class == expectedClass {
			return true
		}
	}
	return false
}

// - - - - //

func collectText(n *html.Node, buf *bytes.Buffer) {
	if n.Type == html.TextNode {
		buf.WriteString(n.Data)
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		collectText(c, buf)
	}
}

func CollectText(node *html.Node) string {
	var buf bytes.Buffer
	collectText(node, &buf)
	return buf.String()
}
