package converter

import (
	"bytes"
	"context"
	"errors"
	"io"
	"slices"
	"strings"

	"golang.org/x/net/html"
)

type convertOption struct {
	domain  string
	context context.Context
}
type ConvertOptionFunc func(o *convertOption)

func WithContext(ctx context.Context) ConvertOptionFunc {
	return func(o *convertOption) {
		o.context = ctx
	}
}

// WithDomain provides a base `domain` to the converter and
// to the `AssembleAbsoluteURL` function.
//
// If a *relative* url is encountered (in an image or link) then the `domain` is used
// to convert it to a *absolute* url.
func WithDomain(domain string) ConvertOptionFunc {
	return func(o *convertOption) {
		o.domain = domain
	}
}

func (conv *Converter) setError(err error) {
	conv.m.Lock()
	defer conv.m.Unlock()

	conv.err = err
}
func (conv *Converter) getError() error {
	conv.m.RLock()
	defer conv.m.RUnlock()

	return conv.err
}

var errNoRenderHandlers = errors.New(`no render handlers are registered. did you forget to register the "commonmark" and "base" plugins?`)
var errBasePluginMissing = errors.New(`you registered the "commonmark" plugin but the "base" plugin is also required`)

// ConvertNode converts a `*html.Node` to a markdown byte slice.
//
// If you have already parsed an HTML page using the `html.Parse()` function
// from the "golang.org/x/net/html" package then you can pass this node
// directly to the converter.
func (conv *Converter) ConvertNode(doc *html.Node, opts ...ConvertOptionFunc) ([]byte, error) {

	if err := conv.getError(); err != nil {
		// There can be errors while calling `Init` on the plugins (e.g. validation errors).
		// Now is the first opportunity where we can return that error.
		return nil, err
	}

	conv.m.Lock()
	option := &convertOption{}
	for _, fn := range opts {
		fn(option)
	}
	conv.m.Unlock()

	// If there are no render handlers registered this is
	// usually a user error - since people want the Commonmark Plugin in 99% of cases.
	if len(conv.getRenderHandlers()) == 0 {
		return nil, errNoRenderHandlers
	}

	containsCommonmark := slices.Contains(conv.registeredPlugins, "commonmark")
	containsBase := slices.Contains(conv.registeredPlugins, "base")
	if containsCommonmark && !containsBase {
		return nil, errBasePluginMissing
	}

	// - - - - - - - - - - - - - - - - - - - //

	state := newGlobalState()

	if option.context == nil {
		option.context = context.Background()
	}
	ctx := option.context
	ctx = provideDomain(ctx, option.domain)
	ctx = provideAssembleAbsoluteURL(ctx, defaultAssembleAbsoluteURL)
	ctx = state.provideGlobalState(ctx)

	customCtx := newConverterContext(ctx, conv)

	// - - - - - - - - - - - - - - - - - - - //

	// Pre-Render
	for _, handler := range conv.getPreRenderHandlers() {
		handler.Value(customCtx, doc)
	}

	// Render
	var buf bytes.Buffer
	conv.handleRenderNode(customCtx, &buf, doc)

	// Post-Render
	result := buf.Bytes()
	for _, handler := range conv.getPostRenderHandlers() {
		result = handler.Value(customCtx, result)
	}

	return result, nil
}

// ConvertReader converts the html from the reader to markdown.
//
// Under the hood `html.Parse()` is used to parse the HTML.
func (conv *Converter) ConvertReader(r io.Reader, opts ...ConvertOptionFunc) ([]byte, error) {
	doc, err := html.Parse(r)
	if err != nil {
		return nil, err
	}

	return conv.ConvertNode(doc, opts...)
}

// ConvertString converts a html-string to a markdown-string.
//
// Under the hood `html.Parse()` is used to parse the HTML.
func (conv *Converter) ConvertString(htmlInput string, opts ...ConvertOptionFunc) (string, error) {
	r := strings.NewReader(htmlInput)
	output, err := conv.ConvertReader(r, opts...)
	if err != nil {
		return "", err
	}

	return string(output), nil
}
