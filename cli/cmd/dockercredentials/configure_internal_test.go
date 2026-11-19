package dockercredentials

import (
	"slices"
	"testing"

	"github.com/urfave/cli/v3"
)

func TestCommandConfigureYesFlagBackwardCompatibility(t *testing.T) {
	t.Parallel()

	yesFlag := findBoolFlag(t, CommandConfigure(), flagYes)

	assertContains(t, yesFlag.Names(), "no-interactive", "flag names")
	assertContains(t, yesFlag.Aliases, "no-interactive", "flag aliases")
	assertContains(t, yesFlag.GetEnvVars(), "NHOST_YES", "env vars")
	assertContains(t, yesFlag.GetEnvVars(), "NO_INTERACTIVE", "env vars")
}

func findBoolFlag(t *testing.T, cmd *cli.Command, name string) *cli.BoolFlag {
	t.Helper()

	for _, flag := range cmd.Flags {
		boolFlag, ok := flag.(*cli.BoolFlag)
		if ok && boolFlag.Name == name {
			return boolFlag
		}
	}

	t.Fatalf("bool flag %q not found", name)

	return nil
}

func assertContains(t *testing.T, got []string, want string, description string) {
	t.Helper()

	if !slices.Contains(got, want) {
		t.Fatalf("expected %s to contain %q, got %v", description, want, got)
	}
}
