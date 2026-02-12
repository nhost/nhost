package format //nolint:revive

import (
	"strings"
	"unicode"
)

func GetNameFromComponentRef(ref string) string {
	return strings.Split(ref, "/")[3]
}

// Title capitalizes the first letter of a string.
func Title(s string) string {
	if len(s) == 0 {
		return s // return empty string if input is empty
	}

	r := []rune(s)
	r[0] = unicode.ToUpper(r[0])

	return string(r)
}

func AntiTitle(s string) string {
	if len(s) == 0 {
		return s
	}

	return strings.ToLower(string(s[0])) + s[1:]
}

func ToCamelCase(s string) string {
	splitFunc := func(r rune) bool {
		return r == ' ' || r == '-'
	}
	parts := strings.FieldsFunc(s, splitFunc)

	for i := range parts {
		parts[i] = Title(parts[i])
	}

	return strings.Join(parts, "")
}
