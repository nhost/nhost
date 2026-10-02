package escape

import (
	"unicode"
)

func IsUnorderedList(chars []byte, index int) int {
	if chars[index] != '-' && chars[index] != '*' && chars[index] != '+' {
		return -1
	}

	for i := index - 1; i >= 0; i-- {
		if chars[i] == '\n' {
			break
		}
		if chars[i] == ' ' {
			continue
		}
		if chars[i] == placeholderByte {
			continue
		}
		return -1
	}

	next := getNext(chars, index)
	if IsSpace(next) || next == 0 {
		return 1
	}

	return -1
}

func IsOrderedList(chars []byte, index int) int {
	if chars[index] != '.' && chars[index] != ')' {
		return -1
	}

	// Directly before the dot needs to be a digit
	prev := getPrevAsRune(chars, index)
	if !unicode.IsDigit(prev) {
		return -1
	}

	for i := index - 1; i >= 0; i-- {
		if chars[i] == '\n' {
			break
		}
		if chars[i] == ' ' {
			continue
		}
		if chars[i] == placeholderByte {
			continue
		}
		if IsDigit(chars[i]) {
			continue
		}

		return -1
	}

	next := getNext(chars, index)
	if IsSpace(next) || next == 0 {
		return 1
	}

	return -1
}
