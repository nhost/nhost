package escape

import (
	"unicode"
)

func IsItalicOrBold(chars []byte, index int) int {
	if chars[index] != '*' && chars[index] != '_' {
		return -1
	}

	next := getNextAsRune(chars, index)

	nextIsWhitespace := unicode.IsSpace(next) || next == 0
	if nextIsWhitespace {
		// "not followed by Unicode whitespace"
		return -1
	}

	return 1
}
