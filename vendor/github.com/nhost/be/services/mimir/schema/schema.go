package schema

import (
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
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
// enabled and a bundled service (auth or storage) also sets its own version or
// resources. The single engine binary has one version and one resources block
// (experimental.nhost.version and experimental.nhost.resources), so per-service
// values are incompatible and rejected. This must be checked on the raw input,
// before the schema applies defaults, because auth.version/storage.version have
// defaults and so are always populated afterwards.
var errNhostPerServiceVersionResources = errors.New(
	"experimental.nhost is enabled: auth and storage must not set their own " +
		"version or resources; the single engine binary uses " +
		"experimental.nhost.version and experimental.nhost.resources",
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

	if err := validateRawNhostConstraints(config); err != nil {
		return err
	}

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

	if err := validateRawNhostConstraints(config); err != nil {
		return nil, err
	}

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

// validateRawNhostConstraints enforces experimental.nhost rules that depend on
// whether the user explicitly set a field. It inspects the raw input before the
// schema applies defaults, so it navigates the config as a generic map rather
// than the typed model (whose defaulted values cannot reveal user intent).
func validateRawNhostConstraints(config any) error {
	b, err := json.Marshal(config)
	if err != nil {
		return fmt.Errorf("problem marshaling config: %w", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(b, &raw); err != nil {
		return fmt.Errorf("problem unmarshaling config: %w", err)
	}

	exp, _ := raw["experimental"].(map[string]any)
	if exp == nil {
		return nil
	}
	if nhost, ok := exp["nhost"]; !ok || nhost == nil {
		return nil
	}

	// auth and storage are bundled into the single binary, so their per-service
	// version/resources are incompatible with the one-binary approach. hasura is
	// deliberately excluded: it still runs as a standalone service.
	for _, svc := range []string{"auth", "storage"} {
		svcCfg, _ := raw[svc].(map[string]any)
		if svcCfg == nil {
			continue
		}
		if v, ok := svcCfg["version"]; ok && v != nil {
			return NewConfigNotValidError(errNhostPerServiceVersionResources)
		}
		if v, ok := svcCfg["resources"]; ok && v != nil {
			return NewConfigNotValidError(errNhostPerServiceVersionResources)
		}
	}

	return nil
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
