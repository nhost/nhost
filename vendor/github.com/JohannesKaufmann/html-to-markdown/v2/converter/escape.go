package converter

import (
	"unicode/utf8"

	"github.com/JohannesKaufmann/html-to-markdown/v2/marker"
)

const (
	actionKeep   = iota
	actionEscape = iota
)

// IMPORTANT: Only internally we assume it is only byte
var placeholderByte byte = marker.BytesMarkerEscaping[0]

func (conv *Converter) escapeContent(chars []byte) []byte {
	if conv.escapeMode == EscapeModeDisabled {
		return chars
	}

	newChars := make([]byte, 0, len(chars))
	for index := 0; index < len(chars); index++ {
		if chars[index] == '\u0000' {
			// For security reasons, the Unicode character U+0000 must be replaced with the REPLACEMENT CHARACTER (U+FFFD).
			newChars = append(newChars, []byte(string('\ufffd'))...)
			continue
		}

		r, _ := utf8.DecodeRune(chars[index:])

		isMarkdownChar := conv.checkIsEscapedChar(r)
		if isMarkdownChar {
			newChars = append(newChars, placeholderByte, chars[index])
		} else {
			newChars = append(newChars, chars[index])
		}
	}

	return newChars
}

func (conv *Converter) unEscapeContent(chars []byte) []byte {
	if conv.escapeMode == EscapeModeDisabled {
		return chars
	}

	checkElements := func(index int) int {
		for _, handler := range conv.getUnEscapeHandlers() {
			if skip := handler.Value(chars, index); skip != -1 {
				return skip
			}
		}

		return -1
	}

	changes := make([]uint8, len(chars))
	for index := 0; index < len(chars); index++ {

		if chars[index] != placeholderByte {
			continue
		}
		if index+1 >= len(chars) {
			break
		}

		skip := checkElements(index + 1)
		if skip == -1 {
			continue
		}
		changes[index] = actionEscape
		index += skip - 1
	}

	newChars := make([]byte, 0, len(chars))
	for index, char := range chars {
		if char != placeholderByte {
			newChars = append(newChars, char)
			continue
		}

		// What to do with this placeholder? Should we escape or not?
		if changes[index] == actionEscape {
			newChars = append(newChars, '\\')
		}
	}
	return newChars
}
