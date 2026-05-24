package schema //nolint:revive,nolintlint

import (
	"context"
	"fmt"

	"github.com/nhost/nhost/services/constellation/internal/schemadiff"
	"github.com/pmezard/go-difflib/difflib"
	"github.com/urfave/cli/v3"
	"github.com/vektah/gqlparser/v2/ast"
)

const (
	flagSchemaA = "a"
	flagSchemaB = "b"
	flagNoClean = "no-clean"

	diffContextLines = 3
)

func commandDiff() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:  "diff",
		Usage: "Compare two GraphQL schema files",
		Description: `Compare two GraphQL schema files and output the differences.
This tool parses both schemas and performs a structural comparison,
outputting a unified diff in GraphQL SDL format.`,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagSchemaA,
				Usage:    "Path to the first schema file",
				Required: true,
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagSchemaB,
				Usage:    "Path to the second schema file",
				Required: true,
			},
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagNoClean,
				Usage: "Disable all normalization/cleaning of known-safe differences",
			},
		},
		Action: diff,
	}
}

func normalize(schemaA, schemaB *ast.Schema) {
	schemadiff.NormalizeAggregateTypes(schemaA, schemaB)

	schemadiff.StripNoopUpdateMutations(schemaA)
	schemadiff.StripNoopUpdateMutations(schemaB)

	schemadiff.StripBuiltinDirectives(schemaA)
	schemadiff.StripBuiltinDirectives(schemaB)

	schemadiff.NormalizeFuncArgNullability(schemaA)
	schemadiff.NormalizeFuncArgNullability(schemaB)
}

func diff(_ context.Context, cmd *cli.Command) error {
	schemaAPath := cmd.String(flagSchemaA)
	schemaBPath := cmd.String(flagSchemaB)
	noClean := cmd.Bool(flagNoClean)

	schemaA, err := schemadiff.Load(schemaAPath)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	schemaB, err := schemadiff.Load(schemaBPath)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	if !noClean {
		normalize(schemaA, schemaB)
	}

	schemadiff.SortFields(schemaA)
	schemadiff.SortFields(schemaB)

	ignoreDescriptions := !noClean
	sdlA := schemadiff.ToSDL(schemaA, ignoreDescriptions)
	sdlB := schemadiff.ToSDL(schemaB, ignoreDescriptions)

	if sdlA == sdlB {
		fmt.Println("Schemas are identical") //nolint:forbidigo
		return nil
	}

	linesA := difflib.SplitLines(sdlA)

	diff := difflib.UnifiedDiff{ //nolint:exhaustruct
		A:        linesA,
		B:        difflib.SplitLines(sdlB),
		FromFile: schemaAPath,
		ToFile:   schemaBPath,
		Context:  diffContextLines,
	}

	diffText, err := difflib.GetUnifiedDiffString(diff)
	if err != nil {
		return fmt.Errorf("generating diff: %w", err)
	}

	diffText = schemadiff.AddHunkContext(diffText, linesA)

	fmt.Print(diffText) //nolint:forbidigo

	return nil
}
