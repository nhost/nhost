package collapse

import (
	"unsafe"
)

func byteSliceToString(b []byte) string {
	/* #nosec G103 */
	return *(*string)(unsafe.Pointer(&b))
}

func replaceAnyWhitespaceWithSpace(source string) string {
	if source == "" {
		return source
	}

	// Some performance optimizations:
	// - If no replacement was done, we return the original slice and dont allocate.
	// - We batch appends
	var ret []byte
	makeIfNeeded := func() {
		if ret == nil {
			ret = make([]byte, 0, len(source))
		}
	}

	startNormal := 0
	startMatch := -1
	for i := 0; i < len(source); i++ {
		isWhitespace := source[i] == ' ' || source[i] == '\r' || source[i] == '\n' || source[i] == '\t'

		if startMatch == -1 && isWhitespace {
			// Start of newlines
			startMatch = i
			continue
		} else if startMatch != -1 && isWhitespace {
			// Middle of newlines
			continue
		} else if startMatch != -1 {
			// Character after the last newline character

			count := i - startMatch
			if count == 1 && source[startMatch] == ' ' {
				// There was only one `isWhitespace` match & that is a space.
				// So the replacement would be exactly the same...
			} else {
				makeIfNeeded()
				ret = append(ret, source[startNormal:startMatch]...)
				ret = append(ret, byte(' '))
				startNormal = i
			}

			startMatch = -1
		}
	}

	if startMatch == -1 && startNormal == 0 {
		// a) no changes need to be done
	} else if startMatch == -1 {
		// b) Only the normal characters until the end still need to be added
		makeIfNeeded()
		ret = append(ret, source[startNormal:]...)
	} else if ret == nil && len(source)-startMatch == 1 && source[startMatch] == ' ' {
		// c) There is a match, but it is exactly the same as the replacement
		//    If there is no new slice, we can skip the replacement.
	} else {
		// d) The match still needs to be replaced (and possible the previous normal characters be added)
		makeIfNeeded()
		ret = append(ret, source[startNormal:startMatch]...)
		ret = append(ret, byte(' '))
	}

	if ret == nil {
		// Huray, we did not do any allocations with make()
		// and instead just return the original slice.
		return source
	}
	return byteSliceToString(ret)
}
