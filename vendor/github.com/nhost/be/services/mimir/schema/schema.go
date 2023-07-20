package schema

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	cuejson "cuelang.org/go/encoding/json"
	"github.com/nhost/be/services/mimir/model"
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

	return nil
}

// Validate the configuration and return a new configureation object with
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
