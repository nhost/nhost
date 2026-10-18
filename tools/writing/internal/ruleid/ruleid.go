// Package ruleid finds writing rule IDs in text: the definitions in the rules
// doc and the scope files, and the citations anywhere else. It implements the
// two greps of the rule ID syntax in `.claude/writing/rules.md`, so every
// consumer (the rubric, scorecards and the drift test) agrees on what an ID is
// and which IDs are defined.
package ruleid

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"slices"
)

// ErrDuplicate means one rule ID is defined more than once across the rules
// doc and the scope files.
var ErrDuplicate = errors.New("rule ID defined more than once")

const idPattern = `\b(?:WR-[A-Z]+|DOCS|BLOG)-[0-9]+\b`

var (
	// definitionRe is the ID grep: `^- \*\*(WR-[A-Z]+-[0-9]+|DOCS-[0-9]+|BLOG-[0-9]+)`.
	definitionRe = regexp.MustCompile(`(?m)^- \*\*(` + idPattern + `)`)
	// citationRe is the citation grep: `(WR-[A-Z]+-[0-9]+|DOCS-[0-9]+|BLOG-[0-9]+)`.
	citationRe = regexp.MustCompile(idPattern)
	wholeIDRe  = regexp.MustCompile(`^(?:` + idPattern + `)$`)
)

// Definitions returns the ID of every definition line in src, in order: a
// line starting `- **<ID>**`.
func Definitions(src []byte) []string {
	matches := definitionRe.FindAllSubmatch(src, -1)
	ids := make([]string, 0, len(matches))

	for _, m := range matches {
		ids = append(ids, string(m[1]))
	}

	return ids
}

// Citations returns every rule ID that appears anywhere in src, in order and
// with repeats.
func Citations(src []byte) []string {
	matches := citationRe.FindAll(src, -1)
	ids := make([]string, 0, len(matches))

	for _, m := range matches {
		ids = append(ids, string(m))
	}

	return ids
}

// IsID reports whether s is exactly one rule ID and nothing else.
func IsID(s string) bool {
	return wholeIDRe.MatchString(s)
}

// Set is the set of defined rule IDs. Build it with [Load].
type Set struct {
	ids map[string]struct{}
}

// Load collects the definitions in `<rulesDir>/rules.md` and every
// `<rulesDir>/scopes/*.md`. rulesDir is the directory holding the
// writing rules, `.claude/writing` in the repository. An ID defined twice is an
// [ErrDuplicate] error.
func Load(rulesDir string) (Set, error) {
	scopes, err := filepath.Glob(filepath.Join(rulesDir, "scopes", "*.md"))
	if err != nil {
		return Set{}, fmt.Errorf("listing writing scopes: %w", err)
	}

	files := append([]string{filepath.Join(rulesDir, "rules.md")}, scopes...)
	set := Set{ids: make(map[string]struct{})}

	for _, file := range files {
		src, err := os.ReadFile(file)
		if err != nil {
			return Set{}, fmt.Errorf("reading rule definitions: %w", err)
		}

		for _, id := range Definitions(src) {
			if _, ok := set.ids[id]; ok {
				return Set{}, fmt.Errorf("%s: %w: %s", file, ErrDuplicate, id)
			}

			set.ids[id] = struct{}{}
		}
	}

	return set, nil
}

// Has reports whether id is defined.
func (s Set) Has(id string) bool {
	_, ok := s.ids[id]

	return ok
}

// IDs returns the defined IDs, sorted.
func (s Set) IDs() []string {
	ids := make([]string, 0, len(s.ids))
	for id := range s.ids {
		ids = append(ids, id)
	}

	slices.Sort(ids)

	return ids
}
