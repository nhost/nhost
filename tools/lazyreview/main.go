package main

import (
	"context"
	"fmt"
	"log"
	"os"

	tea "charm.land/bubbletea/v2"
	"github.com/urfave/cli/v3"

	"github.com/nhost/nhost/tools/lazyreview/review"
	"github.com/nhost/nhost/tools/lazyreview/tui"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol/git"
	"github.com/nhost/nhost/tools/lazyreview/versioncontrol/git/exec"
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

func run(ctx context.Context, cmd *cli.Command) error {
	base := cmd.String("base")

	gitExec, err := exec.NewExec(ctx)
	if err != nil {
		return fmt.Errorf("not in a git repository: %w", err)
	}

	repoRoot := gitExec.Root()

	branch, err := gitExec.CurrentBranch(ctx)
	if err != nil {
		return fmt.Errorf("failed to get current branch: %w", err)
	}

	reviewView := review.NewReview(gitExec, base, repoRoot, branch)

	statuses, err := reviewView.GetStatus(ctx)
	if err != nil {
		return fmt.Errorf("failed to load review data: %w", err)
	}

	if len(statuses) == 0 {
		fmt.Fprintln(os.Stdout, "No changes found between", base, "and HEAD")

		return nil
	}

	gitView := git.NewGit(gitExec)

	model := tui.NewModel(ctx, reviewView, gitView, 0, statuses)
	p := tea.NewProgram(model)

	if _, err := p.Run(); err != nil {
		return fmt.Errorf("TUI error: %w", err)
	}

	return nil
}
