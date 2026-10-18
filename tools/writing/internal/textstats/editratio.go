// Package textstats measures documents as plain text, without a model. It
// computes the line-level edit ratio between a draft and its final version,
// and the voice statistics of a corpus: sentence length, person, imperative
// openings, questions and the density of headings, bold, lists and code.
package textstats

import "strings"

// EditRatio returns the share of lines changed between a and b:
// (insertions + deletions) / (lines in a + lines in b), from a minimal
// line diff, so 0 means identical and 1 means no line in common. Lines are
// compared byte for byte, including a missing final newline, as `git diff`
// does; two empty inputs have a ratio of 0.
func EditRatio(a, b []byte) float64 {
	linesA := splitLines(a)
	linesB := splitLines(b)

	total := len(linesA) + len(linesB)
	if total == 0 {
		return 0
	}

	kept := lcsLength(linesA, linesB)
	deleted := len(linesA) - kept
	inserted := len(linesB) - kept

	return float64(deleted+inserted) / float64(total)
}

func splitLines(src []byte) []string {
	var lines []string
	for line := range strings.Lines(string(src)) {
		lines = append(lines, line)
	}

	return lines
}

// lcsLength returns the length of the longest common subsequence of a and b,
// which a minimal diff keeps; every other line is an insertion or a deletion.
// It keeps two rows of the dynamic-programming table, so memory is linear.
func lcsLength(a, b []string) int {
	prev := make([]int, len(b)+1)
	curr := make([]int, len(b)+1)

	for i := range a {
		for j := range b {
			switch {
			case a[i] == b[j]:
				curr[j+1] = prev[j] + 1
			case prev[j+1] >= curr[j]:
				curr[j+1] = prev[j+1]
			default:
				curr[j+1] = curr[j]
			}
		}

		prev, curr = curr, prev
	}

	return prev[len(b)]
}
