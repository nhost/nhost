package clidocs

import (
	"fmt"
	"strings"

	"github.com/urfave/cli/v3"
)

// ApplyHints walks root and attaches AgentHints to each command at the
// given paths. Path is space-separated, relative to the root (e.g. "dev up",
// "config apply"); the empty string targets root.
//
// Returns an error for every path not found so missing or stale hints surface
// loudly instead of rotting silently.
func ApplyHints(root *cli.Command, hints map[string]AgentHints) error {
	var missing []string
	for path, h := range hints {
		cmd := findCommand(root, path)
		if cmd == nil {
			missing = append(missing, path)
			continue
		}
		WithAgent(cmd, h)
	}
	if len(missing) > 0 {
		return fmt.Errorf("clidocs: command(s) not found: %s", strings.Join(missing, ", "))
	}
	return nil
}

func findCommand(root *cli.Command, path string) *cli.Command {
	cmd := root
	for _, p := range strings.Fields(path) {
		var next *cli.Command
		for _, sub := range cmd.Commands {
			if sub.Name == p {
				next = sub
				break
			}
		}
		if next == nil {
			return nil
		}
		cmd = next
	}
	return cmd
}
