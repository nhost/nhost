package escape

func IsImageOrLink(chars []byte, index int) int {
	if chars[index] == '!' {
		return isImageOrLinkStartExclamation(chars, index)
	}
	if chars[index] == '[' {
		return isImageOrLinkStartBracket(chars, index)
	}

	return -1
}

func isImageOrLinkStartExclamation(chars []byte, index int) int {
	nextIndex := index + 1
	if nextIndex < len(chars) && chars[nextIndex] == '[' {
		// It could be the start of an image
		return 1
	}

	return -1
}

func isImageOrLinkStartBracket(chars []byte, index int) int {
	for i := index + 1; i < len(chars); i++ {
		if chars[i] == '\n' {
			return -1
		}

		if chars[i] == ']' {
			return 1
		}
	}

	return -1
}
