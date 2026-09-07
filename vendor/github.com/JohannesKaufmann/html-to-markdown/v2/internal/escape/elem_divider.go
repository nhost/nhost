package escape

func IsDivider(chars []byte, index int) int {
	if chars[index] != '-' && chars[index] != '_' && chars[index] != '*' {
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

	count := 1
	lastChar := len(chars)
	for i := index + 1; i < len(chars); i++ {
		if chars[i] == placeholderByte {
			continue
		}
		if chars[i] == ' ' {
			continue
		}
		if chars[i] == chars[index] {
			count++
			continue
		}
		if chars[i] == '\n' {
			lastChar = i
			break
		}

		return -1
	}

	if count >= 3 {
		return lastChar - index
	}
	return -1
}
