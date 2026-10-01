package project

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	nhostproject "github.com/nhost/nhost/cli/project"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

func methodNames(methods []signInMethod) []string {
	names := make([]string, 0, len(methods))
	for _, m := range methods {
		names = append(names, m.name)
	}

	return names
}

func TestParseAuthMethods(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   string
		want    []string
		wantErr error
		// wantInErr is a fragment the refusal must carry, so the user is told
		// what they can type instead.
		wantInErr string
	}{
		{name: "default", value: defaultAuthMethods, want: []string{"password"}},
		{
			name:  "several",
			value: "password,otp",
			want:  []string{"password", "otp"},
		},
		{
			name:  "catalogue order, not typed order",
			value: "oauth,password",
			want:  []string{"password", "oauth"},
		},
		{
			name:  "duplicates collapse",
			value: "otp,otp,password",
			want:  []string{"password", "otp"},
		},
		{
			name:  "spaces and stray commas",
			value: " password , , magic-link ",
			want:  []string{"password", "magic-link"},
		},
		{name: "all four", value: "password,magic-link,otp,oauth", want: authMethodNames()},
		{
			name:      "unknown name",
			value:     "password,sms",
			wantErr:   errUnknownAuthMethod,
			wantInErr: "magic-link",
		},
		{name: "empty", value: "", wantErr: errNoAuthMethods},
		{name: "only separators", value: " , ", wantErr: errNoAuthMethods},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseAuthMethods(tt.value)

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("parseAuthMethods(%q) error = %v, want %v", tt.value, err, tt.wantErr)
			}

			if tt.wantInErr != "" && (err == nil || !strings.Contains(err.Error(), tt.wantInErr)) {
				t.Errorf("error %v does not mention %q", err, tt.wantInErr)
			}

			if tt.wantErr != nil {
				return
			}

			if names := methodNames(got); !equalStrings(names, tt.want) {
				t.Errorf("parseAuthMethods(%q) = %v, want %v", tt.value, names, tt.want)
			}
		})
	}
}

func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}

	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}

	return true
}

// resolveAuthWith parses args the way init does, so the table exercises the
// real flag rather than a hand-built command. asked is false throughout: these
// cases are about the flag, and the question it stands in for has its own test.
func resolveAuthWith(t *testing.T, template string, args ...string) ([]signInMethod, error) {
	t.Helper()

	var (
		got    []signInMethod
		gotErr error
		output bytes.Buffer
	)

	cmd := &cli.Command{
		Name: "init",
		Flags: []cli.Flag{
			&cli.StringFlag{Name: flagAuthMethods, Value: defaultAuthMethods},
		},
		Action: func(_ context.Context, c *cli.Command) error {
			got, gotErr = resolveAuthMethods(newTestEnv(&output), c, template, false)

			return nil
		},
	}

	if err := cmd.Run(t.Context(), append([]string{"init"}, args...)); err != nil {
		t.Fatalf("parsing %q: %v", args, err)
	}

	return got, gotErr
}

func TestResolveAuthMethods(t *testing.T) {
	t.Parallel()

	t.Run("omitted falls back to the bare minimum", func(t *testing.T) {
		t.Parallel()

		got, err := resolveAuthWith(t, "nextjs")
		if err != nil {
			t.Fatalf("resolveAuthMethods: %v", err)
		}

		if names := methodNames(got); !equalStrings(names, []string{"password"}) {
			t.Errorf("default selection = %v, want [password]", names)
		}
	})

	t.Run("without a template it means nothing and is refused", func(t *testing.T) {
		t.Parallel()

		_, err := resolveAuthWith(t, "", "--auth-methods", "otp")
		if !errors.Is(err, errAuthMethodsNeedTemplate) {
			t.Errorf("error = %v, want %v", err, errAuthMethodsNeedTemplate)
		}
	})

	t.Run("no template and no flag is not an error", func(t *testing.T) {
		t.Parallel()

		got, err := resolveAuthWith(t, "")
		if err != nil {
			t.Fatalf("resolveAuthMethods: %v", err)
		}

		if len(got) != 0 {
			t.Errorf("selection = %v, want none", methodNames(got))
		}
	})
}

