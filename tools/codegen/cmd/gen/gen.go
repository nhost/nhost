package gen

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/golang"
	"github.com/nhost/nhost/tools/codegen/processor/rust"
	"github.com/nhost/nhost/tools/codegen/processor/typescript"
	"github.com/pb33f/libopenapi"
	"github.com/urfave/cli/v3"
)

const (
	flagOpenAPIFile = "openapi-file"
	flagOutputFile  = "output-file"
	flagPlugin      = "plugin"
	flagPackage     = "package"
)

var (
	errPackageOnlySupportedByGo = errors.New("--package is only supported by the go plugin")
	errUnsupportedPlugin        = errors.New("unsupported plugin")
)

func Command() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:   "gen",
		Usage:  "generate code",
		Action: action,
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagOpenAPIFile,
				Usage:    "OpenAPI file to process",
				Required: true,
				Sources:  cli.EnvVars("OPENAPI_FILE"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagOutputFile,
				Usage:    "Output file to write to",
				Required: true,
				Sources:  cli.EnvVars("OUTPUT_FILE"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:     flagPlugin,
				Usage:    "Plugin to use. Supported: typescript, rust, go",
				Required: true,
				Sources:  cli.EnvVars("PLUGIN"),
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagPackage,
				Usage: "Package name for the generated code (required for go plugin)",
			},
		},
	}
}

func newPlugin(pluginName, packageName string) (processor.Plugin, error) { //nolint:ireturn
	switch pluginName {
	case "typescript":
		if packageName != "" {
			return nil, errPackageOnlySupportedByGo
		}

		return &typescript.Typescript{}, nil
	case "rust":
		if packageName != "" {
			return nil, errPackageOnlySupportedByGo
		}

		return &rust.Rust{}, nil
	case "go":
		goPlugin, err := golang.New(packageName)
		if err != nil {
			return nil, fmt.Errorf("invalid --package: %w", err)
		}

		return goPlugin, nil
	default:
		return nil, fmt.Errorf("%w: %s", errUnsupportedPlugin, pluginName)
	}
}

func action(_ context.Context, c *cli.Command) error {
	fmt.Println("Generating code...") //nolint:forbidigo

	p, err := newPlugin(c.String(flagPlugin), c.String(flagPackage))
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	b, err := os.ReadFile(c.String(flagOpenAPIFile))
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to read OpenAPI file: %v", err), 1)
	}

	document, err := libopenapi.NewDocument(b)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to parse OpenAPI document: %v", err), 1)
	}

	docModel, errors := document.BuildV3Model()
	if len(errors) > 0 {
		for i := range errors {
			fmt.Printf("error: %e\n", errors[i]) //nolint:forbidigo
		}

		return cli.Exit("failed to build OpenAPI model", 1)
	}

	ir, err := processor.NewInterMediateRepresentation(docModel, p)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to create intermediate representation: %v", err), 1)
	}

	f, err := os.OpenFile(
		c.String(flagOutputFile),
		os.O_CREATE|os.O_WRONLY|os.O_TRUNC,
		0o644, //nolint:mnd
	)
	if err != nil {
		return cli.Exit(fmt.Sprintf("failed to open output file: %v", err), 1)
	}
	defer f.Close()

	if err := ir.Render(f); err != nil {
		return cli.Exit(fmt.Sprintf("failed to write output: %v", err), 1)
	}

	fmt.Printf("Code generated successfully to %s\n", c.String(flagOutputFile)) //nolint:forbidigo

	return nil
}
