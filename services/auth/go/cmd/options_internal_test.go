package cmd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"reflect"
	"slices"
	"strconv"
	"testing"
	"time"

	"github.com/urfave/cli/v3"
)

// validTestOptions returns Options that pass Validate, for tests to adjust.
func validTestOptions() Options {
	var opts Options

	opts.EncryptionKey = "5bb16b3e1f0b4ee4e0b5ee7ac1dcd5d1e1c7bc0a6b2e0e4f3d2c1b0a99887766"
	opts.PostgresConnection = "postgres://postgres@localhost:5432/local"
	opts.HasuraGraphqlURL = "http://hasura:8080/v1/graphql"
	opts.JWT.Secret = `{"type":"HS256","key":"test-secret"}`
	opts.JWT.RequireElevatedClaim = "disabled"
	opts.Gravatar.Default = "blank"
	opts.Gravatar.Rating = "g"
	opts.SMTP.AuthMethod = "PLAIN"

	return opts
}

func TestOptionsValidate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		mutate  func(*Options)
		wantErr error
	}{
		{
			name:    "valid",
			mutate:  func(*Options) {},
			wantErr: nil,
		},
		{
			name:    "encryption key required",
			mutate:  func(o *Options) { o.EncryptionKey = "" },
			wantErr: errEncryptionKeyRequired,
		},
		{
			name:    "postgres connection required",
			mutate:  func(o *Options) { o.PostgresConnection = "" },
			wantErr: errPostgresConnectionRequired,
		},
		{
			name:    "hasura graphql url required",
			mutate:  func(o *Options) { o.HasuraGraphqlURL = "" },
			wantErr: errHasuraGraphqlURLRequired,
		},
		{
			name:    "jwt secret required",
			mutate:  func(o *Options) { o.JWT.Secret = "" },
			wantErr: errJWTSecretRequired,
		},
		{
			name:    "gravatar default must be allowed",
			mutate:  func(o *Options) { o.Gravatar.Default = "unknown" },
			wantErr: errInvalidEnumValue,
		},
		{
			name:    "gravatar rating must be allowed",
			mutate:  func(o *Options) { o.Gravatar.Rating = "" },
			wantErr: errInvalidEnumValue,
		},
		{
			name:    "smtp auth method must be allowed",
			mutate:  func(o *Options) { o.SMTP.AuthMethod = "plain" },
			wantErr: errInvalidEnumValue,
		},
		{
			name:    "elevated claim setting must be allowed",
			mutate:  func(o *Options) { o.JWT.RequireElevatedClaim = "always" },
			wantErr: errInvalidEnumValue,
		},
		{
			name: "oauth2 provider falls back to the client url for login",
			mutate: func(o *Options) {
				o.ClientURL = "https://app.example.com"
				o.OAuth2Provider = OAuth2ProviderOptions{
					Enabled: true, AccessTokenTTL: 900, RefreshTokenTTL: 3600,
				}
			},
			wantErr: nil,
		},
		{
			name: "oauth2 provider needs a login url",
			mutate: func(o *Options) {
				o.OAuth2Provider = OAuth2ProviderOptions{
					Enabled: true, AccessTokenTTL: 900, RefreshTokenTTL: 3600,
				}
			},
			wantErr: errOAuth2LoginURLRequired,
		},
		{
			name: "oauth2 provider needs a positive access token ttl",
			mutate: func(o *Options) {
				o.OAuth2Provider = OAuth2ProviderOptions{
					Enabled: true, LoginURL: "https://app.example.com/login", RefreshTokenTTL: 3600,
				}
			},
			wantErr: errOAuth2TTLNotPositive,
		},
		{
			name: "oauth2 provider needs a positive refresh token ttl",
			mutate: func(o *Options) {
				o.OAuth2Provider = OAuth2ProviderOptions{
					Enabled: true, LoginURL: "https://app.example.com/login", AccessTokenTTL: 900,
				}
			},
			wantErr: errOAuth2TTLNotPositive,
		},
		{
			name:    "oauth2 provider settings are ignored when disabled",
			mutate:  func(o *Options) { o.OAuth2Provider.AccessTokenTTL = -1 },
			wantErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			opts := validTestOptions()
			tt.mutate(&opts)

			err := opts.Validate()
			if tt.wantErr == nil {
				if err != nil {
					t.Fatalf("Validate() = %v, want nil", err)
				}

				return
			}

			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("Validate() = %v, want wrapping %v", err, tt.wantErr)
			}
		})
	}
}

func TestOptionsValidateReportsEveryProblem(t *testing.T) {
	t.Parallel()

	opts := validTestOptions()
	opts.EncryptionKey = ""
	opts.JWT.Secret = ""
	opts.SMTP.AuthMethod = ""

	err := opts.Validate()

	for _, want := range []error{
		errEncryptionKeyRequired,
		errJWTSecretRequired,
		errInvalidEnumValue,
	} {
		if !errors.Is(err, want) {
			t.Errorf("Validate() = %v, want wrapping %v", err, want)
		}
	}
}

// NewService validates its Options before acquiring anything, so invalid ones
// fail without reaching PostgreSQL or Hasura.
func TestNewServiceRejectsInvalidOptions(t *testing.T) {
	t.Parallel()

	opts := validTestOptions()
	opts.PostgresConnection = ""

	svc, err := NewService(context.Background(), opts, slog.New(slog.DiscardHandler))
	if svc != nil {
		t.Fatal("NewService with invalid options returned a service")
	}

	if !errors.Is(err, errPostgresConnectionRequired) {
		t.Fatalf("NewService error = %v, want wrapping %v", err, errPostgresConnectionRequired)
	}
}

