package textutils

import "bytes"

const (
	DOUBLE_QUOTE = '"'
	SINGLE_QUOTE = '\''
)

func SurroundBy(content []byte, chars []byte) []byte {
	content = append(chars, content...)
	content = append(content, chars...)
	return content
}
func SurroundByQuotes(content []byte) []byte {
	if len(content) == 0 {
		return nil
	}

	containsDoubleQuote := bytes.ContainsRune(content, DOUBLE_QUOTE)
	containsSingleQuote := bytes.ContainsRune(content, SINGLE_QUOTE)

	if containsDoubleQuote && containsSingleQuote {
		// Escape all quotes
		content = bytes.ReplaceAll(content, []byte(`"`), []byte(`\"`))

		// Surround the content by double quotes
		return SurroundBy(content, []byte(`"`))
	}
	if containsDoubleQuote {
		// Since it contains double quotes (but no single quotes)
		// we can surround it by single quotes
		return SurroundBy(content, []byte(`'`))
	}

	// It may contain single quotes, but definitely no double quotes,
	// so we can safely surround it by double quotes.
	return SurroundBy(content, []byte(`"`))
}
