package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/nhost/nhost/tools/writing/internal/corpus"
	"github.com/nhost/nhost/tools/writing/internal/expect"
	"github.com/nhost/nhost/tools/writing/internal/resolve"
	"github.com/nhost/nhost/tools/writing/internal/textstats"
	"github.com/urfave/cli/v3"
)

const (
	formatTable = "table"
	formatJSON  = "json"
)

const voiceStatsDescription = `Measures the corpus of one voice profile. Every file is resolved as
'writing resolve' would resolve it, and kept only when it resolves to --voice;
for nhost-blog, a blog post is kept when it resolves without error to a
profiled author, and one with an unprofiled byline is skipped. A profile's
since: window then narrows the corpus, and every held-out document in
--expect is set aside.
Co-authored posts, generated pages and other voices' documents are skipped
with a reason on stderr, never an error.

Before measuring, a document loses its frontmatter, {/* */} comments, fenced
code, import lines and export blocks, and JSX or HTML tags (their text stays).
Prose splits into paragraphs at blank lines, headings, list items, table rows
and ::: directives; a paragraph splits into sentences after each '.', '!' or
'?' followed by whitespace. Over the pooled sentences of the corpus:

  sentence length      whitespace-separated words, mean and median
  first person plural  sentences containing we, our, let's (any case) or us
                       (lower case only, so "US" is not counted)
  second person        sentences containing you or your
  imperative opening   share of sentences whose first word, in lower case, is
                       one of the verbs below
  question rate        share of sentences ending in '?'
  per 1k words         ##-#### headings, **bold** spans, list items and fenced
                       code blocks, outside fences, per 1,000 prose words

Imperative verbs:
%s`

func voiceStatsCommand() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:        "voicestats",
		Usage:       "Measure the sentence, person and formatting stats of a voice profile's corpus.",
		Description: fmt.Sprintf(voiceStatsDescription, wrapWords(textstats.ImperativeVerbs())),
		ArgsUsage:   "<file>...",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagVoice,
				Usage:    "slug of the voice profile whose corpus to measure",
				Required: true,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagFormat,
				Usage: "table (Markdown) or json",
				Value: formatTable,
			},
			rulesDirFlag(),
			&cli.StringFlag{ //nolint:exhaustruct
				Name: flagExpect,
				Usage: "voice expectations naming the held-out documents " +
					"(default: <git root>/tools/writing/calibration/voices/expect.yaml)",
			},
		},
		Action: voiceStatsAction,
	}
}

// voiceStatsReport is the JSON output of `voicestats`.
type voiceStatsReport struct {
	Voice   string          `json:"voice"`
	Corpus  []string        `json:"corpus"`
	HeldOut []string        `json:"held_out"`
	Skipped []corpus.Skip   `json:"skipped"`
	Stats   textstats.Stats `json:"stats"`
}

func voiceStatsAction(_ context.Context, c *cli.Command) error {
	if c.NArg() == 0 {
		return cli.Exit("voicestats takes at least one file", 1)
	}

	format := c.String(flagFormat)
	if format != formatTable && format != formatJSON {
		return cli.Exit(fmt.Sprintf("--format must be table or json, got %q", format), 1)
	}

	report, err := measureVoice(c)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	for _, p := range report.HeldOut {
		fmt.Fprintf(c.Root().ErrWriter, "held out: %s\n", p)
	}

	for _, skip := range report.Skipped {
		fmt.Fprintf(c.Root().ErrWriter, "skipped: %s: %s\n", skip.Path, skip.Reason)
	}

	if format == formatJSON {
		if err := json.NewEncoder(c.Root().Writer).Encode(report); err != nil {
			return cli.Exit(fmt.Sprintf("writing result: %v", err), 1)
		}

		return nil
	}

	writeVoiceStatsTable(c.Root().Writer, report)

	return nil
}

