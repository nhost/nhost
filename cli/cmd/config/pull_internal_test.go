package config

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/nhost/nhost/cli/clienv"
)

func TestPrintSecretSafetyWarnings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		writeSecrets  bool
		wantContains  []string
		wantOmissions []string
	}{
		{
			name:         "config and secrets guidance",
			writeSecrets: true,
			wantContains: []string{
				"- Review `nhost/nhost.toml` and make sure there are no secrets before committing it to git.",
				"- Review `.secrets` and set your development secrets.",
				"- `.secrets` was added to `.gitignore`.",
			},
			wantOmissions: []string{},
		},
		{
			name:         "config guidance only",
			writeSecrets: false,
			wantContains: []string{
				"- Review `nhost/nhost.toml` and make sure there are no secrets before committing it to git.",
			},
			wantOmissions: []string{
				"- Review `.secrets` and set your development secrets.",
				"- `.secrets` was added to `.gitignore`.",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var stdout bytes.Buffer

			ce := clienv.New(
				&stdout,
				io.Discard,
				clienv.NewPathStructure("", "", "", ""),
				"",
				"",
				"",
				"",
				"",
				"",
				"local",
			)

			printSecretSafetyWarnings(ce, tt.writeSecrets)

			got := stdout.String()

			for _, want := range tt.wantContains {
				if !strings.Contains(got, want) {
					t.Errorf("stdout = %q, want it to contain %q", got, want)
				}
			}

			for _, omission := range tt.wantOmissions {
				if strings.Contains(got, omission) {
					t.Errorf("stdout = %q, want it not to contain %q", got, omission)
				}
			}
		})
	}
}
