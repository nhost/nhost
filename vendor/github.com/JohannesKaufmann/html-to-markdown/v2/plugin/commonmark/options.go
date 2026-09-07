package commonmark

type linkStyle string

const (
	// For example:
	//
	//  [view more](/about.html)
	LinkStyleInlined linkStyle = "inlined"

	LinkStyleReferencedIndex linkStyle = "referenced_index"
	LinkStyleReferencedShort linkStyle = "referenced_short"
)

type headingStyle string

const (
	// HeadingStyleATX is the heading style of prefixing the heading with "#" signs indicating the level. For example:
	//
	//  ## Heading
	HeadingStyleATX headingStyle = "atx"

	// HeadingStyleSetext is the heading style of putting "=" or "-" on the followed line. For example:
	//
	//  Heading
	//  -------
	HeadingStyleSetext headingStyle = "setext"
)

type linkRenderingBehavior string

const (
	// LinkBehaviorRender renders the element as a link
	LinkBehaviorRender linkRenderingBehavior = "render"
	// LinkBehaviorSkip skips link rendering and falls back to the other rules (e.g. paragraph)
	LinkBehaviorSkip linkRenderingBehavior = "skip"
)

// config to customize the output. You can change stuff like
// the character that is used for strong text.
type config struct {
	// _ or *
	//
	// default: *
	EmDelimiter string

	// ** or __
	//
	// default: **
	StrongDelimiter string

	// Any Thematic break
	//
	// default: "* * *"
	HorizontalRule string

	// "-", "+", or "*"
	//
	// default: "-"
	BulletListMarker string

	DisableListEndComment bool

	// "indented" or "fenced"
	//
	// default: "indented"
	// TODO: CodeBlockStyle string

	// ``` or ~~~
	//
	// default: ```
	CodeBlockFence string

	// "setext" or "atx"
	//
	// default: "atx"
	HeadingStyle headingStyle

	// TODO: LineBreakStyle string "hard" or "soft"

	// "inlined" or "referenced_index" or "referenced_short"
	//
	// default: inlined
	LinkStyle linkStyle

	LinkEmptyHrefBehavior    linkRenderingBehavior
	LinkEmptyContentBehavior linkRenderingBehavior
}

func fillInDefaultConfig(cfg *config) config {
	if cfg.EmDelimiter == "" {
		// The new default is now "*" (instead of "_") as that works better inside words.
		cfg.EmDelimiter = "*"
	}
	if cfg.StrongDelimiter == "" {
		cfg.StrongDelimiter = "**"
	}

	if cfg.HorizontalRule == "" {
		cfg.HorizontalRule = "* * *"
	}

	if cfg.BulletListMarker == "" {
		cfg.BulletListMarker = "-"
	}

	// TODO: also check for spelling mistakes in "indented"
	// if opt.CodeBlockStyle == "" {
	// 	opt.CodeBlockStyle = "indented"
	// }
	if cfg.CodeBlockFence == "" {
		cfg.CodeBlockFence = "```"
	}

	if cfg.HeadingStyle == "" {
		cfg.HeadingStyle = "atx"
	}

	if cfg.LinkEmptyHrefBehavior == "" {
		cfg.LinkEmptyHrefBehavior = LinkBehaviorRender
	}
	if cfg.LinkEmptyContentBehavior == "" {
		cfg.LinkEmptyContentBehavior = LinkBehaviorRender
	}
	if cfg.LinkStyle == "" {
		cfg.LinkStyle = LinkStyleInlined
	}

	return *cfg
}
