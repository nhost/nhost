package hasura

import "encoding/json/jsontext"

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
