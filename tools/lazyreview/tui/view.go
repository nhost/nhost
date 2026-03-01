package tui

import (
	"context"

	"github.com/nhost/nhost/tools/lazyreview/versioncontrol"
)

// View abstracts the common data and actions shared by both review and git modes.
//
//go:generate mockgen -package mock -destination mock/view.go . View,GitView
type View interface {
	GetStatus(ctx context.Context) ([]versioncontrol.FileStatus, error)
	GetChangeDetails(
		ctx context.Context,
		fs versioncontrol.FileStatus,
	) (*versioncontrol.ChangeDetail, error)
	StageHunk(ctx context.Context, fs versioncontrol.FileStatus, hunkIndex int) error
	UnstageHunk(ctx context.Context, fs versioncontrol.FileStatus, hunkIndex int) error
	StageFile(ctx context.Context, path string) error
	UnstageFile(ctx context.Context, path string) error
	StageFolder(ctx context.Context, folder string) error
	UnstageFolder(ctx context.Context, folder string) error
}

// GitView extends View with git-specific operations (discard, commit, push).
type GitView interface {
	View
	DiscardFile(ctx context.Context, path string) error
	DiscardFolder(ctx context.Context, folder string) error
	DiscardHunk(ctx context.Context, fs versioncontrol.FileStatus, hunkIndex int) error
	Commit(ctx context.Context, message string) error
	Push(ctx context.Context) error
	PushForce(ctx context.Context) error
}
