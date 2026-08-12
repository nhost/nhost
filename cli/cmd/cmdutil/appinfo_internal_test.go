package cmdutil

import (
	"context"
	"errors"
	"io"
	"path/filepath"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/nhostclient/graphql"
)

func newUnlinkedCliEnv(t *testing.T) *clienv.CliEnv {
	t.Helper()

	root := t.TempDir()

	return clienv.New(
		io.Discard,
		io.Discard,
		clienv.NewPathStructure(
			root,
			root,
			filepath.Join(root, ".nhost"),
			filepath.Join(root, "nhost"),
		),
		"",
		"https://unreachable.invalid/v1",
		"",
		"",
		"",
		"",
		"local",
	)
}

func TestGetAppInfoOrLinkInteractiveGuard(t *testing.T) {
	t.Parallel()

	linkedApp := &graphql.AppSummaryFragment{
		ID:        "app-id",
		Name:      "app-name",
		Subdomain: "app-subdomain",
		Region: graphql.AppSummaryFragment_Region{
			Name: "eu-central-1",
		},
	}

	tests := []struct {
		name               string
		interactive        bool
		stdoutTTY          bool
		linkApp            *graphql.AppSummaryFragment
		wantApp            *graphql.AppSummaryFragment
		wantErr            error
		wantTerminalChecks int
		wantLinkCalls      int
	}{
		{
			name:               "non-interactive skips terminal and link checks",
			interactive:        false,
			stdoutTTY:          true,
			linkApp:            linkedApp,
			wantApp:            nil,
			wantErr:            clienv.ErrNoLinkedProject,
			wantTerminalChecks: 0,
			wantLinkCalls:      0,
		},
		{
			name:               "interactive non-tty returns no linked project",
			interactive:        true,
			stdoutTTY:          false,
			linkApp:            linkedApp,
			wantApp:            nil,
			wantErr:            clienv.ErrNoLinkedProject,
			wantTerminalChecks: 1,
			wantLinkCalls:      0,
		},
		{
			name:               "interactive tty runs link path",
			interactive:        true,
			stdoutTTY:          true,
			linkApp:            linkedApp,
			wantApp:            linkedApp,
			wantErr:            nil,
			wantTerminalChecks: 1,
			wantLinkCalls:      1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			terminalChecks := 0
			linkCalls := 0

			got, err := getAppInfoOrLink(
				t.Context(),
				newUnlinkedCliEnv(t),
				"",
				tt.interactive,
				func() bool {
					terminalChecks++

					return tt.stdoutTTY
				},
				func(
					_ context.Context,
					_ *clienv.CliEnv,
				) (*graphql.AppSummaryFragment, error) {
					linkCalls++

					return tt.linkApp, nil
				},
			)

			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("getAppInfoOrLink() error = %v, want %v", err, tt.wantErr)
				}

				if got != nil {
					t.Fatalf("getAppInfoOrLink() app = %#v, want nil", got)
				}
			} else if err != nil {
				t.Fatalf("getAppInfoOrLink() returned unexpected error: %v", err)
			}

			if got != tt.wantApp {
				t.Errorf("getAppInfoOrLink() app = %#v, want %#v", got, tt.wantApp)
			}

			if terminalChecks != tt.wantTerminalChecks {
				t.Errorf(
					"terminal checks = %d, want %d",
					terminalChecks,
					tt.wantTerminalChecks,
				)
			}

			if linkCalls != tt.wantLinkCalls {
				t.Errorf("link calls = %d, want %d", linkCalls, tt.wantLinkCalls)
			}
		})
	}
}
