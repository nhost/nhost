package ansi

import (
	"image/color"
	"strconv"
	"strings"
)

// ResetStyle is a SGR (Select Graphic Rendition) style sequence that resets
// all attributes.
// See: https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
const ResetStyle = "\x1b[m"

// Attr is a SGR (Select Graphic Rendition) style attribute.
type Attr = int

// Style represents an ANSI SGR (Select Graphic Rendition) style.
type Style []string

// String returns the ANSI SGR (Select Graphic Rendition) style sequence for
// the given style.
func (s Style) String() string {
	if len(s) == 0 {
		return ResetStyle
	}
	return "\x1b[" + strings.Join(s, ";") + "m"
}

// Styled returns a styled string with the given style applied.
func (s Style) Styled(str string) string {
	if len(s) == 0 {
		return str
	}
	return s.String() + str + ResetStyle
}

// Reset appends the reset style attribute to the style.
func (s Style) Reset() Style {
	return append(s, resetAttr)
}

// Bold appends the bold style attribute to the style.
func (s Style) Bold() Style {
	return append(s, boldAttr)
}

// Faint appends the faint style attribute to the style.
func (s Style) Faint() Style {
	return append(s, faintAttr)
}

// Italic appends the italic style attribute to the style.
func (s Style) Italic() Style {
	return append(s, italicAttr)
}

// Underline appends the underline style attribute to the style.
func (s Style) Underline() Style {
	return append(s, underlineAttr)
}

// UnderlineStyle appends the underline style attribute to the style.
func (s Style) UnderlineStyle(u UnderlineStyle) Style {
	switch u {
	case NoUnderlineStyle:
		return s.NoUnderline()
	case SingleUnderlineStyle:
		return s.Underline()
	case DoubleUnderlineStyle:
		return append(s, doubleUnderlineStyle)
	case CurlyUnderlineStyle:
		return append(s, curlyUnderlineStyle)
	case DottedUnderlineStyle:
		return append(s, dottedUnderlineStyle)
	case DashedUnderlineStyle:
		return append(s, dashedUnderlineStyle)
	}
	return s
}

// DoubleUnderline appends the double underline style attribute to the style.
// This is a convenience method for UnderlineStyle(DoubleUnderlineStyle).
func (s Style) DoubleUnderline() Style {
	return s.UnderlineStyle(DoubleUnderlineStyle)
}

// CurlyUnderline appends the curly underline style attribute to the style.
// This is a convenience method for UnderlineStyle(CurlyUnderlineStyle).
func (s Style) CurlyUnderline() Style {
	return s.UnderlineStyle(CurlyUnderlineStyle)
}

// DottedUnderline appends the dotted underline style attribute to the style.
// This is a convenience method for UnderlineStyle(DottedUnderlineStyle).
func (s Style) DottedUnderline() Style {
	return s.UnderlineStyle(DottedUnderlineStyle)
}

// DashedUnderline appends the dashed underline style attribute to the style.
// This is a convenience method for UnderlineStyle(DashedUnderlineStyle).
func (s Style) DashedUnderline() Style {
	return s.UnderlineStyle(DashedUnderlineStyle)
}

// SlowBlink appends the slow blink style attribute to the style.
func (s Style) SlowBlink() Style {
	return append(s, slowBlinkAttr)
}

// RapidBlink appends the rapid blink style attribute to the style.
func (s Style) RapidBlink() Style {
	return append(s, rapidBlinkAttr)
}

// Reverse appends the reverse style attribute to the style.
func (s Style) Reverse() Style {
	return append(s, reverseAttr)
}

// Conceal appends the conceal style attribute to the style.
func (s Style) Conceal() Style {
	return append(s, concealAttr)
}

// Strikethrough appends the strikethrough style attribute to the style.
func (s Style) Strikethrough() Style {
	return append(s, strikethroughAttr)
}

// NoBold appends the no bold style attribute to the style.
func (s Style) NoBold() Style {
	return append(s, noBoldAttr)
}

// NormalIntensity appends the normal intensity style attribute to the style.
func (s Style) NormalIntensity() Style {
	return append(s, normalIntensityAttr)
}

// NoItalic appends the no italic style attribute to the style.
func (s Style) NoItalic() Style {
	return append(s, noItalicAttr)
}

// NoUnderline appends the no underline style attribute to the style.
func (s Style) NoUnderline() Style {
	return append(s, noUnderlineAttr)
}

