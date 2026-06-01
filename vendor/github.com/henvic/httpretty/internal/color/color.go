// Package color can be used to add color to your terminal using ANSI escape code (or sequences).
//
// See https://en.wikipedia.org/wiki/ANSI_escape_code
// Copy modified from https://github.com/fatih/color
// Copyright 2013 Fatih Arslan
package color

import (
	"fmt"
	"strconv"
	"strings"
)

// Attribute defines a single SGR (Select Graphic Rendition) code.
type Attribute int

// Base attributes
const (
	Reset Attribute = iota
	Bold
	Faint
	Italic
	Underline
	BlinkSlow
	BlinkRapid
	ReverseVideo
	Concealed
	CrossedOut
)

// Foreground text colors
const (
	FgBlack Attribute = iota + 30
	FgRed
	FgGreen
	FgYellow
	FgBlue
	FgMagenta
	FgCyan
	FgWhite
)

// Foreground Hi-Intensity text colors
const (
	FgHiBlack Attribute = iota + 90
	FgHiRed
	FgHiGreen
	FgHiYellow
	FgHiBlue
	FgHiMagenta
	FgHiCyan
	FgHiWhite
)

// Background text colors
const (
	BgBlack Attribute = iota + 40
	BgRed
	BgGreen
	BgYellow
	BgBlue
	BgMagenta
	BgCyan
	BgWhite
)

// Background Hi-Intensity text colors
const (
	BgHiBlack Attribute = iota + 100
	BgHiRed
	BgHiGreen
	BgHiYellow
	BgHiBlue
	BgHiMagenta
	BgHiCyan
	BgHiWhite
)

const (
	escape   = "\x1b"
	unescape = "\\x1b"
)

// Format text for terminal.
// You can pass an arbitrary number of Attribute or []Attribute followed by any other values,
// that can either be a string or something else (that is converted to string using fmt.Sprint).
func Format(s ...interface{}) string {
	if len(s) == 0 {
		return ""
	}

	params := []Attribute{}
	in := -1

	for i, v := range s {
		switch vt := v.(type) {
		case []Attribute:
			if in == -1 {
				params = append(params, vt...)
			} else {
				s[i] = printExtraColorAttribute(v)
			}
		case Attribute:
			if in == -1 {
				params = append(params, vt)
			} else {
				s[i] = printExtraColorAttribute(v)
			}
		default:
			if in == -1 {
				in = i
			}
		}
	}

	if in == -1 || len(s[in:]) == 0 {
		return ""
	}
	return wrap(params, fmt.Sprint(s[in:]...))
}

func printExtraColorAttribute(v interface{}) string {
	return fmt.Sprintf("(EXTRA color.Attribute=%v)", v)
}

// StripAttributes from input arguments and return unformatted text.
func StripAttributes(s ...interface{}) (raw string) {
	in := -1
	for i, v := range s {
		switch v.(type) {
		case []Attribute, Attribute:
			if in != -1 {
				s[i] = printExtraColorAttribute(v)
			}
		default:
			if in == -1 {
				in = i
			}
		}
	}
	if in == -1 {
		in = 0
	}
	return fmt.Sprint(s[in:]...)
}

// Escape text for terminal.
func Escape(s string) string {
	return strings.Replace(s, escape, unescape, -1)
}

// sequence returns a formated SGR sequence to be plugged into a "\x1b[...m"
// an example output might be: "1;36" -> bold cyan.
func sequence(params []Attribute) string {
	format := make([]string, len(params))
	for i, v := range params {
		format[i] = strconv.Itoa(int(v))
	}

	return strings.Join(format, ";")
}

// wrap the s string with the colors attributes.
func wrap(params []Attribute, s string) string {
	return fmt.Sprintf("%s[%sm%s%s[%dm", escape, sequence(params), s, escape, Reset)
}
