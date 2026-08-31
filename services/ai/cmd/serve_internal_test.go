package cmd

import (
	"flag"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/urfave/cli/v2"
)

// newAgentConfigContext stages a urfave/cli context populated with the agent
// provider and tool flags. The flag names mirror the action's registered flags;
// a typo would surface here rather than at runtime.
func newAgentConfigContext(t *testing.T, values map[string]string) *cli.Context {
	t.Helper()

	set := flag.NewFlagSet("test", flag.ContinueOnError)
	set.String(flagAnthropicKey, "", "")
	set.String(flagAnthropicWorkspaceID, "", "")
	set.String(flagOpenAIKey, "", "")
	set.String(flagGoogleKey, "", "")
	set.String(flagBraveKey, "", "")
	set.String(flagTavilyKey, "", "")

	for key, value := range values {
		if err := set.Set(key, value); err != nil {
			t.Fatalf("failed to set flag %q: %v", key, err)
		}
	}

	return cli.NewContext(nil, set, nil)
}

func TestBuildAgentProviders(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		args          map[string]string
		wantProviders []provider.Name
		wantAnthropic provider.AnthropicConfig
		wantTools     agents.ToolConfig
	}{
		{
			name:          "no flags set",
			args:          nil,
			wantProviders: nil,
			wantAnthropic: provider.AnthropicConfig{APIKey: "", WorkspaceID: ""},
			wantTools:     agents.ToolConfig{BraveKey: "", TavilyKey: ""},
		},
		{
			name: "only anthropic",
			args: map[string]string{
				flagAnthropicKey:         "ak",
				flagAnthropicWorkspaceID: "workspace-id",
			},
			wantProviders: []provider.Name{provider.ProviderAnthropic},
			wantAnthropic: provider.AnthropicConfig{
				APIKey:      "ak",
				WorkspaceID: "workspace-id",
			},
			wantTools: agents.ToolConfig{BraveKey: "", TavilyKey: ""},
		},
		{
			name: "all providers and tools",
			args: map[string]string{
				flagAnthropicKey:         "ak",
				flagAnthropicWorkspaceID: "workspace-id",
				flagOpenAIKey:            "ok",
				flagGoogleKey:            "gk",
				flagBraveKey:             "bk",
				flagTavilyKey:            "tk",
			},
			wantProviders: []provider.Name{
				provider.ProviderAnthropic,
				provider.ProviderGoogle,
				provider.ProviderOpenAI,
			},
			wantAnthropic: provider.AnthropicConfig{
				APIKey:      "ak",
				WorkspaceID: "workspace-id",
			},
			wantTools: agents.ToolConfig{BraveKey: "bk", TavilyKey: "tk"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctx := newAgentConfigContext(t, tc.args)

			gotProviders, err := buildAgentProviders(t.Context(), ctx)
			if err != nil {
				t.Fatalf("buildAgentProviders() returned an error: %v", err)
			}

			var gotNames []provider.Name
			for name := range gotProviders {
				gotNames = append(gotNames, name)
			}

			slices.Sort(gotNames)

			if diff := cmp.Diff(tc.wantProviders, gotNames); diff != "" {
				t.Errorf("provider names mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.wantAnthropic, buildAnthropicConfig(ctx)); diff != "" {
				t.Errorf("Anthropic config mismatch (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.wantTools, buildAgentToolConfig(ctx)); diff != "" {
				t.Errorf("tool config mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

// TestAgentConfigEnvVarBindings verifies that the production serve command's
// environment bindings flow into provider construction and tool configuration.
// A rename would otherwise silently disable the integration in production.
func TestAgentConfigEnvVarBindings(t *testing.T) {
	envVars := []string{
		"ANTHROPIC_API_KEY",
		"ANTHROPIC_WORKSPACE_ID",
		"OPENAI_API_KEY",
		"GOOGLE_AI_API_KEY",
		"BRAVE_API_KEY",
		"TAVILY_API_KEY",
	}

	cases := []struct {
		name   string
		envVar string
		check  func(*testing.T, *cli.Context)
	}{
		{
			name:   "ANTHROPIC_API_KEY",
			envVar: "ANTHROPIC_API_KEY",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()
				assertProviderConfigured(t, cCtx, provider.ProviderAnthropic)
			},
		},
		{
			name:   "ANTHROPIC_WORKSPACE_ID",
			envVar: "ANTHROPIC_WORKSPACE_ID",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()

				if got := buildAnthropicConfig(cCtx).WorkspaceID; got != "from-env" {
					t.Errorf("workspace ID = %q, want %q", got, "from-env")
				}
			},
		},
		{
			name:   "OPENAI_API_KEY",
			envVar: "OPENAI_API_KEY",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()
				assertProviderConfigured(t, cCtx, provider.ProviderOpenAI)
			},
		},
		{
			name:   "GOOGLE_AI_API_KEY",
			envVar: "GOOGLE_AI_API_KEY",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()
				assertProviderConfigured(t, cCtx, provider.ProviderGoogle)
			},
		},
		{
			name:   "BRAVE_API_KEY",
			envVar: "BRAVE_API_KEY",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()

				if got := buildAgentToolConfig(cCtx).BraveKey; got != "from-env" {
					t.Errorf("Brave API key = %q, want %q", got, "from-env")
				}
			},
		},
		{
			name:   "TAVILY_API_KEY",
			envVar: "TAVILY_API_KEY",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()

				if got := buildAgentToolConfig(cCtx).TavilyKey; got != "from-env" {
					t.Errorf("Tavily API key = %q, want %q", got, "from-env")
				}
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			for _, envVar := range envVars {
				t.Setenv(envVar, "")
			}

			t.Setenv(tc.envVar, "from-env")

			cmd := CommandServe()
			cmd.Action = func(cCtx *cli.Context) error {
				tc.check(t, cCtx)

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

func assertProviderConfigured(t *testing.T, cCtx *cli.Context, name provider.Name) {
	t.Helper()

	providers, err := buildAgentProviders(t.Context(), cCtx)
	if err != nil {
		t.Fatalf("buildAgentProviders() returned an error: %v", err)
	}

	if _, ok := providers[name]; !ok {
		t.Errorf("provider %q is not configured", name)
	}
}
