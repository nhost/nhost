package escape

func IsAtxHeader(chars []byte, index int) int {
	if chars[index] != '#' {
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

	nPoundSigns := 1
	for i := index + 1; i < len(chars); i++ {
		if chars[i] == '#' {
			nPoundSigns++

			if nPoundSigns > 6 {
				return -1
			}
			continue
		}

		if chars[i] == placeholderByte {
			continue
		}
		if chars[i] == ' ' || chars[i] == '\t' || chars[i] == '\n' || chars[i] == '\r' {
			// TODO: fix calculation with placeholder (maybe own for loop construct?)
			// Returns the count of # that we encountered
			return i - index
		}

		return -1
	}
	return 1
}

func IsSetextHeader(chars []byte, index int) int {
	if chars[index] != '=' && chars[index] != '-' {
		return -1
	}

	var newlineCount int
	for i := index - 1; i >= 0; i-- {
		if chars[i] == placeholderByte || chars[i] == ' ' {
			continue
		}

		if chars[i] == '\n' {
			newlineCount++
			continue
		}

		if newlineCount == 0 {
			// Without any newlines, this character is on the same line
			// as the delimiter. So the delimiter is inside a normal text...
			return -1
		} else if newlineCount == 1 {
			// The heading content is on the line above the delimiter
			// which qualifies for a setext heading...
			return 1
		} else {
			return -1
		}

	}

	return -1
}
