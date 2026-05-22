package metadata

// Customization is the normalized GraphQL schema customization applied to a
// connector's schema: root-field namespacing/prefixing and type/field
// renaming. Both Hasura database-source customization
// (sources[].customization) and remote-schema customization
// (remote_schemas[].definition.customization) are parsed into this single
// shape by the converters in convert.go. The two Hasura shapes differ
// (databases use root_fields{namespace,prefix,suffix} + type_names{prefix,
// suffix}; remote schemas use root_fields_namespace + type_names{prefix,
// suffix,mapping} + field_names), but both reduce to the fields below. The
// zero value applies no changes; callers gate on IsZero.
//
// Hasura's naming_convention option is intentionally not modeled.
type Customization struct {
	// RootFieldsNamespace, when non-empty, wraps every root field of the
	// source under a single field of this name on each root operation type
	// (query/mutation/subscription). Mirrors Hasura's database
	// root_fields.namespace and remote-schema root_fields_namespace.
	RootFieldsNamespace string `json:"root_fields_namespace,omitempty" toml:"root_fields_namespace,omitempty"`
	// RootFieldsPrefix and RootFieldsSuffix are prepended/appended to every
	// root field name. Populated from a database's root_fields.prefix /
	// root_fields.suffix. Remote schemas express the same thing through a
	// FieldNames entry targeting the root operation type instead.
	RootFieldsPrefix string `json:"root_fields_prefix,omitempty" toml:"root_fields_prefix,omitempty"`
	RootFieldsSuffix string `json:"root_fields_suffix,omitempty" toml:"root_fields_suffix,omitempty"`
	// TypeNamesPrefix and TypeNamesSuffix are prepended/appended to every
	// non-builtin type name. TypeNamesMapping takes precedence over
	// prefix/suffix for the specific type names it lists (remote schemas
	// only; nil for databases).
	TypeNamesPrefix  string            `json:"type_names_prefix,omitempty"  toml:"type_names_prefix,omitempty"`
	TypeNamesSuffix  string            `json:"type_names_suffix,omitempty"  toml:"type_names_suffix,omitempty"`
	TypeNamesMapping map[string]string `json:"type_names_mapping,omitempty" toml:"type_names_mapping,omitempty"`
	// FieldNames renames fields on specific parent types. Populated from a
	// remote schema's field_names; nil for databases.
	FieldNames []FieldNameCustomization `json:"field_names,omitempty" toml:"field_names,omitempty"`
}

// FieldNameCustomization renames the fields of a single parent type. Mirrors
// one entry of Hasura's remote-schema customization.field_names.
type FieldNameCustomization struct {
	// ParentType is the (original, un-renamed) name of the type whose fields
	// are renamed.
	ParentType string `json:"parent_type" toml:"parent_type"`
	// Prefix and Suffix are prepended/appended to every field name on
	// ParentType. Mapping takes precedence for the field names it lists.
	Prefix  string            `json:"prefix,omitempty"  toml:"prefix,omitempty"`
	Suffix  string            `json:"suffix,omitempty"  toml:"suffix,omitempty"`
	Mapping map[string]string `json:"mapping,omitempty" toml:"mapping,omitempty"`
}

// IsZero reports whether c applies no customization, so callers can skip
// wrapping a connector that has none configured.
func (c Customization) IsZero() bool {
	return c.RootFieldsNamespace == "" &&
		c.RootFieldsPrefix == "" &&
		c.RootFieldsSuffix == "" &&
		c.TypeNamesPrefix == "" &&
		c.TypeNamesSuffix == "" &&
		len(c.TypeNamesMapping) == 0 &&
		len(c.FieldNames) == 0
}