// NoBlink appends the no blink style attribute to the style.
func (s Style) NoBlink() Style {
	return append(s, noBlinkAttr)
}

// NoReverse appends the no reverse style attribute to the style.
func (s Style) NoReverse() Style {
	return append(s, noReverseAttr)
}

// NoConceal appends the no conceal style attribute to the style.
func (s Style) NoConceal() Style {
	return append(s, noConcealAttr)
}

// NoStrikethrough appends the no strikethrough style attribute to the style.
func (s Style) NoStrikethrough() Style {
	return append(s, noStrikethroughAttr)
}

// DefaultForegroundColor appends the default foreground color style attribute to the style.
func (s Style) DefaultForegroundColor() Style {
	return append(s, defaultForegroundColorAttr)
}

// DefaultBackgroundColor appends the default background color style attribute to the style.
func (s Style) DefaultBackgroundColor() Style {
	return append(s, defaultBackgroundColorAttr)
}

// DefaultUnderlineColor appends the default underline color style attribute to the style.
func (s Style) DefaultUnderlineColor() Style {
	return append(s, defaultUnderlineColorAttr)
}

// ForegroundColor appends the foreground color style attribute to the style.
func (s Style) ForegroundColor(c Color) Style {
	return append(s, foregroundColorString(c))
}

// BackgroundColor appends the background color style attribute to the style.
func (s Style) BackgroundColor(c Color) Style {
	return append(s, backgroundColorString(c))
}

// UnderlineColor appends the underline color style attribute to the style.
func (s Style) UnderlineColor(c Color) Style {
	return append(s, underlineColorString(c))
}

// UnderlineStyle represents an ANSI SGR (Select Graphic Rendition) underline
// style.
type UnderlineStyle = int

const (
	doubleUnderlineStyle = "4:2"
	curlyUnderlineStyle  = "4:3"
	dottedUnderlineStyle = "4:4"
	dashedUnderlineStyle = "4:5"
)

const (
	// NoUnderlineStyle is the default underline style.
	NoUnderlineStyle UnderlineStyle = iota
	// SingleUnderlineStyle is a single underline style.
	SingleUnderlineStyle
	// DoubleUnderlineStyle is a double underline style.
	DoubleUnderlineStyle
	// CurlyUnderlineStyle is a curly underline style.
	CurlyUnderlineStyle
	// DottedUnderlineStyle is a dotted underline style.
	DottedUnderlineStyle
	// DashedUnderlineStyle is a dashed underline style.
	DashedUnderlineStyle
)

// SGR (Select Graphic Rendition) style attributes.
// See: https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
const (
	ResetAttr                        Attr = 0
	BoldAttr                         Attr = 1
	FaintAttr                        Attr = 2
	ItalicAttr                       Attr = 3
	UnderlineAttr                    Attr = 4
	SlowBlinkAttr                    Attr = 5
	RapidBlinkAttr                   Attr = 6
	ReverseAttr                      Attr = 7
	ConcealAttr                      Attr = 8
	StrikethroughAttr                Attr = 9
	NoBoldAttr                       Attr = 21 // Some terminals treat this as double underline.
	NormalIntensityAttr              Attr = 22
	NoItalicAttr                     Attr = 23
	NoUnderlineAttr                  Attr = 24
	NoBlinkAttr                      Attr = 25
	NoReverseAttr                    Attr = 27
	NoConcealAttr                    Attr = 28
	NoStrikethroughAttr              Attr = 29
	BlackForegroundColorAttr         Attr = 30
	RedForegroundColorAttr           Attr = 31
	GreenForegroundColorAttr         Attr = 32
	YellowForegroundColorAttr        Attr = 33
	BlueForegroundColorAttr          Attr = 34
	MagentaForegroundColorAttr       Attr = 35
	CyanForegroundColorAttr          Attr = 36
	WhiteForegroundColorAttr         Attr = 37
	ExtendedForegroundColorAttr      Attr = 38
	DefaultForegroundColorAttr       Attr = 39
	BlackBackgroundColorAttr         Attr = 40
	RedBackgroundColorAttr           Attr = 41
	GreenBackgroundColorAttr         Attr = 42
	YellowBackgroundColorAttr        Attr = 43
	BlueBackgroundColorAttr          Attr = 44
	MagentaBackgroundColorAttr       Attr = 45
	CyanBackgroundColorAttr          Attr = 46
	WhiteBackgroundColorAttr         Attr = 47
	ExtendedBackgroundColorAttr      Attr = 48
	DefaultBackgroundColorAttr       Attr = 49
	ExtendedUnderlineColorAttr       Attr = 58
	DefaultUnderlineColorAttr        Attr = 59
	BrightBlackForegroundColorAttr   Attr = 90
	BrightRedForegroundColorAttr     Attr = 91
	BrightGreenForegroundColorAttr   Attr = 92
	BrightYellowForegroundColorAttr  Attr = 93
	BrightBlueForegroundColorAttr    Attr = 94
	BrightMagentaForegroundColorAttr Attr = 95
	BrightCyanForegroundColorAttr    Attr = 96
	BrightWhiteForegroundColorAttr   Attr = 97
	BrightBlackBackgroundColorAttr   Attr = 100
	BrightRedBackgroundColorAttr     Attr = 101
	BrightGreenBackgroundColorAttr   Attr = 102
	BrightYellowBackgroundColorAttr  Attr = 103
	BrightBlueBackgroundColorAttr    Attr = 104
	BrightMagentaBackgroundColorAttr Attr = 105
	BrightCyanBackgroundColorAttr    Attr = 106
	BrightWhiteBackgroundColorAttr   Attr = 107

	RGBColorIntroducerAttr      Attr = 2
	ExtendedColorIntroducerAttr Attr = 5
)

