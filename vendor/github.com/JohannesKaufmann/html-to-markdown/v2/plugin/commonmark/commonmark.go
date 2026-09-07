package commonmark

import (
	"bytes"
	"strings"

	"github.com/JohannesKaufmann/html-to-markdown/v2/converter"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/domutils"
	"github.com/JohannesKaufmann/html-to-markdown/v2/internal/escape"
	"github.com/JohannesKaufmann/html-to-markdown/v2/marker"
	"golang.org/x/net/html"
)

type commonmark struct {
	config
}

type OptionFunc = func(config *config)

// _ or *
//
// default: *
func WithEmDelimiter(delimiter string) OptionFunc {
	return func(config *config) {
		config.EmDelimiter = delimiter
	}
}

// ** or __
//
// default: **
func WithStrongDelimiter(delimiter string) OptionFunc {
	return func(config *config) {
		config.StrongDelimiter = delimiter
	}
}

// Any Thematic break
//
// default: "* * *"
func WithHorizontalRule(rule string) OptionFunc {
	return func(config *config) {
		config.HorizontalRule = rule
	}
}

// "-", "+", or "*"
//
// default: "-"
func WithBulletListMarker(marker string) OptionFunc {
	return func(config *config) {
		config.BulletListMarker = marker
	}
}
func WithListEndComment(enabled bool) OptionFunc {
	return func(config *config) {
		config.DisableListEndComment = !enabled
	}
}

// ``` or ~~~
//
// default: ```
func WithCodeBlockFence(fence string) OptionFunc {
	return func(config *config) {
		config.CodeBlockFence = fence
	}
}

// "setext" or "atx"
//
// default: "atx"
func WithHeadingStyle(style headingStyle) OptionFunc {
	return func(config *config) {
		config.HeadingStyle = style
	}
}

// WithLinkEmptyHrefBehavior configures how links with *empty hrefs* are rendered.
// Take for example:
//
//	<a href="">the link content</a>
//
// LinkBehaviorRenderAsLink would result in "[the link content]()"
//
// LinkBehaviorSkipLink would result in "the link content"
func WithLinkEmptyHrefBehavior(behavior linkRenderingBehavior) OptionFunc {
	return func(config *config) {
		config.LinkEmptyHrefBehavior = behavior
	}
}

// WithLinkEmptyContentBehavior configures how links *without content* are rendered.
// Take for example:
//
//	<a href="/page"></a>
//
// LinkBehaviorRenderAsLink would result in "[](/page)"
//
// LinkBehaviorSkipLink would result in an empty string.
func WithLinkEmptyContentBehavior(behavior linkRenderingBehavior) OptionFunc {
	return func(config *config) {
		config.LinkEmptyContentBehavior = behavior
	}
}

// TODO: allow changing the link style once the render logic is implemented
//
// "inlined" or "referenced_index" or "referenced_short"
//
// default: inlined
// func WithLinkStyle(style linkStyle) OptionFunc {
// 	return func(config *config) {
// 		config.LinkStyle = style
// 	}
// }

// NewCommonmarkPlugin registers the markdown syntax of commonmark.
func NewCommonmarkPlugin(opts ...OptionFunc) converter.Plugin {

	cfg := &config{}
	for _, opt := range opts {
		opt(cfg)
	}

	cm := commonmark{
		config: fillInDefaultConfig(cfg),
	}

	return &cm
}

func (s *commonmark) Name() string {
	return "commonmark"
}
func (cm *commonmark) Init(conv *converter.Converter) error {
	if err := validateConfig(&cm.config); err != nil {
		return err
	}

	// - - - - - - - - //

	conv.Register.PreRenderer(cm.handlePreRender, converter.PriorityStandard)

	// Note: Should run after "collapse" & also after "remove"
	conv.Register.PreRenderer(func(ctx converter.Context, doc *html.Node) {
		if cm.DisableListEndComment {
			// Early return if the feature is unwanted
			return
		}

		domutils.AddListEndComments(ctx, doc)
	}, converter.PriorityLate+100)

	conv.Register.EscapedChar(
		'\\',
		'*', '_', '-', '+',
		'.', '>', '|',
		'$',
		'#', '=',
		'[', ']', '(', ')',
		'!',
		'~', '`', '"', '\'',
	)
	conv.Register.UnEscaper(escape.IsItalicOrBold, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsBlockQuote, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsAtxHeader, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsSetextHeader, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsDivider, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsOrderedList, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsUnorderedList, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsImageOrLink, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsFencedCode, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsInlineCode, converter.PriorityStandard)
	conv.Register.UnEscaper(escape.IsBackslash, converter.PriorityStandard)

	conv.Register.Renderer(cm.handleRender, converter.PriorityStandard)

	conv.Register.TextTransformer(cm.handleTextTransform, converter.PriorityLate)

	conv.Register.PostRenderer(cm.handlePostRenderCodeBlockNewline, converter.PriorityLate)

	return nil
}

func (cm commonmark) handlePostRenderCodeBlockNewline(ctx converter.Context, content []byte) []byte {
	return bytes.ReplaceAll(
		content,
		[]byte(string(marker.BytesMarkerCodeBlockNewline)),
		[]byte("\n"),
	)
}

func (cm commonmark) handleTextTransform(ctx converter.Context, content string) string {

	if isEnabled, ok := ctx.Value("is_inside_link").(bool); ok && isEnabled {
		content = strings.Replace(content, string(marker.MarkerEscaping)+`]`, `\]`, -1)
	}
	// if isEnabled, ok := ctx.Value("is_inside_heading").(bool); ok && isEnabled {
	// 	// The "#" character would be completely removed, if at the _end_
	// 	// of the heading content. So always escape it inside headings.
	// 	content = strings.Replace(content, string(marker.MarkerEscaping)+`#`, `\#`, -1)
	// }

	return content
}
