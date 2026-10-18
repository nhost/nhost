package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/nhost/nhost/tools/writing/internal/resolve"
	"github.com/urfave/cli/v3"
)

const (
	flagScope    = "scope"
	flagVoice    = "voice"
	flagRulesDir = "rules-dir"
	flagRubric   = "rubric"
	flagAgainst  = "against"
	flagFormat   = "format"
	flagExpect   = "expect"
)

var errNoRepoRoot = errors.New("no .git found in any parent directory")

func main() {
	cmd := &cli.Command{ //nolint:exhaustruct
		Name:  "writing",
		Usage: "Tooling behind the Nhost docs and blog writing standard.",
		Commands: []*cli.Command{
			resolveCommand(),
			validateCommand(),
			editRatioCommand(),
			voiceStatsCommand(),
		},
	}

	if err := cmd.Run(context.Background(), os.Args); err != nil {
		log.Fatal(err)
	}
}

func resolveCommand() *cli.Command {
	return &cli.Command{ //nolint:exhaustruct
		Name:      "resolve",
		Usage:     "Print the scope and voice a document is written and reviewed against, as JSON.",
		ArgsUsage: "[<path>]",
		Flags: []cli.Flag{
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagScope,
				Usage: "docs or blog; required when no path is given or the path is outside both trees",
			},
			&cli.StringFlag{ //nolint:exhaustruct
				Name:  flagVoice,
				Usage: "voice profile slug, overriding the byline and scope defaults",
			},
			rulesDirFlag(),
		},
		Action: resolveAction,
	}
}

func resolveAction(_ context.Context, c *cli.Command) error {
	if c.NArg() > 1 {
		return cli.Exit("resolve takes at most one path", 1)
	}

	rulesDir, err := rulesDirPath(c)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	cwd, err := os.Getwd()
	if err != nil {
		return cli.Exit(fmt.Sprintf("getting working directory: %v", err), 1)
	}

	root, err := findRepoRoot(cwd)
	if err != nil {
		// Without a root the path is kept as given; Resolve then reports it
		// as outside both trees unless --scope is set.
		root = ""
	}

	resolver, err := resolve.New(rulesDir)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	docPath := c.Args().First()

	frontmatter, err := readDocument(docPath)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	result, err := resolver.Resolve(
		repoRelative(root, cwd, docPath), c.String(flagScope), frontmatter, c.String(flagVoice),
	)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	if err := json.NewEncoder(c.Root().Writer).Encode(result); err != nil {
		return cli.Exit(fmt.Sprintf("writing result: %v", err), 1)
	}

	return nil
}

// readDocument returns the document source, or nil when there is no path or
// the file does not exist yet, as when a writer resolves a page it is about to
// create.
func readDocument(docPath string) ([]byte, error) {
	if docPath == "" {
		return nil, nil
	}

	data, err := os.ReadFile(docPath)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("reading document: %w", err)
	}

	return data, nil
}

func rulesDirFlag() *cli.StringFlag {
	return &cli.StringFlag{ //nolint:exhaustruct
		Name:  flagRulesDir,
		Usage: "directory holding the writing rules and voices/ (default: <git root>/.claude/writing)",
	}
}

// rulesDirPath returns --rules-dir, defaulting to <git root>/.claude/writing.
func rulesDirPath(c *cli.Command) (string, error) {
	return repoPath(c, flagRulesDir, ".claude", "writing")
}

// repoPath returns the value of flag when it is set, else elems joined onto
// the git root found from the working directory. Every default path the tool
// reads (the rules dir, the rubric) goes through it.
func repoPath(c *cli.Command, flag string, elems ...string) (string, error) {
	if value := c.String(flag); value != "" {
		return value, nil
	}

	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("getting working directory: %w", err)
	}

	return defaultRepoPath(cwd, flag, elems...)
}

// defaultRepoPath joins elems onto the git root above cwd. Without a root the
// error asks for flag.
func defaultRepoPath(cwd, flag string, elems ...string) (string, error) {
	root, err := findRepoRoot(cwd)
	if err != nil {
		return "", fmt.Errorf("--%s required: %w", flag, err)
	}

	return filepath.Join(append([]string{root}, elems...)...), nil
}

// findRepoRoot walks up from dir to the first directory containing `.git`,
// which is a directory in a clone and a file in a worktree.
func findRepoRoot(dir string) (string, error) {
	for {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			return "", errNoRepoRoot
		}

		dir = parent
	}
}

// repoRelative rewrites docPath, absolute or relative to cwd, as a path
// relative to root, which is what [resolve.Resolver.Resolve] matches the docs
// and blog trees against. A path outside root, or any path when root is
// unknown, is returned unchanged.
func repoRelative(root, cwd, docPath string) string {
	if docPath == "" || root == "" {
		return docPath
	}

	abs := docPath
	if !filepath.IsAbs(abs) {
		abs = filepath.Join(cwd, docPath)
	}

	rel, err := filepath.Rel(root, abs)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return docPath
	}

	return rel
}
