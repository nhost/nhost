package main

import (
	"bytes"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/writing/internal/corpus"
	"github.com/nhost/nhost/tools/writing/internal/textstats"
)

func TestWriteVoiceStatsTable(t *testing.T) {
	t.Parallel()

	ratio := 0.6667

	tests := []struct {
		name   string
		report voiceStatsReport
		want   string
	}{
		{
			name: "rates as percentages with their counts, then the path lists",
			report: voiceStatsReport{
				Voice:   "nuno-pato",
				Corpus:  []string{"landing/src/pages/blog/a.mdx", "landing/src/pages/blog/b.mdx"},
				HeldOut: []string{"landing/src/pages/blog/c.mdx"},
				Skipped: []corpus.Skip{
					{Path: "landing/src/pages/blog/d.mdx", Reason: "resolves to nhost-blog"},
				},
				Stats: textstats.Stats{
					Documents:             2,
					Words:                 1000,
					Sentences:             80,
					MeanSentenceLength:    12.5,
					MedianSentenceLength:  11,
					FirstPersonPlural:     20,
					SecondPerson:          30,
					FirstPluralPerSecond:  &ratio,
					ImperativeOpenings:    6,
					ImperativeOpeningRate: 0.075,
					Questions:             1,
					QuestionRate:          0.0125,
					Headings:              9,
					HeadingsPer1k:         9,
					Bold:                  4,
					BoldPer1k:             4,
					ListItems:             15,
					ListItemsPer1k:        15,
					CodeBlocks:            2,
					CodeBlocksPer1k:       2,
				},
			},
			want: "Voice `nuno-pato`: 2 documents, 1000 words, 80 sentences.\n" +
				"\n" +
				"| Stat | Value |\n" +
				"| --- | --- |\n" +
				"| Mean sentence length (words) | 12.5 |\n" +
				"| Median sentence length (words) | 11.0 |\n" +
				"| First person plural sentences (we, our, us, let's) | 20 |\n" +
				"| Second person sentences (you, your) | 30 |\n" +
				"| First person plural per second person | 0.67 |\n" +
				"| Imperative openings | 7.5% (6) |\n" +
				"| Questions | 1.2% (1) |\n" +
				"| Headings per 1k words | 9.0 (9) |\n" +
				"| Bold spans per 1k words | 4.0 (4) |\n" +
				"| List items per 1k words | 15.0 (15) |\n" +
				"| Code blocks per 1k words | 2.0 (2) |\n" +
				"\n" +
				"Held out (1):\n" +
				"- landing/src/pages/blog/c.mdx\n" +
				"\n" +
				"Skipped (1):\n" +
				"- landing/src/pages/blog/d.mdx: resolves to nhost-blog\n",
		},
		{
			name: "no second person and empty lists",
			report: voiceStatsReport{
				Voice:   "max-serdiukov",
				Corpus:  []string{},
				HeldOut: []string{},
				Skipped: []corpus.Skip{},
				Stats:   textstats.Measure(nil),
			},
			want: "Voice `max-serdiukov`: 0 documents, 0 words, 0 sentences.\n" +
				"\n" +
				"| Stat | Value |\n" +
				"| --- | --- |\n" +
				"| Mean sentence length (words) | 0.0 |\n" +
				"| Median sentence length (words) | 0.0 |\n" +
				"| First person plural sentences (we, our, us, let's) | 0 |\n" +
				"| Second person sentences (you, your) | 0 |\n" +
				"| First person plural per second person | n/a |\n" +
				"| Imperative openings | 0.0% (0) |\n" +
				"| Questions | 0.0% (0) |\n" +
				"| Headings per 1k words | 0.0 (0) |\n" +
				"| Bold spans per 1k words | 0.0 (0) |\n" +
				"| List items per 1k words | 0.0 (0) |\n" +
				"| Code blocks per 1k words | 0.0 (0) |\n" +
				"\n" +
				"Held out (0):\n" +
				"\n" +
				"Skipped (0):\n",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var buf bytes.Buffer

			writeVoiceStatsTable(&buf, tt.report)

			if got := buf.String(); got != tt.want {
				t.Errorf("writeVoiceStatsTable() =\n%s\nwant:\n%s", got, tt.want)
			}
		})
	}
}

func TestWrapWords(t *testing.T) {
	t.Parallel()

	got := wrapWords(textstats.ImperativeVerbs())

	lines := strings.SplitSeq(got, "\n")
	for line := range lines {
		if len(line) > 78 || !strings.HasPrefix(line, "  ") {
			t.Errorf("wrapWords() line %q is longer than 78 or not indented by two", line)
		}
	}

	joined := strings.Join(strings.Fields(got), " ")
	if want := strings.Join(textstats.ImperativeVerbs(), ", "); joined != want {
		t.Errorf("wrapWords() words = %q, want %q", joined, want)
	}
}
