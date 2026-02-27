package diff

import (
	"errors"
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

const (
	hunkHeaderSections = 3 // before @@, range info, after @@
	minRangeParts      = 2 // old range + new range
	rangeComponents    = 2 // start,count
)

var (
	errInvalidHunkHeader = errors.New("invalid hunk header")
	errInvalidHunkRanges = errors.New("invalid hunk ranges")
)

type parser struct {
	files       []*File
	currentFile *File
	currentHunk *Hunk
	rawLines    []string
}

func Parse(raw string) []*File {
	p := &parser{
		files:       nil,
		currentFile: nil,
		currentHunk: nil,
		rawLines:    nil,
	}

	for line := range strings.SplitSeq(raw, "\n") {
		p.processLine(line)
	}

	p.finalize()

	return p.files
}

func (p *parser) processLine(line string) {
	if strings.HasPrefix(line, "diff --git ") {
		p.startNewFile(line)

		return
	}

	if p.currentFile == nil {
		return
	}

	p.rawLines = append(p.rawLines, line)

	switch {
	case strings.HasPrefix(line, "Binary files "):
		p.currentFile = nil
		p.rawLines = nil
	case p.extractFilePath(line):
		// path extraction handled
	case strings.HasPrefix(line, "@@"):
		p.processHunkHeader(line)
	case p.currentHunk != nil:
		p.currentHunk.Lines = append(p.currentHunk.Lines, classifyLine(line))
	}
}

func (p *parser) startNewFile(line string) {
	if p.currentFile != nil && p.currentFile.Path != "" {
		p.currentFile.RawDiff = strings.Join(p.rawLines, "\n")
		p.files = append(p.files, p.currentFile)
	}

	p.currentFile = &File{Path: "", Hunks: nil, RawDiff: ""}
	p.currentHunk = nil
	p.rawLines = []string{line}
}

func (p *parser) extractFilePath(line string) bool {
	if strings.HasPrefix(line, "--- a/") && p.currentFile.Path == "" {
		p.currentFile.Path = strings.TrimPrefix(line, "--- a/")

		return true
	}

	if after, ok := strings.CutPrefix(line, "+++ b/"); ok {
		p.currentFile.Path = after

		return true
	}

	// Handle renames: use the new path (rename to) for pure renames
	// that have no --- / +++ lines.
	if after, ok := strings.CutPrefix(line, "rename to "); ok {
		if p.currentFile.Path == "" {
			p.currentFile.Path = after
		}

		return true
	}

	if strings.HasPrefix(line, "rename from ") {
		return true
	}

	return strings.HasPrefix(line, "--- ") || strings.HasPrefix(line, "+++ ")
}

func (p *parser) processHunkHeader(line string) {
	hunk, err := parseHunkHeader(line)
	if err != nil {
		return
	}

	p.currentHunk = hunk
	p.currentFile.Hunks = append(p.currentFile.Hunks, p.currentHunk)
}

func (p *parser) finalize() {
	if p.currentFile != nil && p.currentFile.Path != "" {
		p.currentFile.RawDiff = strings.Join(p.rawLines, "\n")
		p.files = append(p.files, p.currentFile)
	}
}

func classifyLine(line string) Line {
	switch {
	case strings.HasPrefix(line, "+"):
		return Line{Type: Added, Content: line}
	case strings.HasPrefix(line, "-"):
		return Line{Type: Removed, Content: line}
	default:
		return Line{Type: Context, Content: line}
	}
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
	parts := strings.SplitN(header, "@@", hunkHeaderSections)
	if len(parts) < hunkHeaderSections {
		return nil, fmt.Errorf("%w: %s", errInvalidHunkHeader, header)
	}

	ranges := strings.TrimSpace(parts[1])
	rangeParts := strings.Fields(ranges)

	if len(rangeParts) < minRangeParts {
		return nil, fmt.Errorf("%w: %s", errInvalidHunkRanges, ranges)
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
	parts := strings.SplitN(r, ",", rangeComponents)

	start, err := strconv.Atoi(parts[0])
	if err != nil {
		return 0, 0, fmt.Errorf("invalid start: %w", err)
	}

	count := 1
	if len(parts) == rangeComponents {
		count, err = strconv.Atoi(parts[1])
		if err != nil {
			return 0, 0, fmt.Errorf("invalid count: %w", err)
		}
	}

	return start, count, nil
}
