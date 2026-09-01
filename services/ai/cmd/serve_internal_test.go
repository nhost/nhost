package cmd

import (
	"flag"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/urfave/cli/v2"
)

// newProviderConfigContext stages a urfave/cli context populated with the
// agent-provider flags. The flag names mirror the action's registered flags;
// a typo would surface here rather than at runtime.
func newProviderConfigContext(t *testing.T, values map[string]string) *cli.Context {
	t.Helper()

	set := flag.NewFlagSet("test", flag.ContinueOnError)
	set.String(flagAnthropicKey, "", "")
	set.String(flagOpenAIKey, "", "")
	set.String(flagGoogleKey, "", "")
	set.String(flagBraveKey, "", "")
	set.String(flagTavilyKey, "", "")

	for k, v := range values {
		if err := set.Set(k, v); err != nil {
			t.Fatalf("failed to set flag %q: %v", k, err)
		}
	}

	return cli.NewContext(nil, set, nil)
}

func TestBuildProviderConfig(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
		args map[string]string
		want agents.ProviderConfig
	}{
		{
			name: "no flags set",
			args: nil,
			want: agents.ProviderConfig{
				AnthropicKey: "",
				OpenAIKey:    "",
				GoogleKey:    "",
				BraveKey:     "",
				TavilyKey:    "",
			},
		},
		{
			name: "only anthropic",
			args: map[string]string{flagAnthropicKey: "ak"},
			want: agents.ProviderConfig{
				AnthropicKey: "ak",
				OpenAIKey:    "",
				GoogleKey:    "",
				BraveKey:     "",
				TavilyKey:    "",
			},
		},
		{
			name: "all five",
			args: map[string]string{
				flagAnthropicKey: "ak",
				flagOpenAIKey:    "ok",
				flagGoogleKey:    "gk",
				flagBraveKey:     "bk",
				flagTavilyKey:    "tk",
			},
			want: agents.ProviderConfig{
				AnthropicKey: "ak",
				OpenAIKey:    "ok",
				GoogleKey:    "gk",
				BraveKey:     "bk",
				TavilyKey:    "tk",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctx := newProviderConfigContext(t, tc.args)

			got := buildProviderConfig(ctx)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("buildProviderConfig() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// TestBuildProviderConfigEnvVarBindings verifies that the production serve
// command's env-var bindings (ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY,
// BRAVE_API_KEY, TAVILY_API_KEY) flow through urfave/cli into ProviderConfig.
// A rename of any of these env vars would otherwise silently disable the agent
// service in production. This test cannot run in parallel because t.Setenv
// mutates process env.
func TestBuildProviderConfigEnvVarBindings(t *testing.T) {
	cases := []struct {
		name   string
		envVar string
		field  func(c agents.ProviderConfig) string
	}{
		{
			name:   "ANTHROPIC_API_KEY",
			envVar: "ANTHROPIC_API_KEY",
			field:  func(c agents.ProviderConfig) string { return c.AnthropicKey },
		},
		{
			name:   "GOOGLE_AI_API_KEY",
			envVar: "GOOGLE_AI_API_KEY",
			field:  func(c agents.ProviderConfig) string { return c.GoogleKey },
		},
		{
			name:   "BRAVE_API_KEY",
			envVar: "BRAVE_API_KEY",
			field:  func(c agents.ProviderConfig) string { return c.BraveKey },
		},
		{
			name:   "TAVILY_API_KEY",
			envVar: "TAVILY_API_KEY",
			field:  func(c agents.ProviderConfig) string { return c.TavilyKey },
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv(tc.envVar, "from-env")

			cmd := CommandServe()
			cmd.Action = func(cCtx *cli.Context) error {
				cfg := buildProviderConfig(cCtx)
				if got := tc.field(cfg); got != "from-env" {
					t.Errorf("expected env value 'from-env', got %q", got)
				}

				return nil
			}

			app := cli.NewApp()
			app.Commands = []*cli.Command{cmd}

			if err := app.Run([]string{"ai", "serve"}); err != nil {
				t.Fatalf("app.Run failed: %v", err)
			}
		})
	}
}
