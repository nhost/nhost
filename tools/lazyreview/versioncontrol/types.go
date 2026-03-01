package versioncontrol

import (
	"github.com/nhost/nhost/tools/lazyreview/diff"
)

// ChangeKind describes the type of change a file has undergone.
type ChangeKind int

const (
	ChangeModified ChangeKind = iota
	ChangeAdded               // New file (untracked ?? or staged A)
	ChangeDeleted             // D
	ChangeRenamed             // R
)

// ViewConfig holds mode-specific labels for the TUI.
type ViewConfig struct {
	ModeName    string // "REVIEW" or "GIT"
	ActionLabel string // "reviewed" or "staged"
	StageVerb   string // "Toggle reviewed" or "Stage / unstage"
}

// FileStatus represents the staging/review status of a single file.
type FileStatus struct {
	Path     string
	OrigPath string     // non-empty for renames/copies (the old path)
	Kind     ChangeKind // type of change (modified, added, deleted, renamed)
	Staged   bool       // fully staged/reviewed
	Partial  bool       // some hunks staged/reviewed
}

// ChangeDetail holds the parsed diff and per-hunk status for a single file.
type ChangeDetail struct {
	Path     string
	OrigPath string
	Kind     ChangeKind
	File     *diff.File
	Hunks    []HunkDetail
}

// HunkDetail holds the staging/review status of a single hunk.
type HunkDetail struct {
	Staged      bool
	SourceIndex int // index within the source diff (staged or unstaged)
}