const (
	resetAttr                        = "0"
	boldAttr                         = "1"
	faintAttr                        = "2"
	italicAttr                       = "3"
	underlineAttr                    = "4"
	slowBlinkAttr                    = "5"
	rapidBlinkAttr                   = "6"
	reverseAttr                      = "7"
	concealAttr                      = "8"
	strikethroughAttr                = "9"
	noBoldAttr                       = "21"
	normalIntensityAttr              = "22"
	noItalicAttr                     = "23"
	noUnderlineAttr                  = "24"
	noBlinkAttr                      = "25"
	noReverseAttr                    = "27"
	noConcealAttr                    = "28"
	noStrikethroughAttr              = "29"
	blackForegroundColorAttr         = "30"
	redForegroundColorAttr           = "31"
	greenForegroundColorAttr         = "32"
	yellowForegroundColorAttr        = "33"
	blueForegroundColorAttr          = "34"
	magentaForegroundColorAttr       = "35"
	cyanForegroundColorAttr          = "36"
	whiteForegroundColorAttr         = "37"
	extendedForegroundColorAttr      = "38"
	defaultForegroundColorAttr       = "39"
	blackBackgroundColorAttr         = "40"
	redBackgroundColorAttr           = "41"
	greenBackgroundColorAttr         = "42"
	yellowBackgroundColorAttr        = "43"
	blueBackgroundColorAttr          = "44"
	magentaBackgroundColorAttr       = "45"
	cyanBackgroundColorAttr          = "46"
	whiteBackgroundColorAttr         = "47"
	extendedBackgroundColorAttr      = "48"
	defaultBackgroundColorAttr       = "49"
	extendedUnderlineColorAttr       = "58"
	defaultUnderlineColorAttr        = "59"
	brightBlackForegroundColorAttr   = "90"
	brightRedForegroundColorAttr     = "91"
	brightGreenForegroundColorAttr   = "92"
	brightYellowForegroundColorAttr  = "93"
	brightBlueForegroundColorAttr    = "94"
	brightMagentaForegroundColorAttr = "95"
	brightCyanForegroundColorAttr    = "96"
	brightWhiteForegroundColorAttr   = "97"
	brightBlackBackgroundColorAttr   = "100"
	brightRedBackgroundColorAttr     = "101"
	brightGreenBackgroundColorAttr   = "102"
	brightYellowBackgroundColorAttr  = "103"
	brightBlueBackgroundColorAttr    = "104"
	brightMagentaBackgroundColorAttr = "105"
	brightCyanBackgroundColorAttr    = "106"
	brightWhiteBackgroundColorAttr   = "107"
)

