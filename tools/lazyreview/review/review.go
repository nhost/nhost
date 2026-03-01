package review

import (
	"context"
	"fmt"
	"strings"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
)

// GitQuerier defines the git operations that Review needs.
//
//go:generate mockgen -package mock -destination mock/querier.go . GitQuerier
type GitQuerier interface {
	MergeBase(ctx context.Context, base string) (string, error)
	NameStatus(ctx context.Context, ref string) (string, error)
	UntrackedFiles(ctx context.Context) (string, error)
	DiffFile(ctx context.Context, args ...string) (string, error)
	NewFileDiff(path string) (string, error)
}

type fileInfo struct {
	path      string
	origPath  string
	kind      versioncontrol.ChangeKind
	untracked bool // true for files from ls-files --others (not in git diff)
}

// Review implements tui.View for review mode.
// It diffs from merge-base to HEAD and uses persistent review state.
type Review struct {
	git       GitQuerier
	state     *State
	base      string
	repoRoot  string
	branch    string
	mergeBase string
	fileInfos []fileInfo
	diffCache map[string]*diff.File
}

func NewReview(
	git GitQuerier,
	base, repoRoot, branch string,
) *Review {
	return &Review{
		git:       git,
		state:     nil,
		base:      base,
		repoRoot:  repoRoot,
		branch:    branch,
		mergeBase: "",
		fileInfos: nil,
		diffCache: nil,
	}
}

// refreshFiles fetches merge-base + name-status, loads state on first call,
// and reconciles state with the current file list.
func (v *Review) refreshFiles(ctx context.Context) error {
	if v.mergeBase == "" {
		mb, err := v.git.MergeBase(ctx, v.base)
		if err != nil {
			return fmt.Errorf("merge-base: %w", err)
		}

		v.mergeBase = mb
	}

	v.diffCache = nil

	raw, err := v.git.NameStatus(ctx, v.mergeBase)
	if err != nil {
		return fmt.Errorf("name-status: %w", err)
	}

	v.fileInfos = parseNameStatus(raw)

	untrackedRaw, err := v.git.UntrackedFiles(ctx)
	if err != nil {
		return fmt.Errorf("untracked files: %w", err)
	}

	v.fileInfos = append(v.fileInfos, parseUntrackedFiles(untrackedRaw)...)

	if v.state == nil {
		state, err := Load(v.repoRoot, v.branch, v.base)
		if err != nil {
			return fmt.Errorf("load state: %w", err)
		}

		v.state = state
	}

	paths := make([]string, len(v.fileInfos))
	for i, fi := range v.fileInfos {
		paths[i] = fi.path
	}

	v.state.Reconcile(paths)

	return nil
}

func (v *Review) GetStatus(
	ctx context.Context,
) ([]versioncontrol.FileStatus, error) {
	if err := v.refreshFiles(ctx); err != nil {
		return nil, err
	}

	statuses := make([]versioncontrol.FileStatus, len(v.fileInfos))

	for i, fi := range v.fileInfos {
		fs, ok := v.state.Files[fi.path]
		if !ok {
			statuses[i] = versioncontrol.FileStatus{
				Path:     fi.path,
				OrigPath: fi.origPath,
				Kind:     fi.kind,
				Staged:   false,
				Partial:  false,
			}

			continue
		}

		partial := false
		if !fs.Reviewed {
			for _, h := range fs.Hunks {
				if h.Reviewed {
					partial = true

					break
				}
			}
		}

		statuses[i] = versioncontrol.FileStatus{
			Path:     fi.path,
			OrigPath: fi.origPath,
			Kind:     fi.kind,
			Staged:   fs.Reviewed,
			Partial:  partial,
		}
	}

	return statuses, nil
}

func (v *Review) GetChangeDetails(
	ctx context.Context,
	fs versioncontrol.FileStatus,
) (*versioncontrol.ChangeDetail, error) {
	fi := v.findFileInfo(fs.Path)
	if fi == nil {
		return nil, nil //nolint:nilnil
	}

	f, err := v.fileDiff(ctx, fi)
	if err != nil {
		return nil, err
	}

	if f == nil {
		return nil, nil //nolint:nilnil
	}

	hash := Hash(f.RawDiff)

	v.state.ReconcileFile(fi.path, hash, len(f.Hunks))

	hunks := make([]versioncontrol.HunkDetail, len(f.Hunks))
	for i := range f.Hunks {
		hunks[i] = versioncontrol.HunkDetail{
			Staged:      v.state.IsHunkReviewed(fi.path, i),
			SourceIndex: i,
		}
	}

	return &versioncontrol.ChangeDetail{
		Path:     fi.path,
		OrigPath: fi.origPath,
		Kind:     fi.kind,
		File:     f,
		Hunks:    hunks,
	}, nil
}

