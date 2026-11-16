package textutils

import "strings"

func CalculateCodeFenceOccurrences(fenceChar rune, content string) int {
	var occurrences []int

	var charsTogether int
	for _, char := range content {
		// We encountered a fence character, now count how many
		// are directly afterwards
		if char == fenceChar {
			charsTogether++
		} else if charsTogether != 0 {
			occurrences = append(occurrences, charsTogether)
			charsTogether = 0
		}
	}

	// If the last element in the content was a fenceChar
	if charsTogether != 0 {
		occurrences = append(occurrences, charsTogether)
	}

	return findMax(occurrences)
}

// CalculateCodeFence can be passed the content of a code block and it returns
// how many fence characters (` or ~) should be used.
//
// This is useful if the html content includes the same fence characters
// for example ```
// -> https://stackoverflow.com/a/49268657
func CalculateCodeFence(fenceChar rune, content string) string {
	repeat := CalculateCodeFenceOccurrences(fenceChar, content)

	// The outer fence block always has to have
	// at least one character more than any content inside
	repeat++

	// You have to have at least three fence characters
	// to be recognized as a code block
	if repeat < 3 {
		repeat = 3
	}

	return strings.Repeat(string(fenceChar), repeat)
}

func findMax(a []int) (max int) {
	for i, value := range a {
		if i == 0 {
			max = a[i]
		}

		if value > max {
			max = value
		}
	}
	return max
}
