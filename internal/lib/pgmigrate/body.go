package pgmigrate

import "bytes"

const sqlCommentMarkerLength = 2

// containsMigrationSQL reports whether a body contains anything other than
// PostgreSQL whitespace and comments. It deliberately does not validate SQL
// syntax; PostgreSQL remains responsible for parsing executable bodies.
func containsMigrationSQL(body []byte) bool {
	for {
		body = bytes.TrimSpace(body)
		if len(body) == 0 {
			return false
		}

		if len(body) < sqlCommentMarkerLength {
			return true
		}

		switch {
		case body[0] == '-' && body[1] == '-':
			terminator := bytes.IndexAny(body[sqlCommentMarkerLength:], "\r\n")
			if terminator < 0 {
				return false
			}

			body = body[terminator+sqlCommentMarkerLength+1:]
		case body[0] == '/' && body[1] == '*':
			var closed bool

			body, closed = afterBlockComment(body[sqlCommentMarkerLength:])
			if !closed {
				return false
			}
		default:
			return true
		}
	}
}

func afterBlockComment(body []byte) ([]byte, bool) {
	depth := 1
	for index := 0; index+1 < len(body); index++ {
		switch {
		case body[index] == '/' && body[index+1] == '*':
			depth++
			index++
		case body[index] == '*' && body[index+1] == '/':
			depth--

			index++
			if depth == 0 {
				return body[index+1:], true
			}
		}
	}

	return nil, false
}
