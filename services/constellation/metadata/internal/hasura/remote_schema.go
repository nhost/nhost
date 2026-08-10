package hasura

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
)

// RemoteSchemaMetadata contains the metadata for a remote GraphQL schema.
type RemoteSchemaMetadata struct {
	Name                string                               `json:"name"                           yaml:"name"`
	Definition          RemoteSchemaDefinition               `json:"definition"                     yaml:"definition"`
	Comment             string                               `json:"comment,omitempty"              yaml:"comment,omitempty"`              //nolint:lll
	Permissions         []RemoteSchemaPermission             `json:"permissions,omitempty"          yaml:"permissions,omitempty"`          //nolint:lll
	RemoteRelationships []RemoteSchemaTypeRemoteRelationship `json:"remote_relationships,omitempty" yaml:"remote_relationships,omitempty"` //nolint:lll

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaTypeRemoteRelationship maps a type name to its remote relationships.
type RemoteSchemaTypeRemoteRelationship struct {
	TypeName      string                        `json:"type_name"     yaml:"type_name"`
	Relationships []RemoteSchemaRelationshipDef `json:"relationships" yaml:"relationships"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaRelationshipDef defines a remote relationship from a remote schema type.
type RemoteSchemaRelationshipDef struct {
	Name       string                             `json:"name"       yaml:"name"`
	Definition RemoteSchemaRelationshipDefinition `json:"definition" yaml:"definition"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaRelationshipDefinition contains the relationship definition.
type RemoteSchemaRelationshipDefinition struct {
	ToSource *RemoteSchemaToSourceRelationship `json:"to_source,omitempty" yaml:"to_source,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaToSourceRelationship defines a relationship from a remote schema to a database.
type RemoteSchemaToSourceRelationship struct {
	FieldMapping     map[string]string    `json:"field_mapping"     yaml:"field_mapping"`
	RelationshipType string               `json:"relationship_type" yaml:"relationship_type"`
	Source           string               `json:"source"            yaml:"source"`
	Table            RemoteSchemaTableRef `json:"table"             yaml:"table"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaTableRef references a table in a database.
type RemoteSchemaTableRef struct {
	Name   string `json:"name"   yaml:"name"`
	Schema string `json:"schema" yaml:"schema"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaDefinition defines the connection settings for a remote schema.
type RemoteSchemaDefinition struct {
	URL                  string                    `json:"url,omitempty"                    yaml:"url,omitempty"`                    //nolint:lll
	URLFromEnv           string                    `json:"url_from_env,omitempty"           yaml:"url_from_env,omitempty"`           //nolint:lll
	TimeoutSeconds       int                       `json:"timeout_seconds,omitempty"        yaml:"timeout_seconds,omitempty"`        //nolint:lll
	Customization        RemoteSchemaCustomization `json:"customization"                    yaml:"customization"`                    //nolint:lll
	Headers              []RemoteSchemaHeader      `json:"headers,omitempty"                yaml:"headers,omitempty"`                //nolint:lll
	ForwardClientHeaders bool                      `json:"forward_client_headers,omitempty" yaml:"forward_client_headers,omitempty"` //nolint:lll

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaHeader defines a header to be sent with requests to the remote schema.
type RemoteSchemaHeader struct {
	Name  string   `json:"name" yaml:"name"`
	Value EnvValue `json:"-"    yaml:"-"`
}

// UnmarshalYAML implements custom YAML unmarshaling to handle Hasura's header format
// where value and value_from_env are sibling fields.
func (h *RemoteSchemaHeader) UnmarshalYAML(unmarshal func(any) error) error {
	var raw struct {
		Name         string `yaml:"name"`
		Value        string `yaml:"value,omitempty"`
		ValueFromEnv string `yaml:"value_from_env,omitempty"`
	}

	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling remote schema header: %w", err)
	}

	h.Name = raw.Name
	h.Value = EnvValue{
		Value:   raw.Value,
		FromEnv: raw.ValueFromEnv,
	}

	return nil
}

// UnmarshalJSON implements custom JSON unmarshaling to handle Hasura's header format
// where value and value_from_env are sibling fields.
func (h *RemoteSchemaHeader) UnmarshalJSON(data []byte) error {
	var raw struct {
		Name         string `json:"name"`
		Value        string `json:"value,omitempty"`
		ValueFromEnv string `json:"value_from_env,omitempty"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling remote schema header: %w", err)
	}

	h.Name = raw.Name
	h.Value = EnvValue{
		Value:   raw.Value,
		FromEnv: raw.ValueFromEnv,
	}

	return nil
}

// MarshalJSON inverts UnmarshalJSON: flatten EnvValue into Hasura's sibling
// `value` / `value_from_env` fields next to `name`.
func (h RemoteSchemaHeader) MarshalJSON() ([]byte, error) {
	b, err := json.Marshal(struct {
		Name         string `json:"name"`
		Value        string `json:"value,omitempty"`
		ValueFromEnv string `json:"value_from_env,omitempty"`
	}{
		Name:         h.Name,
		Value:        h.Value.Value,
		ValueFromEnv: h.Value.FromEnv,
	})
	if err != nil {
		return nil, fmt.Errorf("marshaling remote_schema header: %w", err)
	}

	return b, nil
}

// RemoteSchemaPermission defines permissions for a specific role on a remote schema.
type RemoteSchemaPermission struct {
	Role       string                    `json:"role"       yaml:"role"`
	Definition RemoteSchemaPermissionDef `json:"definition" yaml:"definition"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RemoteSchemaPermissionDef contains the GraphQL SDL schema for a role's permissions.
type RemoteSchemaPermissionDef struct {
	Schema string `json:"schema" yaml:"schema"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}
