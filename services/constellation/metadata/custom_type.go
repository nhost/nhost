package metadata

// CustomTypes groups Hasura custom GraphQL types referenced by actions.
type CustomTypes struct {
	InputObjects []CustomInputObjectType `json:"input_objects,omitempty" toml:"input_objects,omitempty"`
	Objects      []CustomObjectType      `json:"objects,omitempty"       toml:"objects,omitempty"`
	Scalars      []CustomScalarType      `json:"scalars,omitempty"       toml:"scalars,omitempty"`
	Enums        []CustomEnumType        `json:"enums,omitempty"         toml:"enums,omitempty"`
}

// IsZero reports whether no custom types are configured. encoding/json/v2 uses
// it for the omitzero tag on Metadata.CustomTypes.
func (c CustomTypes) IsZero() bool {
	return len(c.InputObjects) == 0 && len(c.Objects) == 0 &&
		len(c.Scalars) == 0 && len(c.Enums) == 0
}

// CustomInputObjectType describes an action input object type.
type CustomInputObjectType struct {
	Name        string            `json:"name"                  toml:"name"`
	Description string            `json:"description,omitempty" toml:"description,omitempty"`
	Fields      []CustomTypeField `json:"fields,omitempty"      toml:"fields,omitempty"`
}

// CustomObjectType describes an action output object type. Relationships are
// declared in metadata and later resolved by the action connector.
type CustomObjectType struct {
	Name          string                     `json:"name"                    toml:"name"`
	Description   string                     `json:"description,omitempty"   toml:"description,omitempty"`
	Fields        []CustomTypeField          `json:"fields,omitempty"        toml:"fields,omitempty"`
	Relationships []CustomObjectRelationship `json:"relationships,omitempty" toml:"relationships,omitempty"`
}

// CustomScalarType describes a custom scalar referenced by action types.
type CustomScalarType struct {
	Name        string `json:"name"                  toml:"name"`
	Description string `json:"description,omitempty" toml:"description,omitempty"`
}

// CustomEnumType describes a custom enum referenced by action types.
type CustomEnumType struct {
	Name        string            `json:"name"                  toml:"name"`
	Description string            `json:"description,omitempty" toml:"description,omitempty"`
	Values      []CustomEnumValue `json:"values,omitempty"      toml:"values,omitempty"`
}

// CustomEnumValue describes one enum value, including Hasura's optional
// deprecation metadata.
type CustomEnumValue struct {
	Value             string `json:"value"                        toml:"value"`
	Description       string `json:"description,omitempty"        toml:"description,omitempty"`
	IsDeprecated      bool   `json:"is_deprecated,omitempty"      toml:"is_deprecated,omitempty"`
	DeprecationReason string `json:"deprecation_reason,omitempty" toml:"deprecation_reason,omitempty"`
}

// CustomTypeField describes a field of an action object or input object type.
type CustomTypeField struct {
	Name        string `json:"name"                  toml:"name"`
	Type        string `json:"type"                  toml:"type"`
	Description string `json:"description,omitempty" toml:"description,omitempty"`
}

// CustomObjectRelationship describes a Hasura custom object relationship from
// an action output type to a database source.
type CustomObjectRelationship struct {
	Name         string            `json:"name"             toml:"name"`
	Type         string            `json:"type"             toml:"type"`
	RemoteTable  TableSource       `json:"remote_table"     toml:"remote_table"`
	FieldMapping map[string]string `json:"field_mapping"    toml:"field_mapping"`
	Source       string            `json:"source,omitempty" toml:"source,omitempty"`
}
