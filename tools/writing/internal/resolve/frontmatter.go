package resolve

import (
	"errors"
	"fmt"
	"regexp"
	"time"
)

// ErrNoDate means a blog post has no `date: 'YYYY-MM-DD'` in its
// `export const article = {...}` object, or the date does not parse.
var ErrNoDate = errors.New("no date in export const article")

var (
	articleRe = regexp.MustCompile(`export\s+const\s+article\s*=\s*\{`)
	// authorsRe captures the body of `authors: [...]`, skipping over quoted
	// strings so a `]` inside a URL does not end the list early.
	authorsRe = regexp.MustCompile(`\bauthors\s*:\s*\[((?:[^\]"']|"[^"]*"|'[^']*')*)\]`)
	nameRe    = regexp.MustCompile(`\bname\s*:\s*(?:'([^']*)'|"([^"]*)")`)
	dateRe    = regexp.MustCompile(`\bdate\s*:\s*(?:'([^']*)'|"([^"]*)")`)
)

// ArticleDate returns the `date` of the `export const article = {...}` object
// in a blog post, read inside the object's balanced braces as the authors are,
// so a `date:` in the post body is never taken for it.
func ArticleDate(src []byte) (time.Time, error) {
	body := articleBody(src)
	if body == nil {
		return time.Time{}, ErrNoDate
	}

	m := dateRe.FindSubmatch(body)
	if m == nil {
		return time.Time{}, ErrNoDate
	}

	value := m[1]
	if value == nil {
		value = m[2]
	}

	date, err := time.Parse(time.DateOnly, string(value))
	if err != nil {
		return time.Time{}, fmt.Errorf("%w: %q is not a YYYY-MM-DD date", ErrNoDate, value)
	}

	return date, nil
}

// parseAuthors returns the `name` of every entry in the `authors` list of the
// `export const article = {...}` object in a blog post, in order. Only the
// object itself is searched, so an `authors:` list in the post body is never
// read as the byline. A document without that export, with an unbalanced
// object, or without an `authors` list inside it, has no authors.
func parseAuthors(src []byte) []string {
	body := articleBody(src)
	if body == nil {
		return nil
	}

	list := authorsRe.FindSubmatch(body)
	if list == nil {
		return nil
	}

	matches := nameRe.FindAllSubmatch(list[1], -1)
	authors := make([]string, 0, len(matches))

	for _, m := range matches {
		name := m[1]
		if name == nil {
			name = m[2]
		}

		authors = append(authors, string(name))
	}

	return authors
}

// articleBody returns the text between the braces of
// `export const article = {...}`, or nil when there is no such export or its
// braces never balance. Braces inside quoted strings, template literals and
// comments do not count.
func articleBody(src []byte) []byte {
	loc := articleRe.FindIndex(src)
	if loc == nil {
		return nil
	}

	start := loc[1]
	depth := 1

	for i := start; i < len(src); i++ {
		switch c := src[i]; c {
		case '\'', '"', '`':
			i = skipString(src, i)
		case '/':
			i = skipComment(src, i)
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return src[start:i]
			}
		}
	}

	return nil
}

// skipString returns the index of the quote that closes the string opened at
// src[open], honouring backslash escapes, or the last index when the string
// never closes.
func skipString(src []byte, open int) int {
	quote := src[open]

	for i := open + 1; i < len(src); i++ {
		switch src[i] {
		case '\\':
			i++
		case quote:
			return i
		}
	}

	return len(src) - 1
}

// skipComment returns the index of the last byte of the `//` or `/* */`
// comment starting at src[at], or at itself when no comment starts there.
func skipComment(src []byte, at int) int {
	const opener = len("//")

	if at+1 >= len(src) {
		return at
	}

	switch src[at+1] {
	case '/':
		for i := at + opener; i < len(src); i++ {
			if src[i] == '\n' {
				return i
			}
		}
	case '*':
		for i := at + opener; i+1 < len(src); i++ {
			if src[i] == '*' && src[i+1] == '/' {
				return i + 1
			}
		}
	default:
		return at
	}

	return len(src) - 1
}
