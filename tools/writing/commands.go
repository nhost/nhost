package main

import (
	"context"
	"fmt"
	"os"

	"github.com/nhost/nhost/tools/writing/internal/rubric"
	"github.com/nhost/nhost/tools/writing/internal/ruleid"
	"github.com/nhost/nhost/tools/writing/internal/scorecard"
	"github.com/nhost/nhost/tools/writing/internal/textstats"
	"github.com/urfave/cli/v3"
)

func validateCommand() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name: "validate",
		Usage: "Check a judge scorecard against the rubric, the defined rule IDs and the document it " +
			"scores; exit 1 listing every problem.",
		ArgsUsage: "<scorecard.json>",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagAgainst,
				Usage:    "the document the scorecard scores; every evidence quote must appear in it",
				Required: true,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagScope,
				Usage: "the resolved scope the scorecard must declare (default: the scorecard's own)",
			},
			rulesDirFlag(),
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagRubric,
				Usage: "rubric YAML (default: <git root>/tools/writing/rubric/rubric.yaml)",
			},
		},
		Action: validateAction,
	}
}

func validateAction(_ context.Context, c *cli.Command) error {
	if c.NArg() != 1 {
		return cli.Exit("validate takes one scorecard", 1)
	}

	ids, rb, err := loadRubric(c)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	path := c.Args().First()

	data, err := os.ReadFile(path)
	if err != nil {
		return cli.Exit(fmt.Sprintf("reading scorecard: %v", err), 1)
	}

	sc, err := scorecard.Parse(data)
	if err != nil {
		return cli.Exit(fmt.Sprintf("%s: %v", path, err), 1)
	}

	doc, err := os.ReadFile(c.String(flagAgainst))
	if err != nil {
		return cli.Exit(fmt.Sprintf("reading document: %v", err), 1)
	}

	if err := scorecard.Validate(sc, rb, c.String(flagScope), ids, doc); err != nil {
		return cli.Exit(fmt.Sprintf("%s: %v", path, err), 1)
	}

	w := c.Root().Writer

	for _, d := range rb.Dimensions {
		if sc.Dimensions[d.Name].Mark == scorecard.MarkInsufficientEvidence {
			fmt.Fprintf(
				w,
				"note: %s is %s and counts as 0\n",
				d.Name,
				scorecard.MarkInsufficientEvidence,
			)
		}
	}

	fmt.Fprintf(w, "ok: %s: total %v, blocking %d\n", path, sc.Total, sc.Blocking)

	return nil
}

// loadRubric loads the defined rule IDs and the rubric validated against
// them, from the flags or their repository defaults.
func loadRubric(c *cli.Command) (ruleid.Set, *rubric.Rubric, error) {
	rulesDir, err := rulesDirPath(c)
	if err != nil {
		return ruleid.Set{}, nil, err
	}

	rubricPath, err := repoPath(c, flagRubric, "tools", "writing", "rubric", "rubric.yaml")
	if err != nil {
		return ruleid.Set{}, nil, err
	}

	ids, err := ruleid.Load(rulesDir)
	if err != nil {
		return ruleid.Set{}, nil, fmt.Errorf("loading rule IDs: %w", err)
	}

	rb, err := rubric.Load(rubricPath, ids)
	if err != nil {
		return ruleid.Set{}, nil, fmt.Errorf("loading rubric: %w", err)
	}

	return ids, rb, nil
}

func editRatioCommand() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name: "editratio",
		Usage: "Print the line-level edit ratio between two files, " +
			"(insertions + deletions) / (lines in a + lines in b).",
		ArgsUsage: "<a> <b>",
		Action:    editRatioAction,
	}
}

func editRatioAction(_ context.Context, c *cli.Command) error {
	if c.NArg() != 2 { //nolint:mnd // a draft and its final
		return cli.Exit("editratio takes two files", 1)
	}

	a, err := os.ReadFile(c.Args().Get(0))
	if err != nil {
		return cli.Exit(fmt.Sprintf("reading %s: %v", c.Args().Get(0), err), 1)
	}

	b, err := os.ReadFile(c.Args().Get(1))
	if err != nil {
		return cli.Exit(fmt.Sprintf("reading %s: %v", c.Args().Get(1), err), 1)
	}

	fmt.Fprintf(c.Root().Writer, "%.3f\n", textstats.EditRatio(a, b))

	return nil
}
