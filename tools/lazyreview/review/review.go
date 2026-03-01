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
	Diff(ctx context.Context, ref string) (string, error)
}

// Review implements tui.View for review mode.
// It diffs from merge-base to HEAD and uses persistent review state.
type Review struct {
	git        GitQuerier
	state      *State
	base       string
	repoRoot   string
	branch     string
	hashByPath map[string]string
	fileByHash map[string]*diff.File
}

func NewReview(
	git GitQuerier,
	base, repoRoot, branch string,
) *Review {
	return &Review{
		git:        git,
		state:      nil,
		base:       base,
		repoRoot:   repoRoot,
		branch:     branch,
		hashByPath: make(map[string]string),
		fileByHash: make(map[string]*diff.File),
	}
}

// refresh re-fetches the diff from git, loads state from disk on first call,
// and reconciles state with the current diff.
func (v *Review) refresh(ctx context.Context) ([]*diff.File, []string, error) {
	mergeBase, err := v.git.MergeBase(ctx, v.base)
	if err != nil {
		return nil, nil, fmt.Errorf("merge-base: %w", err)
	}

	rawDiff, err := v.git.Diff(ctx, mergeBase)
	if err != nil {
		return nil, nil, fmt.Errorf("diff: %w", err)
	}

	files := diff.Parse(rawDiff)
	hashes := make([]string, len(files))

	for i, f := range files {
		hashes[i] = Hash(f.RawDiff)
	}

	if v.state == nil {
		state, err := Load(v.repoRoot, v.branch, v.base)
		if err != nil {
			return nil, nil, fmt.Errorf("load state: %w", err)
		}

		v.state = state
	}

	v.state.Reconcile(files)

	v.hashByPath = make(map[string]string, len(files))
	v.fileByHash = make(map[string]*diff.File, len(files))

	for i, f := range files {
		v.hashByPath[f.Path] = hashes[i]
		v.fileByHash[hashes[i]] = f
	}

	return files, hashes, nil
}

func (v *Review) GetStatus(
	ctx context.Context,
) ([]versioncontrol.FileStatus, error) {
	files, hashes, err := v.refresh(ctx)
	if err != nil {
		return nil, err
	}

	statuses := make([]versioncontrol.FileStatus, len(files))

	for i, f := range files {
		hash := hashes[i]

		fs, ok := v.state.Files[hash]
		if !ok {
			statuses[i] = versioncontrol.FileStatus{
				Path:     f.Path,
				OrigPath: "",
				Kind:     versioncontrol.ChangeModified,
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
			Path:     f.Path,
			OrigPath: "",
			Kind:     versioncontrol.ChangeModified,
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
	if _, _, err := v.refresh(ctx); err != nil {
		return nil, err
	}

	hash, ok := v.hashByPath[fs.Path]
	if !ok {
		return nil, nil //nolint:nilnil
	}

	f, ok := v.fileByHash[hash]
	if !ok {
		return nil, nil //nolint:nilnil
	}

	hunks := make([]versioncontrol.HunkDetail, len(f.Hunks))
	for i := range f.Hunks {
		hunks[i] = versioncontrol.HunkDetail{
			Staged:      v.state.IsHunkReviewed(hash, i),
			SourceIndex: i,
		}
	}

	return &versioncontrol.ChangeDetail{
		Path:     fs.Path,
		OrigPath: fs.OrigPath,
		Kind:     fs.Kind,
		File:     f,
		Hunks:    hunks,
	}, nil
}

func (v *Review) StageHunk(
	_ context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	hash, ok := v.hashByPath[fs.Path]
	if !ok {
		return nil
	}

	v.state.SetHunkReviewed(hash, hunkIndex, true)

	return v.save()
}

func (v *Review) UnstageHunk(
	_ context.Context,
	fs versioncontrol.FileStatus,
	hunkIndex int,
) error {
	hash, ok := v.hashByPath[fs.Path]
	if !ok {
		return nil
	}

	v.state.SetHunkReviewed(hash, hunkIndex, false)

	return v.save()
}

func (v *Review) StageFile(_ context.Context, path string) error {
	hash, ok := v.hashByPath[path]
	if !ok {
		return nil
	}

	v.state.SetFilesReviewed([]string{hash}, true)

	return v.save()
}

func (v *Review) UnstageFile(_ context.Context, path string) error {
	hash, ok := v.hashByPath[path]
	if !ok {
		return nil
	}

	v.state.SetFilesReviewed([]string{hash}, false)

	return v.save()
}

func (v *Review) StageFolder(_ context.Context, folder string) error {
	hashes := v.hashesUnderFolder(folder)
	v.state.SetFilesReviewed(hashes, true)

	return v.save()
}

func (v *Review) UnstageFolder(_ context.Context, folder string) error {
	hashes := v.hashesUnderFolder(folder)
	v.state.SetFilesReviewed(hashes, false)

	return v.save()
}

func (v *Review) hashesUnderFolder(folder string) []string {
	prefix := folder + "/"

	var hashes []string

	for path, hash := range v.hashByPath {
		if strings.HasPrefix(path, prefix) || path == folder {
			hashes = append(hashes, hash)
		}
	}

	return hashes
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
