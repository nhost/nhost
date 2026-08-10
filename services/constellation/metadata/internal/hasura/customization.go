package hasura

import "encoding/json/jsontext"

// RemoteSchemaCustomization mirrors a remote schema's
// definition.customization block. Hasura applies it to the introspected
// remote schema before merging.
type RemoteSchemaCustomization struct {
	// RootFieldsNamespace wraps every root field under a single field of
	// this name on each root operation type.
	RootFieldsNamespace string `json:"root_fields_namespace,omitempty" yaml:"root_fields_namespace,omitempty"`
	// TypeNames renames types by prefix/suffix/mapping.
	TypeNames TypeNamesCustomization `json:"type_names" yaml:"type_names"`
	// FieldNames renames fields per parent type.
	FieldNames []FieldNamesCustomization `json:"field_names,omitempty" yaml:"field_names,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// DatabaseSourceCustomization mirrors a database source's customization
// block (sources[].customization). Hasura's naming_convention is
// intentionally not modeled.
type DatabaseSourceCustomization struct {
	// RootFields namespaces and/or prefixes/suffixes the source's root fields.
	RootFields RootFieldsCustomization `json:"root_fields" yaml:"root_fields"`
	// TypeNames renames types by prefix/suffix.
	TypeNames TypeNamesCustomization `json:"type_names" yaml:"type_names"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// RootFieldsCustomization is the database root_fields customization: a
// namespace plus optional prefix/suffix applied to root field names.
type RootFieldsCustomization struct {
	Namespace string `json:"namespace,omitempty" yaml:"namespace,omitempty"`
	Prefix    string `json:"prefix,omitempty"    yaml:"prefix,omitempty"`
	Suffix    string `json:"suffix,omitempty"    yaml:"suffix,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// TypeNamesCustomization renames types. Mapping takes precedence over
// prefix/suffix for the type names it lists. (Databases do not use Mapping.)
type TypeNamesCustomization struct {
	Prefix  string            `json:"prefix,omitempty"  yaml:"prefix,omitempty"`
	Suffix  string            `json:"suffix,omitempty"  yaml:"suffix,omitempty"`
	Mapping map[string]string `json:"mapping,omitempty" yaml:"mapping,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}

// FieldNamesCustomization renames the fields of a single parent type
// (remote schemas only). Mapping takes precedence over prefix/suffix.
type FieldNamesCustomization struct {
	ParentType string            `json:"parent_type"       yaml:"parent_type"`
	Prefix     string            `json:"prefix,omitempty"  yaml:"prefix,omitempty"`
	Suffix     string            `json:"suffix,omitempty"  yaml:"suffix,omitempty"`
	Mapping    map[string]string `json:"mapping,omitempty" yaml:"mapping,omitempty"`

	Unknown jsontext.Value `json:",unknown" yaml:"-"`
}
