package hasura

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
)

// Action operation type values used by Hasura action definitions.
const (
	// ActionOperationQuery exposes the action under the query root.
	ActionOperationQuery = "query"
	// ActionOperationMutation exposes the action under the mutation root.
	ActionOperationMutation = "mutation"
)

// Action execution kind values used by Hasura action definitions.
const (
	// ActionKindSynchronous executes the webhook during the GraphQL request.
	ActionKindSynchronous = "synchronous"
	// ActionKindAsynchronous enqueues the action and returns an action log UUID.
	ActionKindAsynchronous = "asynchronous"
)

// ActionMetadata describes one Hasura Action in YAML or JSON metadata.
type ActionMetadata struct {
	Name        string             `json:"name"                  yaml:"name"`
	Definition  ActionDefinition   `json:"definition"            yaml:"definition"`
	Permissions []ActionPermission `json:"permissions,omitempty" yaml:"permissions,omitempty"`
	Comment     string             `json:"comment,omitempty"     yaml:"comment,omitempty"`
	// Unknown captures keys the engine does not model so they survive a
	// FromJSON ∘ ToJSON round-trip, mirroring the database/table/function wire
	// types. yaml:"-" keeps it out of the YAML file source.
	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// ActionDefinition captures Hasura's action definition block. In file-mode
// metadata, Type, Arguments, and OutputType are usually supplied by
// actions.graphql and merged after actions.yaml is decoded.
type ActionDefinition struct {
	Kind                 string           `json:"kind,omitempty"                   yaml:"kind,omitempty"`
	Handler              string           `json:"handler"                          yaml:"handler"`
	ForwardClientHeaders bool             `json:"forward_client_headers,omitempty" yaml:"forward_client_headers,omitempty"` //nolint:lll
	Headers              []ActionHeader   `json:"headers,omitempty"                yaml:"headers,omitempty"`
	Timeout              int              `json:"timeout,omitempty"                yaml:"timeout,omitempty"`
	Type                 string           `json:"type,omitempty"                   yaml:"type,omitempty"`
	Arguments            []ActionArgument `json:"arguments,omitempty"              yaml:"arguments,omitempty"`
	OutputType           string           `json:"output_type,omitempty"            yaml:"output_type,omitempty"`
	RequestTransform     map[string]any   `json:"request_transform,omitempty"      yaml:"request_transform,omitempty"`
	ResponseTransform    map[string]any   `json:"response_transform,omitempty"     yaml:"response_transform,omitempty"`
	Unknown              jsontext.Value   `json:",unknown"                         yaml:"-"`
}

// ActionArgument defines one GraphQL argument accepted by an action root field.
type ActionArgument struct {
	Name        string         `json:"name"                  yaml:"name"`
	Type        string         `json:"type"                  yaml:"type"`
	Description string         `json:"description,omitempty" yaml:"description,omitempty"`
	Unknown     jsontext.Value `json:",unknown"              yaml:"-"`
}

// ActionHeader defines a static header Hasura attaches to an action webhook.
type ActionHeader struct {
	Name  string   `json:"name" yaml:"name"`
	Value EnvValue `json:"-"    yaml:"-"`
}

// EnvValue is the normalized form of a Hasura header value, which is encoded on
// the wire as sibling `value` / `value_from_env` keys (a literal or an
// environment-variable reference). It is an internal holder populated by the
// ActionHeader (un)marshalers; the canonical wire schemas live in the generated
// api package (HeaderConfValue / HeaderConfFromEnv).
type EnvValue struct {
	Value   string
	FromEnv string
}

// UnmarshalYAML implements custom YAML unmarshaling to handle Hasura's action
// header format, where value and value_from_env are sibling fields.
func (h *ActionHeader) UnmarshalYAML(unmarshal func(any) error) error {
	var raw struct {
		Name         string `yaml:"name"`
		Value        string `yaml:"value,omitempty"`
		ValueFromEnv string `yaml:"value_from_env,omitempty"`
	}

	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling action header: %w", err)
	}

	h.Name = raw.Name
	h.Value = EnvValue{Value: raw.Value, FromEnv: raw.ValueFromEnv}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle Hasura's action
// header format, where value and value_from_env are sibling fields.
func (h *ActionHeader) UnmarshalJSON(data []byte) error {
	var raw struct {
		Name         string `json:"name"`
		Value        string `json:"value,omitempty"`
		ValueFromEnv string `json:"value_from_env,omitempty"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling action header: %w", err)
	}

	h.Name = raw.Name
	h.Value = EnvValue{Value: raw.Value, FromEnv: raw.ValueFromEnv}

	return nil
}

// MarshalJSON emits Hasura's action header format (sibling value /
// value_from_env keys). Without it the json:"-" Value field would be dropped,
// silently stripping webhook headers when an action is persisted as JSON (e.g.
// through the Postgres metadata source).
func (h ActionHeader) MarshalJSON() ([]byte, error) {
	raw := struct {
		Name         string `json:"name"`
		Value        string `json:"value,omitempty"`
		ValueFromEnv string `json:"value_from_env,omitempty"`
	}{
		Name:         h.Name,
		Value:        h.Value.Value,
		ValueFromEnv: h.Value.FromEnv,
	}

	out, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("marshaling action header: %w", err)
	}

	return out, nil
}

// MarshalYAML mirrors [ActionHeader.MarshalJSON] for the YAML file source.
func (h ActionHeader) MarshalYAML() (any, error) {
	return struct {
		Name         string `yaml:"name"`
		Value        string `yaml:"value,omitempty"`
		ValueFromEnv string `yaml:"value_from_env,omitempty"`
	}{
		Name:         h.Name,
		Value:        h.Value.Value,
		ValueFromEnv: h.Value.FromEnv,
	}, nil
}

// ActionPermission grants a role access to an action. Unmodeled keys such as
// Hasura's `comment` are captured in Unknown so they round-trip.
type ActionPermission struct {
	Role    string         `json:"role"     yaml:"role"`
	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}
