package hasura

import (
	json "encoding/json/v2"
	"fmt"
)

// EnvValue represents a string value that can be specified directly or via an environment variable.
// YAML format:
//   - Direct value: "literal"
//   - From env: { from_env: "VAR_NAME" }
type EnvValue struct {
	Value   string `json:"-"                  yaml:"-"`
	FromEnv string `json:"from_env,omitempty" yaml:"from_env,omitempty"`
}

// UnmarshalYAML implements custom YAML unmarshaling to handle both plain strings and from_env mappings.
func (e *EnvValue) UnmarshalYAML(unmarshal func(any) error) error {
	// Try plain string first
	var s string
	if err := unmarshal(&s); err == nil {
		e.Value = s

		return nil
	}

	// Otherwise unmarshal as struct with from_env
	type raw EnvValue

	if err := unmarshal((*raw)(e)); err != nil {
		return fmt.Errorf("unmarshaling env value mapping: %w", err)
	}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle both plain strings and from_env mappings.
func (e *EnvValue) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		e.Value = s

		return nil
	}

	type raw EnvValue

	if err := json.Unmarshal(data, (*raw)(e)); err != nil {
		return fmt.Errorf("unmarshaling env value: %w", err)
	}

	return nil
}
