package textutils

import (
	"bytes"
	"unicode/utf8"
)

func TrimUnnecessaryHardLineBreaks(content []byte) []byte {
	content = bytes.ReplaceAll(content, []byte("  \n\n"), []byte("\n\n"))
	content = bytes.ReplaceAll(content, []byte("  \n  \n"), []byte("\n\n"))
	content = bytes.ReplaceAll(content, []byte("  \n \n"), []byte("\n\n"))
	// out = bytes.ReplaceAll(out, []byte("\n  \n"), []byte("\n\n"))

	return content
}

func TrimConsecutiveNewlines(input []byte) []byte {
	var result []byte
	newlineCount := 0
	spaceBuffer := []byte{}

	for i := 0; i < len(input); {
		r, size := utf8.DecodeRune(input[i:])

		if r == '\n' {
			newlineCount++
			if newlineCount <= 2 {
				// Preserve up to 2 newlines, including preceding spaces
				result = append(result, spaceBuffer...)
				result = append(result, '\n')
				spaceBuffer = spaceBuffer[:0] // Clear space buffer
			} else {
				// Skip additional newlines
				spaceBuffer = spaceBuffer[:0] // Clear space buffer
			}
		} else if r == ' ' {
			// Collect spaces into the space buffer
			spaceBuffer = append(spaceBuffer, input[i:i+size]...)
		} else {
			// Reset newline count and append non-newline characters
			newlineCount = 0
			result = append(result, spaceBuffer...)
			result = append(result, input[i:i+size]...)
			spaceBuffer = spaceBuffer[:0] // Clear space buffer
		}

		i += size
	}

	// Append any trailing spaces
	result = append(result, spaceBuffer...)

	return result
}

/*
func TrimConsecutiveNewlines(source []byte) []byte {
	// Some performance optimizations:
	// - If no replacement was done, we return the original slice and don't allocate.
	// - We batch appends

	var ret []byte

	startNormal := 0
	startMatch := -1

	count := 0
	// for i, b := range source {
	for i := 0; i < len(source); i++ {
		r, size := utf8.DecodeRune(source[i:])
		_ = size

		isNewline := r == '\n' // || r == marker.MarkerLineBreak
		if isNewline {
			count += 1
		}

		if startMatch == -1 && isNewline {
			// Start of newlines
			startMatch = i
			i = i + size - 1
			continue
		} else if startMatch != -1 && isNewline {
			// Middle of newlines
			i = i + size - 1
			continue
		} else if startMatch != -1 {
			// Character after the last newline character

			if count > 2 {
				if ret == nil {
					ret = make([]byte, 0, len(source))
				}

				ret = append(ret, source[startNormal:startMatch]...)
				ret = append(ret, '\n', '\n')
				startNormal = i
			}

			startMatch = -1
			count = 0
		}
	}

	getStartEnd := func() (int, int, bool, bool) {
		if startMatch == -1 && startNormal == 0 {
			// a) no changes need to be done
			return -1, -1, false, false
		}

		if count <= 2 {
			// b) Only the normal characters still need to be added
			return startNormal, len(source), true, false
		}

		// c) The match still needs to be replaced (and possible the previous normal characters be added)
		return startNormal, startMatch, true, true
	}

	start, end, isKeepNeeded, isReplaceNeeded := getStartEnd()
	if isKeepNeeded {
		if ret == nil {
			ret = make([]byte, 0, len(source))
		}

		ret = append(ret, source[start:end]...)
		if isReplaceNeeded {
			ret = append(ret, '\n', '\n')
		}
	}

	if ret == nil {
		// Hurray, we did not do any allocations with make()
		// and instead just return the original slice.
		return source
	}
	return ret
}
*/
