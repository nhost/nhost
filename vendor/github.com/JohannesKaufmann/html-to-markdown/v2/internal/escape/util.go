package escape

import "unicode/utf8"

// TODO: move to markers package?

func IsSpace(b byte) bool {
	switch b {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x85, 0xA0:
		return true
	}
	return false
}

func IsDigit(b byte) bool {
	switch b {
	case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9':
		return true
	}
	return false
}

func getPrev(chars []byte, index int) byte {
	for i := index - 1; i >= 0; i-- {
		if chars[i] == placeholderByte {
			continue
		}
		return chars[i]
	}
	return 0
}

func getNext(chars []byte, index int) byte {
	for i := index + 1; i < len(chars); i++ {
		if chars[i] == placeholderByte {
			continue
		}
		return chars[i]
	}
	return 0
}

func getPrevAsRune(chars []byte, index int) rune {
	for i := index - 1; i >= 0; i-- {
		if chars[i] == placeholderByte {
			continue
		}

		r, _ := utf8.DecodeLastRune(chars[:i+1])

		return r
	}
	return 0
}
func getNextAsRune(source []byte, index int) rune {
	for i := index + 1; i < len(source); i++ {
		if source[i] == placeholderByte {
			continue
		}

		r, _ := utf8.DecodeRune(source[i:])
		return r
	}
	return 0
}

// TODO: make public?
func GetNextAsRune(source []byte, index int) rune {
	return getNextAsRune(source, index)
}
