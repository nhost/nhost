package escape

func IsBackslash(chars []byte, index int) int {
	if chars[index] != '\\' {
		return -1
	}

	return 1
}
