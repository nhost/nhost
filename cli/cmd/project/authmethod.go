package project

import (
	"errors"
	"fmt"
	"strings"

	"github.com/nhost/be/services/mimir/model"
	"github.com/nhost/nhost/cli/clienv"
	"github.com/nhost/nhost/cli/cmd/config"
	"github.com/pelletier/go-toml/v2"
	"github.com/urfave/cli/v3"
)

const (
	flagAuthMethods = "auth-methods"

	// defaultAuthMethods is the smallest set that works on a stock backend:
	// password is the one method nhost.toml ships enabled, so scaffolding it
	// alone leaves the configuration untouched.
	defaultAuthMethods = "password"
)

var (
	errUnknownAuthMethod = errors.New("unknown sign-in method")
	errNoAuthMethods     = errors.New("no sign-in methods given")

	errAuthMethodsNeedTemplate = errors.New(
		"--auth-methods selects what a template scaffolds, so it needs --template",
	)
)

// signInMethod is one of the sign-in methods a template ships. name is both
// what --auth-methods takes and the directory under the template's own
// authDir, so a selection maps to files without a second table to keep in
// step. The catalogue is shared by every template, which is why a template
// added later owes the same four directories.
type signInMethod struct {
	name  string
	href  string
	title string
	// description is the sentence the finished app puts on the method's card.
	// The picker shows the title alone.
	description string
	// enable turns the method on in a freshly generated nhost.toml, and is nil
	// when no configuration the CLI can write makes the method work: password
	// is already enabled in a stock backend, and OAuth needs provider
	// credentials nothing here can supply.
	enable func(*model.ConfigConfig)
	// enabled reports whether a config already has what enable writes, and is
	// nil exactly when enable is.
	enabled func(*model.ConfigConfig) bool
}

// signInMethods lists the methods in the order the sign-in page offers them,
// which is also the order resolveAuthMethods returns and methods.ts records.
// Ordering by the catalogue rather than by what was typed keeps the generated
// file identical for every spelling of the same selection.
func signInMethods() []signInMethod {
	return []signInMethod{
		{
			name:        "password",
			href:        "/auth/password",
			title:       "Email and password",
			description: "Sign up or sign in with a password.",
			enable:      nil,
			enabled:     nil,
		},
		{
			name:        "magic-link",
			href:        "/auth/magic-link",
			title:       "Magic link",
			description: "Get a sign-in link by email.",
			enable:      enableMagicLink,
			enabled:     magicLinkEnabled,
		},
		{
			name:        "otp",
			href:        "/auth/otp",
			title:       "Email code",
			description: "Get a one-time code by email.",
			enable:      enableEmailOTP,
			enabled:     emailOTPEnabled,
		},
		{
			name:        "oauth",
			href:        "/auth/oauth",
			title:       "GitHub or Google",
			description: "Sign in with a provider account.",
			enable:      nil,
			enabled:     nil,
		},
	}
}

func authMethodNames() []string {
	all := signInMethods()
	names := make([]string, 0, len(all))

	for _, m := range all {
		names = append(names, m.name)
	}

	return names
}

// authMethodsUsage is the flag's help line, naming the methods from the
// catalogue so a method added there is offered without a second edit.
//
// The backticks are urfave's placeholder syntax rather than Markdown: the first
// quoted span becomes the flag's value name in help and is left bare where it
// appears in the sentence. Only LIST may carry them, or the flag renders as its
// own usage text.
func authMethodsUsage() string {
	return "Sign-in methods to scaffold, comma separated. `LIST` is any of: " +
		strings.Join(authMethodNames(), ", ")
}

