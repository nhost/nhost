package resolve

import (
	_ "embed"
	"path"
	"strings"
)

var (
	//go:embed exclusions.txt
	exclusions string

	//go:embed resolution.md
	resolution string
)

// ExclusionList returns the embedded generated-page exclusion list, one glob
// per line relative to `docs/src/content/docs/`, byte-identical to the `text`
// fence under "Coverage and generated pages" in `rules.md`.
func ExclusionList() string {
	return exclusions
}

// TableMarkdown returns the embedded resolution table, byte-identical to the
// `markdown` fence under "Resolving the scope and the voice" in
// `rules.md`.
func TableMarkdown() string {
	return resolution
}

// isGenerated reports whether rel, relative to `docs/src/content/docs/`,
// matches the exclusion list. A glob ending in `/**` matches everything below
// its directory; any other glob is matched with [path.Match].
func isGenerated(rel string) bool {
	for glob := range strings.Lines(exclusions) {
		glob = strings.TrimSpace(glob)
		if glob == "" {
			continue
		}

		if dir, ok := strings.CutSuffix(glob, "/**"); ok {
			if strings.HasPrefix(rel, dir+"/") {
				return true
			}

			continue
		}

		if matched, err := path.Match(glob, rel); err == nil && matched {
			return true
		}
	}

	return false
}
