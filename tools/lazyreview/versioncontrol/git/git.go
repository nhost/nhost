package git

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
)

// Executor defines the git operations that Git needs.
//
//go:generate mockgen -package mock -destination mock/executor.go . Executor
type Executor interface { //nolint:interfacebloat
	Root() string
	Status(ctx context.Context) (string, error)
	DiffFile(ctx context.Context, args ...string) (string, error)
	NewFileDiff(path string) (string, error)
	StageFiles(ctx context.Context, paths []string) error
	UnstageFiles(ctx context.Context, paths []string) error
	StageHunk(ctx context.Context, patch string) error
	UnstageHunk(ctx context.Context, patch string) error
	DiscardFiles(ctx context.Context, paths []string) error
	DiscardHunk(ctx context.Context, patch string) error
	Commit(ctx context.Context, message string) error
	Push(ctx context.Context) error
	PushForce(ctx context.Context) error
}

// Git implements tui.GitView for git mode.
// Caches bulk diffs per GetStatus cycle; invalidated on each GetStatus call.
type Git struct {
	exec          Executor
	stagedCache   map[string]*diff.File
	unstagedCache map[string]*diff.File
}

func NewGit(exec Executor) *Git {
	return &Git{
		exec:          exec,
		stagedCache:   nil,
		unstagedCache: nil,
	}
}

func (v *Git) GetStatus(
	ctx context.Context,
) ([]versioncontrol.FileStatus, error) {
	v.stagedCache = nil
	v.unstagedCache = nil

	raw, err := v.exec.Status(ctx)
	if err != nil {
		return nil, fmt.Errorf("status: %w", err)
	}

	return parseStatus(raw), nil
}

func parseStatus(raw string) []versioncontrol.FileStatus {
	trimmed := strings.TrimRight(raw, "\n")
	if trimmed == "" {
		return nil
	}

	lines := strings.Split(trimmed, "\n")
	statuses := make([]versioncontrol.FileStatus, 0, len(lines))

	for _, line := range lines {
		fs, ok := parseLine(line)
		if ok {
			statuses = append(statuses, fs)
		}
	}

	return statuses
}

func parseLine(line string) (versioncontrol.FileStatus, bool) {
	if len(line) < 4 { //nolint:mnd
		return versioncontrol.FileStatus{
			Path: "", OrigPath: "", Kind: versioncontrol.ChangeModified, Staged: false, Partial: false,
		}, false
	}

	x := line[0]
	y := line[1]
	path := line[3:]

	var origPath string

	if x == 'R' || x == 'C' {
		if idx := strings.Index(path, " -> "); idx != -1 {
			origPath = path[:idx]
			path = path[idx+4:]
		}
	}

	indexChanged := x != ' ' && x != '?'
	worktreeChanged := y != ' ' && y != '?'

	return versioncontrol.FileStatus{
		Path:     path,
		OrigPath: origPath,
		Kind:     determineChangeKind(x, y),
		Staged:   indexChanged && !worktreeChanged,
		Partial:  indexChanged && worktreeChanged,
	}, true
}

func determineChangeKind(x, y byte) versioncontrol.ChangeKind {
	switch {
	case x == '?' || x == 'A' || y == 'A':
		return versioncontrol.ChangeAdded
	case x == 'D' || y == 'D':
		return versioncontrol.ChangeDeleted
	case x == 'R':
		return versioncontrol.ChangeRenamed
	default:
		return versioncontrol.ChangeModified
	}
}

func (v *Git) GetChangeDetails(
	ctx context.Context,
	fs versioncontrol.FileStatus,
) (*versioncontrol.ChangeDetail, error) {
	switch {
	case fs.Partial:
		return v.partiallyStaged(ctx, fs)
	case fs.Staged:
		return v.fullyStaged(ctx, fs)
	default:
		return v.fullyUnstaged(ctx, fs)
	}
}

func (v *Git) ensureStagedCache(ctx context.Context) error {
	if v.stagedCache != nil {
		return nil
	}

	raw, err := v.exec.DiffFile(ctx, "--cached", "-M")
	if err != nil {
		return fmt.Errorf("bulk staged diff: %w", err)
	}

	files := diff.Parse(raw)
	v.stagedCache = make(map[string]*diff.File, len(files))

	for _, f := range files {
		v.stagedCache[f.Path] = f
	}

	return nil
}

