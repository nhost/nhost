package textstats_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/tools/writing/internal/textstats"
)

func TestMeasure(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		fixtures []string
		inline   []string
		want     textstats.Stats
	}{
		{
			// Eight sentences of 6, 5, 4, 3, 6, 4, 5 and 3 words survive:
			// frontmatter, the import, both exports, the MDX comment, the
			// fence, the JSX tags and their props, the table and the
			// directive lines are dropped. "Let's" and "We" are first person
			// plural, the capital "US" is not; "Run", "Open" and "See" open
			// imperatively.
			name:     "MDX constructs",
			fixtures: []string{"constructs.mdx"},
			want: textstats.Stats{
				Documents:             1,
				Words:                 36,
				Sentences:             8,
				MeanSentenceLength:    4.5,
				MedianSentenceLength:  4.5,
				FirstPersonPlural:     2,
				SecondPerson:          1,
				FirstPluralPerSecond:  new(float64(2)),
				ImperativeOpenings:    3,
				ImperativeOpeningRate: 0.375,
				Questions:             1,
				QuestionRate:          0.125,
				Headings:              2,
				HeadingsPer1k:         55.5556,
				Bold:                  2,
				BoldPer1k:             55.5556,
				ListItems:             3,
				ListItemsPer1k:        83.3333,
				CodeBlocks:            1,
				CodeBlocksPer1k:       27.7778,
			},
		},
		{
			// plain.md adds three five-word sentences, two first person
			// plural, one second person and one question, to the eight above.
			name:     "sentences pool across documents",
			fixtures: []string{"constructs.mdx", "plain.md"},
			want: textstats.Stats{
				Documents:             2,
				Words:                 51,
				Sentences:             11,
				MeanSentenceLength:    4.6364,
				MedianSentenceLength:  5,
				FirstPersonPlural:     4,
				SecondPerson:          2,
				FirstPluralPerSecond:  new(float64(2)),
				ImperativeOpenings:    3,
				ImperativeOpeningRate: 0.2727,
				Questions:             2,
				QuestionRate:          0.1818,
				Headings:              2,
				HeadingsPer1k:         39.2157,
				Bold:                  2,
				BoldPer1k:             39.2157,
				ListItems:             3,
				ListItemsPer1k:        58.8235,
				CodeBlocks:            1,
				CodeBlocksPer1k:       19.6078,
			},
		},
		{
			name: "no second person leaves the ratio unset",
			inline: []string{
				"We like tests. Our tests pass.\n\n# A title is not counted\n\n##### Nor is a fifth level\n",
			},
			want: textstats.Stats{
				Documents:             1,
				Words:                 6,
				Sentences:             2,
				MeanSentenceLength:    3,
				MedianSentenceLength:  3,
				FirstPersonPlural:     2,
				SecondPerson:          0,
				FirstPluralPerSecond:  nil,
				ImperativeOpenings:    0,
				ImperativeOpeningRate: 0,
				Questions:             0,
				QuestionRate:          0,
				Headings:              0,
				HeadingsPer1k:         0,
				Bold:                  0,
				BoldPer1k:             0,
				ListItems:             0,
				ListItemsPer1k:        0,
				CodeBlocks:            0,
				CodeBlocksPer1k:       0,
			},
		},
		{
			// The tilde fence holds a backtick fence line, which must not
			// close it; the indented fence under a list item is a block too.
			name: "tilde and indented fences",
			inline: []string{
				"Install it.\n\n~~~md\n```\nNot prose.\n~~~\n\n- Copy this:\n\n  ```sh\n  cp a b\n  ```\n",
			},
			want: textstats.Stats{
				Documents:             1,
				Words:                 4,
				Sentences:             2,
				MeanSentenceLength:    2,
				MedianSentenceLength:  2,
				FirstPersonPlural:     0,
				SecondPerson:          0,
				FirstPluralPerSecond:  nil,
				ImperativeOpenings:    2,
				ImperativeOpeningRate: 1,
				Questions:             0,
				QuestionRate:          0,
				Headings:              0,
				HeadingsPer1k:         0,
				Bold:                  0,
				BoldPer1k:             0,
				ListItems:             1,
				ListItemsPer1k:        250,
				CodeBlocks:            2,
				CodeBlocksPer1k:       500,
			},
		},
		{
			name:   "angle-bracketed link destination with parentheses",
			inline: []string{"See [Yo](<https://en.wikipedia.org/wiki/Yo_(app)>) now.\n"},
			want: textstats.Stats{
				Documents:             1,
				Words:                 3,
				Sentences:             1,
				MeanSentenceLength:    3,
				MedianSentenceLength:  3,
				FirstPersonPlural:     0,
				SecondPerson:          0,
				FirstPluralPerSecond:  nil,
				ImperativeOpenings:    1,
				ImperativeOpeningRate: 1,
				Questions:             0,
				QuestionRate:          0,
				Headings:              0,
				HeadingsPer1k:         0,
				Bold:                  0,
				BoldPer1k:             0,
				ListItems:             0,
				ListItemsPer1k:        0,
				CodeBlocks:            0,
				CodeBlocksPer1k:       0,
			},
		},
		{
			name: "no documents",
			want: textstats.Stats{
				Documents:             0,
				Words:                 0,
				Sentences:             0,
				MeanSentenceLength:    0,
				MedianSentenceLength:  0,
				FirstPersonPlural:     0,
				SecondPerson:          0,
				FirstPluralPerSecond:  nil,
				ImperativeOpenings:    0,
				ImperativeOpeningRate: 0,
				Questions:             0,
				QuestionRate:          0,
				Headings:              0,
				HeadingsPer1k:         0,
				Bold:                  0,
				BoldPer1k:             0,
				ListItems:             0,
				ListItemsPer1k:        0,
				CodeBlocks:            0,
				CodeBlocksPer1k:       0,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			docs := make([][]byte, 0, len(tt.fixtures)+len(tt.inline))

			for _, name := range tt.fixtures {
				data, err := os.ReadFile(filepath.Join("testdata", "voice", name))
				if err != nil {
					t.Fatalf("reading fixture: %v", err)
				}

				docs = append(docs, data)
			}

			for _, src := range tt.inline {
				docs = append(docs, []byte(src))
			}

			if diff := cmp.Diff(tt.want, textstats.Measure(docs)); diff != "" {
				t.Errorf("Measure() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestImperativeVerbs(t *testing.T) {
	t.Parallel()

	verbs := textstats.ImperativeVerbs()
	if len(verbs) != 34 {
		t.Errorf("ImperativeVerbs() has %d verbs, want 34", len(verbs))
	}

	verbs[0] = "changed"

	if textstats.ImperativeVerbs()[0] != "run" {
		t.Error("ImperativeVerbs() shares its list with the caller")
	}
}
