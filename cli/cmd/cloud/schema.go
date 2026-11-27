package cloud

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
	"github.com/vektah/gqlparser/v2/ast"
	"github.com/vektah/gqlparser/v2/formatter"
)

const defaultSchemaDepth uint = 1

func CommandSchema() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name: "schema",
		Usage: "Print a summary, or SDL for named query and mutation fields, from the bundled " +
			"Cloud schema snapshot (offline, no login)",
		ArgsUsage: "[field ...]",
		Description: "Without arguments, prints a sorted JSON summary of query and mutation names. " +
			"Name one or more query or mutation fields to print them as SDL. " +
			"Selected root fields are level 0; their return and argument types are level 1. Each type " +
			"reference adds a level, including input fields, implemented interfaces, union members and " +
			"interface implementations. Types through --depth are printed in full; deeper types stay " +
			"referenced but undefined. Used scalars and enums are always included, except built-in scalars. " +
			"A large --depth prints every needed type. --depth requires at least one field name. " +
			"Reads the snapshot bundled with the CLI without a login or network access. " +
			"Projects are called apps.",
		Flags: []cli.Flag{
			&cli.UintFlag{ //nolint:exhaustruct
				Name:  "depth",
				Value: defaultSchemaDepth,
				Usage: "Print types through N reference levels (selected fields: 0; return and argument types: 1). " +
					"Deeper types stay referenced but undefined. Used enums and custom scalars are always included. " +
					"Use a large N for every needed type; requires at least one field name",
			},
		},
		Action: commandSchema,
	}
}

func commandSchema(_ context.Context, cmd *cli.Command) error {
	names := cmd.Args().Slice()
	if cmd.IsSet("depth") && len(names) == 0 {
		return fmt.Errorf("%w: --depth requires a field name", errInvalidSelection)
	}

	schema, err := loadSnapshot()
	if err != nil {
		return fmt.Errorf("failed to read schema: %w", err)
	}

	data, err := schemaOutput(schema, names, cmd.Uint("depth"))
	if err != nil {
		return err
	}

	clienv.FromCLI(cmd).Println("%s", data)

	return nil
}

func schemaOutput(schema *ast.Schema, names []string, depth uint) ([]byte, error) {
	if len(names) != 0 {
		doc, err := subset(schema, names, depth)
		if err != nil {
			return nil, fmt.Errorf("failed to select schema fields: %w", err)
		}

		return formatDocument(doc), nil
	}

	data, err := json.MarshalIndent(summarize(schema), "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to encode schema summary: %w", err)
	}

	return data, nil
}

func formatDocument(doc *ast.SchemaDocument) []byte {
	var buf bytes.Buffer
	formatter.NewFormatter(&buf, formatter.WithIndent("  ")).FormatSchemaDocument(doc)

	return buf.Bytes()
}
