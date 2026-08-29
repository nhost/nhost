package textutils

import (
	"bytes"
	"unicode"
)

var (
	doubleSpace = []byte{' ', ' '}

	newlineBreak              = []byte{'\n'}
	hardLineBreak             = []byte{' ', ' ', '\n'}
	escapedNoContentLineBreak = []byte{'\\', '\n'}
)

// EscapeMultiLine deals with multiline content inside a link or a heading.
func EscapeMultiLine(content []byte) []byte {
	parts := bytes.Split(content, newlineBreak)
	if len(parts) == 1 {
		return content
	}

	output := make([]byte, 0, len(content))
	for i := range parts {
		trimmedLeft := bytes.TrimLeftFunc(parts[i], unicode.IsSpace)

		if len(trimmedLeft) == 0 {
			// A blank line would interrupt the link.
			// So we need to escape the line
			output = append(output, escapedNoContentLineBreak...)
			continue
		}

		isLast := i == len(parts)-1
		if isLast {
			// For the last line we don't need to add any "\n" anymore
			output = append(output, trimmedLeft...)
			continue
		}

		// Now decide what ending we want:
		if bytes.HasSuffix(trimmedLeft, doubleSpace) {
			// We already have "  " so adding a "\n" is enough
			output = append(output, trimmedLeft...)
			output = append(output, newlineBreak...)
			continue
		} else {
			// We *prefer* having a hard-line-break "  \n"
			output = append(output, trimmedLeft...)
			output = append(output, hardLineBreak...)
			continue
		}
	}

	return output
}