func (v *Git) ensureUnstagedCache(ctx context.Context) error {
	if v.unstagedCache != nil {
		return nil
	}

	raw, err := v.exec.DiffFile(ctx)
	if err != nil {
		return fmt.Errorf("bulk unstaged diff: %w", err)
	}

	files := diff.Parse(raw)
	v.unstagedCache = make(map[string]*diff.File, len(files))

	for _, f := range files {
		v.unstagedCache[f.Path] = f
	}

	return nil
}

func (v *Git) fullyStaged(
	ctx context.Context,
	fs versioncontrol.FileStatus,
) (*versioncontrol.ChangeDetail, error) {
	if err := v.ensureStagedCache(ctx); err != nil {
		return nil, err
	}

	f := v.stagedCache[fs.Path]
	if f == nil {
		return nil, nil //nolint:nilnil
	}

	hunks := make([]versioncontrol.HunkDetail, len(f.Hunks))
	for i := range hunks {
		hunks[i] = versioncontrol.HunkDetail{Staged: true, SourceIndex: i}
	}

	return &versioncontrol.ChangeDetail{
		Path:     fs.Path,
		OrigPath: fs.OrigPath,
		Kind:     fs.Kind,
		File:     f,
		Hunks:    hunks,
	}, nil
}

func (v *Git) fullyUnstaged(
	ctx context.Context,
	fs versioncontrol.FileStatus,
) (*versioncontrol.ChangeDetail, error) {
	if fs.Kind == versioncontrol.ChangeAdded && !fs.Staged && !fs.Partial {
		raw, err := v.exec.NewFileDiff(fs.Path)
		if err != nil {
			return nil, fmt.Errorf("new file diff %s: %w", fs.Path, err)
		}

		f := findFileByPath(diff.Parse(raw), fs.Path)
		if f == nil {
			return nil, nil //nolint:nilnil
		}

		hunks := make([]versioncontrol.HunkDetail, len(f.Hunks))
		for i := range hunks {
			hunks[i] = versioncontrol.HunkDetail{Staged: false, SourceIndex: i}
		}

		return &versioncontrol.ChangeDetail{
			Path:     fs.Path,
			OrigPath: fs.OrigPath,
			Kind:     fs.Kind,
			File:     f,
			Hunks:    hunks,
		}, nil
	}

	if err := v.ensureUnstagedCache(ctx); err != nil {
		return nil, err
	}

	f := v.unstagedCache[fs.Path]
	if f == nil {
		return nil, nil //nolint:nilnil
	}

	hunks := make([]versioncontrol.HunkDetail, len(f.Hunks))
	for i := range hunks {
		hunks[i] = versioncontrol.HunkDetail{Staged: false, SourceIndex: i}
	}

	return &versioncontrol.ChangeDetail{
		Path:     fs.Path,
		OrigPath: fs.OrigPath,
		Kind:     fs.Kind,
		File:     f,
		Hunks:    hunks,
	}, nil
}

func (v *Git) partiallyStaged(
	ctx context.Context,
	fs versioncontrol.FileStatus,
) (*versioncontrol.ChangeDetail, error) {
	if err := v.ensureStagedCache(ctx); err != nil {
		return nil, err
	}

	if err := v.ensureUnstagedCache(ctx); err != nil {
		return nil, err
	}

	stagedFile := v.stagedCache[fs.Path]
	unstagedFile := v.unstagedCache[fs.Path]

	if stagedFile == nil && unstagedFile == nil {
		return nil, nil //nolint:nilnil
	}

	merged, hunks := mergePartialHunks(stagedFile, unstagedFile)

	return &versioncontrol.ChangeDetail{
		Path:     fs.Path,
		OrigPath: fs.OrigPath,
		Kind:     fs.Kind,
		File:     merged,
		Hunks:    hunks,
	}, nil
}

