package tui

import (
	"fmt"
	"strings"
	"sync"

	"github.com/alecthomas/chroma/v2"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
	"github.com/nhost/nhost/tools/lazyreview/diff"
)

// Highlighter tokenizes diff lines using chroma and caches the results per file.
type Highlighter struct {
	mu    sync.Mutex
	cache map[string][]string // file path -> highlighted lines
	style *chroma.Style
}

// NewHighlighter creates a Highlighter with the dracula chroma style.
func NewHighlighter() *Highlighter {
	return &Highlighter{
		mu:    sync.Mutex{},
		cache: make(map[string][]string),
		style: styles.Get("dracula"),
	}
}

// Clear invalidates the entire highlight cache.
func (h *Highlighter) Clear() {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.cache = make(map[string][]string)
}

// HighlightFile tokenizes all lines in a diff file and returns cached results.
// Returns nil if no lexer matches the file path.
func (h *Highlighter) HighlightFile(f *diff.File) []string {
	if f == nil {
		return nil
	}

	h.mu.Lock()
	defer h.mu.Unlock()

	if cached, ok := h.cache[f.Path]; ok {
		return cached
	}

	lexer := lexers.Match(f.Path)
	if lexer == nil {
		return nil
	}

	lexer = chroma.Coalesce(lexer)

	var lines []string
	for _, hunk := range f.Hunks {
		// blank entry for the hunk header line
		lines = append(lines, "")

		for _, line := range hunk.Lines {
			lines = append(lines, h.highlightLine(lexer, line.Content))
		}
	}

	h.cache[f.Path] = lines

	return lines
}

// highlightLine tokenizes a single line and returns an ANSI-colored string.
func (h *Highlighter) highlightLine(lexer chroma.Lexer, content string) string {
	// Strip the diff prefix (+/-/ ) for tokenization
	raw := content
	if len(raw) > 0 {
		switch raw[0] {
		case '+', '-', ' ':
			raw = raw[1:]
		}
	}

	iter, err := lexer.Tokenise(nil, raw)
	if err != nil {
		return ""
	}

	var sb strings.Builder

	// Write the diff prefix character without syntax coloring
	if len(content) > 0 {
		sb.WriteByte(content[0])
	}

	for _, token := range iter.Tokens() {
		entry := h.style.Get(token.Type)
		fg := entry.Colour

		if !fg.IsSet() {
			sb.WriteString(token.Value)

			continue
		}

		r, g, b := fg.Red(), fg.Green(), fg.Blue()
		sb.WriteString(fmt.Sprintf("\033[38;2;%d;%d;%dm%s\033[39m", r, g, b, token.Value))
	}

	return sb.String()
}

// StyleLine combines a cached syntax-highlighted foreground with a diff
// background color. Falls back to plain diff styling when highlight is empty.
func (h *Highlighter) StyleLine(
	line diff.Line,
	highlight string,
	plainFallback string,
) string {
	if highlight == "" {
		return plainFallback
	}

	switch line.Type {
	case diff.Added:
		return addedBgANSI + highlight + resetANSI
	case diff.Removed:
		return removedBgANSI + highlight + resetANSI
	case diff.Context:
		return highlight
	}

	return highlight
}
