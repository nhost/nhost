package main

import (
	"context"
	"fmt"
	"log"
	"os"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/urfave/cli/v3"

	"github.com/nhost/nhost/tools/lazyreview/diff"
	"github.com/nhost/nhost/tools/lazyreview/git"
	"github.com/nhost/nhost/tools/lazyreview/review"
	"github.com/nhost/nhost/tools/lazyreview/tui"
)

var Version string

func main() {
	cmd := &cli.Command{ //nolint:exhaustruct
		Name:    "lazyreview",
		Version: Version,
		Usage:   "TUI code review helper",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  "base",
				Usage: "base branch to diff against",
				Value: "main",
			},
		},
		Action: run,
	}

	if err := cmd.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}

func run(_ context.Context, cmd *cli.Command) error {
	base := cmd.String("base")

	repoRoot, err := git.RepoRoot()
	if err != nil {
		return fmt.Errorf("not in a git repository: %w", err)
	}

	branch, err := git.CurrentBranch()
	if err != nil {
		return fmt.Errorf("failed to get current branch: %w", err)
	}

	rawDiff, err := git.Diff(base)
	if err != nil {
		return fmt.Errorf("failed to get diff: %w", err)
	}

	files := diff.Parse(rawDiff)
	if len(files) == 0 {
		fmt.Println("No changes found between", base, "and HEAD")

		return nil
	}

	hashes := make([]string, len(files))
	for i, f := range files {
		hashes[i] = review.Hash(f.RawDiff)
	}

	state, err := review.Load(repoRoot, branch, base)
	if err != nil {
		return fmt.Errorf("failed to load review state: %w", err)
	}

	state.Reconcile(files)

	model := tui.NewModel(files, hashes, state)
	p := tea.NewProgram(model, tea.WithAltScreen())

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("TUI error: %w", err)
	}

	if err := state.Save(); err != nil {
		return fmt.Errorf("failed to save review state: %w", err)
	}

	return nil
}
