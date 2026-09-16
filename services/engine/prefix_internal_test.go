package main

import (
	"os"
	"slices"
	"testing"

	"github.com/urfave/cli/v3"
)

// passthroughSrc is a small stand-in for a service's native flags covering the
// three shapes the engine re-exposes (scalar, bool, slice) plus one flag that
// the caller consolidates into a global and therefore skips.
func passthroughSrc() []cli.Flag {
	return []cli.Flag{
		&cli.StringFlag{Name: "api-prefix"},
		&cli.BoolFlag{Name: "disable-signup"},
		&cli.StringSliceFlag{Name: "trusted"},
		&cli.StringFlag{Name: "postgres"},
	}
}

func TestClassifyFlag(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		flag cli.Flag
		want flagKind
	}{
		{"string is scalar", &cli.StringFlag{Name: "s"}, kindScalar},
		{"int is scalar", &cli.IntFlag{Name: "i"}, kindScalar},
		{"duration is scalar", &cli.DurationFlag{Name: "d"}, kindScalar},
		{"bool is bool", &cli.BoolFlag{Name: "b"}, kindBool},
		{"string slice is slice", &cli.StringSliceFlag{Name: "sl"}, kindSlice},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := classifyFlag(tc.flag); got != tc.want {
				t.Fatalf("classifyFlag(%s) = %d, want %d", tc.name, got, tc.want)
			}
		})
	}
}

func TestPrefixedNameAndEnv(t *testing.T) {
	t.Parallel()

	if got := prefixedName("auth", "api-prefix"); got != "auth-api-prefix" {
		t.Fatalf("prefixedName = %q, want auth-api-prefix", got)
	}

	if got := prefixedEnv("auth", "api-prefix"); got != "AUTH_API_PREFIX" {
		t.Fatalf("prefixedEnv = %q, want AUTH_API_PREFIX", got)
	}
}

func TestServicePrefixedFlags(t *testing.T) {
	t.Parallel()

	skip := newSet("postgres")
	hidden := newSet("disable-signup")

	src := append(passthroughSrc(), &cli.IntFlag{
		Name:  "smtp-port",
		Usage: "SMTP port",
		Value: 587,
	})
	flags := servicePrefixedFlags("auth", src, skip, hidden)

	names := make([]string, 0, len(flags))
	for _, f := range flags {
		names = append(names, f.Names()[0])
	}

	want := []string{"auth-api-prefix", "auth-disable-signup", "auth-trusted", "auth-smtp-port"}
	if !slices.Equal(names, want) {
		t.Fatalf("prefixed flag names = %v, want %v (postgres must be skipped)", names, want)
	}

	docFlag, ok := flags[len(flags)-1].(cli.DocGenerationFlag)
	if !ok {
		t.Fatalf("auth-smtp-port type = %T, want cli.DocGenerationFlag", flags[len(flags)-1])
	}

	if got := docFlag.GetDefaultText(); got != "587" {
		t.Errorf("auth-smtp-port default text = %q, want 587", got)
	}

	if got := docFlag.GetUsage(); got != "SMTP port (int)" {
		t.Errorf("auth-smtp-port usage = %q, want %q", got, "SMTP port (int)")
	}

	// The hidden native flag is still exposed, just not visible in help.
	for _, f := range flags {
		vis, ok := f.(cli.VisibleFlag)
		if !ok {
			continue
		}

		if f.Names()[0] == "auth-disable-signup" && vis.IsVisible() {
			t.Fatal("auth-disable-signup should be hidden from help")
		}

		if f.Names()[0] == "auth-api-prefix" && !vis.IsVisible() {
			t.Fatal("auth-api-prefix should be visible in help")
		}
	}
}

func TestServicePassthroughArgs(t *testing.T) {
	t.Parallel()

	skip := newSet("postgres")
	prefixed := servicePrefixedFlags("auth", passthroughSrc(), skip, nil)

	args := []string{
		"--auth-api-prefix", "/v1",
		"--auth-disable-signup=true",
		"--auth-trusted", "a",
		"--auth-trusted", "b",
	}

	runParsed(t, prefixed, args, func(cmd *cli.Command) {
		got := servicePassthroughArgs("auth", cmd, passthroughSrc(), skip)
		want := []string{
			"--api-prefix", "/v1",
			"--disable-signup=true",
			"--trusted", "a",
			"--trusted", "b",
		}

		if !slices.Equal(got, want) {
			t.Fatalf("passthrough args = %v, want %v", got, want)
		}
	})
}

func TestServicePassthroughArgsFromRenamedEnv(t *testing.T) {
	const (
		engineEnv = "AUTH_GITHUB_CLIENT_SECRET"
		nativeEnv = "AUTH_PROVIDER_GITHUB_CLIENT_SECRET"
	)

	t.Setenv(engineEnv, "from-engine-env")
	// Register restoration first, then unset so the parser observes true absence.
	t.Setenv(nativeEnv, "")

	if err := os.Unsetenv(nativeEnv); err != nil {
		t.Fatalf("unsetting native service environment: %v", err)
	}

	def := serviceRegistry()["auth"]

	var githubSecret cli.Flag
	for _, flag := range def.command().Flags {
		if slices.Contains(flag.Names(), "github-client-secret") {
			githubSecret = flag

			break
		}
	}

	if githubSecret == nil {
		t.Fatal("real auth registry has no github-client-secret flag")
	}

	nativeFlag, ok := githubSecret.(*cli.StringFlag)
	if !ok {
		t.Fatalf("real auth github-client-secret type = %T, want *cli.StringFlag", githubSecret)
	}

	if _, nativeSourceSet := nativeFlag.Sources.Lookup(); nativeSourceSet {
		t.Fatal("generated engine env unexpectedly populated the differently named native source")
	}

	source := []cli.Flag{githubSecret}
	prefixed := servicePrefixedFlags("auth", source, nil, nil)
	runParsed(t, prefixed, nil, func(cmd *cli.Command) {
		if !cmd.IsSet("auth-github-client-secret") {
			t.Fatal("engine env-populated flag is not reported as set")
		}

		got := servicePassthroughArgs("auth", cmd, source, nil)

		want := []string{"--github-client-secret", "from-engine-env"}
		if !slices.Equal(got, want) {
			t.Fatalf("passthrough args = %v, want %v", got, want)
		}
	})
}

func TestServicePassthroughArgsOmitsUnset(t *testing.T) {
	t.Parallel()

	skip := newSet("postgres")
	prefixed := servicePrefixedFlags("auth", passthroughSrc(), skip, nil)

	// Only api-prefix is set; unset flags must not be forwarded so the
	// service's own defaults and env sources still apply.
	runParsed(t, prefixed, []string{"--auth-api-prefix", "/v1"}, func(cmd *cli.Command) {
		got := servicePassthroughArgs("auth", cmd, passthroughSrc(), skip)
		want := []string{"--api-prefix", "/v1"}

		if !slices.Equal(got, want) {
			t.Fatalf("passthrough args = %v, want %v", got, want)
		}
	})
}
