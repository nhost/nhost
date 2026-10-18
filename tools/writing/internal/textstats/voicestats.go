package textstats

import (
	"math"
	"regexp"
	"slices"
	"strings"
)

// ImperativeVerbs returns the fixed list of base-form verbs that make a
// sentence an imperative opening when one is its first word, compared in
// lower case.
func ImperativeVerbs() []string {
	return []string{
		"run", "open", "create", "add", "set", "click", "install", "use", "go",
		"select", "copy", "paste", "enable", "configure", "deploy", "start",
		"check", "make", "call", "define", "update", "remove", "delete",
		"navigate", "choose", "enter", "save", "import", "export", "edit",
		"replace", "see", "note", "try",
	}
}

var (
	frontmatterRe = regexp.MustCompile(`(?s)\A---\n.*?\n---(?:\n|\z)`)
	mdxCommentRe  = regexp.MustCompile(`(?s)\{/\*.*?\*/\}`)
	// jsxTagRe matches an opening, closing or self-closing JSX or HTML tag,
	// across lines, so a component whose props span several lines goes
	// whole; the text between an opening and a closing tag is kept.
	jsxTagRe   = regexp.MustCompile(`</?[A-Za-z][A-Za-z0-9.]*(?:\s[^<>]*)?/?>`)
	fenceRe    = regexp.MustCompile("^\\s*(```|~~~)")
	headingRe  = regexp.MustCompile(`^(#{1,6}) `)
	listItemRe = regexp.MustCompile(`^\s*(?:[-*+]|\d+[.)])\s+(.*)$`)
	boldRe     = regexp.MustCompile(`\*\*[^*\n]+?\*\*`)
	// imageRe and linkRe accept an angle-bracketed destination, which may
	// hold parentheses: [Yo](<https://en.wikipedia.org/wiki/Yo_(app)>).
	imageRe = regexp.MustCompile(`!\[[^\]]*\]\((?:<[^>]*>|[^)]*)\)`)
	linkRe  = regexp.MustCompile(`\[([^\]]*)\]\((?:<[^>]*>|[^)]*)\)`)
	// sentenceEndRe matches the end of a sentence inside a paragraph: `.`,
	// `!` or `?`, any closing quotes or brackets, then whitespace.
	sentenceEndRe = regexp.MustCompile(`[.!?]+["'’”)\]]*\s+`)
	// firstPluralRe matches `we`, `our` and `let's` in any case, and `us` in
	// lower case only, so the `US` of a region name does not count.
	firstPluralRe = regexp.MustCompile(`(?i:\b(?:we|our|let['’]s)\b)|\bus\b`)
	secondRe      = regexp.MustCompile(`(?i)\b(?:you|your)\b`)
	wordTrimRe    = regexp.MustCompile(`^[^\p{L}]+|[^\p{L}'’]+$`)
)

// Stats are the voice statistics of a corpus. Counts are summed over every
// document; lengths and rates are computed over the pooled sentences, so a
// long document weighs more than a short one. Per-1k densities divide by
// Words.
type Stats struct {
	Documents int `json:"documents"`
	// Words counts whitespace-separated words in prose sentences, not in
	// headings, tables or code.
	Words     int `json:"words"`
	Sentences int `json:"sentences"`

	MeanSentenceLength   float64 `json:"mean_sentence_length"`
	MedianSentenceLength float64 `json:"median_sentence_length"`

	// FirstPersonPlural counts sentences containing we, our, us or let's;
	// SecondPerson counts sentences containing you or your.
	FirstPersonPlural int `json:"first_person_plural_sentences"`
	SecondPerson      int `json:"second_person_sentences"`
	// FirstPluralPerSecond is FirstPersonPlural / SecondPerson, nil when no
	// sentence is in the second person.
	FirstPluralPerSecond *float64 `json:"first_plural_per_second"`

	ImperativeOpenings    int     `json:"imperative_openings"`
	ImperativeOpeningRate float64 `json:"imperative_opening_rate"`
	Questions             int     `json:"questions"`
	QuestionRate          float64 `json:"question_rate"`

	Headings        int     `json:"headings"`
	HeadingsPer1k   float64 `json:"headings_per_1k_words"`
	Bold            int     `json:"bold_spans"`
	BoldPer1k       float64 `json:"bold_per_1k_words"`
	ListItems       int     `json:"list_items"`
	ListItemsPer1k  float64 `json:"list_items_per_1k_words"`
	CodeBlocks      int     `json:"code_blocks"`
	CodeBlocksPer1k float64 `json:"code_blocks_per_1k_words"`
}

