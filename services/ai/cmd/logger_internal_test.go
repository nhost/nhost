package cmd

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"

	"github.com/urfave/cli/v2"
)

func TestIsSensitiveFlag(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		want bool
	}{
		{name: flagAgentProviders, want: true},
		{name: "database-password", want: true},
		{name: "access-token", want: true},
		{name: "client-secret", want: true},
		{name: "openai-key", want: true},
		{name: flagPostgresConnection, want: true},
		{name: "openai-org", want: false},
		{name: flagPathPrefix, want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := isSensitiveFlag(test.name); got != test.want {
				t.Errorf("isSensitiveFlag(%q) = %t, want %t", test.name, got, test.want)
			}
		})
	}
}

//nolint:paralleltest // app.Run mutates urfave/cli's global help/version flags.
func TestLogFlagsRedactsAgentProvidersInBothLoops(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		appLevel bool
	}{
		{
			name:     "application flag loop",
			value:    `[{"name":"app-secret-marker"}]`,
			appLevel: true,
		},
		{
			name:     "command flag loop",
			value:    `[{"name":"command-secret-marker"}]`,
			appLevel: false,
		},
	}

	for _, test := range tests { //nolint:paralleltest // app.Run's global mutations require sequential subtests.
		t.Run(test.name, func(t *testing.T) {
			var output bytes.Buffer

			logger := slog.New(slog.NewTextHandler(&output, nil))
			action := func(cCtx *cli.Context) error {
				logFlags(logger, cCtx)

				return nil
			}
			app := cli.NewApp()
			args := []string{"ai"}

			if test.appLevel {
				flag := &cli.StringFlag{Name: flagAgentProviders}
				command := &cli.Command{
					Name:   "log-flags",
					Action: action,
				}
				app.Flags = []cli.Flag{flag}
				app.Commands = []*cli.Command{command}
				args = append(args, "--"+flagAgentProviders, test.value, command.Name)
			} else {
				command := CommandServe()
				command.Action = action
				app.Commands = []*cli.Command{command}
				args = append(args, command.Name, "--"+flagAgentProviders, test.value)
			}

			if err := app.Run(args); err != nil {
				t.Fatalf("app.Run failed: %v", err)
			}

			logged := output.String()
			if strings.Contains(logged, test.value) || strings.Contains(logged, "secret-marker") {
				t.Errorf("log output contains sensitive flag value %q", test.value)
			}

			if !strings.Contains(logged, "********") {
				t.Errorf("log output did not contain redaction marker: %q", logged)
			}
		})
	}
}
