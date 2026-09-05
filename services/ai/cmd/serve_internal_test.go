package cmd

import (
	"bytes"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/ai/agents"
	"github.com/urfave/cli/v2"
)

func newAgentConfigContext(t *testing.T, values map[string]string) *cli.Context {
	t.Helper()

	set := flag.NewFlagSet("test", flag.ContinueOnError)
	set.String(flagAgentProviders, "", "")
	set.String(flagBraveKey, "", "")
	set.String(flagTavilyKey, "", "")

	for key, value := range values {
		if err := set.Set(key, value); err != nil {
			t.Fatalf("failed to set flag %q: %v", key, err)
		}
	}

	return cli.NewContext(nil, set, nil)
}

func configuredProviderDeclaration(name, providerType, baseURL, headers string) string {
	return fmt.Sprintf(
		`{"name":%q,"type":%q,"configuration":{"base_url":%q%s}}`,
		name,
		providerType,
		baseURL,
		headers,
	)
}

func TestCommandServeAgentProviderFlagContract(t *testing.T) {
	t.Parallel()

	flags := make(map[string]cli.Flag)
	for _, commandFlag := range CommandServe().Flags {
		flags[commandFlag.Names()[0]] = commandFlag
	}

	agentProvidersFlag, ok := flags[flagAgentProviders].(*cli.StringFlag)
	if !ok {
		t.Fatalf(
			"%s flag type = %T, want *cli.StringFlag",
			flagAgentProviders,
			flags[flagAgentProviders],
		)
	}

	if diff := cmp.Diff([]string{"AGENT_PROVIDERS"}, agentProvidersFlag.EnvVars); diff != "" {
		t.Errorf("agent provider environment bindings mismatch (-want +got):\n%s", diff)
	}

	for _, legacyFlag := range []string{
		"anthropic-key",
		"anthropic-workspace-id",
		"google-key",
		"openai-compatible-base-url",
		"openai-compatible-headers",
	} {
		if _, ok := flags[legacyFlag]; ok {
			t.Errorf("legacy agent flag %q is still registered", legacyFlag)
		}
	}

	for _, name := range []string{flagOpenAIKey, flagOpenAIOrg} {
		openAIFlag, ok := flags[name].(*cli.StringFlag)
		if !ok {
			t.Fatalf("%s flag type = %T, want *cli.StringFlag", name, flags[name])
		}

		if !strings.Contains(openAIFlag.Usage, "auto-embeddings only") ||
			openAIFlag.Category != "auto-embeddings" {
			t.Errorf("%s is not described as auto-embeddings-only: %#v", name, openAIFlag)
		}
	}
}

func TestBuildAgentProviders(t *testing.T) {
	t.Parallel()

	allProviders := "[" + strings.Join([]string{
		configuredProviderDeclaration(
			"anthropic",
			"anthropic_messages",
			"https://api.anthropic.com",
			`,"headers":{"x-api-key":"anthropic-secret"}`,
		),
		configuredProviderDeclaration(
			"google",
			"google_gemini",
			"https://generativelanguage.googleapis.com",
			`,"headers":{"x-goog-api-key":"google-secret"}`,
		),
		configuredProviderDeclaration(
			"openai",
			"openai_chat_completions",
			"https://api.openai.com/v1",
			`,"headers":{"Authorization":"Bearer openai-secret"}`,
		),
		configuredProviderDeclaration(
			"openai_compatible",
			"openai_chat_completions",
			"http://localhost:11434/v1",
			"",
		),
		configuredProviderDeclaration(
			"gateway.primary-test",
			"openai_chat_completions",
			"https://gateway.example/v1",
			"",
		),
	}, ",") + "]"

	tests := []struct {
		name      string
		raw       string
		wantTypes map[string]string
	}{
		{name: "unset", raw: "", wantTypes: map[string]string{}},
		{name: "empty", raw: "[]", wantTypes: map[string]string{}},
		{
			name: "all adapters and historical identities",
			raw:  allProviders,
			wantTypes: map[string]string{
				"anthropic":            "anthropic_messages",
				"gateway.primary-test": "openai_chat_completions",
				"google":               "google_gemini",
				"openai":               "openai_chat_completions",
				"openai_compatible":    "openai_chat_completions",
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			registry, typesByName, err := buildAgentProviders(
				t.Context(),
				newAgentConfigContext(t, map[string]string{flagAgentProviders: test.raw}),
			)
			if err != nil {
				t.Fatalf("buildAgentProviders() error = %v", err)
			}

			if diff := cmp.Diff(test.wantTypes, typesByName); diff != "" {
				t.Errorf("provider types mismatch (-want +got):\n%s", diff)
			}

			if len(registry) != len(test.wantTypes) {
				t.Fatalf("registry length = %d, want %d", len(registry), len(test.wantTypes))
			}

			for name := range test.wantTypes {
				if registry[name] == nil {
					t.Errorf("registry provider %q is nil", name)
				}
			}
		})
	}
}