// counts are the raw tallies for one document.
type counts struct {
	sentenceLengths []int
	firstPlural     int
	second          int
	imperatives     int
	questions       int
	headings        int
	bold            int
	listItems       int
	codeBlocks      int
}

// Measure returns the voice statistics of the documents, each the source of
// one Markdown or MDX page. Before measuring, a document loses its leading
// `---` frontmatter, `{/* */}` comments, fenced code blocks, `import` lines
// and `export` blocks outside fences, and JSX or HTML tags (the text between
// tags stays). What remains is split into paragraphs at blank lines,
// headings, list items, table rows and `:::` directives; list items count as
// paragraphs of their own, and headings, table rows and directive lines are
// not prose. A paragraph splits into sentences after each `.`, `!` or `?`
// followed by whitespace.
//
//   - Sentence length is in whitespace-separated words, after Markdown links
//     and images are reduced to their text and emphasis and backticks are
//     dropped.
//   - An imperative opening is a sentence whose first word, in lower case, is
//     in [ImperativeVerbs].
//   - A question is a sentence ending in `?`.
//   - A heading is a `##`, `###` or `####` line outside a fence.
//   - Bold is a `**...**` span on one line outside a fence, headings and
//     tables included.
//   - A list item is a line starting with `-`, `*`, `+` or `N.`/`N)` and a
//     space, outside a fence.
//   - A code block is a fenced block, counted once at its opening line.
func Measure(docs [][]byte) Stats {
	imperatives := make(map[string]struct{})
	for _, verb := range ImperativeVerbs() {
		imperatives[verb] = struct{}{}
	}

	var total counts

	for _, doc := range docs {
		c := measureDocument(doc, imperatives)
		total.sentenceLengths = append(total.sentenceLengths, c.sentenceLengths...)
		total.firstPlural += c.firstPlural
		total.second += c.second
		total.imperatives += c.imperatives
		total.questions += c.questions
		total.headings += c.headings
		total.bold += c.bold
		total.listItems += c.listItems
		total.codeBlocks += c.codeBlocks
	}

	return total.stats(len(docs))
}

func (c *counts) stats(documents int) Stats {
	words := 0
	for _, n := range c.sentenceLengths {
		words += n
	}

	sentences := len(c.sentenceLengths)

	var ratio *float64
	if c.second > 0 {
		r := round(float64(c.firstPlural) / float64(c.second))
		ratio = &r
	}

	return Stats{
		Documents:             documents,
		Words:                 words,
		Sentences:             sentences,
		MeanSentenceLength:    share(words, sentences),
		MedianSentenceLength:  median(c.sentenceLengths),
		FirstPersonPlural:     c.firstPlural,
		SecondPerson:          c.second,
		FirstPluralPerSecond:  ratio,
		ImperativeOpenings:    c.imperatives,
		ImperativeOpeningRate: share(c.imperatives, sentences),
		Questions:             c.questions,
		QuestionRate:          share(c.questions, sentences),
		Headings:              c.headings,
		HeadingsPer1k:         perThousand(c.headings, words),
		Bold:                  c.bold,
		BoldPer1k:             perThousand(c.bold, words),
		ListItems:             c.listItems,
		ListItemsPer1k:        perThousand(c.listItems, words),
		CodeBlocks:            c.codeBlocks,
		CodeBlocksPer1k:       perThousand(c.codeBlocks, words),
	}
}

func measureDocument(src []byte, imperatives map[string]struct{}) counts {
	text := strings.ReplaceAll(string(src), "\r\n", "\n")
	text = frontmatterRe.ReplaceAllString(text, "")
	text = mdxCommentRe.ReplaceAllString(text, "")

	var c counts

	text = stripCode(text, &c)
	text = jsxTagRe.ReplaceAllString(text, "")

	for _, paragraph := range paragraphs(text, &c) {
		for _, sentence := range sentences(paragraph) {
			c.addSentence(sentence, imperatives)
		}
	}

	return c
}

// stripCode drops fenced blocks, counting each, and the `import` lines and
// `export` blocks outside them.
func stripCode(text string, c *counts) string {
	var (
		kept       []string
		fence      string
		exportOpen int
	)

	for line := range strings.Lines(text) {
		line = strings.TrimSuffix(line, "\n")

		switch {
		case fence != "":
			if m := fenceRe.FindStringSubmatch(line); m != nil && m[1] == fence {
				fence = ""
			}
		case exportOpen > 0:
			exportOpen += bracketDepth(line)
		case fenceRe.MatchString(line):
			fence = fenceRe.FindStringSubmatch(line)[1]
			c.codeBlocks++
		case strings.HasPrefix(line, "import "):
		case strings.HasPrefix(line, "export "):
			exportOpen = max(bracketDepth(line), 0)
		default:
			kept = append(kept, line)
		}
	}

	return strings.Join(kept, "\n")
}

