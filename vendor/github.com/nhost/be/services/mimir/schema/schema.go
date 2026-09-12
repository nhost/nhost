package schema

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	cuejson "cuelang.org/go/encoding/json"
	"github.com/nhost/be/services/mimir/model"
)

// errNhostConstellationExclusive is returned when a config enables both
// experimental.nhost and experimental.constellation. They are mutually
// exclusive because the engine always runs constellation as its GraphQL engine.
// This cross-field rule is enforced here rather than in the CUE schema because a
// conditional on an optional field breaks cuegraph code generation.
var errNhostConstellationExclusive = errors.New(
	"experimental.nhost and experimental.constellation are mutually exclusive: " +
		"the nhost engine already runs constellation as its GraphQL engine",
)

// errNhostPerServiceVersionResources is returned when experimental.nhost is
// enabled and a bundled service sets an override that the single engine binary
// cannot honor. Auth networking remains supported because Factorio migrates its
// custom domains to the engine ingress. This must be checked on the raw input,
// before the schema applies defaults, because service versions and resource
// replicas have defaults and so are always populated afterwards.
var errNhostPerServiceVersionResources = errors.New(
	"experimental.nhost is enabled: auth.version, auth.resources.compute, " +
		"auth.resources.replicas, auth.resources.autoscaler, storage.version, " +
		"and storage.resources are not supported; configure the engine version " +
		"and sizing with experimental.nhost.version and experimental.nhost.resources",
)

// errNhostResourcesNetworking is returned when the engine's shared resources
// block declares networking. A shared custom domain has no unambiguous bundled
// service target; auth custom domains remain declared under auth.resources.
var errNhostResourcesNetworking = errors.New(
	"experimental.nhost.resources.networking is not supported; declare auth " +
		"custom domains with auth.resources.networking",
)

var errNhostActivationRetainsOverrides = errors.New(
	"cannot enable experimental.nhost while retaining unsupported bundled-service settings",
)

type ConfigNotValidError struct {
	err error
}

func NewConfigNotValidError(err error) error {
	return &ConfigNotValidError{err: err}
}

func (e *ConfigNotValidError) Error() string {
	if e.err == nil {
		return "config is not valid"
	}

	return "config is not valid: " + e.err.Error()
}

//go:embed schema.cue
var schemabytes []byte

type Schema struct {
	Value cue.Value
	mu    sync.Mutex
}

func New() (*Schema, error) {
	ctx := cuecontext.New()

	v := ctx.CompileBytes(schemabytes)
	if v.Err() != nil {
		return nil, fmt.Errorf("problem compiling cue schema: %w", v.Err())
	}

	return &Schema{
		Value: v,
		mu:    sync.Mutex{},
	}, nil
}

func (s *Schema) unify(config any, model string) (*cue.Value, error) {
	b, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling config: %w", err)
	}

	expr, err := cuejson.Extract(model, b)
	if err != nil {
		return nil, fmt.Errorf("problem extracting json: %w", err)
	}

	ctx := cuecontext.New()

	v := ctx.BuildExpr(expr)
	if v.Err() != nil {
		return nil, fmt.Errorf("problem building cue expression: %w", v.Err())
	}

	configSchema := s.Value.LookupPath(cue.ParsePath("#" + model))

	u := configSchema.Unify(v)
	if u.Err() != nil {
		return nil, NewConfigNotValidError(u.Err())
	}

	return &u, nil
}

func (s *Schema) ValidateConfig(config any) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.unify(config, "Config")
	if err != nil {
		return err
	}

	if err := u.Validate(cue.All(), cue.Concrete(true)); err != nil {
		return NewConfigNotValidError(err)
	}

	cfg, err := configFromValue(u)
	if err != nil {
		return err
	}

	return validateConfigConstraints(cfg)
}

// Fill validates the configuration and returns a new configuration object with
// the missing values set to their defaults.
func (s *Schema) Fill(config any) (*model.ConfigConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.unify(config, "Config")
	if err != nil {
		return nil, err
	}

	if err := u.Validate(cue.All(), cue.Concrete(true)); err != nil {
		return nil, NewConfigNotValidError(err)
	}

	merged, err := configFromValue(u)
	if err != nil {
		return nil, err
	}

	if err := validateConfigConstraints(merged); err != nil {
		return nil, err
	}

	return merged, nil
}

// configFromValue marshals a validated cue value into a ConfigConfig with
// defaults applied.
func configFromValue(u *cue.Value) (*model.ConfigConfig, error) {
	b, err := json.Marshal(u)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling cue value: %w", err)
	}

	var merged model.ConfigConfig
	if err := json.Unmarshal(b, &merged); err != nil {
		return nil, fmt.Errorf("problem unmarshaling cue value: %w", err)
	}

	return &merged, nil
}

// validateConfigConstraints enforces cross-field rules that cannot be expressed
// in the CUE schema without breaking code generation.
func validateConfigConstraints(cfg *model.ConfigConfig) error {
	exp := cfg.GetExperimental()
	if exp.GetNhost() != nil && exp.GetConstellation() != nil {
		return NewConfigNotValidError(errNhostConstellationExclusive)
	}

	return nil
}