// resolveAuthMethods returns the methods to scaffold. The flag only means
// something alongside a template, so giving it without one is refused rather
// than quietly ignored.
//
// asked says the template itself was chosen by answering a question, in which
// case the methods are asked for too rather than defaulted silently: someone
// being asked what to build is the one person who has not already said.
func resolveAuthMethods(
	ce *clienv.CliEnv,
	cmd *cli.Command,
	template string,
	asked bool,
) ([]signInMethod, error) {
	if template == "" {
		if cmd.IsSet(flagAuthMethods) {
			return nil, errAuthMethodsNeedTemplate
		}

		return nil, nil
	}

	methods, err := parseAuthMethods(cmd.String(flagAuthMethods))
	if err != nil {
		return nil, err
	}

	if asked && !cmd.IsSet(flagAuthMethods) {
		return pickAuthMethods(ce, methods)
	}

	return methods, nil
}

// pickAuthMethods asks which sign-in methods to scaffold, opening with the
// given selection already checked.
func pickAuthMethods(ce *clienv.CliEnv, defaults []signInMethod) ([]signInMethod, error) {
	all := signInMethods()

	chosen := make(map[string]bool, len(defaults))
	for _, m := range defaults {
		chosen[m.name] = true
	}

	items := make([]pickerItem, 0, len(all))
	checked := make([]bool, 0, len(all))

	for _, m := range all {
		items = append(items, pickerItem{Label: m.title})
		checked = append(checked, chosen[m.name])
	}

	picked, err := promptPickMulti(ce, "Sign-in methods", items, checked)
	if err != nil {
		return nil, err
	}

	methods := make([]signInMethod, 0, len(all))

	for i, m := range all {
		if picked[i] {
			methods = append(methods, m)
		}
	}

	return methods, nil
}

// parseAuthMethods turns the comma-separated flag value into methods in
// catalogue order, refusing a name no template ships and a selection that
// would leave the sign-in page with nothing to offer.
func parseAuthMethods(value string) ([]signInMethod, error) {
	chosen := make(map[string]bool, len(signInMethods()))

	for field := range strings.SplitSeq(value, ",") {
		name := strings.TrimSpace(field)
		if name == "" {
			continue
		}

		if _, ok := lookupAuthMethod(name); !ok {
			return nil, fmt.Errorf(
				"%w %q; available: %s",
				errUnknownAuthMethod, name, strings.Join(authMethodNames(), ", "),
			)
		}

		chosen[name] = true
	}

	if len(chosen) == 0 {
		return nil, fmt.Errorf(
			"%w; pick from: %s", errNoAuthMethods, strings.Join(authMethodNames(), ", "),
		)
	}

	methods := make([]signInMethod, 0, len(chosen))

	for _, m := range signInMethods() {
		if chosen[m.name] {
			methods = append(methods, m)
		}
	}

	return methods, nil
}

func lookupAuthMethod(name string) (signInMethod, bool) {
	for _, m := range signInMethods() {
		if m.name == name {
			return m, true
		}
	}

	return signInMethod{}, false //nolint:exhaustruct // zero value on the not-found path
}

// authMethodConfigure is the configuration a selection needs on a fresh
// backend, as the variadic argument InitConfigAndSecrets takes. The default
// selection returns nothing, so scaffolding it writes no configuration at all.
func authMethodConfigure(methods []signInMethod) []func(*model.ConfigConfig) {
	enablers := make([]func(*model.ConfigConfig), 0, len(methods))

	for _, m := range methods {
		if m.enable != nil {
			enablers = append(enablers, m.enable)
		}
	}

	return enablers
}

// manualAuthMethods are the selected methods that need a setting cfg leaves
// off, which is what the next steps name when init did not write the config
// itself. A nil cfg, one that could not be read, names every method that needs
// a setting, since none of them can be shown to be on.
func manualAuthMethods(
	methods []signInMethod,
	cfg *model.ConfigConfig,
) []string {
	names := make([]string, 0, len(methods))

	for _, m := range methods {
		if m.enable == nil || (cfg != nil && m.enabled(cfg)) {
			continue
		}

		names = append(names, m.name)
	}

	return names
}

