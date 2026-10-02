package collapse

import (
	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

var blockElements = []string{
	"address", "article", "aside", "audio", "blockquote", "body", "canvas", "center", "dd", "dir", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer", "form", "frameset", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "html", "isindex", "li", "main", "menu", "nav", "noframes", "noscript", "ol", "output", "p", "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
}

var voidElements = []string{
	// Note: Compared to the javascript implementation, I removed "source"
	"area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link", "meta", "param" /* "source, "*/, "track", "wbr",
}

var defaultIsBlockNode = func(node *html.Node) bool {
	name := dom.NodeName(node)

	for _, elem := range blockElements {
		if elem == name {
			return true
		}
	}
	return false
}
var defaultIsVoidNode = func(node *html.Node) bool {
	name := dom.NodeName(node)

	for _, elem := range voidElements {
		if elem == name {
			return true
		}
	}
	return false
}
var defaultIsPreformattedNode = func(node *html.Node) bool {
	// Note: Originally in the javascript version, this just checked for "pre".
	// I changed it, to also return true for "code"
	name := dom.NodeName(node)

	return name == "pre" || name == "code"
}
