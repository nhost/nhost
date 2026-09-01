package textutils

import (
	"bytes"
)

// DelimiterForEveryLine puts the delimiter not just at the start and end of the string
// but if the text is divided on multiple lines, puts the delimiters on every line with content.
//
// Otherwise the bold/italic delimiters won't be recognized if it contains new line characters.
func DelimiterForEveryLine(text []byte, delimiter []byte) []byte {
	var buf bytes.Buffer

	lines := bytes.Split(text, []byte("\n"))
	for i, line := range lines {
		leftExtra, trimmed, rightExtra := SurroundingSpaces(line)

		if trimmed == nil {
			// For empty lines, we don't need a delimiter
			buf.Write(leftExtra)
			buf.Write(rightExtra)
		} else {
			buf.Write(leftExtra)
			buf.Write(delimiter)
			buf.Write(trimmed)
			buf.Write(delimiter)
			buf.Write(rightExtra)
		}

		// To join the lines again, add a newlines character
		if i < len(lines)-1 {
			buf.WriteRune('\n')
		}
	}

	return buf.Bytes()
}
