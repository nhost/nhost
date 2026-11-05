package schema

import (
	"encoding/json"
	"fmt"

	"cuelang.org/go/cue"
	"github.com/nhost/be/services/mimir/model"
)

// ApplyDefaults preserves existing values, even if they violate current schema
// constraints. Only available, concrete defaults are added. Writes must use Fill
// instead to validate the complete candidate configuration.
func (s *Schema) ApplyDefaults(config any) (*model.ConfigConfig, error) {
	return applyDefaults[model.ConfigConfig](s, config, "Config")
}

func (s *Schema) ApplySystemConfigDefaults(config any) (*model.ConfigSystemConfig, error) {
	return applyDefaults[model.ConfigSystemConfig](s, config, "SystemConfig")
}

func (s *Schema) ApplyRunServiceConfigDefaults(config any) (*model.ConfigRunServiceConfig, error) {
	return applyDefaults[model.ConfigRunServiceConfig](s, config, "RunServiceConfig")
}

func applyDefaults[T any](s *Schema, config any, name string) (*T, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	value, err := s.unify(config, name)
	if err != nil {
		return nil, err
	}

	raw, err := json.Marshal(config)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal config: %w", err)
	}

	data, err := mergeDefaults(*value, raw)
	if err != nil {
		return nil, err
	}

	var configWithDefaults T
	if err := json.Unmarshal(data, &configWithDefaults); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config with defaults: %w", err)
	}

	return &configWithDefaults, nil
}

// CUE retains accessible fields and their defaults even when another field or a
// hidden cross-field constraint is invalid. Walk those fields instead of
// marshaling the whole unified value, which would reject legacy configurations.
// Raw values always win; incomplete or invalid defaults are simply unavailable.
func mergeDefaults(value cue.Value, raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 || raw[0] == '{' {
		return mergeObjectDefaults(value, raw)
	}

	if raw[0] == '[' {
		return mergeListDefaults(value, raw)
	}

	return raw, nil
}

func mergeListDefaults(value cue.Value, raw json.RawMessage) (json.RawMessage, error) {
	var items []json.RawMessage
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil, fmt.Errorf("failed to unmarshal list: %w", err)
	}

	for i, item := range items {
		filled, err := mergeDefaults(value.LookupPath(cue.MakePath(cue.Index(i))), item)
		if err != nil {
			return nil, err
		}

		items[i] = filled
	}

	data, err := json.Marshal(items)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal list: %w", err)
	}

	return data, nil
}

func mergeObjectDefaults(value cue.Value, raw json.RawMessage) (json.RawMessage, error) {
	fields, err := value.Fields()
	if err != nil {
		if len(raw) != 0 {
			return raw, nil
		}

		// No concrete default (for example, a newly required secret).
		data, err := value.MarshalJSON()
		if err != nil {
			return nil, nil //nolint:nilerr
		}

		return data, nil
	}

	object := make(map[string]json.RawMessage)
	if len(raw) != 0 {
		if err := json.Unmarshal(raw, &object); err != nil {
			return nil, fmt.Errorf("failed to unmarshal object: %w", err)
		}
	}

	for fields.Next() {
		name := fields.Selector().Unquoted()

		filled, err := mergeDefaults(fields.Value(), object[name])
		if err != nil {
			return nil, err
		}

		if filled != nil {
			object[name] = filled
		}
	}

	data, err := json.Marshal(object)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal object: %w", err)
	}

	return data, nil
}
