// Package jsonpath provides utilities for navigating and manipulating JSON-like data structures
// using dot-separated paths.
//
// Arrays encountered during navigation are flattened across path segments: when a segment is
// applied to a slice, the segment is collected from each element and the results are
// concatenated (with nested slices spliced in). As a consequence, callbacks that walk results
// (e.g. ForEach) may be invoked multiple times for a single input, and slice extractors
// (e.g. ToRows) return a flat slice regardless of nesting depth.
package jsonpath

import (
	"strings"
)

// Path represents a navigation path through JSON-like data in dot-separated
// form (e.g., "games.homeTeam.department"). Intermediate segments traverse
// slices by collecting and flattening; see the package docs for the full
// array-flattening contract.
type Path []string

// Parse creates a Path from a dot-separated string.
// Returns an empty path for empty strings.
func Parse(s string) Path {
	if s == "" {
		return Path{}
	}

	parts := strings.Split(s, ".")
	result := make(Path, 0, len(parts))

	for _, p := range parts {
		if p != "" {
			result = append(result, p)
		}
	}

	return result
}

// String returns the dot-separated path string.
func (p Path) String() string {
	return strings.Join(p, ".")
}

// IsEmpty returns true if the path has no elements.
func (p Path) IsEmpty() bool {
	return len(p) == 0
}

// Child returns a new Path with the given element appended.
func (p Path) Child(name string) Path {
	result := make(Path, len(p)+1)
	copy(result, p)
	result[len(p)] = name

	return result
}

// navigate traverses data following the path.
// Returns the data at the final path location, or nil if the path doesn't exist.
func (p Path) navigate(data any) any {
	if len(p) == 0 {
		return data
	}

	current := data

	for _, part := range p {
		current = navigatePart(current, part)
		if current == nil {
			return nil
		}
	}

	return current
}

// navigatePart navigates one level of the path.
func navigatePart(current any, part string) any {
	switch v := current.(type) {
	case map[string]any:
		return v[part]

	case []any:
		var collected []any

		for _, item := range v {
			if itemMap, ok := item.(map[string]any); ok {
				if nested, exists := itemMap[part]; exists {
					if nestedArr, ok := nested.([]any); ok {
						collected = append(collected, nestedArr...)
					} else {
						collected = append(collected, nested)
					}
				}
			}
		}

		if len(collected) == 0 {
			return nil
		}

		return collected

	default:
		return nil
	}
}

// ForEach calls fn for each map found at this path.
func (p Path) ForEach(data any, fn func(item map[string]any)) {
	target := p.navigate(data)
	if target == nil {
		return
	}

	switch v := target.(type) {
	case []any:
		for _, item := range v {
			if itemMap, ok := item.(map[string]any); ok {
				fn(itemMap)
			}
		}
	case map[string]any:
		fn(v)
	}
}

// Delete removes the specified keys from all maps at this path.
func (p Path) Delete(data any, keys ...string) {
	if len(keys) == 0 {
		return
	}

	p.ForEach(data, func(item map[string]any) {
		for _, key := range keys {
			delete(item, key)
		}
	})
}

// ToRows extracts all map objects at this path as a flat slice.
func (p Path) ToRows(data any) []map[string]any {
	target := p.navigate(data)
	if target == nil {
		return nil
	}

	return flattenToRows(target)
}

// flattenToRows recursively flattens nested arrays into a slice of maps.
func flattenToRows(data any) []map[string]any {
	var rows []map[string]any

	switch v := data.(type) {
	case []any:
		for _, item := range v {
			rows = append(rows, flattenToRows(item)...)
		}
	case map[string]any:
		rows = append(rows, v)
	}

	return rows
}