func measureVoice(c *cli.Command) (voiceStatsReport, error) {
	rulesDir, err := rulesDirPath(c)
	if err != nil {
		return voiceStatsReport{}, err
	}

	expectPath, err := repoPath(
		c, flagExpect, "tools", "writing", "calibration", "voices", "expect.yaml",
	)
	if err != nil {
		return voiceStatsReport{}, err
	}

	resolver, err := resolve.New(rulesDir)
	if err != nil {
		return voiceStatsReport{}, fmt.Errorf("loading voice profiles: %w", err)
	}

	expectations, err := expect.Load(expectPath)
	if err != nil {
		return voiceStatsReport{}, fmt.Errorf("loading held-out documents: %w", err)
	}

	docs, err := readCandidates(c.Args().Slice())
	if err != nil {
		return voiceStatsReport{}, err
	}

	voice := c.String(flagVoice)

	sel, err := corpus.Select(resolver, voice, expectations.HeldOutPaths(), docs)
	if err != nil {
		return voiceStatsReport{}, fmt.Errorf("selecting the corpus: %w", err)
	}

	paths := make([]string, 0, len(sel.Kept))
	sources := make([][]byte, 0, len(sel.Kept))

	for _, doc := range sel.Kept {
		paths = append(paths, doc.Path)
		sources = append(sources, doc.Source)
	}

	report := voiceStatsReport{
		Voice:   voice,
		Corpus:  paths,
		HeldOut: append([]string{}, sel.HeldOut...),
		Skipped: append([]corpus.Skip{}, sel.Skipped...),
		Stats:   textstats.Measure(sources),
	}

	return report, nil
}

// readCandidates reads every file, naming it by its repository-relative path,
// which is what resolution and the held-out list compare.
func readCandidates(paths []string) ([]corpus.Document, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return nil, fmt.Errorf("getting working directory: %w", err)
	}

	root, err := findRepoRoot(cwd)
	if err != nil {
		// Without a root the paths are kept as given, as `resolve` does.
		root = ""
	}

	docs := make([]corpus.Document, 0, len(paths))

	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", p, err)
		}

		docs = append(docs, corpus.Document{Path: repoRelative(root, cwd, p), Source: data})
	}

	return docs, nil
}

// writeVoiceStatsTable writes the report as Markdown: the corpus size, the
// stats table with the count behind each rate, then the held-out and skipped
// documents.
func writeVoiceStatsTable(w io.Writer, r voiceStatsReport) {
	s := r.Stats

	ratio := "n/a"
	if s.FirstPluralPerSecond != nil {
		ratio = fmt.Sprintf("%.2f", *s.FirstPluralPerSecond)
	}

	fmt.Fprintf(w, "Voice `%s`: %d documents, %d words, %d sentences.\n\n",
		r.Voice, s.Documents, s.Words, s.Sentences)

	rows := [][2]string{
		{"Mean sentence length (words)", fmt.Sprintf("%.1f", s.MeanSentenceLength)},
		{"Median sentence length (words)", fmt.Sprintf("%.1f", s.MedianSentenceLength)},
		{"First person plural sentences (we, our, us, let's)", strconv.Itoa(s.FirstPersonPlural)},
		{"Second person sentences (you, your)", strconv.Itoa(s.SecondPerson)},
		{"First person plural per second person", ratio},
		{"Imperative openings", rate(s.ImperativeOpeningRate, s.ImperativeOpenings)},
		{"Questions", rate(s.QuestionRate, s.Questions)},
		{"Headings per 1k words", density(s.HeadingsPer1k, s.Headings)},
		{"Bold spans per 1k words", density(s.BoldPer1k, s.Bold)},
		{"List items per 1k words", density(s.ListItemsPer1k, s.ListItems)},
		{"Code blocks per 1k words", density(s.CodeBlocksPer1k, s.CodeBlocks)},
	}

	fmt.Fprintln(w, "| Stat | Value |")
	fmt.Fprintln(w, "| --- | --- |")

	for _, row := range rows {
		fmt.Fprintf(w, "| %s | %s |\n", row[0], row[1])
	}

	writePathList(w, "Held out", r.HeldOut)

	skipped := make([]string, 0, len(r.Skipped))
	for _, skip := range r.Skipped {
		skipped = append(skipped, skip.Path+": "+skip.Reason)
	}

	writePathList(w, "Skipped", skipped)
}

// wrapWords joins words with commas into lines of at most 78 characters, each
// indented by two spaces.
func wrapWords(words []string) string {
	const width = 78

	var (
		lines []string
		line  = " "
	)

	for i, word := range words {
		if i < len(words)-1 {
			word += ","
		}

		if len(line)+1+len(word) > width {
			lines = append(lines, line)
			line = " "
		}

		line += " " + word
	}

	return strings.Join(append(lines, line), "\n")
}

func rate(share float64, n int) string {
	return fmt.Sprintf("%.1f%% (%d)", share*100, n) //nolint:mnd // a percentage
}

func density(perThousand float64, n int) string {
	return fmt.Sprintf("%.1f (%d)", perThousand, n)
}

func writePathList(w io.Writer, title string, items []string) {
	fmt.Fprintf(w, "\n%s (%d):\n", title, len(items))

	for _, item := range items {
		fmt.Fprintf(w, "- %s\n", item)
	}
}