// bracketDepth returns the opening minus the closing brackets on a line.
func bracketDepth(line string) int {
	return strings.Count(line, "{") + strings.Count(line, "(") + strings.Count(line, "[") -
		strings.Count(line, "}") - strings.Count(line, ")") - strings.Count(line, "]")
}

// paragraphs splits prose into paragraphs, counting headings, list items and
// bold spans on the way.
func paragraphs(text string, c *counts) []string {
	var (
		out     []string
		current []string
	)

	flush := func() {
		if len(current) > 0 {
			out = append(out, strings.Join(current, " "))
			current = nil
		}
	}

	for line := range strings.Lines(text) {
		line = strings.TrimSpace(line)
		c.bold += len(boldRe.FindAllString(line, -1))

		if m := headingRe.FindStringSubmatch(line); m != nil {
			if n := len(m[1]); n >= 2 && n <= 4 {
				c.headings++
			}

			flush()

			continue
		}

		if m := listItemRe.FindStringSubmatch(line); m != nil {
			c.listItems++

			flush()

			current = append(current, m[1])

			continue
		}

		switch {
		case line == "", strings.HasPrefix(line, "|"), strings.HasPrefix(line, ":::"),
			strings.Trim(line, "-*_ ") == "":
			flush()
		default:
			current = append(current, strings.TrimSpace(strings.TrimPrefix(line, ">")))
		}
	}

	flush()

	return out
}

// sentences splits a paragraph after each sentence end and returns the
// non-empty sentences with links, images, emphasis and backticks reduced to
// plain words.
func sentences(paragraph string) []string {
	paragraph = imageRe.ReplaceAllString(paragraph, "")
	paragraph = linkRe.ReplaceAllString(paragraph, "$1")
	paragraph = strings.NewReplacer("**", "", "`", "", "__", "").Replace(paragraph)

	// The trailing space lets the last sentence end like the others.
	paragraph += " "

	var out []string

	start := 0
	for _, loc := range sentenceEndRe.FindAllStringIndex(paragraph, -1) {
		if s := strings.TrimSpace(paragraph[start:loc[1]]); hasWord(s) {
			out = append(out, s)
		}

		start = loc[1]
	}

	if s := strings.TrimSpace(paragraph[start:]); hasWord(s) {
		out = append(out, s)
	}

	return out
}

func hasWord(s string) bool {
	return strings.IndexFunc(s, func(r rune) bool {
		return r >= '0' && r <= '9' || r >= 'A' && r <= 'Z' || r >= 'a' && r <= 'z' || r > 0x7f
	}) >= 0
}

func (c *counts) addSentence(s string, imperatives map[string]struct{}) {
	words := strings.Fields(s)
	c.sentenceLengths = append(c.sentenceLengths, len(words))

	if firstPluralRe.MatchString(s) {
		c.firstPlural++
	}

	if secondRe.MatchString(s) {
		c.second++
	}

	first := strings.ToLower(wordTrimRe.ReplaceAllString(words[0], ""))
	if _, ok := imperatives[first]; ok {
		c.imperatives++
	}

	if strings.HasSuffix(strings.TrimRight(s, `"'’”)]`), "?") {
		c.questions++
	}
}

func share(n, of int) float64 {
	if of == 0 {
		return 0
	}

	return round(float64(n) / float64(of))
}

func perThousand(n, words int) float64 {
	if words == 0 {
		return 0
	}

	return round(float64(n) * 1000 / float64(words))
}

func median(lengths []int) float64 {
	if len(lengths) == 0 {
		return 0
	}

	sorted := slices.Sorted(slices.Values(lengths))
	mid := len(sorted) / 2 //nolint:mnd // halfway

	if len(sorted)%2 == 1 {
		return float64(sorted[mid])
	}

	return float64(sorted[mid-1]+sorted[mid]) / 2 //nolint:mnd // mean of the middle two
}

// round keeps four decimal places, so the JSON output is stable across
// platforms.
func round(x float64) float64 {
	const scale = 10_000

	return math.Round(x*scale) / scale
}
