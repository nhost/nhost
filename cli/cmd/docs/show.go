package docs

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	docsembed "github.com/nhost/nhost/docs"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/urfave/cli/v3"
)

const flagRaw = "raw"

func CommandShow() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "show",
		Aliases:   []string{"view"},
		Usage:     "Display contents of a documentation page",
		ArgsUsage: "<page>",
		Action:    commandShow,
		Flags: []cli.Flag{
			&cli.BoolFlag{ //nolint:exhaustruct
				Name:  flagRaw,
				Usage: "Show raw MDX content including frontmatter",
			},
		},
	}
}

func commandShow(_ context.Context, cmd *cli.Command) error {
	ce := clienv.FromCLI(cmd)

	if cmd.NArg() < 1 {
		return errors.New("missing page argument. Usage: nhost docs show <page>") //nolint:goerr113
	}

	pagePath := cmd.Args().First()
	showRaw := cmd.Bool(flagRaw)

	content, err := readPage(pagePath)
	if err != nil {
		return err
	}

	if showRaw {
		ce.Println("%s", content)
	} else {
		ce.Println("%s", stripFrontmatter(content))
	}

	return nil
}

func readPage(pagePath string) (string, error) {
	normalizedPath := normalizePath(pagePath)

	extensions := []string{".mdx", ".md"}
	for _, ext := range extensions {
		filePath := normalizedPath + ext

		data, err := docsembed.DocsFS.ReadFile(filePath)
		if err == nil {
			return string(data), nil
		}
	}

	return "", fmt.Errorf( //nolint:goerr113
		"page not found: %s\nTry running 'nhost docs list' to see available pages",
		pagePath,
	)
}

func normalizePath(path string) string {
	path = strings.TrimPrefix(path, "/")

	path = strings.TrimSuffix(path, ".mdx")
	path = strings.TrimSuffix(path, ".md")

	return path
}

func stripFrontmatter(content string) string {
	frontmatterRegex := regexp.MustCompile(`(?s)^---\n.*?\n---\n*`)
	return frontmatterRegex.ReplaceAllString(content, "")
}
