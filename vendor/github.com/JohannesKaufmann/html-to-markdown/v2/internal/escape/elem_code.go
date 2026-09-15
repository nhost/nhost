package escape

func IsFencedCode(chars []byte, index int) int {
	if chars[index] != '`' && chars[index] != '~' {
		return -1
	}

	for i := index - 1; i >= 0; i-- {
		if chars[i] == ' ' || chars[i] == placeholderByte {
			continue
		}
		if chars[i] == '\n' {
			break
		}

		return -1
	}

	count := 1
	i := index + 1
	for ; i < len(chars); i++ {
		if chars[i] == placeholderByte {
			continue
		}
		if chars[i] == '`' || chars[i] == '~' {
			count++
			continue
		}

		break
	}
	if count < 3 {
		return -1
	}

	return i - index
}

func IsInlineCode(chars []byte, index int) int {
	if chars[index] != '`' {
		return -1
	}

	return 1
}
