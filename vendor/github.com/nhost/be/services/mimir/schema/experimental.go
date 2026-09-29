// This file holds every rule specific to experimental.nhost, the single engine
// binary that bundles auth, storage and constellation. They live apart from the
// generic CUE plumbing in schema.go because they are policy rather than
// mechanism, and because they are expected to be removed or relaxed together
// once the engine stops being experimental.

package schema

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	"github.com/nhost/be/services/mimir/model"
)

// errEngineConstellationExclusive is returned when a config enables both
// experimental.nhost and experimental.constellation. They are mutually
// exclusive because the engine always runs constellation as its GraphQL engine.
// This cross-field rule is enforced here rather than in the CUE schema because a
// conditional on an optional field breaks cuegraph code generation.
var errEngineConstellationExclusive = errors.New(
	"experimental.nhost and experimental.constellation are mutually exclusive: " +
		"the nhost engine already runs constellation as its GraphQL engine",
)

// errEnginePerServiceVersionResources is returned when experimental.nhost is
// enabled and a bundled service sets an override that the single engine binary
// cannot honor. Auth networking remains supported because Factorio migrates its
// custom domains to the engine ingress. Default-valued fields are ignored so
// configurations returned by Fill can be submitted again unchanged.
var errEnginePerServiceVersionResources = errors.New(
	"experimental.nhost is enabled: non-default auth.version and " +
		"auth.resources.replicas, auth.resources.compute, auth.resources.autoscaler, " +
		"non-default storage.version, and storage.resources are not supported; " +
		"configure the engine version and sizing with experimental.nhost.version " +
		"and experimental.nhost.resources",
)

// errEngineResourcesNetworking is returned when the engine's shared resources
// block declares networking. A shared custom domain has no unambiguous bundled
// service target; auth custom domains remain declared under auth.resources.
var errEngineResourcesNetworking = errors.New(
	"experimental.nhost.resources.networking is not supported; declare auth " +
		"custom domains with auth.resources.networking",
)

var errEngineActivationRetainsOverrides = errors.New(
	"cannot enable experimental.nhost while retaining unsupported bundled-service settings; " +
		"set these fields to null before enabling the engine",
)

var errCUEDefaultNotFound = errors.New("CUE field has no default")

var errCUEDefaultOutOfRange = errors.New("CUE default is out of range for its Go type")

// validateConfigConstraints enforces cross-field rules that cannot be expressed
// in the CUE schema without breaking code generation.
func validateConfigConstraints(cfg *model.ConfigConfig) error {
	exp := cfg.GetExperimental()
	if exp.GetNhost() != nil && exp.GetConstellation() != nil {
		return NewConfigNotValidError(errEngineConstellationExclusive)
	}

	return nil
}

// ValidateConfigMutation enforces experimental.nhost constraints against only
// the fields supplied by a mutation. The complete config determines whether the
// engine is enabled, but defaults already stored in it never count as user intent.
//
// config is typed, unlike the any accepted by ValidateConfig, so that transposing
// the arguments is a compile error. A transposed call would otherwise fail OPEN:
// a mutation input rarely carries experimental.nhost, so it would take the early
// return below and report success while checking nothing.
func (s *Schema) ValidateConfigMutation(config *model.ConfigConfig, mutation any) error {
	if config.GetExperimental().GetNhost() == nil {
		return nil
	}

	mutated, err := configFromAny(mutation)
	if err != nil {
		return err
	}

	return validateEngineOverrides(mutated)
}

// ValidateEngineActivation rejects an off-to-on transition that would retain
// bundled-service resource settings the engine cannot honor. Stored auth and
// storage versions are ignored because they are inert once the engine is enabled
// and may reflect defaults from an older schema.
func (s *Schema) ValidateEngineActivation(oldConfig, newConfig *model.ConfigConfig) error {
	if oldConfig.GetExperimental().GetNhost() != nil ||
		newConfig.GetExperimental().GetNhost() == nil {
		return nil
	}

	overrides, err := engineActivationOverrides(newConfig)
	if err != nil {
		return err
	}

	if len(overrides) == 0 {
		return nil
	}

	return NewConfigNotValidError(fmt.Errorf(
		"%w: %s",
		errEngineActivationRetainsOverrides,
		formatEngineOverrides(overrides),
	))
}