// The checklist is offered after the template picker, but only where there is
// a terminal to draw it on. Piped input gets the defaults and no second
// question, so `printf '1\n' | nhost init --template` still scaffolds on one
// line of input.
//
//nolint:paralleltest // swaps os.Stdin
func TestPickAuthMethodsFallsBackToDefaults(t *testing.T) {
	withStdin(t, "")

	var output bytes.Buffer

	defaults, err := parseAuthMethods(defaultAuthMethods)
	if err != nil {
		t.Fatalf("parseAuthMethods: %v", err)
	}

	got, err := pickAuthMethods(newTestEnv(&output), defaults)
	if err != nil {
		t.Fatalf("pickAuthMethods: %v", err)
	}

	if names := methodNames(got); !equalStrings(names, []string{"password"}) {
		t.Errorf("selection = %v, want [password]", names)
	}

	if output.Len() != 0 {
		t.Errorf("a question was asked with no terminal to answer it on:\n%s", output.String())
	}
}

// The checklist offers every method the catalogue has, so one added there is
// offered without a second edit.
func TestPickAuthMethodsOffersTheWholeCatalogue(t *testing.T) {
	t.Parallel()

	all := signInMethods()

	items := make([]pickerItem, 0, len(all))
	for _, m := range all {
		items = append(items, pickerItem{Label: m.title})
	}

	if len(items) != len(authMethodNames()) {
		t.Errorf(
			"checklist offers %d methods, catalogue has %d",
			len(items),
			len(authMethodNames()),
		)
	}

	for i, m := range all {
		if items[i].Label != m.title {
			t.Errorf("item %d label = %q, want %q", i, items[i].Label, m.title)
		}
	}
}

// The default selection has to leave a fresh nhost.toml exactly as generated:
// that is what makes password-only the minimum rather than merely the smallest
// list.
func TestAuthMethodConfigureDefaultWritesNothing(t *testing.T) {
	t.Parallel()

	methods, err := parseAuthMethods(defaultAuthMethods)
	if err != nil {
		t.Fatalf("parseAuthMethods(%q): %v", defaultAuthMethods, err)
	}

	if got := authMethodConfigure(methods); len(got) != 0 {
		t.Errorf("default selection returned %d config mutators, want 0", len(got))
	}

	if got := manualAuthMethods(methods, nil); len(got) != 0 {
		t.Errorf("default selection asks the user to enable %v, want nothing", got)
	}
}

// Each enabler turns on the one method the backend ships disabled and leaves
// everything else in the default config alone.
func TestAuthMethodConfigure(t *testing.T) {
	t.Parallel()

	tests := []struct {
		value           string
		wantMutators    int
		wantPasswordles bool
		wantOTP         bool
		wantManual      []string
	}{
		{value: "password", wantMutators: 0, wantManual: nil},
		{
			value:           "password,magic-link",
			wantMutators:    1,
			wantPasswordles: true,
			wantManual:      []string{"magic-link"},
		},
		{value: "otp", wantMutators: 1, wantOTP: true, wantManual: []string{"otp"}},
		{
			value:           "password,magic-link,otp,oauth",
			wantMutators:    2,
			wantPasswordles: true,
			wantOTP:         true,
			wantManual:      []string{"magic-link", "otp"},
		},
		// OAuth needs provider credentials, so selecting it writes no config
		// and leaves nothing for the user to switch on either.
		{value: "password,oauth", wantMutators: 0, wantManual: nil},
	}

	for _, tt := range tests {
		t.Run(tt.value, func(t *testing.T) {
			t.Parallel()

			methods, err := parseAuthMethods(tt.value)
			if err != nil {
				t.Fatalf("parseAuthMethods(%q): %v", tt.value, err)
			}

			mutators := authMethodConfigure(methods)
			if len(mutators) != tt.wantMutators {
				t.Errorf("returned %d config mutators, want %d", len(mutators), tt.wantMutators)
			}

			cfg, err := nhostproject.DefaultConfig()
			if err != nil {
				t.Fatalf("DefaultConfig: %v", err)
			}

			passwordBefore := cfg.Auth.Method.EmailPassword

			for _, mutate := range mutators {
				mutate(cfg)
			}

			if got := enabledPasswordless(cfg); got != tt.wantPasswordles {
				t.Errorf("emailPasswordless enabled = %v, want %v", got, tt.wantPasswordles)
			}

			if got := enabledEmailOTP(cfg); got != tt.wantOTP {
				t.Errorf("otp.email enabled = %v, want %v", got, tt.wantOTP)
			}

			if cfg.Auth.Method.EmailPassword != passwordBefore {
				t.Error("emailPassword was touched; it is already on in a stock backend")
			}

			got := manualAuthMethods(methods, nil)
			if !equalStrings(got, tt.wantManual) {
				t.Errorf("manualAuthMethods = %v, want %v", got, tt.wantManual)
			}

			// What enable writes, enabled has to read back as on.
			if got := manualAuthMethods(methods, cfg); len(got) != 0 {
				t.Errorf("after configuring, %v still read as off", got)
			}
		})
	}
}