func TestAgentProvidersEnvironmentBinding(t *testing.T) {
	raw := "[" + configuredProviderDeclaration(
		"from-environment",
		"openai_chat_completions",
		"https://environment.example/v1",
		"",
	) + "]"
	t.Setenv("AGENT_PROVIDERS", raw)

	command := CommandServe()
	command.Action = func(cCtx *cli.Context) error {
		registry, typesByName, err := buildAgentProviders(t.Context(), cCtx)
		if err != nil {
			return err
		}

		if registry["from-environment"] == nil {
			t.Error("AGENT_PROVIDERS declaration was not configured")
		}

		wantTypes := map[string]string{"from-environment": "openai_chat_completions"}
		if diff := cmp.Diff(wantTypes, typesByName); diff != "" {
			t.Errorf("provider types mismatch (-want +got):\n%s", diff)
		}

		return nil
	}

	app := cli.NewApp()

	app.Commands = []*cli.Command{command}
	if err := app.Run([]string{"ai", "serve"}); err != nil {
		t.Fatalf("app.Run() error = %v", err)
	}
}

func TestAgentProvidersCLIOverridesEnvironment(t *testing.T) {
	environmentRaw := "[" + configuredProviderDeclaration(
		"from-environment",
		"openai_chat_completions",
		"https://environment.example/v1",
		"",
	) + "]"
	cliRaw := "[" + configuredProviderDeclaration(
		"from-cli",
		"openai_chat_completions",
		"https://cli.example/v1",
		"",
	) + "]"

	t.Setenv("AGENT_PROVIDERS", environmentRaw)

	command := CommandServe()
	command.Action = func(cCtx *cli.Context) error {
		registry, typesByName, err := buildAgentProviders(t.Context(), cCtx)
		if err != nil {
			return err
		}

		if _, ok := registry["from-environment"]; ok {
			t.Error("environment declaration overrode the CLI flag")
		}

		if registry["from-cli"] == nil {
			t.Error("CLI declaration was not configured")
		}

		wantTypes := map[string]string{"from-cli": "openai_chat_completions"}
		if diff := cmp.Diff(wantTypes, typesByName); diff != "" {
			t.Errorf("provider types mismatch (-want +got):\n%s", diff)
		}

		return nil
	}

	app := cli.NewApp()

	app.Commands = []*cli.Command{command}
	if err := app.Run([]string{"ai", "serve", "--" + flagAgentProviders, cliRaw}); err != nil {
		t.Fatalf("app.Run() error = %v", err)
	}
}

//nolint:paralleltest // app.Run mutates urfave/cli's global help and version flags.
func TestLegacyAgentEnvironmentDoesNotRegisterProviders(t *testing.T) {
	for name, value := range map[string]string{
		"AGENT_PROVIDERS":            "",
		"ANTHROPIC_API_KEY":          "legacy-anthropic-marker",
		"ANTHROPIC_WORKSPACE_ID":     "legacy-workspace-marker",
		"GOOGLE_AI_API_KEY":          "legacy-google-marker",
		"OPENAI_COMPATIBLE_BASE_URL": "https://legacy.example/v1",
		"OPENAI_COMPATIBLE_HEADERS":  `{"Authorization":"legacy-header-marker"}`,
		"OPENAI_API_KEY":             "embedding-key-marker",
		"OPENAI_ORG":                 "embedding-org-marker",
	} {
		t.Setenv(name, value)
	}

	command := CommandServe()
	command.Action = func(cCtx *cli.Context) error {
		registry, typesByName, err := buildAgentProviders(t.Context(), cCtx)
		if err != nil {
			return err
		}

		if len(registry) != 0 || len(typesByName) != 0 {
			t.Fatalf("legacy environment configured providers: %#v, %#v", registry, typesByName)
		}

		if got := cCtx.String(flagOpenAIKey); got != "embedding-key-marker" {
			t.Errorf("auto-embeddings OpenAI key = %q", got)
		}

		if got := cCtx.String(flagOpenAIOrg); got != "embedding-org-marker" {
			t.Errorf("auto-embeddings OpenAI organization = %q", got)
		}

		return nil
	}

	app := cli.NewApp()

	app.Commands = []*cli.Command{command}
	if err := app.Run([]string{"ai", "serve"}); err != nil {
		t.Fatalf("app.Run() error = %v", err)
	}
}

func TestBuildAgentProvidersFailureIsAtomicAndSafe(t *testing.T) {
	t.Parallel()

	const secretMarker = "AGENT-PROVIDER-SECRET-MARKER"

	raw := "[" + strings.Join([]string{
		configuredProviderDeclaration(
			"valid",
			"openai_chat_completions",
			"https://api.openai.com/v1",
			"",
		),
		configuredProviderDeclaration(
			"invalid",
			"openai_chat_completions",
			"https://example.com/"+secretMarker,
			`,"headers":{"Host":"`+secretMarker+`"}`,
		),
	}, ",") + "]"

	registry, typesByName, err := buildAgentProviders(
		t.Context(),
		newAgentConfigContext(t, map[string]string{flagAgentProviders: raw}),
	)
	if err == nil {
		t.Fatal("buildAgentProviders() returned no error")
	}

	if registry != nil || typesByName != nil {
		t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
	}

	if strings.Contains(err.Error(), secretMarker) || strings.Contains(err.Error(), raw) {
		t.Fatalf("configuration error exposed raw input: %v", err)
	}
}

