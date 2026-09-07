package dom

import "golang.org/x/net/html"

// In order to stay consistent with v1 of the library, this follows
// the naming scheme of goquery.
// E.g. "#text", "div", ...
func NodeName(node *html.Node) string {
	if node == nil {
		return ""
	}

	switch node.Type {
	case html.ErrorNode:
		return "#error"
	case html.TextNode:
		return "#text"
	case html.DocumentNode:
		return "#document"
	case html.CommentNode:
		return "#comment"

	case html.DoctypeNode:
		// E.g. for `<!DOCTYPE html>` it would be "html"
		return node.Data
	case html.ElementNode:
		// E.g. "div" or "p"
		return node.Data
	}

	return ""
}

func NameIsInlineNode(name string) bool {
	switch name {
	case
		"#text",
		"a",
		"abbr",
		"acronym",
		"audio",
		"b",
		"bdi",
		"bdo",
		"big",
		"br",
		"button",
		"canvas",
		"cite",
		"code",
		"data",
		"datalist",
		"del",
		"dfn",
		"em",
		"embed",
		"i",
		"iframe",
		"img",
		"input",
		"ins",
		"kbd",
		"label",
		"map",
		"mark",
		"meter",
		"noscript",
		"object",
		"output",
		"picture",
		"progress",
		"q",
		"ruby",
		"s",
		"samp",
		"script",
		"select",
		"slot",
		"small",
		"span",
		"strong",
		"sub",
		"sup",
		"svg",
		"template",
		"textarea",
		"time",
		"u",
		"tt",
		"var",
		"video",
		"wbr":
		return true

	default:
		return false
	}
}

func NameIsBlockNode(name string) bool {
	switch name {
	case
		"address",
		"article",
		"aside",
		"blockquote",
		"details",
		"dialog",
		"dd",
		"div",
		"dl",
		"dt",
		"fieldset",
		"figcaption",
		"figure",
		"footer",
		"form",
		"h1", "h2", "h3", "h4", "h5", "h6",
		"header",
		"hgroup",
		"hr",
		"li",
		"main",
		"nav",
		"ol",
		"p",
		"pre",
		"section",
		"table",
		"ul":

		return true

	default:
		return false
	}
}

func NameIsHeading(name string) bool {
	switch name {
	case
		"h1", "h2", "h3", "h4", "h5", "h6":
		return true
	default:
		return false
	}
}