func (v *Review) ensureDiffCache(ctx context.Context) error {
	if v.diffCache != nil {
		return nil
	}

	raw, err := v.git.DiffFile(ctx, "-M", v.mergeBase)
	if err != nil {
		return fmt.Errorf("bulk diff: %w", err)
	}

	files := diff.Parse(raw)
	v.diffCache = make(map[string]*diff.File, len(files))

	for _, f := range files {
		v.diffCache[f.Path] = f
	}

	return nil
}

func (v *Review) fileDiff(
	ctx context.Context,
	fi *fileInfo,
) (*diff.File, error) {
	if fi.untracked {
		raw, err := v.git.NewFileDiff(fi.path)
		if err != nil {
			return nil, fmt.Errorf("new file diff %s: %w", fi.path, err)
		}

		files := diff.Parse(raw)
		if len(files) == 0 {
			return nil, nil //nolint:nilnil
		}

		return files[0], nil
	}

	if err := v.ensureDiffCache(ctx); err != nil {
		return nil, err
	}

	return v.diffCache[fi.path], nil
}

func (v *Review) findFileInfo(path string) *fileInfo {
	for i := range v.fileInfos {
		if v.fileInfos[i].path == path {
			return &v.fileInfos[i]
		}
	}

	return nil
}

func (v *Review) StageHunk(
	_ context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	v.state.SetHunkReviewed(fs.Path, hunkIndex, true)

	return v.save()
}

func (v *Review) UnstageHunk(
	_ context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	v.state.SetHunkReviewed(fs.Path, hunkIndex, false)

	return v.save()
}

func (v *Review) StageFile(_ context.Context, path string) error {
	v.state.SetFilesReviewed([]string{path}, true)

	return v.save()
}

func (v *Review) UnstageFile(_ context.Context, path string) error {
	v.state.SetFilesReviewed([]string{path}, false)

	return v.save()
}

func (v *Review) StageFolder(_ context.Context, folder string) error {
	paths := v.pathsUnderFolder(folder)
	v.state.SetFilesReviewed(paths, true)

	return v.save()
}

func (v *Review) UnstageFolder(_ context.Context, folder string) error {
	paths := v.pathsUnderFolder(folder)
	v.state.SetFilesReviewed(paths, false)

	return v.save()
}

func (v *Review) pathsUnderFolder(folder string) []string {
	prefix := folder + "/"

	var paths []string

	for _, fi := range v.fileInfos {
		if strings.HasPrefix(fi.path, prefix) || fi.path == folder {
			paths = append(paths, fi.path)
		}
	}

	return paths
}

func (v *Review) save() error {
	if v.state == nil {
		return nil
	}

	if err := v.state.Save(); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	return nil
}

// parseUntrackedFiles parses the output of `git ls-files --others --exclude-standard`.
// Each line is a file path.
func parseUntrackedFiles(raw string) []fileInfo {
	trimmed := strings.TrimRight(raw, "\n")
	if trimmed == "" {
		return nil
	}

	lines := strings.Split(trimmed, "\n")
	infos := make([]fileInfo, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}

		infos = append(infos, fileInfo{
			path:      line,
			origPath:  "",
			kind:      versioncontrol.ChangeAdded,
			untracked: true,
		})
	}

	return infos
}

// parseNameStatus parses the output of `git diff --name-status -M`.
// Format: "M\tfile", "A\tfile", "D\tfile", "R100\told\tnew".
func parseNameStatus(raw string) []fileInfo {
	trimmed := strings.TrimRight(raw, "\n")
	if trimmed == "" {
		return nil
	}

	lines := strings.Split(trimmed, "\n")
	infos := make([]fileInfo, 0, len(lines))

	for _, line := range lines {
		parts := strings.Split(line, "\t")
		if len(parts) < 2 { //nolint:mnd
			continue
		}

		status := parts[0]

		var fi fileInfo

		switch {
		case strings.HasPrefix(status, "R"):
			if len(parts) < 3 { //nolint:mnd
				continue
			}

			fi = fileInfo{
				path:      parts[2],
				origPath:  parts[1],
				kind:      versioncontrol.ChangeRenamed,
				untracked: false,
			}
		case status == "A":
			fi = fileInfo{
				path:      parts[1],
				origPath:  "",
				kind:      versioncontrol.ChangeAdded,
				untracked: false,
			}
		case status == "D":
			fi = fileInfo{
				path:      parts[1],
				origPath:  "",
				kind:      versioncontrol.ChangeDeleted,
				untracked: false,
			}
		default:
			fi = fileInfo{
				path:      parts[1],
				origPath:  "",
				kind:      versioncontrol.ChangeModified,
				untracked: false,
			}
		}

		infos = append(infos, fi)
	}

	return infos
}