// mergePartialHunks merges hunks from staged and unstaged diffs, sorted by
// OldStart (staged before unstaged on ties). Each HunkDetail records which
// source diff and index it came from.
func mergePartialHunks(
	staged, unstaged *diff.File,
) (*diff.File, []versioncontrol.HunkDetail) {
	type entry struct {
		hunk        *diff.Hunk
		staged      bool
		sourceIndex int
	}

	var entries []entry

	if staged != nil {
		for i, h := range staged.Hunks {
			entries = append(entries, entry{hunk: h, staged: true, sourceIndex: i})
		}
	}

	if unstaged != nil {
		for i, h := range unstaged.Hunks {
			entries = append(entries, entry{hunk: h, staged: false, sourceIndex: i})
		}
	}

	sort.SliceStable(entries, func(i, j int) bool {
		if entries[i].hunk.OldStart != entries[j].hunk.OldStart {
			return entries[i].hunk.OldStart < entries[j].hunk.OldStart
		}
		// staged before unstaged on ties
		return entries[i].staged && !entries[j].staged
	})

	merged := &diff.File{
		Path:    "",
		Hunks:   make([]*diff.Hunk, len(entries)),
		RawDiff: "",
	}
	if staged != nil {
		merged.Path = staged.Path
	} else if unstaged != nil {
		merged.Path = unstaged.Path
	}

	hunks := make([]versioncontrol.HunkDetail, len(entries))

	for i, e := range entries {
		merged.Hunks[i] = e.hunk
		hunks[i] = versioncontrol.HunkDetail{
			Staged:      e.staged,
			SourceIndex: e.sourceIndex,
		}
	}

	return merged, hunks
}

func (v *Git) StageHunk(
	ctx context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	var patch string

	var err error

	if fs.Partial {
		// Staging an unstaged hunk
		patch, err = v.extractPartialPatch(ctx, fs, hunkIndex, false)
	} else {
		patch, err = v.extractHunkPatch(ctx, fs, hunkIndex)
	}

	if err != nil {
		return err
	}

	if patch == "" {
		return nil
	}

	if err := v.exec.StageHunk(ctx, patch); err != nil {
		return fmt.Errorf("stage hunk: %w", err)
	}

	return nil
}

func (v *Git) UnstageHunk(
	ctx context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	var patch string

	var err error

	if fs.Partial {
		// Unstaging a staged hunk
		patch, err = v.extractPartialPatch(ctx, fs, hunkIndex, true)
	} else {
		patch, err = v.extractHunkPatch(ctx, fs, hunkIndex)
	}

	if err != nil {
		return err
	}

	if patch == "" {
		return nil
	}

	if err := v.exec.UnstageHunk(ctx, patch); err != nil {
		return fmt.Errorf("unstage hunk: %w", err)
	}

	return nil
}

func (v *Git) DiscardHunk(
	ctx context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	var patch string

	var err error

	if fs.Partial {
		// Discarding an unstaged hunk
		patch, err = v.extractPartialPatch(ctx, fs, hunkIndex, false)
	} else {
		patch, err = v.extractHunkPatch(ctx, fs, hunkIndex)
	}

	if err != nil {
		return err
	}

	if patch == "" {
		return nil
	}

	if err := v.exec.DiscardHunk(ctx, patch); err != nil {
		return fmt.Errorf("discard hunk: %w", err)
	}

	return nil
}

// extractPartialPatch uses the cached source diff (staged or unstaged)
// for a partially staged file and extracts the hunk at sourceIndex.
func (v *Git) extractPartialPatch(
	ctx context.Context,
	fs versioncontrol.FileStatus,
	sourceIndex int,
	fromStaged bool,
) (string, error) {
	var f *diff.File

	if fromStaged {
		if err := v.ensureStagedCache(ctx); err != nil {
			return "", err
		}

		f = v.stagedCache[fs.Path]
	} else {
		if err := v.ensureUnstagedCache(ctx); err != nil {
			return "", err
		}

		f = v.unstagedCache[fs.Path]
	}

	if f == nil {
		return "", nil
	}

	patch := diff.HunkPatch(f.RawDiff, sourceIndex)
	if patch == "" {
		return "", nil
	}

	return sanitizeRenamePatch(patch, fs.Path), nil
}

// lookupFile resolves the *diff.File for a given FileStatus, using
// the cache for tracked files and NewFileDiff for untracked ones.
func (v *Git) lookupFile(
	ctx context.Context,
	fs versioncontrol.FileStatus,
) (*diff.File, error) {
	switch {
	case fs.Kind == versioncontrol.ChangeAdded && !fs.Staged && !fs.Partial:
		raw, err := v.exec.NewFileDiff(fs.Path)
		if err != nil {
			return nil, fmt.Errorf("new file diff %s: %w", fs.Path, err)
		}

		return findFileByPath(diff.Parse(raw), fs.Path), nil
	case fs.Staged:
		if err := v.ensureStagedCache(ctx); err != nil {
			return nil, err
		}

		return v.stagedCache[fs.Path], nil
	default:
		if err := v.ensureUnstagedCache(ctx); err != nil {
			return nil, err
		}

		return v.unstagedCache[fs.Path], nil
	}
}

