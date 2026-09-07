package converter

import "sync"

type Converter struct {
	m sync.RWMutex

	err error

	registeredPlugins []string

	preRenderHandlers  prioritizedSlice[HandlePreRenderFunc]
	renderHandlers     prioritizedSlice[HandleRenderFunc]
	postRenderHandlers prioritizedSlice[HandlePostRenderFunc]

	textTransformHandlers prioritizedSlice[HandleTextTransformFunc]

	markdownChars    map[rune]interface{}
	unEscapeHandlers prioritizedSlice[HandleUnEscapeFunc]

	tagTypes map[string]prioritizedSlice[tagType]

	escapeMode escapeMode

	Register register
}

type converterOption = func(c *Converter) error

func NewConverter(opts ...converterOption) *Converter {
	conv := &Converter{
		markdownChars: make(map[rune]interface{}),
		tagTypes:      make(map[string]prioritizedSlice[tagType]),
	}
	conv.Register = register{conv}

	for _, opt := range opts {
		err := opt(conv)
		if err != nil {
			conv.setError(err)
			break
		}
	}

	return conv
}

type escapeMode string

const (
	EscapeModeDisabled escapeMode = "disabled"
	EscapeModeSmart    escapeMode = "smart"
)

// WithEscapeMode changes the strictness of the "escaping".
//
// Some characters have a special meaning in markdown.
// For example, the character "*" can be used for lists, emphasis and dividers.
// By placing a backlash before that character (e.g. "\*") you can "escape" it.
// Then the character will render as a raw "*" without the "markdown meaning" applied.
//
// Learn more in the documentation
//
//	"disabled" or "smart"
//
//	default: "smart"
func WithEscapeMode(mode escapeMode) converterOption {
	return func(c *Converter) error {
		c.escapeMode = mode
		return nil
	}
}