// ValidateConfigMutation enforces experimental.nhost constraints against only
// the fields supplied by a mutation. The complete config determines whether the
// engine is enabled, but defaults already stored in it never count as user intent.
func ValidateConfigMutation(config, mutation any) error {
	rawConfig, err := rawConfigMap(config)
	if err != nil {
		return err
	}

	experimental, _ := rawConfig["experimental"].(map[string]any)
	if nhost, ok := experimental["nhost"]; !ok || nhost == nil {
		return nil
	}

	rawMutation, err := rawConfigMap(mutation)
	if err != nil {
		return err
	}

	mutationExperimental, _ := rawMutation["experimental"].(map[string]any)
	mutationNhost, _ := mutationExperimental["nhost"].(map[string]any)

	return validateRawNhostOverrides(rawMutation, mutationNhost)
}

// ValidateNhostActivation rejects an off-to-on transition that would retain
// bundled-service settings the engine cannot honor. It intentionally treats all
// structurally present values alike because stored CUE defaults have no reliable
// provenance information.
func ValidateNhostActivation(oldConfig, newConfig *model.ConfigConfig) error {
	if oldConfig.GetExperimental().GetNhost() != nil ||
		newConfig.GetExperimental().GetNhost() == nil {
		return nil
	}

	rawConfig, err := rawConfigMap(newConfig)
	if err != nil {
		return err
	}

	fields := nhostPerServiceOverrideFields(rawConfig)
	if len(fields) == 0 {
		return nil
	}

	return NewConfigNotValidError(fmt.Errorf(
		"%w: %s; remove these fields before enabling the engine",
		errNhostActivationRetainsOverrides,
		strings.Join(fields, ", "),
	))
}

func rawConfigMap(config any) (map[string]any, error) {
	b, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling config: %w", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		return nil, fmt.Errorf("problem unmarshaling config: %w", err)
	}

	return raw, nil
}

func validateRawNhostOverrides(raw, nhost map[string]any) error {
	if len(nhostPerServiceOverrideFields(raw)) != 0 {
		return NewConfigNotValidError(errNhostPerServiceVersionResources)
	}

	resources, _ := nhost["resources"].(map[string]any)
	if networking, ok := resources["networking"]; ok && networking != nil {
		return NewConfigNotValidError(errNhostResourcesNetworking)
	}

	return nil
}

// nhostPerServiceOverrideFields identifies bundled-service settings that the
// single engine binary cannot honor. Auth networking remains supported because
// Factorio routes those domains to the engine, while Hasura is excluded because
// it still runs as a standalone service.
func nhostPerServiceOverrideFields(raw map[string]any) []string {
	auth, _ := raw["auth"].(map[string]any)
	storage, _ := raw["storage"].(map[string]any)

	return append(authNhostOverrideFields(auth), storageNhostOverrideFields(storage)...)
}

func authNhostOverrideFields(auth map[string]any) []string {
	fields := make([]string, 0)
	if version, ok := auth["version"]; ok && version != nil {
		fields = append(fields, "auth.version")
	}

	resources, _ := auth["resources"].(map[string]any)
	for _, field := range []string{"compute", "replicas", "autoscaler"} {
		if value, ok := resources[field]; ok && value != nil {
			fields = append(fields, "auth.resources."+field)
		}
	}

	return fields
}

func storageNhostOverrideFields(storage map[string]any) []string {
	fields := make([]string, 0)
	if version, ok := storage["version"]; ok && version != nil {
		fields = append(fields, "storage.version")
	}

	if resources, ok := storage["resources"]; ok && resources != nil {
		fields = append(fields, "storage.resources")
	}

	return fields
}

func (s *Schema) ValidateSystemConfig(config any) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.unify(config, "SystemConfig")
	if err != nil {
		return err
	}

	if err := u.Validate(cue.All(), cue.Concrete(true)); err != nil {
		return NewConfigNotValidError(err)
	}

	return nil
}

func (s *Schema) FillSystemConfig(
	config any,
) (*model.ConfigSystemConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.unify(config, "SystemConfig")
	if err != nil {
		return nil, err
	}

	if err := u.Validate(cue.All(), cue.Concrete(true)); err != nil {
		return nil, NewConfigNotValidError(err)
	}

	b, err := json.Marshal(u)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling cue value: %w", err)
	}

	var merged model.ConfigSystemConfig
	if err := json.Unmarshal(b, &merged); err != nil {
		return nil, fmt.Errorf("problem unmarshaling cue value: %w", err)
	}

	return &merged, nil
}

func (s *Schema) FillRunServiceConfig(
	config any,
) (*model.ConfigRunServiceConfig, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	u, err := s.unify(config, "RunServiceConfig")
	if err != nil {
		return nil, err
	}

	if err := u.Validate(cue.All(), cue.Concrete(true)); err != nil {
		return nil, NewConfigNotValidError(err)
	}

	b, err := json.Marshal(u)
	if err != nil {
		return nil, fmt.Errorf("problem marshaling cue value: %w", err)
	}

	var merged model.ConfigRunServiceConfig
	if err := json.Unmarshal(b, &merged); err != nil {
		return nil, fmt.Errorf("problem unmarshaling cue value: %w", err)
	}

	return &merged, nil
}
