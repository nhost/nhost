package config

import "strings"

// interpolateEnv replaces environment variables in the format $VAR.
// Supports escaping $ with $$ or \$.
func interpolateEnv(s string, getenv func(string) string) string { //nolint:cyclop
	var result strings.Builder
	result.Grow(len(s))

	for i := 0; i < len(s); i++ {
		switch {
		case s[i] == '\\' && i+1 < len(s) && s[i+1] == '$':
			// Handle \$ escape sequence
			result.WriteByte('$')

			i++ // skip the $
		case s[i] == '$' && i+1 < len(s) && s[i+1] == '$':
			// Handle $$ escape sequence
			result.WriteByte('$')

			i++ // skip the second $
		case s[i] == '$':
			// Start of variable substitution
			i++
			if i >= len(s) {
				result.WriteByte('$')
				break
			}

			// Extract variable name
			start := i
			for i < len(s) && (isAlphaNumUnderscore(s[i])) {
				i++
			}

			if i == start {
				// No valid variable name found
				result.WriteByte('$')

				i--
			} else {
				varName := s[start:i]
				if value := getenv(varName); value != "" {
					result.WriteString(value)
				}

				i-- // Back up one because the loop will increment
			}
		default:
			result.WriteByte(s[i])
		}
	}

	return result.String()
}

func isAlphaNumUnderscore(c byte) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_'
}