// manualAuthMethods asks enabled about every method enable can switch on, so
// a method carrying one without the other would panic there. Going over the
// whole catalogue catches one added since the cases above were written.
func TestSignInMethodsPairEnableWithEnabled(t *testing.T) {
	t.Parallel()

	for _, m := range signInMethods() {
		if (m.enable == nil) != (m.enabled == nil) {
			t.Errorf("%s: enable and enabled must be set together", m.name)
			continue
		}

		if m.enable == nil {
			continue
		}

		cfg, err := nhostproject.DefaultConfig()
		if err != nil {
			t.Fatalf("DefaultConfig: %v", err)
		}

		m.enable(cfg)

		if !m.enabled(cfg) {
			t.Errorf("%s: enabled does not read back what enable wrote", m.name)
		}
	}
}

// Only what the config leaves off is named, so a user whose backend already
// has a method on is not sent to switch it on again.
func TestManualAuthMethods(t *testing.T) {
	t.Parallel()

	withOTP := func(t *testing.T) *model.ConfigConfig {
		t.Helper()

		cfg, err := nhostproject.DefaultConfig()
		if err != nil {
			t.Fatalf("DefaultConfig: %v", err)
		}

		enableEmailOTP(cfg)

		return cfg
	}

	tests := []struct {
		name  string
		value string
		cfg   func(t *testing.T) *model.ConfigConfig
		want  []string
	}{
		{
			name:  "already on is not named",
			value: "password,magic-link,otp",
			cfg:   withOTP,
			want:  []string{"magic-link"},
		},
		{
			name:  "everything on names nothing",
			value: "otp",
			cfg:   withOTP,
			want:  nil,
		},
		{
			name:  "an unread config names every toggle",
			value: "password,magic-link,otp,oauth",
			cfg:   func(*testing.T) *model.ConfigConfig { return nil },
			want:  []string{"magic-link", "otp"},
		},
		{
			name:  "an empty config names every toggle",
			value: "magic-link,otp",
			cfg: func(*testing.T) *model.ConfigConfig {
				return &model.ConfigConfig{}
			},
			want: []string{"magic-link", "otp"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			methods, err := parseAuthMethods(tt.value)
			if err != nil {
				t.Fatalf("parseAuthMethods(%q): %v", tt.value, err)
			}

			got := manualAuthMethods(methods, tt.cfg(t))
			if !equalStrings(got, tt.want) {
				t.Errorf("manualAuthMethods = %v, want %v", got, tt.want)
			}
		})
	}
}

// The local overlay is part of what `nhost up` runs with, so a method it turns
// on counts as on.
func TestReadLocalConfigAppliesOverlay(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	ps := clienv.NewPathStructure(
		root, root, filepath.Join(root, ".nhost"), filepath.Join(root, "nhost"),
	)

	if err := os.MkdirAll(ps.OverlaysFolder(), 0o755); err != nil {
		t.Fatal(err)
	}

	cfg, err := nhostproject.DefaultConfig()
	if err != nil {
		t.Fatalf("DefaultConfig: %v", err)
	}

	if err := clienv.MarshalFile(
		cfg, ps.NhostToml(), toml.Marshal,
	); err != nil {
		t.Fatal(err)
	}

	patch := `[{"op": "replace",` +
		` "path": "/auth/method/emailPasswordless/enabled", "value": true}]`
	if err := os.WriteFile(
		ps.Overlay("local"), []byte(patch), 0o600,
	); err != nil {
		t.Fatal(err)
	}

	got, err := readLocalConfig(ps)
	if err != nil {
		t.Fatalf("readLocalConfig: %v", err)
	}

	if !magicLinkEnabled(got) {
		t.Error("the overlay turned magic link on, but it reads as off")
	}

	if emailOTPEnabled(got) {
		t.Error("otp reads as on, but neither file turns it on")
	}
}

func enabledPasswordless(cfg *model.ConfigConfig) bool {
	m := cfg.Auth.Method
	if m == nil || m.EmailPasswordless == nil || m.EmailPasswordless.Enabled == nil {
		return false
	}

	return *m.EmailPasswordless.Enabled
}

func enabledEmailOTP(cfg *model.ConfigConfig) bool {
	m := cfg.Auth.Method
	if m == nil || m.Otp == nil || m.Otp.Email == nil || m.Otp.Email.Enabled == nil {
		return false
	}

	return *m.Otp.Email.Enabled
}