// configFromAny reinterprets any config-shaped value as a *model.ConfigConfig so that
// one typed rule set can serve every caller. A mutation arrives as one of the
// generated input types, which are distinct structs that share ConfigConfig's JSON
// field names, so a round trip through JSON is what unifies them. Absent fields and
// explicit nulls both land as nil, which is exactly how the mutation boundary
// already treated them: neither counts as user intent.
//
// Because unknown field names are dropped silently rather than mismatched, this
// conversion is only safe while the input types keep those JSON names. That is
// asserted by TestMutationInputsSurviveConfigConversion.
func configFromAny(value any) (*model.ConfigConfig, error) {
	if cfg, ok := value.(*model.ConfigConfig); ok {
		return cfg, nil
	}

	b, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling config: %w", err)
	}

	var cfg model.ConfigConfig
	if err := json.Unmarshal(b, &cfg); err != nil {
		return nil, fmt.Errorf("problem unmarshaling config: %w", err)
	}

	return &cfg, nil
}

func validateEngineOverrides(cfg *model.ConfigConfig) error {
	overrides, err := enginePerServiceOverrides(cfg)
	if err != nil {
		return err
	}

	if len(overrides) != 0 {
		return NewConfigNotValidError(fmt.Errorf(
			"%w; unsupported values: %s",
			errEnginePerServiceVersionResources,
			formatEngineOverrides(overrides),
		))
	}

	if cfg.GetExperimental().GetNhost().GetResources().GetNetworking() != nil {
		return NewConfigNotValidError(errEngineResourcesNetworking)
	}

	return nil
}

type engineOverride struct {
	field string
	value any
}

// engineOverrideDefaults holds schema defaults typed to match the model fields they
// are compared against, so the comparison cannot silently fail across numeric
// representations the way an any-typed JSON value would.
type engineOverrideDefaults struct {
	authVersion      string
	storageVersion   string
	resourceReplicas uint8
}

//nolint:gochecknoglobals // Immutable schema defaults are compiled once at package initialization.
var engineDefaults, engineDefaultsErr = loadEngineOverrideDefaults()

func loadEngineOverrideDefaults() (engineOverrideDefaults, error) {
	v := cuecontext.New().CompileBytes(schemabytes)
	if v.Err() != nil {
		return engineOverrideDefaults{}, fmt.Errorf(
			"problem compiling cue schema for defaults: %w",
			v.Err(),
		)
	}

	authVersion, err := cueDefaultString(v, "#Auth.version")
	if err != nil {
		return engineOverrideDefaults{}, err
	}

	storageVersion, err := cueDefaultString(v, "#Storage.version")
	if err != nil {
		return engineOverrideDefaults{}, err
	}

	resourceReplicas, err := cueDefaultUint8(v, "#Resources.replicas")
	if err != nil {
		return engineOverrideDefaults{}, err
	}

	return engineOverrideDefaults{
		authVersion:      authVersion,
		storageVersion:   storageVersion,
		resourceReplicas: resourceReplicas,
	}, nil
}

func getEngineOverrideDefaults() (engineOverrideDefaults, error) {
	return engineDefaults, engineDefaultsErr
}

func cueDefault(v cue.Value, path string) (cue.Value, error) {
	field := v.LookupPath(cue.ParsePath(path))
	if field.Err() != nil {
		return cue.Value{}, fmt.Errorf("looking up CUE default %s: %w", path, field.Err())
	}

	defaultValue, ok := field.Default()
	if !ok {
		return cue.Value{}, fmt.Errorf("%w: %s", errCUEDefaultNotFound, path)
	}

	return defaultValue, nil
}

