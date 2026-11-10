package queries

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

var errInvalidComputedPath = errors.New("invalid JSON path")

// parseComputedPath converts Hasura's JSON selection path into PostgreSQL's
// text[] path. No path component is ever interpolated into SQL.
//
//nolint:cyclop // Optional root, dots, names and both bracket forms are independent grammar branches.
func parseComputedPath(path string) ([]string, error) {
	if path == "" || !utf8.ValidString(path) {
		return nil, errInvalidComputedPath
	}

	if path[0] == '$' {
		path = path[1:]
		if path == "" {
			return []string{}, nil
		}
	}

	parts := []string{}
	for len(path) > 0 {
		if path[0] == '.' {
			path = path[1:]
			if path == "" {
				return nil, errInvalidComputedPath
			}
		}

		if path[0] == '[' {
			part, rest, err := parseComputedBracket(path)
			if err != nil {
				return nil, err
			}

			parts = append(parts, part)
			path = rest

			continue
		}

		first, width := utf8.DecodeRuneInString(path)
		if first != '_' && !unicode.IsLetter(first) {
			return nil, errInvalidComputedPath
		}

		end := width
		for end < len(path) {
			r, size := utf8.DecodeRuneInString(path[end:])
			if !unicode.IsLetter(r) && r != '_' && r != '-' && (r < '0' || r > '9') {
				break
			}

			end += size
		}

		parts = append(parts, path[:end])
		path = path[end:]
	}

	return parts, nil
}

const minComputedBracketLength = 3

//nolint:cyclop,gocognit,funlen // Each escape and delimiter branch is needed for Hasura's quoted-key grammar.
func parseComputedBracket(path string) (string, string, error) {
	if len(path) < minComputedBracketLength {
		return "", "", errInvalidComputedPath
	}

	if path[1] != '\'' && path[1] != '"' {
		end := 1
		for end < len(path) && path[end] >= '0' && path[end] <= '9' {
			end++
		}

		if end == 1 || end >= len(path) || path[end] != ']' {
			return "", "", errInvalidComputedPath
		}

		index := strings.TrimLeft(path[1:end], "0")
		if index == "" {
			index = "0"
		}

		return index, path[end+1:], nil
	}

	quote := path[1]

	var encoded strings.Builder
	encoded.WriteByte('"')

	for i := 2; i < len(path); i++ {
		if path[i] == '\\' {
			if i+1 >= len(path) {
				return "", "", errInvalidComputedPath
			}

			// JSON has no \\' escape; the single-quoted form uses it only
			// to escape its own delimiter.
			if quote == '\'' && path[i+1] == '\'' {
				encoded.WriteByte('\'')

				i++

				continue
			}

			encoded.WriteByte('\\')
			encoded.WriteByte(path[i+1])
			i++

			continue
		}

		if path[i] == quote {
			if i+1 >= len(path) || path[i+1] != ']' {
				return "", "", errInvalidComputedPath
			}

			encoded.WriteByte('"')

			if !validComputedSurrogates(encoded.String()) {
				return "", "", errInvalidComputedPath
			}

			var key string
			if err := json.Unmarshal([]byte(encoded.String()), &key); err != nil {
				return "", "", errInvalidComputedPath
			}

			return key, path[i+2:], nil
		}

		if path[i] == '"' && quote == '\'' {
			encoded.WriteByte('\\')
		}

		encoded.WriteByte(path[i])
	}

	return "", "", errInvalidComputedPath
}

// encoding/json replaces lone surrogate escapes with U+FFFD. Hasura rejects
// them instead; validate escapes before decoding the quoted key.
//
//nolint:cyclop // Distinguishes escapes, surrogate pairs and malformed hex.
func validComputedSurrogates(
	encoded string,
) bool {
	for i := 0; i < len(encoded); i++ {
		if encoded[i] != '\\' || i+1 >= len(encoded) {
			continue
		}

		if encoded[i+1] != 'u' {
			i++

			continue
		}

		if i+6 > len(encoded) {
			return false
		}

		n, err := strconv.ParseUint(encoded[i+2:i+6], 16, 16)
		if err != nil {
			return false
		}

		i += 5
		switch {
		case n >= 0xdc00 && n <= 0xdfff:
			return false
		case n >= 0xd800 && n <= 0xdbff:
			if i+6 >= len(encoded) || encoded[i+1:i+3] != `\u` {
				return false
			}

			low, err := strconv.ParseUint(encoded[i+3:i+7], 16, 16)
			if err != nil || low < 0xdc00 || low > 0xdfff {
				return false
			}

			i += 6
		}
	}

	return true
}