// listenerFlags configure the process rather than the service, so they have no
// Options field.
func listenerFlags() []string { return []string{flagPort, flagDebug, flagLogFormatTEXT} }

// runOptionsFromCommand resolves args against the serve command's flags, with
// their environment sources cleared, and returns the Options they map to.
func runOptionsFromCommand(t *testing.T, args ...string) Options {
	t.Helper()

	var opts Options

	flags := CommandServe().Flags
	for _, flag := range flags {
		clearFlagSourcesForTest(t, flag)
	}

	cmd := &cli.Command{
		Name:    "serve",
		Version: "1.2.3",
		Flags:   flags,
		Action: func(_ context.Context, cmd *cli.Command) error {
			opts = OptionsFromCommand(cmd)

			return nil
		},
	}

	if err := cmd.Run(context.Background(), append([]string{"serve"}, args...)); err != nil {
		t.Fatalf("running cli: %v", err)
	}

	return opts
}

func clearFlagSourcesForTest(t *testing.T, flag cli.Flag) {
	t.Helper()

	switch typedFlag := flag.(type) {
	case *cli.BoolFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.IntFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.UintFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.DurationFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.StringFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.StringSliceFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	case *cli.GenericFlag:
		typedFlag.Sources = cli.ValueSourceChain{}
	default:
		t.Fatalf("clearing env sources for %v: unsupported flag type %T", flag.Names(), flag)
	}
}

// distinctFlagArgs sets every service flag to a value no other flag gets:
// strings carry the flag's name, numbers and durations its position, and enums
// their last allowed value, which is never the default.
func distinctFlagArgs(t *testing.T) []string {
	t.Helper()

	var args []string

	for i, flag := range CommandServe().Flags {
		name := flag.Names()[0]
		if slices.Contains(listenerFlags(), name) {
			continue
		}

		n := strconv.Itoa(i + 1)

		switch typedFlag := flag.(type) {
		case *cli.BoolFlag:
			args = append(args, "--"+name)
		case *cli.IntFlag, *cli.UintFlag:
			args = append(args, "--"+name, n)
		case *cli.DurationFlag:
			args = append(args, "--"+name, n+"s")
		case *cli.StringFlag, *cli.StringSliceFlag:
			args = append(args, "--"+name, "v-"+name)
		case *cli.GenericFlag:
			enum, ok := typedFlag.Value.(*EnumValue)
			if !ok {
				t.Fatalf("flag %s: unsupported generic value %T", name, typedFlag.Value)
			}

			args = append(args, "--"+name, enum.Enum[len(enum.Enum)-1])
		default:
			t.Fatalf("flag %s: unsupported flag type %T", name, flag)
		}
	}

	return args
}

// optionLeaves flattens v into its leaf fields keyed by dotted path. Embedded
// structs are flattened into their parent, as Go promotes their fields.
func optionLeaves(v reflect.Value, prefix string, leaves map[string]reflect.Value) {
	for i := range v.NumField() {
		field := v.Type().Field(i)
		value := v.Field(i)

		path := prefix + field.Name
		if field.Anonymous {
			path = prefix
		}

		if value.Kind() == reflect.Struct {
			if !field.Anonymous {
				path += "."
			}

			optionLeaves(value, path, leaves)

			continue
		}

		leaves[path] = value
	}
}

// Every flag the serve command defines must land in its own Options field:
// setting each flag to a distinct value must leave no field zero and no two
// fields equal.
func TestOptionsFromCommandMapsEveryFlag(t *testing.T) {
	t.Parallel()

	// Known to stay zero whatever the flags say, preserving behavior from
	// before Options. Both are TODOs in OptionsFromCommand; drop
	// them from this list once fixed:
	//   - the attestation timeout flag is an IntFlag of milliseconds that has
	//     always been read as a duration, which yields 0 and leaves the
	//     WebAuthn library's default in force;
	//   - WorkOS has no scope flag, so it always uses its default scopes.
	alwaysZero := []string{"Webauthn.AttestationTimeout", "Providers.Workos.Scope"}

	got := runOptionsFromCommand(t, distinctFlagArgs(t)...)

	leaves := map[string]reflect.Value{}
	optionLeaves(reflect.ValueOf(got), "", leaves)

	seen := map[string]string{}

	for path, value := range leaves {
		if slices.Contains(alwaysZero, path) {
			if !value.IsZero() {
				t.Errorf("%s = %v, expected to stay zero; update alwaysZero", path, value)
			}

			continue
		}

		if value.IsZero() {
			t.Errorf("%s is zero: no flag maps to it", path)

			continue
		}

		if value.Kind() == reflect.Bool {
			continue
		}

		key := fmt.Sprintf("%v", value.Interface())
		if value.Type() == reflect.TypeFor[time.Duration]() {
			key = "duration " + key
		}

		if other, ok := seen[key]; ok {
			t.Errorf("%s and %s both hold %s: they read the same flag", path, other, key)
		}

		seen[key] = path
	}

	if got.Version != "1.2.3" {
		t.Errorf("Version = %q, want the command's version", got.Version)
	}

	if err := got.Validate(); err != nil {
		t.Errorf("fully configured options do not validate: %v", err)
	}
}

// The flag defaults must satisfy Validate once the settings without a usable
// default are provided, so a standalone auth needs nothing more.
func TestOptionsFromCommandDefaultsValidate(t *testing.T) {
	t.Parallel()

	got := runOptionsFromCommand(
		t,
		"--"+flagEncryptionKey, "key",
		"--"+flagGraphqlURL, "http://hasura:8080/v1/graphql",
		"--"+flagHasuraGraphqlJWTSecret, `{"type":"HS256","key":"secret"}`,
	)

	if err := got.Validate(); err != nil {
		t.Fatalf("default options do not validate: %v", err)
	}
}