// extractHunkPatch uses the cached diff for the target file, extracts the
// specified hunk as a patch, and sanitizes rename metadata so that git apply
// only operates on the content change.
func (v *Git) extractHunkPatch(
	ctx context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) (string, error) {
	f, err := v.lookupFile(ctx, fs)
	if err != nil {
		return "", err
	}

	if f == nil {
		return "", nil
	}

	patch := diff.HunkPatch(f.RawDiff, hunkIndex)
	if patch == "" {
		return "", nil
	}

	return sanitizeRenamePatch(patch, fs.Path), nil
}

// sanitizeRenamePatch strips rename/copy metadata from a patch and normalizes
// file paths to newPath. This ensures that git apply -R only reverts the
// content change without undoing the rename itself. For non-rename patches
// this is a no-op (paths already match).
func sanitizeRenamePatch(patch, newPath string) string {
	var result []string

	for line := range strings.SplitSeq(patch, "\n") {
		switch {
		case strings.HasPrefix(line, "diff --git "):
			result = append(result,
				fmt.Sprintf("diff --git a/%s b/%s", newPath, newPath),
			)
		case strings.HasPrefix(line, "similarity index"),
			strings.HasPrefix(line, "dissimilarity index"),
			strings.HasPrefix(line, "rename from"),
			strings.HasPrefix(line, "rename to"),
			strings.HasPrefix(line, "copy from"),
			strings.HasPrefix(line, "copy to"):
			continue
		case strings.HasPrefix(line, "--- a/"):
			result = append(result, "--- a/"+newPath)
		default:
			result = append(result, line)
		}
	}

	return strings.Join(result, "\n")
}

func (v *Git) StageFile(ctx context.Context, path string) error {
	if err := v.exec.StageFiles(ctx, []string{path}); err != nil {
		return fmt.Errorf("stage file: %w", err)
	}

	return nil
}

func (v *Git) UnstageFile(ctx context.Context, path string) error {
	if err := v.exec.UnstageFiles(ctx, []string{path}); err != nil {
		return fmt.Errorf("unstage file: %w", err)
	}

	return nil
}

func (v *Git) StageFolder(ctx context.Context, folder string) error {
	if err := v.exec.StageFiles(ctx, []string{folder}); err != nil {
		return fmt.Errorf("stage folder: %w", err)
	}

	return nil
}

func (v *Git) UnstageFolder(ctx context.Context, folder string) error {
	if err := v.exec.UnstageFiles(ctx, []string{folder}); err != nil {
		return fmt.Errorf("unstage folder: %w", err)
	}

	return nil
}

func (v *Git) DiscardFile(ctx context.Context, path string) error {
	if err := v.exec.DiscardFiles(ctx, []string{path}); err != nil {
		return fmt.Errorf("discard file: %w", err)
	}

	return nil
}

func (v *Git) DiscardFolder(ctx context.Context, folder string) error {
	raw, err := v.exec.Status(ctx)
	if err != nil {
		return fmt.Errorf("status: %w", err)
	}

	prefix := folder + "/"

	var paths []string

	for _, fs := range parseStatus(raw) {
		if strings.HasPrefix(fs.Path, prefix) || fs.Path == folder {
			paths = append(paths, fs.Path)
		}
	}

	if len(paths) == 0 {
		return nil
	}

	if err := v.exec.DiscardFiles(ctx, paths); err != nil {
		return fmt.Errorf("discard folder: %w", err)
	}

	return nil
}

func (v *Git) Commit(ctx context.Context, message string) error {
	if err := v.exec.Commit(ctx, message); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	return nil
}

func (v *Git) Push(ctx context.Context) error {
	if err := v.exec.Push(ctx); err != nil {
		return fmt.Errorf("push: %w", err)
	}

	return nil
}

func (v *Git) PushForce(ctx context.Context) error {
	if err := v.exec.PushForce(ctx); err != nil {
		return fmt.Errorf("force push: %w", err)
	}

	return nil
}

func findFileByPath(files []*diff.File, path string) *diff.File {
	for _, f := range files {
		if f.Path == path {
			return f
		}
	}

	return nil
}