func TestServeRejectsInvalidProviderConfigBeforeExternalWork(t *testing.T) {
	const sensitiveMarker = "STARTUP-CONFIGURATION-SENSITIVE-MARKER"

	t.Setenv("AGENT_PROVIDERS", "")

	output, err := os.CreateTemp(t.TempDir(), "serve-stdout-*.log")
	if err != nil {
		t.Fatalf("create stdout capture: %v", err)
	}

	originalStdout := os.Stdout
	os.Stdout = output
	t.Cleanup(func() { os.Stdout = originalStdout })

	raw := "[" + configuredProviderDeclaration(
		"invalid",
		"openai_chat_completions",
		"https://example.com/"+sensitiveMarker,
		`,"headers":{"Host":"`+sensitiveMarker+`"}`,
	) + "]"
	app := cli.NewApp()
	app.Name = "ai"
	app.Version = "test-version"
	app.Commands = []*cli.Command{CommandServe()}
	runErr := app.Run([]string{
		"ai",
		"serve",
		"--" + flagLogFormatJSON,
		"--" + flagAgentProviders,
		raw,
		"--" + flagPostgresConnection,
		"invalid-postgres-connection",
	})

	os.Stdout = originalStdout

	if _, err := output.Seek(0, io.SeekStart); err != nil {
		t.Fatalf("rewind stdout capture: %v", err)
	}

	logged, err := io.ReadAll(output)
	if err != nil {
		t.Fatalf("read stdout capture: %v", err)
	}

	if err := output.Close(); err != nil {
		t.Fatalf("close stdout capture: %v", err)
	}

	if runErr == nil || !strings.Contains(runErr.Error(), "invalid headers") {
		t.Fatalf("app.Run() error = %v, want safe configuration error", runErr)
	}

	text := string(logged)
	for _, marker := range []string{sensitiveMarker, raw, "invalid-postgres-connection"} {
		if strings.Contains(runErr.Error(), marker) {
			t.Errorf("startup error contains sensitive marker %q", marker)
		}

		if strings.Contains(text, marker) {
			t.Errorf("startup logs contain sensitive marker %q", marker)
		}
	}

	orderedMessages := []string{
		"ai vtest-version",
		"starting program",
		"failed to configure agent providers",
	}

	lastIndex := -1
	for _, message := range orderedMessages {
		index := strings.Index(text, message)
		if index <= lastIndex {
			t.Errorf("startup message %q missing or out of order in %q", message, text)
		}

		lastIndex = index
	}

	if !strings.Contains(text, `"agent-providers":"********"`) {
		t.Errorf("agent provider flag was not redacted: %q", text)
	}

	for _, externalWork := range []string{"Applying postgres migrations", "Applying hasura migrations", "starting server"} {
		if strings.Contains(text, externalWork) {
			t.Errorf("invalid configuration reached external work %q: %q", externalWork, text)
		}
	}
}

func TestLogAgentProviderSummaryIsSafeAndSorted(t *testing.T) {
	t.Parallel()

	var output bytes.Buffer

	logger := slog.New(slog.NewJSONHandler(&output, nil))
	logAgentProviderSummary(t.Context(), logger, map[string]string{
		"zeta":   "google_gemini",
		"alpha":  "anthropic_messages",
		"middle": "openai_chat_completions",
	})

	logged := output.String()

	positions := []int{
		strings.Index(logged, `"name":"alpha"`),
		strings.Index(logged, `"name":"middle"`),
		strings.Index(logged, `"name":"zeta"`),
	}
	if slices.Contains(positions, -1) || !slices.IsSorted(positions) {
		t.Errorf("provider summary is not sorted: %q", logged)
	}

	for _, providerType := range []string{
		"anthropic_messages",
		"google_gemini",
		"openai_chat_completions",
	} {
		if !strings.Contains(logged, providerType) {
			t.Errorf("provider summary is missing type %q: %q", providerType, logged)
		}
	}

	for _, forbidden := range []string{"base_url", "headers", "Authorization", "https://"} {
		if strings.Contains(logged, forbidden) {
			t.Errorf("provider summary contains configuration field %q: %q", forbidden, logged)
		}
	}
}

func TestAgentToolEnvironmentBindings(t *testing.T) {
	t.Setenv("BRAVE_API_KEY", "brave-marker")
	t.Setenv("TAVILY_API_KEY", "tavily-marker")

	command := CommandServe()
	command.Action = func(cCtx *cli.Context) error {
		want := agents.ToolConfig{BraveKey: "brave-marker", TavilyKey: "tavily-marker"}
		if diff := cmp.Diff(want, buildAgentToolConfig(cCtx)); diff != "" {
			t.Errorf("tool configuration mismatch (-want +got):\n%s", diff)
		}

		return nil
	}

	app := cli.NewApp()

	app.Commands = []*cli.Command{command}
	if err := app.Run([]string{"ai", "serve"}); err != nil {
		t.Fatalf("app.Run() error = %v", err)
	}
}
