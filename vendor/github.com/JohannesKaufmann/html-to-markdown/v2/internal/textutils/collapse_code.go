package textutils

import (
	"bytes"
)

func CollapseInlineCodeContent(content []byte) []byte {
	// TODO: what about other characters like the reset char? Maybe unicode.IsSpace?
	content = bytes.ReplaceAll(content, []byte{'\n'}, []byte{' '})
	content = bytes.ReplaceAll(content, []byte{'\t'}, []byte{' '})

	content = bytes.TrimSpace(content)

	newChars := make([]byte, 0, len(content))

	var count int
	for _, char := range content {
		if char == ' ' {
			count++
		} else {
			count = 0
		}

		if count > 1 {
			continue
		}
		newChars = append(newChars, char)
	}

	return newChars
}
