package converter

import (
	"context"
	"fmt"

	"github.com/JohannesKaufmann/dom"
	"golang.org/x/net/html"
)

// func GetValue[K string, V any](ctx context.Context, key K) V {
// 	val, _ := ctx.Value(key).(V)
// 	return val
// }
// func SetValue[K string, V any](ctx context.Context, key K, val V) context.Context {
// 	return context.WithValue(ctx, key, val)
// }

type ctxKey string

const (
	ctxKeyAssembleAbsoluteURL ctxKey = "AssembleAbsoluteURL"
	ctxKeyDomain              ctxKey = "Domain"

	ctxKeySetState    ctxKey = "SetState"
	ctxKeyUpdateState ctxKey = "UpdateState"
	ctxKeyGetState    ctxKey = "GetState"
)

func provideDomain(ctx context.Context, domain string) context.Context {
	return context.WithValue(ctx, ctxKeyDomain, domain)
}
func GetDomain(ctx context.Context) string {
	domain, ok := ctx.Value(ctxKeyDomain).(string)
	if !ok {
		fmt.Println("[warning] value ctxKeyDomain is different")
		return ""
	}

	return domain
}

// - - - - - - - - - - - - - - - - - - - - - //

type AssembleAbsoluteURLFunc func(tagName string, rawURL string, domain string) string

func assembleAbsoluteURL(ctx context.Context, tagName string, rawURL string) string {
	domain := GetDomain(ctx)

	// TODO: since this gets passed down from the converter, it doesn't have to provided from the ctx anymore
	fn, ok := ctx.Value(ctxKeyAssembleAbsoluteURL).(AssembleAbsoluteURLFunc)
	if !ok {
		fmt.Println("[warning] func ctxKeyAssembleAbsoluteURL is different")
		return ""
	}

	return fn(tagName, rawURL, domain)
}

func provideAssembleAbsoluteURL(ctx context.Context, fn AssembleAbsoluteURLFunc) context.Context {
	return context.WithValue(ctx, ctxKeyAssembleAbsoluteURL, fn)
}

// - - - - - - - - - - - - - - - - - - - - - //

type SetStateFunc func(key string, val any)
type UpdateStateFunc func(key string, fn func(any) any)
type GetStateFunc func(key string) any

type globalState struct {
	data map[string]any
}

func newGlobalState() *globalState {

	return &globalState{
		data: make(map[string]any),
	}
}

func (s *globalState) setState(key string, val any) {
	s.data[key] = val
}
func (s *globalState) updateState(key string, fn func(any) any) {
	s.data[key] = fn(s.data[key])
}
func (s *globalState) getState(key string) any {
	return s.data[key]
}

func (s *globalState) provideGlobalState(ctx context.Context) context.Context {

	var setState SetStateFunc = s.setState
	var updateState UpdateStateFunc = s.updateState
	var getState GetStateFunc = s.getState

	ctx = context.WithValue(ctx, ctxKeySetState, setState)
	ctx = context.WithValue(ctx, ctxKeyUpdateState, updateState)
	ctx = context.WithValue(ctx, ctxKeyGetState, getState)

	return ctx
}

func GetState[V any](ctx context.Context, key string) V {
	fn := ctx.Value(ctxKeyGetState).(GetStateFunc)

	val, _ := fn(key).(V)

	return val
}

func SetState[V any](ctx context.Context, key string, val V) {
	fn := ctx.Value(ctxKeySetState).(SetStateFunc)

	fn(key, val)
}

func UpdateState[V any](ctx context.Context, key string, fn func(V) V) {
	updater := ctx.Value(ctxKeyUpdateState).(UpdateStateFunc)

	updater(key, func(val any) any {
		value, ok := val.(V)
		if !ok && val != nil {
			// TODO: slog?
			fmt.Println("[warning] val is different than V in UpdateState")
		}

		return fn(value)
	})
}

// - - - - - - //

// Context extends the normal context.Context with some additional
// methods useful for the process of converting.
type Context interface {
	context.Context

	AssembleAbsoluteURL(ctx Context, tagName string, rawURL string) string

	GetTagType(tagName string) (tagType, bool)

	RenderNodes(ctx Context, w Writer, nodes ...*html.Node)
	RenderChildNodes(ctx Context, w Writer, n *html.Node)

	EscapeContent(content []byte) []byte
	UnEscapeContent(content []byte) []byte

	WithValue(key any, val any) Context
}

type converterContext struct {
	context.Context
	conv *Converter
}

func newConverterContext(ctx context.Context, conv *Converter) Context {
	return &converterContext{
		Context: ctx,
		conv:    conv,
	}
}

func (c *converterContext) AssembleAbsoluteURL(ctx Context, tagName string, rawURL string) string {
	return assembleAbsoluteURL(ctx, tagName, rawURL)
}

func (c *converterContext) RenderNodes(ctx Context, w Writer, nodes ...*html.Node) {
	c.conv.handleRenderNodes(ctx, w, nodes...)
}
func (c *converterContext) RenderChildNodes(ctx Context, w Writer, n *html.Node) {
	c.conv.handleRenderNodes(ctx, w, dom.AllChildNodes(n)...)
}

func (c *converterContext) GetTagType(tagName string) (tagType, bool) {
	return c.conv.getTagType(tagName)
}
func (c *converterContext) EscapeContent(content []byte) []byte {
	return c.conv.escapeContent(content)
}
func (c *converterContext) UnEscapeContent(content []byte) []byte {
	return c.conv.unEscapeContent(content)
}

func (c *converterContext) WithValue(key any, val any) Context {
	return &converterContext{
		Context: context.WithValue(c.Context, key, val),
		conv:    c.conv,
	}
}