// foregroundColorString returns the style SGR attribute for the given
// foreground color.
// See: https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
func foregroundColorString(c Color) string {
	switch c := c.(type) {
	case BasicColor:
		// 3-bit or 4-bit ANSI foreground
		// "3<n>" or "9<n>" where n is the color number from 0 to 7
		switch c {
		case Black:
			return blackForegroundColorAttr
		case Red:
			return redForegroundColorAttr
		case Green:
			return greenForegroundColorAttr
		case Yellow:
			return yellowForegroundColorAttr
		case Blue:
			return blueForegroundColorAttr
		case Magenta:
			return magentaForegroundColorAttr
		case Cyan:
			return cyanForegroundColorAttr
		case White:
			return whiteForegroundColorAttr
		case BrightBlack:
			return brightBlackForegroundColorAttr
		case BrightRed:
			return brightRedForegroundColorAttr
		case BrightGreen:
			return brightGreenForegroundColorAttr
		case BrightYellow:
			return brightYellowForegroundColorAttr
		case BrightBlue:
			return brightBlueForegroundColorAttr
		case BrightMagenta:
			return brightMagentaForegroundColorAttr
		case BrightCyan:
			return brightCyanForegroundColorAttr
		case BrightWhite:
			return brightWhiteForegroundColorAttr
		}
	case ExtendedColor:
		// 256-color ANSI foreground
		// "38;5;<n>"
		return "38;5;" + strconv.FormatUint(uint64(c), 10)
	case TrueColor, color.Color:
		// 24-bit "true color" foreground
		// "38;2;<r>;<g>;<b>"
		r, g, b, _ := c.RGBA()
		return "38;2;" +
			strconv.FormatUint(uint64(shift(r)), 10) + ";" +
			strconv.FormatUint(uint64(shift(g)), 10) + ";" +
			strconv.FormatUint(uint64(shift(b)), 10)
	}
	return defaultForegroundColorAttr
}

// backgroundColorString returns the style SGR attribute for the given
// background color.
// See: https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
func backgroundColorString(c Color) string {
	switch c := c.(type) {
	case BasicColor:
		// 3-bit or 4-bit ANSI foreground
		// "4<n>" or "10<n>" where n is the color number from 0 to 7
		switch c {
		case Black:
			return blackBackgroundColorAttr
		case Red:
			return redBackgroundColorAttr
		case Green:
			return greenBackgroundColorAttr
		case Yellow:
			return yellowBackgroundColorAttr
		case Blue:
			return blueBackgroundColorAttr
		case Magenta:
			return magentaBackgroundColorAttr
		case Cyan:
			return cyanBackgroundColorAttr
		case White:
			return whiteBackgroundColorAttr
		case BrightBlack:
			return brightBlackBackgroundColorAttr
		case BrightRed:
			return brightRedBackgroundColorAttr
		case BrightGreen:
			return brightGreenBackgroundColorAttr
		case BrightYellow:
			return brightYellowBackgroundColorAttr
		case BrightBlue:
			return brightBlueBackgroundColorAttr
		case BrightMagenta:
			return brightMagentaBackgroundColorAttr
		case BrightCyan:
			return brightCyanBackgroundColorAttr
		case BrightWhite:
			return brightWhiteBackgroundColorAttr
		}
	case ExtendedColor:
		// 256-color ANSI foreground
		// "48;5;<n>"
		return "48;5;" + strconv.FormatUint(uint64(c), 10)
	case TrueColor, color.Color:
		// 24-bit "true color" foreground
		// "38;2;<r>;<g>;<b>"
		r, g, b, _ := c.RGBA()
		return "48;2;" +
			strconv.FormatUint(uint64(shift(r)), 10) + ";" +
			strconv.FormatUint(uint64(shift(g)), 10) + ";" +
			strconv.FormatUint(uint64(shift(b)), 10)
	}
	return defaultBackgroundColorAttr
}

// underlineColorString returns the style SGR attribute for the given underline
// color.
// See: https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
func underlineColorString(c Color) string {
	switch c := c.(type) {
	// NOTE: we can't use 3-bit and 4-bit ANSI color codes with underline
	// color, use 256-color instead.
	//
	// 256-color ANSI underline color
	// "58;5;<n>"
	case BasicColor:
		return "58;5;" + strconv.FormatUint(uint64(c), 10)
	case ExtendedColor:
		return "58;5;" + strconv.FormatUint(uint64(c), 10)
	case TrueColor, color.Color:
		// 24-bit "true color" foreground
		// "38;2;<r>;<g>;<b>"
		r, g, b, _ := c.RGBA()
		return "58;2;" +
			strconv.FormatUint(uint64(shift(r)), 10) + ";" +
			strconv.FormatUint(uint64(shift(g)), 10) + ";" +
			strconv.FormatUint(uint64(shift(b)), 10)
	}
	return defaultUnderlineColorAttr
}

func shift(v uint32) uint32 {
	if v > 0xff {
		return v >> 8
	}
	return v
}
