package converter

import (
	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

func (conv *Converter) handleRenderNodes(ctx Context, w Writer, nodes ...*html.Node) {
	for _, node := range nodes {
		conv.handleRenderNode(ctx, w, node)
	}
}

func (conv *Converter) handleRenderNode(ctx Context, w Writer, node *html.Node) RenderStatus {
	name := dom.NodeName(node)

	// - - A: the #text node - - //
	if name == "#text" {
		return conv.handleRenderText(ctx, w, node)
	}

	// - - B: the render handlers - - //
	for _, handler := range conv.getRenderHandlers() {
		status := handler.Value(ctx, w, node)
		if status == RenderSuccess {
			return status
		}
	}

	// - - C: the fallback - - //
	// If nothing works we fallback to this:
	return conv.handleRenderFallback(ctx, w, node)
}

func (conv *Converter) handleRenderFallback(ctx Context, w Writer, node *html.Node) RenderStatus {

	tagName := dom.NodeName(node)
	tagType, _ := ctx.GetTagType(tagName)

	if tagType == TagTypeBlock {
		w.WriteRune('\n')
		w.WriteRune('\n')
	}
	ctx.RenderChildNodes(ctx, w, node)
	if tagType == TagTypeBlock {
		w.WriteRune('\n')
		w.WriteRune('\n')
	}

	return RenderSuccess
}
func (conv *Converter) handleRenderText(ctx Context, w Writer, node *html.Node) RenderStatus {
	content := node.Data

	for _, handler := range conv.getTextTransformHandlers() {
		content = handler.Value(ctx, content)
	}

	w.WriteString(content)
	return RenderSuccess
}
