# dom

[![Go Reference](https://pkg.go.dev/badge/github.com/JohannesKaufmann/dom.svg)](https://pkg.go.dev/github.com/JohannesKaufmann/dom)

Helper functions for "net/html" that make it easier to interact with `*html.Node`.

🚀 [Getting Started](#getting-started) - 📚 [Documentation](#documentation) - 🧑‍💻 [Examples](/examples/)

## Installation

```bash
go get -u github.com/JohannesKaufmann/dom
```

> [!NOTE]
> This "dom" libary was developed for the needs of the [html-to-markdown](https://github.com/JohannesKaufmann/html-to-markdown) library.
> That beeing said, please submit any functions that you need.

## Getting Started

```go
package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func main() {
	input := `
	<ul>
		<li><a href="github.com/JohannesKaufmann/dom">dom</a></li>
		<li><a href="github.com/JohannesKaufmann/html-to-markdown">html-to-markdown</a></li>
	</ul>
	`

	doc, err := html.Parse(strings.NewReader(input))
	if err != nil {
		log.Fatal(err)
	}

	// - - - //

	firstLink := dom.FindFirstNode(doc, func(node *html.Node) bool {
		return dom.NodeName(node) == "a"
	})

	fmt.Println("href:", dom.GetAttributeOr(firstLink, "href", ""))
}
```

## Node vs Element

The naming scheme in this library is:

- "Node" means `*html.Node{}`
  - This means _any_ node in the tree of nodes.
- "Element" means `*html.Node{Type: html.ElementNode}`
  - This means _only_ nodes with the type of `ElementNode`. For example `<p>`, `<span>`, `<a>`, ... but not `#text`, `<!--comment-->`, ...

For most functions, there are two versions. For example:

- `FirstChildNode()` and `FirstChildElement()`
- `AllChildNodes()` and `AllChildElements()`
- ...

## Documentation

[![Go Reference](https://pkg.go.dev/badge/github.com/JohannesKaufmann/dom.svg)](https://pkg.go.dev/github.com/JohannesKaufmann/dom)

### Attributes & Content

You can get the attributes of a node using `GetAttribute`, `GetAttributeOr` or the more specialized `GetClasses` that returns a slice of strings.

For matching nodes, `HasID` and `HasClass` can be used.

If you want to collect the #text of all the child nodes, you can call `CollectText`.

```go
name := dom.NodeName(node)
// "h2"

href := dom.GetAttributeOr(node, "href", "")
// "github.com"

isHeading := dom.HasClass(node, "repo__name")
// `true`

content := dom.CollectText(node)
// "Lorem ipsum"
```

---

### Children & Siblings

You can already use `node.FirstChild` to get the first child _node_. For the convenience we added `FirstChildNode()` and `FirstChildElement()` which returns `*html.Node`.

To get all direct children, use `AllChildNodes` and `AllChildElements` which returns `[]*html.Node`.

- `PrevSiblingNode` and `PrevSiblingElement`

- `NextSiblingNode` and `NextSiblingElement`

### Find Nodes

Searching for nodes deep in the tree is made easier with:

```go
firstParagraph := dom.FindFirstNode(doc, func(node *html.Node) bool {
    return dom.NodeName(node) == "p"
})
// *html.Node


allParagraphs := dom.FindAllNodes(doc, func(node *html.Node) bool {
    return dom.NodeName(node) == "p"
})
// []*html.Node
```

- 🧑‍💻 [Example code, find](/examples/find/main.go)
- 🧑‍💻 [Example code, selectors](/examples/selectors/main.go)

---

### Get next/previous neighbors

What is special about this? The order!

If you are somewhere in the DOM, you can call `GetNextNeighborNode` to get the next node, even if it is _further up_ the tree. The order is the same as you would see the elements in the DOM.

```go
node := startNode
for node != nil {
    fmt.Println(dom.NodeName(node))

    node = dom.GetNextNeighborNode(node)
}
```

If we start the `for` loop at the `<button>` and repeatedly call `GetNextNeighborNode` this would be the _order_ that the nodes are _visited_.

```text
#document
├─html
│ ├─head
│ ├─body
│ │ ├─nav
│ │ │ ├─p
│ │ │ │ ├─#text "up"
│ │ ├─main
│ │ │ ├─button   *️⃣
│ │ │ │ ├─span  0️⃣
│ │ │ │ │ ├─#text "start"  1️⃣
│ │ │ ├─div  2️⃣
│ │ │ │ ├─h3  3️⃣
│ │ │ │ │ ├─#text "heading"  4️⃣
│ │ │ │ ├─p  5️⃣
│ │ │ │ │ ├─#text "description"  6️⃣
│ │ ├─footer  7️⃣
│ │ │ ├─p  8️⃣
│ │ │ │ ├─#text "down"  9️⃣
```

If you only want to visit the ElementNode's (and skip the `#text` Nodes) you can use `GetNextNeighborElement` instead.

If you want to skip the children you can use `GetNextNeighborNodeExcludingOwnChild`. In the example above, when starting at the `<button>` the next node would be the `<div>`.

The same functions also exist for the previous nodes, e.g. `GetPrevNeighborNode`.

- 🧑‍💻 [Example code, next basics](/examples/next_basics/main.go)
- 🧑‍💻 [Example code, next inside a loop](/examples/next_loop/main.go)

---

### Remove & Replace Node

```go
if dom.HasClass(node, "lang__old") {
	newNode := &html.Node{
		Type: html.TextNode,
		Data: "🪦",
	}
	dom.ReplaceNode(node, newNode)
}


for _, node := range emptyTextNodes {
	dom.RemoveNode(node)
}
```

- 🧑‍💻 [Example code, remove and replace](/examples/remove_replace/main.go)

### Unwrap Node

```text
#document
├─html
│ ├─head
│ ├─body
│ │ ├─article   *️⃣
│ │ │ ├─h3
│ │ │ │ ├─#text "Heading"
│ │ │ ├─p
│ │ │ │ ├─#text "short description"
```

If we take the input above and run `UnwrapNode(articleNode)` we can "unwrap" the `<article>`. That means removing the `<article>` while _keeping_ the children (`<h3>` and `<p>`).

```text
#document
├─html
│ ├─head
│ ├─body
│ │ ├─h3
│ │ │ ├─#text "Heading"
│ │ ├─p
│ │ │ ├─#text "short description"
```

For the reverse you can use `WrapNode(existingNode, newNode)`.

---

### RenderRepresentation

```go
import (
	"fmt"
	"log"
	"strings"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func main() {
	input := `<a href="/about">Read More</a>`

	doc, err := html.Parse(strings.NewReader(input))
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(dom.RenderRepresentation(doc))
}
```

The tree representation helps to visualize the tree-structure of the DOM.
And the `#text` nodes stand out.

> [!TIP]
> This function could be useful for debugging & testcases.
> For example in [neighbors_test.go](/neighbors_test.go)

```text
#document
├─html
│ ├─head
│ ├─body
│ │ ├─a (href=/about)
│ │ │ ├─#text "Read More"
```

While the normal "net/html" [`Render()`](https://pkg.go.dev/golang.org/x/net/html#Render) function would have produced this:

```
<html><head></head><body><a href="/about">Read More</a></body></html>
```

- 🧑‍💻 [Example code, dom representation](/examples/dom_representation/main.go)
