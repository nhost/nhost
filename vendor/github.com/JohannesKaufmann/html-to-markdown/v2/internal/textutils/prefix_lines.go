package textutils

func PrefixLines(source []byte, repl []byte) []byte {
	newSlice := make([]byte, 0, len(source))

	newSlice = append(newSlice, repl...)
	for _, b := range source {
		newSlice = append(newSlice, b)
		if b == '\n' {
			newSlice = append(newSlice, repl...)
		}

	}

	return newSlice
}
