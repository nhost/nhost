package diff

import (
	"fmt"
	"strconv"
	"strings"
)

type LineType int

const (
	Context LineType = iota
	Added
	Removed
)

type Line struct {
	Type    LineType
	Content string
}

type Hunk struct {
	Header   string
	OldStart int
	OldCount int
	NewStart int
	NewCount int
	Lines    []Line
}

type File struct {
	Path    string
	Hunks   []*Hunk
	RawDiff string
}

func Parse(raw string) []*File {
	lines := strings.Split(raw, "\n")

	var (
		files       []*File
		currentFile *File
		currentHunk *Hunk
		rawLines    []string
	)

	for i := range lines {
		line := lines[i]

		if strings.HasPrefix(line, "diff --git ") {
			if currentFile != nil {
				currentFile.RawDiff = strings.Join(rawLines, "\n")
				files = append(files, currentFile)
			}

			currentFile = &File{} //nolint:exhaustruct
			currentHunk = nil
			rawLines = []string{line}

			continue
		}

		if currentFile == nil {
			continue
		}

		rawLines = append(rawLines, line)

		if strings.HasPrefix(line, "Binary files ") {
			currentFile = nil
			rawLines = nil

			continue
		}

		if strings.HasPrefix(line, "--- a/") && currentFile.Path == "" {
			currentFile.Path = strings.TrimPrefix(line, "--- a/")

			continue
		}

		if after, ok := strings.CutPrefix(line, "+++ b/"); ok {
			currentFile.Path = after

			continue
		}

		if strings.HasPrefix(line, "--- ") || strings.HasPrefix(line, "+++ ") {
			continue
		}

		if strings.HasPrefix(line, "@@") {
			hunk, err := parseHunkHeader(line)
			if err != nil {
				continue
			}

			currentHunk = hunk
			currentFile.Hunks = append(currentFile.Hunks, currentHunk)

			continue
		}

		if currentHunk == nil {
			continue
		}

		switch {
		case strings.HasPrefix(line, "+"):
			currentHunk.Lines = append(currentHunk.Lines, Line{
				Type:    Added,
				Content: line,
			})
		case strings.HasPrefix(line, "-"):
			currentHunk.Lines = append(currentHunk.Lines, Line{
				Type:    Removed,
				Content: line,
			})
		default:
			currentHunk.Lines = append(currentHunk.Lines, Line{
				Type:    Context,
				Content: line,
			})
		}
	}

	if currentFile != nil && currentFile.Path != "" {
		currentFile.RawDiff = strings.Join(rawLines, "\n")
		files = append(files, currentFile)
	}

	return files
}

// HunkPatch extracts the file header and a single hunk from a raw diff
// to produce a valid patch suitable for git apply.
func HunkPatch(rawDiff string, hunkIndex int) string {
	lines := strings.Split(rawDiff, "\n")

	var header []string

	hunkCount := -1

	var hunkLines []string

	for _, line := range lines {
		if strings.HasPrefix(line, "@@") {
			hunkCount++

			if hunkCount == hunkIndex {
				hunkLines = append(hunkLines, line)
			} else if hunkCount > hunkIndex {
				break
			}

			continue
		}

		if hunkCount < 0 {
			header = append(header, line)

			continue
		}

		if hunkCount == hunkIndex {
			hunkLines = append(hunkLines, line)
		}
	}

	if len(hunkLines) == 0 {
		return ""
	}

	result := strings.Join(header, "\n") + "\n" + strings.Join(hunkLines, "\n")
	if !strings.HasSuffix(result, "\n") {
		result += "\n"
	}

	return result
}

func parseHunkHeader(header string) (*Hunk, error) {
	// Format: @@ -old_start,old_count +new_start,new_count @@ optional context
	parts := strings.SplitN(header, "@@", 3) //nolint:mnd
	if len(parts) < 3 {                      //nolint:mnd
		return nil, fmt.Errorf("invalid hunk header: %s", header)
	}

	ranges := strings.TrimSpace(parts[1])
	rangeParts := strings.Fields(ranges)

	if len(rangeParts) < 2 { //nolint:mnd
		return nil, fmt.Errorf("invalid hunk ranges: %s", ranges)
	}

	oldStart, oldCount, err := parseRange(rangeParts[0][1:]) // skip '-'
	if err != nil {
		return nil, fmt.Errorf("invalid old range: %w", err)
	}

	newStart, newCount, err := parseRange(rangeParts[1][1:]) // skip '+'
	if err != nil {
		return nil, fmt.Errorf("invalid new range: %w", err)
	}

	return &Hunk{
		Header:   header,
		OldStart: oldStart,
		OldCount: oldCount,
		NewStart: newStart,
		NewCount: newCount,
		Lines:    nil,
	}, nil
}

func parseRange(r string) (int, int, error) {
	parts := strings.SplitN(r, ",", 2) //nolint:mnd

	start, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, fmt.Errorf("invalid start: %w", err)
	}

	count := 1
	if len(parts) == 2 { //nolint:mnd
		count, err = strconv.Atoi(parts[1])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid count: %w", err)
		}
	}

	return start, count, nil
}
