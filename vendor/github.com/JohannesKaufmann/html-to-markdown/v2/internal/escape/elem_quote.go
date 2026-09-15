package escape

func IsBlockQuote(chars []byte, index int) int {
	if chars[index] != '>' {
		return -1
	}

	for i := index - 1; i >= 0; i-- {
		if chars[i] == '\n' {
			break
		}
		if chars[i] == placeholderByte {
			continue
		}
		if chars[i] == ' ' {
			continue
		}

		return -1
	}

	return 1
}
