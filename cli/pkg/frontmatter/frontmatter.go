package frontmatter

import (
	"bytes"
	"errors"
	"fmt"

	"gopkg.in/yaml.v3"
)

var (
	// ErrNoFrontmatter is returned when no frontmatter is found.
	ErrNoFrontmatter = errors.New("no frontmatter found")
	// ErrInvalidFrontmatter is returned when frontmatter is malformed.
	ErrInvalidFrontmatter = errors.New("invalid frontmatter: missing closing delimiter")
)

var delimiter = []byte("---") //nolint:gochecknoglobals

// Parse extracts YAML frontmatter from content and unmarshals it into v.
// Returns the remaining content after the frontmatter.
func Parse(content []byte, v any) ([]byte, error) {
	content = bytes.TrimLeft(content, "\n\r\t ")

	if !bytes.HasPrefix(content, delimiter) {
		return content, ErrNoFrontmatter
	}

	// Find the closing delimiter
	rest := content[len(delimiter):]
	rest = bytes.TrimLeft(rest, "\r\t ")

	// Must start with newline after opening delimiter
	if len(rest) == 0 || (rest[0] != '\n') {
		return content, ErrNoFrontmatter
	}

	rest = rest[1:] // skip the newline

	// Find closing ---
	closingIdx := bytes.Index(rest, append([]byte("\n"), delimiter...))
	if closingIdx == -1 {
		// Check if it starts at the beginning (empty frontmatter edge case)
		if bytes.HasPrefix(rest, delimiter) {
			closingIdx = 0
		} else {
			return content, ErrInvalidFrontmatter
		}
	}

	frontmatterData := rest[:closingIdx]
	remaining := rest[closingIdx+1+len(delimiter):]
	remaining = bytes.TrimLeft(remaining, "\n\r")

	if err := yaml.Unmarshal(frontmatterData, v); err != nil {
		return content, fmt.Errorf("failed to unmarshal frontmatter: %w", err)
	}

	return remaining, nil
}
