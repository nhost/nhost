package converter

import (
	"errors"
	"fmt"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

type register struct {
	conv *Converter
}

func (r *register) Plugin(plugin Plugin) {
	pluginName := plugin.Name()
	if pluginName == "" {
		r.conv.setError(errors.New("the plugin has no name"))
		return
	}

	r.conv.m.Lock()
	r.conv.registeredPlugins = append(r.conv.registeredPlugins, pluginName)
	r.conv.m.Unlock()

	err := plugin.Init(r.conv)
	if err != nil {
		r.conv.setError(fmt.Errorf("error while initializing %q plugin: %w", pluginName, err))
		return
	}
}

// - - - - - - - - - - - - - Pre-Render - - - - - - - - - - - - - //

type HandlePreRenderFunc func(ctx Context, doc *html.Node)

func (r *register) PreRenderer(fn HandlePreRenderFunc, priority int) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	handler := prioritized(fn, priority)
	r.conv.preRenderHandlers = append(r.conv.preRenderHandlers, handler)
}
func (conv *Converter) getPreRenderHandlers() prioritizedSlice[HandlePreRenderFunc] {
	conv.m.RLock()
	defer conv.m.RUnlock()

	handlers := make(prioritizedSlice[HandlePreRenderFunc], len(conv.preRenderHandlers))
	copy(handlers, conv.preRenderHandlers)
	handlers.Sort()

	return handlers
}

// - - - - - - - - - - - - - Render - - - - - - - - - - - - - //

// Writer is an interface that only conforms to the Write* methods of bytes.Buffer
type Writer interface {
	Write(p []byte) (n int, err error)
	WriteByte(c byte) error
	WriteRune(r rune) (n int, err error)
	WriteString(s string) (n int, err error)
}

type HandleRenderFunc func(ctx Context, w Writer, n *html.Node) RenderStatus

func (r *register) Renderer(fn HandleRenderFunc, priority int) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	handler := prioritized(fn, priority)
	r.conv.renderHandlers = append(r.conv.renderHandlers, handler)
}

// RendererFor registers a renderer for a specific tag (e.g. "div").
// It is a small wrapper around `TagType()` and `Renderer()`.
func (r *register) RendererFor(tagName string, tagType tagType, renderFn HandleRenderFunc, priority int) {

	// 1. we add the "tagType" to the map
	r.TagType(tagName, tagType, priority)

	// 2. we register the render function
	r.Renderer(func(ctx Context, w Writer, n *html.Node) RenderStatus {
		if dom.NodeName(n) == tagName {
			return renderFn(ctx, w, n)
		}
		return RenderTryNext
	}, priority)
}

func (conv *Converter) getRenderHandlers() prioritizedSlice[HandleRenderFunc] {
	conv.m.RLock()
	defer conv.m.RUnlock()

	handlers := make(prioritizedSlice[HandleRenderFunc], len(conv.renderHandlers))
	copy(handlers, conv.renderHandlers)
	handlers.Sort()

	return handlers
}

// - - - - - - - - - - - - - Post Render - - - - - - - - - - - - - //

type HandlePostRenderFunc func(ctx Context, content []byte) []byte

func (r *register) PostRenderer(fn HandlePostRenderFunc, priority int) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	handler := prioritized(fn, priority)
	r.conv.postRenderHandlers = append(r.conv.postRenderHandlers, handler)
}
func (conv *Converter) getPostRenderHandlers() prioritizedSlice[HandlePostRenderFunc] {
	conv.m.RLock()
	defer conv.m.RUnlock()

	handlers := make(prioritizedSlice[HandlePostRenderFunc], len(conv.postRenderHandlers))
	copy(handlers, conv.postRenderHandlers)
	handlers.Sort()

	return handlers
}

// - - - - - - - - - - - - - Text - - - - - - - - - - - - - //

type HandleTextTransformFunc func(ctx Context, content string) string

func (r *register) TextTransformer(fn HandleTextTransformFunc, priority int) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	handler := prioritized(fn, priority)
	r.conv.textTransformHandlers = append(r.conv.textTransformHandlers, handler)
}
func (conv *Converter) getTextTransformHandlers() prioritizedSlice[HandleTextTransformFunc] {
	conv.m.RLock()
	defer conv.m.RUnlock()

	handlers := make(prioritizedSlice[HandleTextTransformFunc], len(conv.textTransformHandlers))
	copy(handlers, conv.textTransformHandlers)
	handlers.Sort()

	return handlers
}

// - - - - - - - - - - - - - Escaping - - - - - - - - - - - - - //

func (r *register) EscapedChar(chars ...rune) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	for _, char := range chars {
		r.conv.markdownChars[char] = struct{}{}
	}
}
func (conv *Converter) checkIsEscapedChar(r rune) bool {
	conv.m.RLock()
	defer conv.m.RUnlock()

	_, ok := conv.markdownChars[r]
	return ok
}

type HandleUnEscapeFunc func(chars []byte, index int) int

func (r *register) UnEscaper(fn HandleUnEscapeFunc, priority int) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	handler := prioritized(fn, priority)
	r.conv.unEscapeHandlers = append(r.conv.unEscapeHandlers, handler)
}
func (conv *Converter) getUnEscapeHandlers() prioritizedSlice[HandleUnEscapeFunc] {
	conv.m.RLock()
	defer conv.m.RUnlock()

	handlers := make(prioritizedSlice[HandleUnEscapeFunc], len(conv.unEscapeHandlers))
	copy(handlers, conv.unEscapeHandlers)
	handlers.Sort()

	return handlers
}

// - - - - - - - - - - - - - Tag Type - - - - - - - - - - - - - //

type tagType string

const (
	TagTypeBlock  tagType = "block"
	TagTypeInline tagType = "inline"

	// TagTypeRemove will remove that node in the _PreRender_ phase with a high priority.
	TagTypeRemove tagType = "remove"
)

func (r *register) TagType(tagName string, tagType tagType, priority int) {
	r.conv.m.Lock()
	defer r.conv.m.Unlock()

	val := prioritized(tagType, priority)
	r.conv.tagTypes[tagName] = append(r.conv.tagTypes[tagName], val)
}
func (conv *Converter) getTagType(tagName string) (tagType, bool) {
	conv.m.RLock()
	defer conv.m.RUnlock()

	types, ok := conv.tagTypes[tagName]
	if !ok || len(types) == 0 {

		if dom.NameIsBlockNode(tagName) {
			return TagTypeBlock, true
		} else if dom.NameIsInlineNode(tagName) {
			return TagTypeInline, true
		}
		return "", false
	}

	types.Sort()
	firstType := types[0].Value

	return firstType, true
}