// configToAdd is what the scaffolded app needs from the project's config and
// does not find there, for the next steps to name.
type configToAdd struct {
	// methods are the selected sign-in methods the config leaves off.
	methods []string
	// redirects are the template's redirect targets the config does not allow.
	redirects []string
	// localRedirects are those the local backend alone should allow.
	localRedirects []string
}

// missingConfig reads what the project's config still lacks for the template
// and the selected methods. A config init wrote itself lacks nothing.
func missingConfig(
	ce *clienv.CliEnv,
	template string,
	methods []signInMethod,
	wroteConfig bool,
) configToAdd {
	if wroteConfig {
		return configToAdd{methods: nil, redirects: nil, localRedirects: nil}
	}

	cfg, err := readLocalConfig(ce.Path)
	if err != nil {
		ce.Warnln("Could not check what the configuration already has: %v", err)
	}

	tmpl, _ := lookupTemplate(template)

	return configToAdd{
		methods:        manualAuthMethods(methods, cfg),
		redirects:      missingRedirects(tmpl.redirectURLs, cfg),
		localRedirects: missingRedirects(tmpl.localRedirectURLs, cfg),
	}
}

// readLocalConfig reads nhost.toml with the overlay `nhost up` applies on top,
// which together are the configuration the local backend runs with.
func readLocalConfig(ps *clienv.PathStructure) (*model.ConfigConfig, error) {
	cfg := &model.ConfigConfig{} //nolint:exhaustruct // external type
	if err := clienv.UnmarshalFile(
		ps.NhostToml(), cfg, toml.Unmarshal,
	); err != nil {
		return nil, fmt.Errorf("reading %s: %w", ps.NhostToml(), err)
	}

	overlay := ps.Overlay("local")
	if !clienv.PathExists(overlay) {
		return cfg, nil
	}

	cfg, err := config.ApplyJSONPatches(*cfg, overlay)
	if err != nil {
		return nil, fmt.Errorf("applying %s: %w", overlay, err)
	}

	return cfg, nil
}

// authMethod returns the config's auth method section, creating the structs
// above it that a default config leaves unset.
func authMethod(cfg *model.ConfigConfig) *model.ConfigAuthMethod {
	if cfg.Auth == nil {
		cfg.Auth = &model.ConfigAuth{} //nolint:exhaustruct // external type, filled below
	}

	if cfg.Auth.Method == nil {
		cfg.Auth.Method = &model.ConfigAuthMethod{} //nolint:exhaustruct // external type
	}

	return cfg.Auth.Method
}

// enableMagicLink turns on the emailed sign-in link, which a stock backend
// ships disabled.
func enableMagicLink(cfg *model.ConfigConfig) {
	method := authMethod(cfg)

	if method.EmailPasswordless == nil {
		method.EmailPasswordless = &model.ConfigAuthMethodEmailPasswordless{} //nolint:exhaustruct // external type
	}

	enabled := true
	method.EmailPasswordless.Enabled = &enabled
}

func magicLinkEnabled(cfg *model.ConfigConfig) bool {
	on := cfg.GetAuth().GetMethod().GetEmailPasswordless().GetEnabled()

	return on != nil && *on
}

// enableEmailOTP turns on the emailed one-time code, which a stock backend
// ships disabled.
func enableEmailOTP(cfg *model.ConfigConfig) {
	method := authMethod(cfg)

	if method.Otp == nil {
		method.Otp = &model.ConfigAuthMethodOtp{} //nolint:exhaustruct // external type
	}

	if method.Otp.Email == nil {
		method.Otp.Email = &model.ConfigAuthMethodOtpEmail{} //nolint:exhaustruct // external type
	}

	enabled := true
	method.Otp.Email.Enabled = &enabled
}

func emailOTPEnabled(cfg *model.ConfigConfig) bool {
	on := cfg.GetAuth().GetMethod().GetOtp().GetEmail().GetEnabled()

	return on != nil && *on
}