func cueDefaultString(v cue.Value, path string) (string, error) {
	defaultValue, err := cueDefault(v, path)
	if err != nil {
		return "", err
	}

	value, err := defaultValue.String()
	if err != nil {
		return "", fmt.Errorf("reading CUE default %s as string: %w", path, err)
	}

	return value, nil
}

func cueDefaultUint8(v cue.Value, path string) (uint8, error) {
	defaultValue, err := cueDefault(v, path)
	if err != nil {
		return 0, err
	}

	value, err := defaultValue.Uint64()
	if err != nil {
		return 0, fmt.Errorf("reading CUE default %s as uint: %w", path, err)
	}

	if value > math.MaxUint8 {
		return 0, fmt.Errorf("%w: %s is %d", errCUEDefaultOutOfRange, path, value)
	}

	return uint8(value), nil
}

// enginePerServiceOverrides identifies bundled-service settings that the single
// engine binary cannot honor. Auth networking remains supported because Factorio
// routes those domains to the engine, while Hasura is excluded because it still
// runs as a standalone service.
func enginePerServiceOverrides(cfg *model.ConfigConfig) ([]engineOverride, error) {
	return engineOverrides(cfg, true)
}

func engineActivationOverrides(cfg *model.ConfigConfig) ([]engineOverride, error) {
	return engineOverrides(cfg, false)
}

// engineOverrides excludes stored service versions from activation validation
// when includeVersions is false. Such versions can represent historical schema
// defaults and are inert after the engine takes over the bundled services.
func engineOverrides(cfg *model.ConfigConfig, includeVersions bool) ([]engineOverride, error) {
	defaults, err := getEngineOverrideDefaults()
	if err != nil {
		return nil, err
	}

	overrides := authEngineOverrides(cfg.GetAuth(), defaults, includeVersions)

	return append(
		overrides,
		storageEngineOverrides(cfg.GetStorage(), defaults, includeVersions)...,
	), nil
}

func authEngineOverrides(
	auth *model.ConfigAuth,
	defaults engineOverrideDefaults,
	includeVersion bool,
) []engineOverride {
	overrides := make([]engineOverride, 0)
	if version := auth.GetVersion(); includeVersion && version != nil &&
		*version != defaults.authVersion {
		overrides = append(overrides, engineOverride{field: "auth.version", value: *version})
	}

	resources := auth.GetResources()
	if compute := resources.GetCompute(); compute != nil {
		overrides = append(overrides, engineOverride{
			field: "auth.resources.compute",
			value: compute,
		})
	}

	if autoscaler := resources.GetAutoscaler(); autoscaler != nil {
		overrides = append(overrides, engineOverride{
			field: "auth.resources.autoscaler",
			value: autoscaler,
		})
	}

	if replicas := resources.GetReplicas(); replicas != nil &&
		*replicas != defaults.resourceReplicas {
		overrides = append(overrides, engineOverride{
			field: "auth.resources.replicas",
			value: *replicas,
		})
	}

	return overrides
}

func storageEngineOverrides(
	storage *model.ConfigStorage,
	defaults engineOverrideDefaults,
	includeVersion bool,
) []engineOverride {
	overrides := make([]engineOverride, 0)
	if version := storage.GetVersion(); includeVersion && version != nil &&
		*version != defaults.storageVersion {
		overrides = append(overrides, engineOverride{field: "storage.version", value: *version})
	}

	resources := storage.GetResources()
	if resources == nil {
		return overrides
	}

	// Storage networking is forbidden by #Storage.resources, so unlike auth
	// there is no supported resources sub-field to preserve. Any explicitly
	// retained storage resources block is therefore an unsupported override.
	overrides = append(overrides, engineOverride{
		field: "storage.resources",
		value: resources,
	})

	return overrides
}

func formatEngineOverrides(overrides []engineOverride) string {
	formatted := make([]string, 0, len(overrides))
	for _, override := range overrides {
		value, err := json.Marshal(override.value)
		if err != nil {
			formatted = append(formatted, fmt.Sprintf("%s=%v", override.field, override.value))

			continue
		}

		formatted = append(formatted, override.field+"="+string(value))
	}

	return strings.Join(formatted, ", ")
}
