package metadata

import (
	"bytes"
	"fmt"

	"github.com/pelletier/go-toml/v2"
)

// MarshalTOML encodes metadata to TOML using a map-based representation.
func MarshalTOML(m *Metadata) ([]byte, error) {
	buf := &bytes.Buffer{}

	enc := toml.NewEncoder(buf).
		SetIndentTables(true).
		SetArraysMultiline(true).
		SetIndentSymbol("    ")

	if err := enc.Encode(m); err != nil {
		return nil, fmt.Errorf("encoding metadata to TOML: %w", err)
	}

	return stripEmptyTableHeaders(buf.Bytes()), nil
}

// unmarshalTOML decodes TOML data from the map-based representation into Metadata.
func unmarshalTOML(data []byte) (*Metadata, error) {
	var tm Metadata
	if err := toml.Unmarshal(data, &tm); err != nil {
		return nil, fmt.Errorf("parsing TOML metadata: %w", err)
	}

	return &tm, nil
}

// stripEmptyTableHeaders removes TOML table headers (e.g. [a.b]) that contain
// no key-value pairs of their own — only sub-tables. These are redundant because
// TOML infers intermediate tables automatically.
func stripEmptyTableHeaders(data []byte) []byte {
	lines := bytes.Split(data, []byte("\n"))
	keep := make([]bool, len(lines))

	for i, line := range lines {
		trimmed := bytes.TrimSpace(line)

		// Not a [table] header → always keep.
		if len(trimmed) == 0 || trimmed[0] != '[' || trimmed[0] == '#' {
			keep[i] = true
			continue
		}

		// [[array]] headers → always keep.
		if bytes.HasPrefix(trimmed, []byte("[[")) {
			keep[i] = true
			continue
		}

		// It's a [table] header. Check whether the next non-blank line is
		// another header (or EOF). If so this header is empty.
		hasContent := false
		for j := i + 1; j < len(lines); j++ {
			next := bytes.TrimSpace(lines[j])
			if len(next) == 0 {
				continue
			}

			if next[0] == '[' {
				break
			}

			hasContent = true

			break
		}

		keep[i] = hasContent
	}

	out := make([][]byte, 0, len(lines))
	for i, line := range lines {
		if keep[i] {
			out = append(out, line)
		}
	}

	return bytes.Join(out, []byte("\n"))
}
