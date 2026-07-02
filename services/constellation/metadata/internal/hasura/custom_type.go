package hasura

import (
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
)

// CustomTypes groups Hasura custom GraphQL types referenced by actions.
type CustomTypes struct {
	InputObjects []CustomInputObjectType `json:"input_objects,omitempty" yaml:"input_objects,omitempty"`
	Objects      []CustomObjectType      `json:"objects,omitempty"       yaml:"objects,omitempty"`
	Scalars      []CustomScalarType      `json:"scalars,omitempty"       yaml:"scalars,omitempty"`
	Enums        []CustomEnumType        `json:"enums,omitempty"         yaml:"enums,omitempty"`
	Unknown      jsontext.Value          `json:",unknown"                yaml:"-"`
}

// IsZero reports whether no custom types are configured. It also inspects
// Unknown: a custom_types object whose only content is unmodeled keys is still
// meaningful, and treating it as zero would let the `omitzero` tag in
// v3MetadataOut drop exactly the data Unknown exists to preserve.
func (c CustomTypes) IsZero() bool {
	return len(c.InputObjects) == 0 && len(c.Objects) == 0 &&
		len(c.Scalars) == 0 && len(c.Enums) == 0 && len(c.Unknown) == 0
}

func emptyCustomTypes() CustomTypes {
	return CustomTypes{
		InputObjects: nil,
		Objects:      nil,
		Scalars:      nil,
		Enums:        nil,
		Unknown:      nil,
	}
}

// CustomInputObjectType describes an action input object type.
type CustomInputObjectType struct {
	Name        string            `json:"name"                  yaml:"name"`
	Description string            `json:"description,omitempty" yaml:"description,omitempty"`
	Fields      []CustomTypeField `json:"fields,omitempty"      yaml:"fields,omitempty"`
	Unknown     jsontext.Value    `json:",unknown"              yaml:"-"`
}

// CustomObjectType describes an action output object type.
type CustomObjectType struct {
	Name          string                     `json:"name"                    yaml:"name"`
	Description   string                     `json:"description,omitempty"   yaml:"description,omitempty"`
	Fields        []CustomTypeField          `json:"fields,omitempty"        yaml:"fields,omitempty"`
	Relationships []CustomObjectRelationship `json:"relationships,omitempty" yaml:"relationships,omitempty"`
	Unknown       jsontext.Value             `json:",unknown"                yaml:"-"`
}

// CustomScalarType describes a custom scalar referenced by action types.
type CustomScalarType struct {
	Name        string         `json:"name"                  yaml:"name"`
	Description string         `json:"description,omitempty" yaml:"description,omitempty"`
	Unknown     jsontext.Value `json:",unknown"              yaml:"-"`
}

// CustomEnumType describes a custom enum referenced by action types.
type CustomEnumType struct {
	Name        string            `json:"name"                  yaml:"name"`
	Description string            `json:"description,omitempty" yaml:"description,omitempty"`
	Values      []CustomEnumValue `json:"values,omitempty"      yaml:"values,omitempty"`
	Unknown     jsontext.Value    `json:",unknown"              yaml:"-"`
}

// CustomEnumValue describes one enum value, including optional deprecation metadata.
// CustomEnumValue deliberately omits the `json:",unknown"` field carried by
// every other custom-type wire struct: a Hasura enum value is a closed type
// (value/name/description/is_deprecated/deprecation_reason only), and its
// hand-written UnmarshalJSON/UnmarshalYAML decode into a fixed shape to accept
// the `name` alias. Any future key would need capturing here explicitly rather
// than via the tag, which is not honored alongside a custom unmarshaler.
type CustomEnumValue struct {
	Value             string `json:"value"                        yaml:"value"`
	Description       string `json:"description,omitempty"        yaml:"description,omitempty"`
	IsDeprecated      bool   `json:"is_deprecated,omitempty"      yaml:"is_deprecated,omitempty"`
	DeprecationReason string `json:"deprecation_reason,omitempty" yaml:"deprecation_reason,omitempty"`
}

// UnmarshalYAML accepts Hasura's value field and the name alias produced by
// SDL-derived tests or hand-written metadata.
func (v *CustomEnumValue) UnmarshalYAML(unmarshal func(any) error) error {
	var raw struct {
		Value             string `yaml:"value"`
		Name              string `yaml:"name"`
		Description       string `yaml:"description,omitempty"`
		IsDeprecated      bool   `yaml:"is_deprecated,omitempty"`
		DeprecationReason string `yaml:"deprecation_reason,omitempty"`
	}

	if err := unmarshal(&raw); err != nil {
		return fmt.Errorf("unmarshaling custom enum value: %w", err)
	}

	v.Value = raw.Value
	if v.Value == "" {
		v.Value = raw.Name
	}

	v.Description = raw.Description
	v.IsDeprecated = raw.IsDeprecated
	v.DeprecationReason = raw.DeprecationReason

	return nil
}

// UnmarshalJSON accepts Hasura's value field and the name alias produced by
// SDL-derived tests or hand-written metadata.
func (v *CustomEnumValue) UnmarshalJSON(data []byte) error {
	var raw struct {
		Value             string `json:"value"`
		Name              string `json:"name"`
		Description       string `json:"description,omitempty"`
		IsDeprecated      bool   `json:"is_deprecated,omitempty"`
		DeprecationReason string `json:"deprecation_reason,omitempty"`
	}

	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshaling custom enum value: %w", err)
	}

	v.Value = raw.Value
	if v.Value == "" {
		v.Value = raw.Name
	}

	v.Description = raw.Description
	v.IsDeprecated = raw.IsDeprecated
	v.DeprecationReason = raw.DeprecationReason

	return nil
}

// CustomTypeField describes a field of an action object or input object type.
type CustomTypeField struct {
	Name        string         `json:"name"                  yaml:"name"`
	Type        string         `json:"type"                  yaml:"type"`
	Description string         `json:"description,omitempty" yaml:"description,omitempty"`
	Unknown     jsontext.Value `json:",unknown"              yaml:"-"`
}

// CustomObjectRelationship describes a Hasura custom object relationship from
// an action output type to a database source.
type CustomObjectRelationship struct {
	Name         string            `json:"name"             yaml:"name"`
	Type         string            `json:"type"             yaml:"type"`
	RemoteTable  TableSource       `json:"remote_table"     yaml:"remote_table"`
	FieldMapping map[string]string `json:"field_mapping"    yaml:"field_mapping"`
	Source       string            `json:"source,omitempty" yaml:"source,omitempty"`
	Unknown      jsontext.Value    `json:",unknown"         yaml:"-"`
}
