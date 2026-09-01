package cmd

import (
	"errors"
	"flag"
	"io"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/nhost/nhost/services/ai/agents/provider"
	"github.com/nhost/nhost/services/ai/hasura"
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
	set.String(flagOpenAICompatibleBaseURL, "", "")
	set.String(flagOpenAICompatibleHeaders, "", "")
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
		wantProviders []string
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
			wantProviders: []string{string(hasura.AiAgentProvidersEnumAnthropic)},
			wantAnthropic: provider.AnthropicConfig{
				APIKey:      "ak",
				WorkspaceID: "workspace-id",
			},
			wantTools: agents.ToolConfig{BraveKey: "", TavilyKey: ""},
		},
		{
			name: "only OpenAI-compatible",
			args: map[string]string{
				flagOpenAICompatibleBaseURL: "http://localhost:11434/v1",
			},
			wantProviders: []string{string(hasura.AiAgentProvidersEnumOpenaiCompatible)},
			wantAnthropic: provider.AnthropicConfig{APIKey: "", WorkspaceID: ""},
			wantTools:     agents.ToolConfig{BraveKey: "", TavilyKey: ""},
		},
		{
			name: "all providers and tools",
			args: map[string]string{
				flagAnthropicKey:            "ak",
				flagAnthropicWorkspaceID:    "workspace-id",
				flagOpenAIKey:               "ok",
				flagGoogleKey:               "gk",
				flagOpenAICompatibleBaseURL: "http://localhost:11434/v1",
				flagOpenAICompatibleHeaders: `{"Authorization":"configured"}`,
				flagBraveKey:                "bk",
				flagTavilyKey:               "tk",
			},
			wantProviders: []string{
				string(hasura.AiAgentProvidersEnumAnthropic),
				string(hasura.AiAgentProvidersEnumGoogle),
				string(hasura.AiAgentProvidersEnumOpenai),
				string(hasura.AiAgentProvidersEnumOpenaiCompatible),
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

			var gotNames []string
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
		"OPENAI_COMPATIBLE_BASE_URL",
		"OPENAI_COMPATIBLE_HEADERS",
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
				assertProviderConfigured(t, cCtx, string(hasura.AiAgentProvidersEnumAnthropic))
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
				assertProviderConfigured(t, cCtx, string(hasura.AiAgentProvidersEnumOpenai))
			},
		},
		{
			name:   "GOOGLE_AI_API_KEY",
			envVar: "GOOGLE_AI_API_KEY",
			check: func(t *testing.T, cCtx *cli.Context) {
				t.Helper()
				assertProviderConfigured(t, cCtx, string(hasura.AiAgentProvidersEnumGoogle))
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

func assertProviderConfigured(t *testing.T, cCtx *cli.Context, name string) {
	t.Helper()

	providers, err := buildAgentProviders(t.Context(), cCtx)
	if err != nil {
		t.Fatalf("buildAgentProviders() returned an error: %v", err)
	}

	if _, ok := providers[name]; !ok {
		t.Errorf("provider %q is not configured", name)
	}
}

func TestParseOpenAICompatibleHeaders(t *testing.T) {
	t.Parallel()

	invalidUTF8 := string([]byte{'{', '"', 'X', '"', ':', '"', 0xff, '"', '}'})
	tests := []struct {
		name    string
		raw     string
		want    map[string]string
		wantErr bool
	}{
		{name: "empty", raw: "", want: map[string]string{}, wantErr: false},
		{name: "whitespace", raw: " \n\t\r", want: map[string]string{}, wantErr: false},
		{name: "empty object", raw: "{}", want: map[string]string{}, wantErr: false},
		{
			name: "headers",
			raw:  `{"Authorization":"Bearer token","cf-aig-authorization":"gateway"}`,
			want: map[string]string{
				"Authorization":        "Bearer token",
				"cf-aig-authorization": "gateway",
			},
			wantErr: false,
		},
		{name: "null", raw: "null", want: nil, wantErr: true},
		{name: "array", raw: "[]", want: nil, wantErr: true},
		{name: "string scalar", raw: `"header"`, want: nil, wantErr: true},
		{name: "number scalar", raw: "42", want: nil, wantErr: true},
		{name: "boolean scalar", raw: "true", want: nil, wantErr: true},
		{name: "non-string value", raw: `{"X-Test":42}`, want: nil, wantErr: true},
		{name: "null value", raw: `{"X-Test":null}`, want: nil, wantErr: true},
		{name: "object value", raw: `{"X-Test":{}}`, want: nil, wantErr: true},
		{name: "array value", raw: `{"X-Test":[]}`, want: nil, wantErr: true},
		{
			name:    "exact duplicate",
			raw:     `{"Authorization":"first","Authorization":"second"}`,
			want:    nil,
			wantErr: true,
		},
		{
			name:    "case-variant duplicate",
			raw:     `{"Authorization":"first","authorization":"second"}`,
			want:    nil,
			wantErr: true,
		},
		{name: "invalid UTF-8 JSON", raw: invalidUTF8, want: nil, wantErr: true},
		{
			name:    "header name validation is deferred",
			raw:     `{"Invalid Header":"value"}`,
			want:    map[string]string{"Invalid Header": "value"},
			wantErr: false,
		},
		{
			name:    "header value validation is deferred",
			raw:     `{"X-Test":"line\u000afeed"}`,
			want:    map[string]string{"X-Test": "line\nfeed"},
			wantErr: false,
		},
		{name: "trailing object", raw: `{} {}`, want: nil, wantErr: true},
		{name: "trailing scalar", raw: `{} true`, want: nil, wantErr: true},
		{name: "unterminated object", raw: `{"X-Test":"value"`, want: nil, wantErr: true},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseOpenAICompatibleHeaders(test.raw)
			if test.wantErr {
				if !errors.Is(err, errInvalidOpenAICompatibleHeadersJSON) {
					t.Fatalf("error = %v, want fixed JSON error", err)
				}

				if strings.Contains(err.Error(), test.raw) {
					t.Error("parse error contains rejected input")
				}

				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(test.want, got); diff != "" {
				t.Errorf("headers mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestBuildOpenAICompatibleProviderErrors(t *testing.T) {
	t.Parallel()

	const invalidHeaderError = "validate OpenAI-compatible configuration: " +
		"invalid provider headers"

	tests := []struct {
		name          string
		values        map[string]string
		wantErr       error
		wantErrorText string
		markers       []string
	}{
		{
			name: "headers require base URL",
			values: map[string]string{
				flagOpenAICompatibleHeaders: `{"Authorization":"configured"}`,
			},
			wantErr:       errOpenAICompatibleBaseURLRequired,
			wantErrorText: "",
			markers:       nil,
		},
		{
			name: "malformed headers",
			values: map[string]string{
				flagOpenAICompatibleBaseURL: "http://localhost:11434/v1",
				flagOpenAICompatibleHeaders: "not-json",
			},
			wantErr:       errInvalidOpenAICompatibleHeadersJSON,
			wantErrorText: "",
			markers:       nil,
		},
		{
			name: "invalid header name is rejected by provider config",
			values: map[string]string{
				flagOpenAICompatibleBaseURL: "http://localhost:11434/v1",
				flagOpenAICompatibleHeaders: `{"Invalid Header HEADER-NAME-SENTINEL":"value"}`,
			},
			wantErr:       nil,
			wantErrorText: invalidHeaderError,
			markers:       []string{"HEADER-NAME-SENTINEL"},
		},
		{
			name: "control header value is rejected by provider config",
			values: map[string]string{
				flagOpenAICompatibleBaseURL: "http://localhost:11434/v1",
				flagOpenAICompatibleHeaders: `{"X-Test":"HEADER-VALUE-SENTINEL\u000a"}`,
			},
			wantErr:       nil,
			wantErrorText: invalidHeaderError,
			markers:       []string{"HEADER-VALUE-SENTINEL"},
		},
		{
			name: "reserved header is rejected by provider config",
			values: map[string]string{
				flagOpenAICompatibleBaseURL: "http://localhost:11434/v1",
				flagOpenAICompatibleHeaders: `{"Host":"RESERVED-HEADER-SENTINEL"}`,
			},
			wantErr:       nil,
			wantErrorText: invalidHeaderError,
			markers:       []string{"RESERVED-HEADER-SENTINEL"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			providers, err := buildAgentProviders(
				t.Context(),
				newAgentConfigContext(t, test.values),
			)
			if err == nil {
				t.Fatal("expected an error")
			}

			if test.wantErr != nil && !errors.Is(err, test.wantErr) {
				t.Fatalf("error = %v, want %v", err, test.wantErr)
			}

			if test.wantErrorText != "" && err.Error() != test.wantErrorText {
				t.Fatalf("error = %q, want %q", err, test.wantErrorText)
			}

			for _, marker := range test.markers {
				if strings.Contains(err.Error(), marker) {
					t.Errorf("error exposed rejected marker %q: %v", marker, err)
				}
			}

			if providers != nil {
				t.Errorf("providers = %#v, want nil", providers)
			}
		})
	}
}

func TestServeRejectsInvalidProviderConfigBeforeStartup(t *testing.T) {
	t.Setenv("OPENAI_COMPATIBLE_BASE_URL", "")
	t.Setenv("OPENAI_COMPATIBLE_HEADERS", "")

	output, err := os.CreateTemp(t.TempDir(), "serve-stdout-*.log")
	if err != nil {
		t.Fatalf("create stdout capture: %v", err)
	}

	originalStdout := os.Stdout
	os.Stdout = output
	t.Cleanup(func() {
		os.Stdout = originalStdout
	})

	app := cli.NewApp()
	app.Name = "ai"
	app.Commands = []*cli.Command{CommandServe()}
	runErr := app.Run([]string{
		"ai",
		"serve",
		"--" + flagOpenAICompatibleBaseURL,
		"BASE-URL-SENTINEL",
		"--" + flagOpenAICompatibleHeaders,
		`{"Authorization":"HEADER-SENTINEL"}`,
		"--" + flagPostgresConnection,
		"invalid-postgres-connection",
	})

	os.Stdout = originalStdout

	position, err := output.Seek(0, io.SeekStart)
	if err != nil {
		t.Fatalf("rewind stdout capture: %v", err)
	}

	if position != 0 {
		t.Fatalf("rewind stdout capture position = %d, want 0", position)
	}

	logged, err := io.ReadAll(output)
	if err != nil {
		t.Fatalf("read stdout capture: %v", err)
	}

	if err := output.Close(); err != nil {
		t.Fatalf("close stdout capture: %v", err)
	}

	if runErr == nil || !strings.Contains(runErr.Error(), "invalid provider base URL") {
		t.Fatalf("app.Run error = %v, want fixed provider base URL error", runErr)
	}

	for _, marker := range []string{"BASE-URL-SENTINEL", "HEADER-SENTINEL"} {
		if strings.Contains(runErr.Error(), marker) {
			t.Errorf("startup error contains sensitive marker %q", marker)
		}

		if strings.Contains(string(logged), marker) {
			t.Errorf("startup logs contain sensitive marker %q", marker)
		}
	}

	if len(logged) != 0 {
		t.Errorf("invalid configuration produced startup logs before failing: %q", logged)
	}
}

func TestOpenAICompatibleEnvVarBindings(t *testing.T) {
	tests := []struct {
		name      string
		baseURL   string
		headers   string
		wantError bool
	}{
		{
			name:      "base URL only",
			baseURL:   "http://localhost:11434/v1",
			headers:   "",
			wantError: false,
		},
		{
			name:      "base URL and headers",
			baseURL:   "http://localhost:11434/v1",
			headers:   `{"Authorization":"configured"}`,
			wantError: false,
		},
		{
			name:      "malformed headers",
			baseURL:   "http://localhost:11434/v1",
			headers:   "not-json",
			wantError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("OPENAI_COMPATIBLE_BASE_URL", test.baseURL)
			t.Setenv("OPENAI_COMPATIBLE_HEADERS", test.headers)

			command := CommandServe()
			command.Action = func(cCtx *cli.Context) error {
				providers, err := buildAgentProviders(t.Context(), cCtx)
				if test.wantError {
					if !errors.Is(err, errInvalidOpenAICompatibleHeadersJSON) {
						t.Errorf("error = %v, want fixed JSON error", err)
					}

					return nil
				}

				if err != nil {
					return err
				}

				if _, ok := providers[string(hasura.AiAgentProvidersEnumOpenaiCompatible)]; !ok {
					t.Error("compatible environment configuration was not enabled")
				}

				return nil
			}

			app := cli.NewApp()
			app.Commands = []*cli.Command{command}

			if err := app.Run([]string{"ai", "serve"}); err != nil {
				t.Fatalf("app.Run failed: %v", err)
			}
		})
	}
}
