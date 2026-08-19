package openapi3

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"math/big"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"sync"
	"unicode/utf16"

	"github.com/go-openapi/jsonpointer"
)

const (
	TypeArray   = "array"
	TypeBoolean = "boolean"
	TypeInteger = "integer"
	TypeNumber  = "number"
	TypeObject  = "object"
	TypeString  = "string"
	TypeNull    = "null"
)

var (
	// SchemaErrorDetailsDisabled disables printing of details about schema errors.
	SchemaErrorDetailsDisabled = false

	errSchema = errors.New("input does not match the schema")

	// ErrOneOfConflict is the SchemaError Origin when data matches more than one oneOf schema
	ErrOneOfConflict = errors.New("input matches more than one oneOf schemas")

	// ErrSchemaInputNaN may be returned when validating a number
	ErrSchemaInputNaN = errors.New("floating point NaN is not allowed")
	// ErrSchemaInputInf may be returned when validating a number
	ErrSchemaInputInf = errors.New("floating point Inf is not allowed")

	compiledPatterns sync.Map
)

// NewSchemaRef simply builds a SchemaRef
func NewSchemaRef(ref string, value *Schema) *SchemaRef {
	return &SchemaRef{
		Ref:   ref,
		Value: value,
	}
}

type SchemaRefs []*SchemaRef

var _ jsonpointer.JSONPointable = (*SchemaRefs)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (s SchemaRefs) JSONLookup(token string) (any, error) {
	i, err := strconv.ParseUint(token, 10, 64)
	if err != nil {
		return nil, err
	}

	if i >= uint64(len(s)) {
		return nil, fmt.Errorf("index out of range: %d", i)
	}

	ref := s[i]

	if ref == nil || ref.Ref != "" {
		return &Ref{Ref: ref.Ref}, nil
	}
	return ref.Value, nil
}

// Schema is specified by OpenAPI/Swagger 3.0 standard.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#schema-object
// and https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#schema-object
type Schema struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	OneOf        SchemaRefs    `json:"oneOf,omitempty" yaml:"oneOf,omitempty"`
	AnyOf        SchemaRefs    `json:"anyOf,omitempty" yaml:"anyOf,omitempty"`
	AllOf        SchemaRefs    `json:"allOf,omitempty" yaml:"allOf,omitempty"`
	Not          *SchemaRef    `json:"not,omitempty" yaml:"not,omitempty"`
	Type         *Types        `json:"type,omitempty" yaml:"type,omitempty"`
	Title        string        `json:"title,omitempty" yaml:"title,omitempty"`
	Format       string        `json:"format,omitempty" yaml:"format,omitempty"`
	Description  string        `json:"description,omitempty" yaml:"description,omitempty"`
	Enum         []any         `json:"enum,omitempty" yaml:"enum,omitempty"`
	Default      any           `json:"default,omitempty" yaml:"default,omitempty"`
	Example      any           `json:"example,omitempty" yaml:"example,omitempty"`
	ExternalDocs *ExternalDocs `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`

	// Array-related, here for struct compactness
	UniqueItems bool `json:"uniqueItems,omitempty" yaml:"uniqueItems,omitempty"`
	// Number-related, here for struct compactness
	ExclusiveMin ExclusiveBound `json:"exclusiveMinimum,omitempty" yaml:"exclusiveMinimum,omitempty"` // Number for v3.1+ otherwise boolean
	ExclusiveMax ExclusiveBound `json:"exclusiveMaximum,omitempty" yaml:"exclusiveMaximum,omitempty"` // Number for v3.1+ otherwise boolean
	// Properties
	Nullable        bool `json:"nullable,omitempty" yaml:"nullable,omitempty"`
	ReadOnly        bool `json:"readOnly,omitempty" yaml:"readOnly,omitempty"`
	WriteOnly       bool `json:"writeOnly,omitempty" yaml:"writeOnly,omitempty"`
	AllowEmptyValue bool `json:"allowEmptyValue,omitempty" yaml:"allowEmptyValue,omitempty"`
	Deprecated      bool `json:"deprecated,omitempty" yaml:"deprecated,omitempty"`
	XML             *XML `json:"xml,omitempty" yaml:"xml,omitempty"`

	// Number
	Min        *float64 `json:"minimum,omitempty" yaml:"minimum,omitempty"`
	Max        *float64 `json:"maximum,omitempty" yaml:"maximum,omitempty"`
	MultipleOf *float64 `json:"multipleOf,omitempty" yaml:"multipleOf,omitempty"`

	// String
	MinLength uint64  `json:"minLength,omitempty" yaml:"minLength,omitempty"`
	MaxLength *uint64 `json:"maxLength,omitempty" yaml:"maxLength,omitempty"`
	Pattern   string  `json:"pattern,omitempty" yaml:"pattern,omitempty"`

	// Array
	MinItems uint64     `json:"minItems,omitempty" yaml:"minItems,omitempty"`
	MaxItems *uint64    `json:"maxItems,omitempty" yaml:"maxItems,omitempty"`
	Items    *SchemaRef `json:"items,omitempty" yaml:"items,omitempty"`

	// Object
	Required             []string             `json:"required,omitempty" yaml:"required,omitempty"`
	Properties           Schemas              `json:"properties,omitempty" yaml:"properties,omitempty"`
	MinProps             uint64               `json:"minProperties,omitempty" yaml:"minProperties,omitempty"`
	MaxProps             *uint64              `json:"maxProperties,omitempty" yaml:"maxProperties,omitempty"`
	AdditionalProperties AdditionalProperties `json:"additionalProperties,omitempty" yaml:"additionalProperties,omitempty"`
	Discriminator        *Discriminator       `json:"discriminator,omitempty" yaml:"discriminator,omitempty"`

	Const                 any        `json:"const,omitempty" yaml:"const,omitempty"`                                 // OpenAPI >=3.1
	Examples              []any      `json:"examples,omitempty" yaml:"examples,omitempty"`                           // OpenAPI >=3.1
	PrefixItems           SchemaRefs `json:"prefixItems,omitempty" yaml:"prefixItems,omitempty"`                     // OpenAPI >=3.1
	Contains              *SchemaRef `json:"contains,omitempty" yaml:"contains,omitempty"`                           // OpenAPI >=3.1
	MinContains           *uint64    `json:"minContains,omitempty" yaml:"minContains,omitempty"`                     // OpenAPI >=3.1
	MaxContains           *uint64    `json:"maxContains,omitempty" yaml:"maxContains,omitempty"`                     // OpenAPI >=3.1
	PatternProperties     Schemas    `json:"patternProperties,omitempty" yaml:"patternProperties,omitempty"`         // OpenAPI >=3.1
	DependentSchemas      Schemas    `json:"dependentSchemas,omitempty" yaml:"dependentSchemas,omitempty"`           // OpenAPI >=3.1
	PropertyNames         *SchemaRef `json:"propertyNames,omitempty" yaml:"propertyNames,omitempty"`                 // OpenAPI >=3.1
	UnevaluatedItems      BoolSchema `json:"unevaluatedItems,omitempty" yaml:"unevaluatedItems,omitempty"`           // OpenAPI >=3.1
	UnevaluatedProperties BoolSchema `json:"unevaluatedProperties,omitempty" yaml:"unevaluatedProperties,omitempty"` // OpenAPI >=3.1

	If   *SchemaRef `json:"if,omitempty" yaml:"if,omitempty"`     // OpenAPI >=3.1
	Then *SchemaRef `json:"then,omitempty" yaml:"then,omitempty"` // OpenAPI >=3.1
	Else *SchemaRef `json:"else,omitempty" yaml:"else,omitempty"` // OpenAPI >=3.1

	DependentRequired map[string][]string `json:"dependentRequired,omitempty" yaml:"dependentRequired,omitempty"` // OpenAPI >=3.1

	Defs          Schemas `json:"$defs,omitempty" yaml:"$defs,omitempty"`       // OpenAPI >=3.1
	SchemaDialect string  `json:"$schema,omitempty" yaml:"$schema,omitempty"`   // OpenAPI >=3.1
	Comment       string  `json:"$comment,omitempty" yaml:"$comment,omitempty"` // OpenAPI >=3.1

	SchemaID      string `json:"$id,omitempty" yaml:"$id,omitempty"`                       // OpenAPI >=3.1
	Anchor        string `json:"$anchor,omitempty" yaml:"$anchor,omitempty"`               // OpenAPI >=3.1
	DynamicRef    string `json:"$dynamicRef,omitempty" yaml:"$dynamicRef,omitempty"`       // OpenAPI >=3.1
	DynamicAnchor string `json:"$dynamicAnchor,omitempty" yaml:"$dynamicAnchor,omitempty"` // OpenAPI >=3.1

	ContentMediaType string     `json:"contentMediaType,omitempty" yaml:"contentMediaType,omitempty"` // OpenAPI >=3.1
	ContentEncoding  string     `json:"contentEncoding,omitempty" yaml:"contentEncoding,omitempty"`   // OpenAPI >=3.1
	ContentSchema    *SchemaRef `json:"contentSchema,omitempty" yaml:"contentSchema,omitempty"`       // OpenAPI >=3.1
}

// Types represents the type(s) of a schema.
//
// In OpenAPI 3.0, this is typically a single type (e.g., "string").
// In OpenAPI 3.1, it can be an array of types (e.g., ["string", "null"]).
//
// Serialization behavior:
//   - Single type: serializes as a string (e.g., "string")
//   - Multiple types: serializes as an array (e.g., ["string", "null"])
//   - Accepts both string and array formats when unmarshaling
//
// Example OpenAPI 3.0 (single type):
//
//	schema := &Schema{Type: &Types{"string"}}
//	// JSON: {"type": "string"}
//
// Example OpenAPI 3.1 (type array):
//
//	schema := &Schema{Type: &Types{"string", "null"}}
//	// JSON: {"type": ["string", "null"]}
type Types []string

// Is returns true if the schema has exactly one type and it matches the given type.
// This is useful for OpenAPI 3.0 style single-type checks.
//
// Example:
//
//	types := &Types{"string"}
//	types.Is("string")  // true
//	types.Is("number")  // false
//
//	types = &Types{"string", "null"}
//	types.Is("string")  // false (multiple types)
func (types *Types) Is(typ string) bool {
	return types != nil && len(*types) == 1 && (*types)[0] == typ
}

// Slice returns the types as a string slice.
// Returns nil if types is nil.
//
// Example:
//
//	types := &Types{"string", "null"}
//	slice := types.Slice()  // []string{"string", "null"}
func (types *Types) Slice() []string {
	if types == nil {
		return nil
	}
	return *types
}

// Includes returns true if the given type is included in the type array.
// Returns false if types is nil.
//
// Example:
//
//	types := &Types{"string", "null"}
//	types.Includes("string")  // true
//	types.Includes("null")    // true
//	types.Includes("number")  // false
func (pTypes *Types) Includes(typ string) bool {
	if pTypes == nil {
		return false
	}
	return slices.Contains(*pTypes, typ)
}

// Permits returns true if the given type is permitted.
// Returns true if types is nil (any type allowed), otherwise checks if the type is included.
//
// Example:
//
//	var nilTypes *Types
//	nilTypes.Permits("anything")  // true (nil permits everything)
//
//	types := &Types{"string"}
//	types.Permits("string")  // true
//	types.Permits("number")  // false
func (types *Types) Permits(typ string) bool {
	if types == nil {
		return true
	}
	return types.Includes(typ)
}

// IncludesNull returns true if the type array includes "null".
// This is useful for OpenAPI 3.1 where null is a first-class type.
//
// Example:
//
//	types := &Types{"string", "null"}
//	types.IncludesNull()  // true
//
//	types = &Types{"string"}
//	types.IncludesNull()  // false
func (types *Types) IncludesNull() bool {
	return types.Includes(TypeNull)
}

// IsMultiple returns true if multiple types are specified.
// This is an OpenAPI 3.1 feature that enables type arrays.
//
// Example:
//
//	types := &Types{"string"}
//	types.IsMultiple()  // false
//
//	types = &Types{"string", "null"}
//	types.IsMultiple()  // true
func (types *Types) IsMultiple() bool {
	return types != nil && len(*types) > 1
}

// IsSingle returns true if exactly one type is specified.
//
// Example:
//
//	types := &Types{"string"}
//	types.IsSingle()  // true
//
//	types = &Types{"string", "null"}
//	types.IsSingle()  // false
func (types *Types) IsSingle() bool {
	return types != nil && len(*types) == 1
}

// IsEmpty returns true if no types are specified (nil or empty array).
// When a schema has no type specified, it permits any type.
//
// Example:
//
//	var nilTypes *Types
//	nilTypes.IsEmpty()  // true
//
//	types := &Types{}
//	types.IsEmpty()  // true
//
//	types = &Types{"string"}
//	types.IsEmpty()  // false
func (types *Types) IsEmpty() bool {
	return types == nil || len(*types) == 0
}

func (pTypes *Types) MarshalJSON() ([]byte, error) {
	x, err := pTypes.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

func (pTypes *Types) MarshalYAML() (any, error) {
	if pTypes == nil {
		return nil, nil
	}
	types := *pTypes
	switch len(types) {
	case 0:
		return nil, nil
	case 1:
		return types[0], nil
	default:
		return []string(types), nil
	}
}

func (types *Types) UnmarshalJSON(data []byte) error {
	var strings []string
	if err := json.Unmarshal(data, &strings); err != nil {
		var s string
		if err := json.Unmarshal(data, &s); err != nil {
			return unmarshalError(err)
		}
		strings = []string{s}
	}
	*types = strings
	return nil
}

// BoolSchema represents a JSON Schema keyword that can be either a boolean or a schema object.
// Used for additionalProperties, unevaluatedProperties, and unevaluatedItems.
type BoolSchema struct {
	Has    *bool
	Schema *SchemaRef
}

// AdditionalProperties is a type alias for BoolSchema, kept for backward compatibility.
type AdditionalProperties = BoolSchema

// MarshalYAML returns the YAML encoding of BoolSchema.
func (bs BoolSchema) MarshalYAML() (any, error) {
	if x := bs.Has; x != nil {
		if *x {
			return true, nil
		}
		return false, nil
	}
	if x := bs.Schema; x != nil {
		return x.MarshalYAML()
	}
	return nil, nil
}

// MarshalJSON returns the JSON encoding of BoolSchema.
func (bs BoolSchema) MarshalJSON() ([]byte, error) {
	x, err := bs.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// UnmarshalJSON sets BoolSchema to a copy of data.
func (bs *BoolSchema) UnmarshalJSON(data []byte) error {
	var x any
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	switch y := x.(type) {
	case nil:
	case bool:
		bs.Has = &y
	case map[string]any:
		if len(y) == 0 {
			bs.Schema = &SchemaRef{Value: &Schema{}}
		} else {
			buf := new(bytes.Buffer)
			_ = json.NewEncoder(buf).Encode(y)
			if err := json.NewDecoder(buf).Decode(&bs.Schema); err != nil {
				return err
			}
		}
	default:
		return errors.New("cannot unmarshal: value must be either a schema object or a boolean")
	}
	return nil
}

// ExclusiveBound represents exclusiveMinimum/exclusiveMaximum which changed type between OpenAPI versions.
// In OpenAPI 3.0 (JSON Schema draft-04): boolean that modifies minimum/maximum
// In OpenAPI 3.1 (JSON Schema 2020-12): number representing the actual exclusive bound
type ExclusiveBound struct {
	Bool  *bool    // For OpenAPI 3.0 style (modifier for min/max)
	Value *float64 // For OpenAPI 3.1 style (actual bound value)
}

// IsSet returns true if either Bool or Value is set.
func (eb ExclusiveBound) IsSet() bool {
	return eb.Bool != nil || eb.Value != nil
}

// IsTrue returns true if the bound is set as a boolean true (OpenAPI 3.0 style).
func (eb ExclusiveBound) IsTrue() bool {
	return eb.Bool != nil && *eb.Bool
}

// MarshalYAML returns the YAML encoding of ExclusiveBound.
func (eb ExclusiveBound) MarshalYAML() (any, error) {
	if eb.Value != nil {
		return *eb.Value, nil
	}
	if eb.Bool != nil {
		return *eb.Bool, nil
	}
	return nil, nil
}

// MarshalJSON returns the JSON encoding of ExclusiveBound.
func (eb ExclusiveBound) MarshalJSON() ([]byte, error) {
	x, err := eb.MarshalYAML()
	if err != nil {
		return nil, err
	}
	if x == nil {
		return nil, nil
	}
	return json.Marshal(x)
}

// UnmarshalJSON sets ExclusiveBound to a copy of data.
func (eb *ExclusiveBound) UnmarshalJSON(data []byte) error {
	var x any
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	switch y := x.(type) {
	case nil:
		// nothing to do
	case bool:
		eb.Bool = &y
	case float64:
		eb.Value = &y
	default:
		return errors.New("cannot unmarshal exclusiveMinimum/exclusiveMaximum: value must be either a number or a boolean")
	}
	return nil
}

var _ jsonpointer.JSONPointable = (*Schema)(nil)

func NewSchema() *Schema {
	return &Schema{}
}

// MarshalJSON returns the JSON encoding of Schema.
func (schema Schema) MarshalJSON() ([]byte, error) {
	m, err := schema.MarshalYAML()
	if err != nil {
		return nil, err
	}

	return json.Marshal(m)
}

// MarshalYAML returns the YAML encoding of Schema.
func (schema Schema) MarshalYAML() (any, error) {
	m := make(map[string]any, 61+len(schema.Extensions))
	maps.Copy(m, schema.Extensions)

	if x := schema.OneOf; len(x) != 0 {
		m["oneOf"] = x
	}
	if x := schema.AnyOf; len(x) != 0 {
		m["anyOf"] = x
	}
	if x := schema.AllOf; len(x) != 0 {
		m["allOf"] = x
	}
	if x := schema.Not; x != nil {
		m["not"] = x
	}
	if x := schema.Type; x != nil {
		m["type"] = x
	}
	if x := schema.Title; len(x) != 0 {
		m["title"] = x
	}
	if x := schema.Format; len(x) != 0 {
		m["format"] = x
	}
	if x := schema.Description; len(x) != 0 {
		m["description"] = x
	}
	if x := schema.Enum; len(x) != 0 {
		m["enum"] = x
	}
	if x := schema.Default; x != nil {
		m["default"] = x
	}
	if x := schema.Example; x != nil {
		m["example"] = x
	}
	if x := schema.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}

	// Array-related
	if x := schema.UniqueItems; x {
		m["uniqueItems"] = x
	}
	// Number-related
	if x := schema.ExclusiveMin; x.IsSet() {
		m["exclusiveMinimum"] = x
	}
	if x := schema.ExclusiveMax; x.IsSet() {
		m["exclusiveMaximum"] = x
	}
	// Properties
	if x := schema.Nullable; x {
		m["nullable"] = x
	}
	if x := schema.ReadOnly; x {
		m["readOnly"] = x
	}
	if x := schema.WriteOnly; x {
		m["writeOnly"] = x
	}
	if x := schema.AllowEmptyValue; x {
		m["allowEmptyValue"] = x
	}
	if x := schema.Deprecated; x {
		m["deprecated"] = x
	}
	if x := schema.XML; x != nil {
		m["xml"] = x
	}

	// Number
	if x := schema.Min; x != nil {
		m["minimum"] = x
	}
	if x := schema.Max; x != nil {
		m["maximum"] = x
	}
	if x := schema.MultipleOf; x != nil {
		m["multipleOf"] = x
	}

	// String
	if x := schema.MinLength; x != 0 {
		m["minLength"] = x
	}
	if x := schema.MaxLength; x != nil {
		m["maxLength"] = x
	}
	if x := schema.Pattern; x != "" {
		m["pattern"] = x
	}

	// Array
	if x := schema.MinItems; x != 0 {
		m["minItems"] = x
	}
	if x := schema.MaxItems; x != nil {
		m["maxItems"] = x
	}
	if x := schema.Items; x != nil {
		m["items"] = x
	}

	// Object
	if x := schema.Required; len(x) != 0 {
		m["required"] = x
	}
	if x := schema.Properties; len(x) != 0 {
		m["properties"] = x
	}
	if x := schema.MinProps; x != 0 {
		m["minProperties"] = x
	}
	if x := schema.MaxProps; x != nil {
		m["maxProperties"] = x
	}
	if x := schema.AdditionalProperties; x.Has != nil || x.Schema != nil {
		m["additionalProperties"] = &x
	}
	if x := schema.Discriminator; x != nil {
		m["discriminator"] = x
	}

	// OpenAPI 3.1 / JSON Schema 2020-12 fields
	if x := schema.Const; x != nil {
		m["const"] = x
	}
	if x := schema.Examples; len(x) != 0 {
		m["examples"] = x
	}
	if x := schema.PrefixItems; len(x) != 0 {
		m["prefixItems"] = x
	}
	if x := schema.Contains; x != nil {
		m["contains"] = x
	}
	if x := schema.MinContains; x != nil {
		m["minContains"] = x
	}
	if x := schema.MaxContains; x != nil {
		m["maxContains"] = x
	}
	if x := schema.PatternProperties; len(x) != 0 {
		m["patternProperties"] = x
	}
	if x := schema.DependentSchemas; len(x) != 0 {
		m["dependentSchemas"] = x
	}
	if x := schema.PropertyNames; x != nil {
		m["propertyNames"] = x
	}
	if x := schema.UnevaluatedItems; x.Has != nil || x.Schema != nil {
		m["unevaluatedItems"] = &x
	}
	if x := schema.UnevaluatedProperties; x.Has != nil || x.Schema != nil {
		m["unevaluatedProperties"] = &x
	}
	if x := schema.If; x != nil {
		m["if"] = x
	}
	if x := schema.Then; x != nil {
		m["then"] = x
	}
	if x := schema.Else; x != nil {
		m["else"] = x
	}
	if x := schema.DependentRequired; len(x) != 0 {
		m["dependentRequired"] = x
	}
	if x := schema.Defs; len(x) != 0 {
		m["$defs"] = x
	}
	if x := schema.SchemaDialect; x != "" {
		m["$schema"] = x
	}
	if x := schema.Comment; x != "" {
		m["$comment"] = x
	}
	if x := schema.SchemaID; x != "" {
		m["$id"] = x
	}
	if x := schema.Anchor; x != "" {
		m["$anchor"] = x
	}
	if x := schema.DynamicRef; x != "" {
		m["$dynamicRef"] = x
	}
	if x := schema.DynamicAnchor; x != "" {
		m["$dynamicAnchor"] = x
	}
	if x := schema.ContentMediaType; x != "" {
		m["contentMediaType"] = x
	}
	if x := schema.ContentEncoding; x != "" {
		m["contentEncoding"] = x
	}
	if x := schema.ContentSchema; x != nil {
		m["contentSchema"] = x
	}

	return m, nil
}

// UnmarshalJSON sets Schema to a copy of data.
func (schema *Schema) UnmarshalJSON(data []byte) error {
	type SchemaBis Schema
	var x SchemaBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, "oneOf")
	delete(x.Extensions, "anyOf")
	delete(x.Extensions, "allOf")
	delete(x.Extensions, "not")
	delete(x.Extensions, "type")
	delete(x.Extensions, "title")
	delete(x.Extensions, "format")
	delete(x.Extensions, "description")
	delete(x.Extensions, "enum")
	delete(x.Extensions, "default")
	delete(x.Extensions, "example")
	delete(x.Extensions, "externalDocs")

	// Array-related
	delete(x.Extensions, "uniqueItems")
	// Number-related
	delete(x.Extensions, "exclusiveMinimum")
	delete(x.Extensions, "exclusiveMaximum")
	// Properties
	delete(x.Extensions, "nullable")
	delete(x.Extensions, "readOnly")
	delete(x.Extensions, "writeOnly")
	delete(x.Extensions, "allowEmptyValue")
	delete(x.Extensions, "deprecated")
	delete(x.Extensions, "xml")

	// Number
	delete(x.Extensions, "minimum")
	delete(x.Extensions, "maximum")
	delete(x.Extensions, "multipleOf")

	// String
	delete(x.Extensions, "minLength")
	delete(x.Extensions, "maxLength")
	delete(x.Extensions, "pattern")

	// Array
	delete(x.Extensions, "minItems")
	delete(x.Extensions, "maxItems")
	delete(x.Extensions, "items")

	// Object
	delete(x.Extensions, "required")
	delete(x.Extensions, "properties")
	delete(x.Extensions, "minProperties")
	delete(x.Extensions, "maxProperties")
	delete(x.Extensions, "additionalProperties")
	delete(x.Extensions, "discriminator")

	// OpenAPI 3.1 / JSON Schema 2020-12 fields
	delete(x.Extensions, "const")
	delete(x.Extensions, "examples")
	delete(x.Extensions, "prefixItems")
	delete(x.Extensions, "contains")
	delete(x.Extensions, "minContains")
	delete(x.Extensions, "maxContains")
	delete(x.Extensions, "patternProperties")
	delete(x.Extensions, "dependentSchemas")
	delete(x.Extensions, "propertyNames")
	delete(x.Extensions, "unevaluatedItems")
	delete(x.Extensions, "unevaluatedProperties")
	delete(x.Extensions, "if")
	delete(x.Extensions, "then")
	delete(x.Extensions, "else")
	delete(x.Extensions, "dependentRequired")
	delete(x.Extensions, "$defs")
	delete(x.Extensions, "$schema")
	delete(x.Extensions, "$comment")
	delete(x.Extensions, "$id")
	delete(x.Extensions, "$anchor")
	delete(x.Extensions, "$dynamicRef")
	delete(x.Extensions, "$dynamicAnchor")
	delete(x.Extensions, "contentMediaType")
	delete(x.Extensions, "contentEncoding")
	delete(x.Extensions, "contentSchema")

	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}

	*schema = Schema(x)
	return nil
}

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (schema Schema) JSONLookup(token string) (any, error) {
	switch token {
	case "additionalProperties":
		if addProps := schema.AdditionalProperties.Has; addProps != nil {
			return *addProps, nil
		}
		if addProps := schema.AdditionalProperties.Schema; addProps != nil {
			if addProps.Ref != "" {
				return &Ref{Ref: addProps.Ref}, nil
			}
			return addProps.Value, nil
		}
	case "not":
		if schema.Not != nil {
			if schema.Not.Ref != "" {
				return &Ref{Ref: schema.Not.Ref}, nil
			}
			return schema.Not.Value, nil
		}
	case "items":
		if schema.Items != nil {
			if schema.Items.Ref != "" {
				return &Ref{Ref: schema.Items.Ref}, nil
			}
			return schema.Items.Value, nil
		}
	case "oneOf":
		return schema.OneOf, nil
	case "anyOf":
		return schema.AnyOf, nil
	case "allOf":
		return schema.AllOf, nil
	case "type":
		return schema.Type, nil
	case "title":
		return schema.Title, nil
	case "format":
		return schema.Format, nil
	case "description":
		return schema.Description, nil
	case "enum":
		return schema.Enum, nil
	case "default":
		return schema.Default, nil
	case "example":
		return schema.Example, nil
	case "externalDocs":
		return schema.ExternalDocs, nil
	case "uniqueItems":
		return schema.UniqueItems, nil
	case "exclusiveMin":
		return schema.ExclusiveMin, nil
	case "exclusiveMax":
		return schema.ExclusiveMax, nil
	case "nullable":
		return schema.Nullable, nil
	case "readOnly":
		return schema.ReadOnly, nil
	case "writeOnly":
		return schema.WriteOnly, nil
	case "allowEmptyValue":
		return schema.AllowEmptyValue, nil
	case "xml":
		return schema.XML, nil
	case "deprecated":
		return schema.Deprecated, nil
	case "min":
		return schema.Min, nil
	case "max":
		return schema.Max, nil
	case "multipleOf":
		return schema.MultipleOf, nil
	case "minLength":
		return schema.MinLength, nil
	case "maxLength":
		return schema.MaxLength, nil
	case "pattern":
		return schema.Pattern, nil
	case "minItems":
		return schema.MinItems, nil
	case "maxItems":
		return schema.MaxItems, nil
	case "required":
		return schema.Required, nil
	case "properties":
		return schema.Properties, nil
	case "minProps":
		return schema.MinProps, nil
	case "maxProps":
		return schema.MaxProps, nil
	case "discriminator":
		return schema.Discriminator, nil

	// OpenAPI 3.1 / JSON Schema 2020-12 fields
	case "const":
		return schema.Const, nil
	case "examples":
		return schema.Examples, nil
	case "prefixItems":
		return schema.PrefixItems, nil
	case "contains":
		if schema.Contains != nil {
			if schema.Contains.Ref != "" {
				return &Ref{Ref: schema.Contains.Ref}, nil
			}
			return schema.Contains.Value, nil
		}
	case "minContains":
		return schema.MinContains, nil
	case "maxContains":
		return schema.MaxContains, nil
	case "patternProperties":
		return schema.PatternProperties, nil
	case "dependentSchemas":
		return schema.DependentSchemas, nil
	case "propertyNames":
		if schema.PropertyNames != nil {
			if schema.PropertyNames.Ref != "" {
				return &Ref{Ref: schema.PropertyNames.Ref}, nil
			}
			return schema.PropertyNames.Value, nil
		}
	case "unevaluatedItems":
		if ui := schema.UnevaluatedItems.Has; ui != nil {
			return *ui, nil
		}
		if ui := schema.UnevaluatedItems.Schema; ui != nil {
			if ui.Ref != "" {
				return &Ref{Ref: ui.Ref}, nil
			}
			return ui.Value, nil
		}
	case "unevaluatedProperties":
		if up := schema.UnevaluatedProperties.Has; up != nil {
			return *up, nil
		}
		if up := schema.UnevaluatedProperties.Schema; up != nil {
			if up.Ref != "" {
				return &Ref{Ref: up.Ref}, nil
			}
			return up.Value, nil
		}
	case "if":
		if schema.If != nil {
			if schema.If.Ref != "" {
				return &Ref{Ref: schema.If.Ref}, nil
			}
			return schema.If.Value, nil
		}
	case "then":
		if schema.Then != nil {
			if schema.Then.Ref != "" {
				return &Ref{Ref: schema.Then.Ref}, nil
			}
			return schema.Then.Value, nil
		}
	case "else":
		if schema.Else != nil {
			if schema.Else.Ref != "" {
				return &Ref{Ref: schema.Else.Ref}, nil
			}
			return schema.Else.Value, nil
		}
	case "dependentRequired":
		return schema.DependentRequired, nil
	case "$defs":
		return schema.Defs, nil
	case "$schema":
		return schema.SchemaDialect, nil
	case "$comment":
		return schema.Comment, nil
	case "$id":
		return schema.SchemaID, nil
	case "$anchor":
		return schema.Anchor, nil
	case "$dynamicRef":
		return schema.DynamicRef, nil
	case "$dynamicAnchor":
		return schema.DynamicAnchor, nil
	case "contentMediaType":
		return schema.ContentMediaType, nil
	case "contentEncoding":
		return schema.ContentEncoding, nil
	case "contentSchema":
		if schema.ContentSchema != nil {
			if schema.ContentSchema.Ref != "" {
				return &Ref{Ref: schema.ContentSchema.Ref}, nil
			}
			return schema.ContentSchema.Value, nil
		}
	}

	v, _, err := jsonpointer.GetForToken(schema.Extensions, token)
	return v, err
}

func (schema *Schema) NewRef() *SchemaRef {
	return &SchemaRef{
		Value: schema,
	}
}

func NewOneOfSchema(schemas ...*Schema) *Schema {
	refs := make([]*SchemaRef, 0, len(schemas))
	for _, schema := range schemas {
		refs = append(refs, &SchemaRef{Value: schema})
	}
	return &Schema{
		OneOf: refs,
	}
}

func NewAnyOfSchema(schemas ...*Schema) *Schema {
	refs := make([]*SchemaRef, 0, len(schemas))
	for _, schema := range schemas {
		refs = append(refs, &SchemaRef{Value: schema})
	}
	return &Schema{
		AnyOf: refs,
	}
}

func NewAllOfSchema(schemas ...*Schema) *Schema {
	refs := make([]*SchemaRef, 0, len(schemas))
	for _, schema := range schemas {
		refs = append(refs, &SchemaRef{Value: schema})
	}
	return &Schema{
		AllOf: refs,
	}
}

func NewBoolSchema() *Schema {
	return &Schema{
		Type: &Types{TypeBoolean},
	}
}

func NewFloat64Schema() *Schema {
	return &Schema{
		Type: &Types{TypeNumber},
	}
}

func NewIntegerSchema() *Schema {
	return &Schema{
		Type: &Types{TypeInteger},
	}
}

func NewInt32Schema() *Schema {
	return &Schema{
		Type:   &Types{TypeInteger},
		Format: "int32",
	}
}

func NewInt64Schema() *Schema {
	return &Schema{
		Type:   &Types{TypeInteger},
		Format: "int64",
	}
}

func NewStringSchema() *Schema {
	return &Schema{
		Type: &Types{TypeString},
	}
}

func NewDateTimeSchema() *Schema {
	return &Schema{
		Type:   &Types{TypeString},
		Format: "date-time",
	}
}

func NewUUIDSchema() *Schema {
	return &Schema{
		Type:   &Types{TypeString},
		Format: "uuid",
	}
}

func NewBytesSchema() *Schema {
	return &Schema{
		Type:   &Types{TypeString},
		Format: "byte",
	}
}

func NewArraySchema() *Schema {
	return &Schema{
		Type: &Types{TypeArray},
	}
}

func NewObjectSchema() *Schema {
	return &Schema{
		Type:       &Types{TypeObject},
		Properties: make(Schemas),
	}
}

func (schema *Schema) WithNullable() *Schema {
	schema.Nullable = true
	return schema
}

func (schema *Schema) WithMin(value float64) *Schema {
	schema.Min = &value
	return schema
}

func (schema *Schema) WithMax(value float64) *Schema {
	schema.Max = &value
	return schema
}

// WithExclusiveMin sets exclusiveMinimum as a boolean (OpenAPI 3.0 style).
func (schema *Schema) WithExclusiveMin(value bool) *Schema {
	schema.ExclusiveMin = ExclusiveBound{Bool: &value}
	return schema
}

// WithExclusiveMax sets exclusiveMaximum as a boolean (OpenAPI 3.0 style).
func (schema *Schema) WithExclusiveMax(value bool) *Schema {
	schema.ExclusiveMax = ExclusiveBound{Bool: &value}
	return schema
}

// WithExclusiveMinValue sets exclusiveMinimum as a number (OpenAPI 3.1 style).
func (schema *Schema) WithExclusiveMinValue(value float64) *Schema {
	schema.ExclusiveMin = ExclusiveBound{Value: &value}
	return schema
}

// WithExclusiveMaxValue sets exclusiveMaximum as a number (OpenAPI 3.1 style).
func (schema *Schema) WithExclusiveMaxValue(value float64) *Schema {
	schema.ExclusiveMax = ExclusiveBound{Value: &value}
	return schema
}

func (schema *Schema) WithEnum(values ...any) *Schema {
	schema.Enum = values
	return schema
}

func (schema *Schema) WithDefault(defaultValue any) *Schema {
	schema.Default = defaultValue
	return schema
}

func (schema *Schema) WithFormat(value string) *Schema {
	schema.Format = value
	return schema
}

func (schema *Schema) WithLength(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = n
	schema.MaxLength = &n
	return schema
}

func (schema *Schema) WithMinLength(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = n
	return schema
}

func (schema *Schema) WithMaxLength(i int64) *Schema {
	n := uint64(i)
	schema.MaxLength = &n
	return schema
}

func (schema *Schema) WithLengthDecodedBase64(i int64) *Schema {
	n := uint64(i)
	v := (n*8 + 5) / 6
	schema.MinLength = v
	schema.MaxLength = &v
	return schema
}

func (schema *Schema) WithMinLengthDecodedBase64(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = (n*8 + 5) / 6
	return schema
}

func (schema *Schema) WithMaxLengthDecodedBase64(i int64) *Schema {
	n := uint64(i)
	schema.MinLength = (n*8 + 5) / 6
	return schema
}

func (schema *Schema) WithPattern(pattern string) *Schema {
	schema.Pattern = pattern
	return schema
}

func (schema *Schema) WithItems(value *Schema) *Schema {
	schema.Items = &SchemaRef{
		Value: value,
	}
	return schema
}

func (schema *Schema) WithMinItems(i int64) *Schema {
	n := uint64(i)
	schema.MinItems = n
	return schema
}

func (schema *Schema) WithMaxItems(i int64) *Schema {
	n := uint64(i)
	schema.MaxItems = &n
	return schema
}

func (schema *Schema) WithUniqueItems(unique bool) *Schema {
	schema.UniqueItems = unique
	return schema
}

func (schema *Schema) WithProperty(name string, propertySchema *Schema) *Schema {
	return schema.WithPropertyRef(name, &SchemaRef{
		Value: propertySchema,
	})
}

func (schema *Schema) WithPropertyRef(name string, ref *SchemaRef) *Schema {
	if schema.Properties == nil {
		schema.Properties = make(Schemas)
	}
	schema.Properties[name] = ref
	return schema
}

func (schema *Schema) WithProperties(properties map[string]*Schema) *Schema {
	result := make(Schemas, len(properties))
	for k, v := range properties {
		result[k] = &SchemaRef{
			Value: v,
		}
	}
	schema.Properties = result
	return schema
}

func (schema *Schema) WithRequired(required []string) *Schema {
	schema.Required = required
	return schema
}

func (schema *Schema) WithMinProperties(i int64) *Schema {
	n := uint64(i)
	schema.MinProps = n
	return schema
}

func (schema *Schema) WithMaxProperties(i int64) *Schema {
	n := uint64(i)
	schema.MaxProps = &n
	return schema
}

func (schema *Schema) WithAnyAdditionalProperties() *Schema {
	schema.AdditionalProperties = AdditionalProperties{Has: Ptr(true)}
	return schema
}

func (schema *Schema) WithoutAdditionalProperties() *Schema {
	schema.AdditionalProperties = AdditionalProperties{Has: Ptr(false)}
	return schema
}

func (schema *Schema) WithAdditionalProperties(v *Schema) *Schema {
	schema.AdditionalProperties = AdditionalProperties{}
	if v != nil {
		schema.AdditionalProperties.Schema = &SchemaRef{Value: v}
	}
	return schema
}

func (schema *Schema) PermitsNull() bool {
	return schema.Nullable || schema.Type.IncludesNull()
}

// IsEmpty tells whether schema is equivalent to the empty schema `{}`.
func (schema *Schema) IsEmpty() bool {
	if schema.Type != nil || schema.Format != "" || len(schema.Enum) != 0 ||
		schema.UniqueItems || schema.ExclusiveMin.IsSet() || schema.ExclusiveMax.IsSet() ||
		schema.Nullable || schema.ReadOnly || schema.WriteOnly || schema.AllowEmptyValue ||
		schema.Min != nil || schema.Max != nil || schema.MultipleOf != nil ||
		schema.MinLength != 0 || schema.MaxLength != nil || schema.Pattern != "" ||
		schema.MinItems != 0 || schema.MaxItems != nil ||
		len(schema.Required) != 0 ||
		schema.MinProps != 0 || schema.MaxProps != nil ||
		schema.Const != nil {
		return false
	}
	if n := schema.Not; n != nil && n.Value != nil && !n.Value.IsEmpty() {
		return false
	}
	if ap := schema.AdditionalProperties.Schema; ap != nil && ap.Value != nil && !ap.Value.IsEmpty() {
		return false
	}
	if apa := schema.AdditionalProperties.Has; apa != nil && !*apa {
		return false
	}
	if items := schema.Items; items != nil && items.Value != nil && !items.Value.IsEmpty() {
		return false
	}
	for _, s := range schema.PrefixItems {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	if c := schema.Contains; c != nil && c.Value != nil && !c.Value.IsEmpty() {
		return false
	}
	if schema.MinContains != nil || schema.MaxContains != nil {
		return false
	}
	for _, s := range schema.Properties {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.PatternProperties {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.DependentSchemas {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	if pn := schema.PropertyNames; pn != nil && pn.Value != nil && !pn.Value.IsEmpty() {
		return false
	}
	if ui := schema.UnevaluatedItems.Schema; ui != nil && ui.Value != nil && !ui.Value.IsEmpty() {
		return false
	}
	if uih := schema.UnevaluatedItems.Has; uih != nil && !*uih {
		return false
	}
	if up := schema.UnevaluatedProperties.Schema; up != nil && up.Value != nil && !up.Value.IsEmpty() {
		return false
	}
	if uph := schema.UnevaluatedProperties.Has; uph != nil && !*uph {
		return false
	}
	if len(schema.Examples) != 0 {
		return false
	}
	for _, s := range schema.OneOf {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.AnyOf {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	for _, s := range schema.AllOf {
		if ss := s.Value; ss != nil && !ss.IsEmpty() {
			return false
		}
	}
	if f := schema.If; f != nil && f.Value != nil && !f.Value.IsEmpty() {
		return false
	}
	if t := schema.Then; t != nil && t.Value != nil && !t.Value.IsEmpty() {
		return false
	}
	if e := schema.Else; e != nil && e.Value != nil && !e.Value.IsEmpty() {
		return false
	}
	if len(schema.DependentRequired) != 0 {
		return false
	}
	if len(schema.Defs) != 0 {
		return false
	}
	if schema.SchemaDialect != "" || schema.Comment != "" {
		return false
	}
	if schema.SchemaID != "" || schema.Anchor != "" || schema.DynamicRef != "" || schema.DynamicAnchor != "" {
		return false
	}
	if schema.ContentMediaType != "" || schema.ContentEncoding != "" {
		return false
	}
	if cs := schema.ContentSchema; cs != nil && cs.Value != nil && !cs.Value.IsEmpty() {
		return false
	}
	return true
}

// Validate returns an error if Schema does not comply with the OpenAPI spec.
func (schema *Schema) Validate(ctx context.Context, opts ...ValidationOption) error {
	// Apply document-level validation options to the context
	ctx = WithValidationOptions(ctx, opts...)

	// Perform schema validation with the options in context
	_, err := schema.validate(ctx, []*Schema{})
	return err
}

// returns the updated stack and an error if Schema does not comply with the OpenAPI spec.
func (schema *Schema) validate(ctx context.Context, stack []*Schema) ([]*Schema, error) {
	if slices.Contains(stack, schema) {
		return stack, nil
	}

	validationOpts := getValidationOptions(ctx)

	stack = append(stack, schema)

	if schema.ReadOnly && schema.WriteOnly {
		return stack, newSchemaReadOnlyWriteOnlyExclusive(schema.Origin)
	}

	// The elements of `required` MUST be unique (JSON Schema 2020-12 §6.5.3
	// for OAS 3.1, draft-04 for OAS 3.0).
	if len(schema.Required) > 1 {
		seen := make(map[string]struct{}, len(schema.Required))
		for _, name := range schema.Required {
			if _, dup := seen[name]; dup {
				return stack, &DuplicateRequiredFieldError{Field: name, Origin: schema.Origin}
			}
			seen[name] = struct{}{}
		}
	}

	// Reject fields that only exist in OAS 3.1 / JSON Schema 2020-12 when the
	// document is OAS 3.0. Fields explicitly allowed via AllowExtraSiblingFields
	// are skipped (opt-in escape hatch for 3.0 docs that reference external
	// JSON Schema documents). Once 3.0 moves to its own schema validator this
	// block becomes a no-op.
	if !validationOpts.isOpenAPI31OrLater {
		allowed := validationOpts.extraSiblingFieldsAllowed
		reject := func(field string) error {
			if _, ok := allowed[field]; ok {
				return nil
			}
			return errFieldFor31Plus(field, schema.Origin)
		}
		if schema.Const != nil {
			if err := reject("const"); err != nil {
				return stack, err
			}
		}
		if len(schema.Examples) != 0 {
			if err := reject("examples"); err != nil {
				return stack, err
			}
		}
		if len(schema.PrefixItems) != 0 {
			if err := reject("prefixItems"); err != nil {
				return stack, err
			}
		}
		if schema.Contains != nil {
			if err := reject("contains"); err != nil {
				return stack, err
			}
		}
		if schema.MinContains != nil {
			if err := reject("minContains"); err != nil {
				return stack, err
			}
		}
		if schema.MaxContains != nil {
			if err := reject("maxContains"); err != nil {
				return stack, err
			}
		}
		if len(schema.PatternProperties) != 0 {
			if err := reject("patternProperties"); err != nil {
				return stack, err
			}
		}
		if len(schema.DependentSchemas) != 0 {
			if err := reject("dependentSchemas"); err != nil {
				return stack, err
			}
		}
		if schema.PropertyNames != nil {
			if err := reject("propertyNames"); err != nil {
				return stack, err
			}
		}
		if schema.UnevaluatedItems.Has != nil || schema.UnevaluatedItems.Schema != nil {
			if err := reject("unevaluatedItems"); err != nil {
				return stack, err
			}
		}
		if schema.UnevaluatedProperties.Has != nil || schema.UnevaluatedProperties.Schema != nil {
			if err := reject("unevaluatedProperties"); err != nil {
				return stack, err
			}
		}
		if schema.If != nil {
			if err := reject("if"); err != nil {
				return stack, err
			}
		}
		if schema.Then != nil {
			if err := reject("then"); err != nil {
				return stack, err
			}
		}
		if schema.Else != nil {
			if err := reject("else"); err != nil {
				return stack, err
			}
		}
		if len(schema.DependentRequired) != 0 {
			if err := reject("dependentRequired"); err != nil {
				return stack, err
			}
		}
		if len(schema.Defs) != 0 {
			if err := reject("$defs"); err != nil {
				return stack, err
			}
		}
		if schema.SchemaDialect != "" {
			if err := reject("$schema"); err != nil {
				return stack, err
			}
		}
		if schema.Comment != "" {
			if err := reject("$comment"); err != nil {
				return stack, err
			}
		}
		if schema.SchemaID != "" {
			if err := reject("$id"); err != nil {
				return stack, err
			}
		}
		if schema.Anchor != "" {
			if err := reject("$anchor"); err != nil {
				return stack, err
			}
		}
		if schema.DynamicRef != "" {
			if err := reject("$dynamicRef"); err != nil {
				return stack, err
			}
		}
		if schema.DynamicAnchor != "" {
			if err := reject("$dynamicAnchor"); err != nil {
				return stack, err
			}
		}
		if schema.ContentMediaType != "" {
			if err := reject("contentMediaType"); err != nil {
				return stack, err
			}
		}
		if schema.ContentEncoding != "" {
			if err := reject("contentEncoding"); err != nil {
				return stack, err
			}
		}
		if schema.ContentSchema != nil {
			if err := reject("contentSchema"); err != nil {
				return stack, err
			}
		}
	}

	for _, item := range schema.OneOf {
		v := item.Value
		if v == nil {
			return stack, newUnresolvedRef(item.Ref, item.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, &SchemaCombinatorElementValidationError{Combinator: "oneOf", Cause: err}
		}
	}

	for _, item := range schema.AnyOf {
		v := item.Value
		if v == nil {
			return stack, newUnresolvedRef(item.Ref, item.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, &SchemaCombinatorElementValidationError{Combinator: "anyOf", Cause: err}
		}
	}

	for _, item := range schema.AllOf {
		v := item.Value
		if v == nil {
			return stack, newUnresolvedRef(item.Ref, item.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, &SchemaCombinatorElementValidationError{Combinator: "allOf", Cause: err}
		}
	}

	if ref := schema.Not; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	if ref := schema.If; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}
		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if ref := schema.Then; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}
		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if ref := schema.Else; ref != nil {
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}
		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	for _, schemaType := range schema.Type.Slice() {
		switch schemaType {
		case TypeBoolean:
		case TypeNumber:
			if format := schema.Format; len(format) > 0 {
				switch format {
				case "float", "double":
				default:
					if _, ok := SchemaNumberFormats[format]; !ok && validationOpts.schemaFormatValidationEnabled {
						return stack, unsupportedFormat(format)
					}
				}
			}
		case TypeInteger:
			if format := schema.Format; len(format) > 0 {
				switch format {
				case "int32", "int64":
				default:
					if _, ok := SchemaIntegerFormats[format]; !ok && validationOpts.schemaFormatValidationEnabled {
						return stack, unsupportedFormat(format)
					}
				}
			}
		case TypeString:
			if format := schema.Format; len(format) > 0 {
				switch format {
				// Supported by OpenAPIv3.0.3:
				// https://spec.openapis.org/oas/v3.0.3
				case "byte", "binary", "date", "date-time", "password":
				// In JSON Draft-07 (not validated yet though):
				// https://json-schema.org/draft-07/json-schema-release-notes.html#formats
				case "iri", "iri-reference", "uri-template", "idn-email", "idn-hostname":
				case "json-pointer", "relative-json-pointer", "regex", "time":
				// In JSON Draft 2019-09 (not validated yet though):
				// https://json-schema.org/draft/2019-09/release-notes.html#format-vocabulary
				case "duration", "uuid":
				// Defined in some other specification
				case "email", "hostname", "ipv4", "ipv6", "uri", "uri-reference":
				default:
					if _, ok := SchemaStringFormats[format]; !ok && validationOpts.schemaFormatValidationEnabled {
						return stack, unsupportedFormat(format)
					}
				}
			}
			if !validationOpts.schemaPatternValidationDisabled && schema.Pattern != "" {
				if _, err := schema.compilePattern(validationOpts.regexCompilerFunc); err != nil {
					return stack, err
				}
			}
		case TypeArray:
			if schema.Items == nil && !validationOpts.jsonSchema2020ValidationEnabled && len(schema.PrefixItems) == 0 {
				return stack, newSchemaItemsRequired(schema.Origin)
			}
		case TypeObject:
		case TypeNull:
			if !validationOpts.jsonSchema2020ValidationEnabled {
				return stack, newSchemaTypeError(schemaType, schema.Origin)
			}
		default:
			return stack, newSchemaTypeError(schemaType, schema.Origin)
		}
	}

	if ref := schema.Items; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	for _, name := range componentNames(schema.Properties) {
		ref := schema.Properties[name]
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	if schema.AdditionalProperties.Has != nil && schema.AdditionalProperties.Schema != nil {
		return stack, newSchemaAdditionalPropertiesBothForms(schema.Origin)
	}
	if ref := schema.AdditionalProperties.Schema; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	// OpenAPI 3.1 / JSON Schema 2020-12 sub-schemas
	for _, ref := range schema.PrefixItems {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if ref := schema.Contains; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	for _, name := range componentNames(schema.PatternProperties) {
		ref := schema.PatternProperties[name]
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	for _, name := range componentNames(schema.DependentSchemas) {
		ref := schema.DependentSchemas[name]
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	for _, name := range componentNames(schema.Defs) {
		ref := schema.Defs[name]
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if ref := schema.PropertyNames; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if schema.UnevaluatedItems.Has != nil && schema.UnevaluatedItems.Schema != nil {
		return stack, newSchemaUnevaluatedItemsBothForms(schema.Origin)
	}
	if ref := schema.UnevaluatedItems.Schema; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if schema.UnevaluatedProperties.Has != nil && schema.UnevaluatedProperties.Schema != nil {
		return stack, newSchemaUnevaluatedPropertiesBothForms(schema.Origin)
	}
	if ref := schema.UnevaluatedProperties.Schema; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}
	if ref := schema.ContentSchema; ref != nil {
		if err := ref.validateExtras(ctx); err != nil {
			return stack, err
		}
		v := ref.Value
		if v == nil {
			return stack, newUnresolvedRef(ref.Ref, ref.Origin)
		}

		var err error
		if stack, err = v.validate(ctx, stack); err != nil {
			return stack, err
		}
	}

	if v := schema.ExternalDocs; v != nil {
		if err := v.Validate(ctx); err != nil {
			return stack, &SectionValidationError{Section: "external docs", Cause: err}
		}
	}

	if v := schema.Default; v != nil && !validationOpts.schemaDefaultsValidationDisabled {
		if err := validateExampleValue(ctx, v, schema); err != nil {
			return stack, newSchemaValueError("default", err, schema.Origin)
		}
	}

	if x := schema.Example; x != nil && !validationOpts.examplesValidationDisabled {
		if err := validateExampleValue(ctx, x, schema); err != nil {
			return stack, newSchemaValueError("example", err, schema.Origin)
		}
	}

	return stack, validateExtensions(ctx, schema.Extensions, schema.Origin)
}

func (schema *Schema) IsMatching(value any) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONBoolean(value bool) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONNumber(value float64) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONString(value string) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONArray(value []any) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

func (schema *Schema) IsMatchingJSONObject(value map[string]any) bool {
	settings := newSchemaValidationSettings(FailFast())
	return schema.visitJSON(settings, value) == nil
}

// VisitJSON applies a Schema to the given data, considering opts.
// To validate data against an OpenAPIv3.1+ schema, be sure to pass the EnableJSONSchema2020() option.
func (schema *Schema) VisitJSON(value any, opts ...SchemaValidationOption) error {
	settings := newSchemaValidationSettings(opts...)

	if settings.useJSONSchema2020 {
		return schema.useJSONSchema2020(settings, value)
	}
	return schema.visitJSON(settings, value)
}

func (schema *Schema) visitJSON(settings *schemaValidationSettings, value any) (err error) {
	switch value := value.(type) {
	case nil:
		// Don't use VisitJSONNull, as we still want to reach 'visitXOFOperations', since
		// those could allow for a nullable value even though this one doesn't
		if schema.PermitsNull() {
			return
		}
	case float64:
		if math.IsNaN(value) {
			return ErrSchemaInputNaN
		}
		if math.IsInf(value, 0) {
			return ErrSchemaInputInf
		}
	}

	if schema.IsEmpty() {
		switch value.(type) {
		case nil:
			return schema.visitJSONNull(settings)
		default:
			return
		}
	}

	if err = schema.visitNotOperation(settings, value); err != nil {
		return
	}
	var run bool
	if err, run = schema.visitXOFOperations(settings, value); err != nil || !run {
		return
	}
	if err = schema.visitEnumOperation(settings, value); err != nil {
		return
	}
	if err = schema.visitConstOperation(settings, value); err != nil {
		return
	}

	switch value := value.(type) {
	case nil:
		return schema.visitJSONNull(settings)
	case bool:
		return schema.visitJSONBoolean(settings, value)
	case json.Number:
		valueFloat64, err := value.Float64()
		if err != nil {
			return &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "type",
				Reason:                "cannot convert json.Number to float64",
				customizeMessageError: settings.customizeMessageError,
				Origin:                err,
			}
		}
		return schema.visitJSONNumber(settings, valueFloat64)
	case int:
		return schema.visitJSONNumber(settings, float64(value))
	case int32:
		return schema.visitJSONNumber(settings, float64(value))
	case int64:
		return schema.visitJSONNumber(settings, float64(value))
	case float64:
		return schema.visitJSONNumber(settings, value)
	case string:
		return schema.visitJSONString(settings, value)
	case []any:
		return schema.visitJSONArray(settings, value)
	case map[string]any:
		return schema.visitJSONObject(settings, value)
	case map[any]any: // for YAML cf. issue https://github.com/getkin/kin-openapi/issues/444
		values := make(map[string]any, len(value))
		for key, v := range value {
			if k, ok := key.(string); ok {
				values[k] = v
			}
		}
		if len(value) == len(values) {
			return schema.visitJSONObject(settings, values)
		}
	}

	// Catch slice of non-empty interface type
	if reflect.TypeOf(value).Kind() == reflect.Slice {
		valueR := reflect.ValueOf(value)
		newValue := make([]any, 0, valueR.Len())
		for i := 0; i < valueR.Len(); i++ {
			newValue = append(newValue, valueR.Index(i).Interface())
		}
		return schema.visitJSONArray(settings, newValue)
	}

	return &SchemaError{
		Value:                 value,
		Schema:                schema,
		SchemaField:           "type",
		Reason:                fmt.Sprintf("unhandled value of type %T", value),
		customizeMessageError: settings.customizeMessageError,
	}
}

func (schema *Schema) visitEnumOperation(settings *schemaValidationSettings, value any) (err error) {
	if enum := schema.Enum; len(enum) != 0 {
		for _, v := range enum {
			switch c := value.(type) {
			case json.Number:
				var f float64
				if f, err = strconv.ParseFloat(c.String(), 64); err != nil {
					return err
				}
				if v == f {
					return
				}
			case int64:
				if v == float64(c) {
					return
				}
			default:
				if reflect.DeepEqual(v, value) {
					return
				}
			}
		}
		if settings.failfast {
			return errSchema
		}
		allowedValues, _ := json.Marshal(enum)
		return &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "enum",
			Reason:                "value is not one of the allowed values " + string(allowedValues),
			customizeMessageError: settings.customizeMessageError,
		}
	}
	return
}

func (schema *Schema) visitConstOperation(settings *schemaValidationSettings, value any) (err error) {
	if schema.Const == nil {
		return
	}
	var match bool
	switch c := value.(type) {
	case json.Number:
		var f float64
		if f, err = strconv.ParseFloat(c.String(), 64); err != nil {
			return err
		}
		match = reflect.DeepEqual(schema.Const, f)
	case int64:
		match = reflect.DeepEqual(schema.Const, float64(c))
	default:
		match = reflect.DeepEqual(schema.Const, value)
	}
	if !match {
		if settings.failfast {
			return errSchema
		}
		constVal, _ := json.Marshal(schema.Const)
		return &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "const",
			Reason:                "value must be " + string(constVal),
			customizeMessageError: settings.customizeMessageError,
		}
	}
	return
}

func (schema *Schema) visitNotOperation(settings *schemaValidationSettings, value any) (err error) {
	if ref := schema.Not; ref != nil {
		v := ref.Value
		if v == nil {
			return newUnresolvedRef(ref.Ref, ref.Origin)
		}
		if err := v.visitJSON(settings, value); err == nil {
			if settings.failfast {
				return errSchema
			}
			return &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "not",
				customizeMessageError: settings.customizeMessageError,
			}
		}
	}
	return
}

// If the XOF operations pass successfully, abort further run of validation, as they will already be satisfied (unless the schema
// itself is badly specified
// resolveDiscriminatorRef resolves the discriminator reference for oneOf/anyOf validation.
// Returns the discriminator ref string and any error encountered during resolution.
func (schema *Schema) resolveDiscriminatorRef(value any) (string, error) {
	if schema.Discriminator == nil {
		return "", nil
	}
	pn := schema.Discriminator.PropertyName
	valuemap, okcheck := value.(map[string]any)
	if !okcheck {
		return "", nil
	}
	discriminatorVal, okcheck := valuemap[pn]
	if !okcheck {
		return "", &SchemaError{
			Schema:      schema,
			SchemaField: "discriminator",
			Reason:      fmt.Sprintf("input does not contain the discriminator property %q", pn),
		}
	}

	discriminatorValString, okcheck := discriminatorVal.(string)
	if !okcheck {
		return "", &SchemaError{
			Value:       discriminatorVal,
			Schema:      schema,
			SchemaField: "discriminator",
			Reason:      fmt.Sprintf("value of discriminator property %q is not a string", pn),
		}
	}

	if discriminatorRef, okcheck := schema.Discriminator.Mapping[discriminatorValString]; len(schema.Discriminator.Mapping) > 0 && !okcheck {
		return "", &SchemaError{
			Value:       discriminatorVal,
			Schema:      schema,
			SchemaField: "discriminator",
			Reason:      fmt.Sprintf("discriminator property %q has invalid value", pn),
		}
	} else {
		return discriminatorRef.Ref, nil
	}
}

func (schema *Schema) visitXOFOperations(settings *schemaValidationSettings, value any) (err error, run bool) {
	var visitedOneOf, visitedAnyOf, visitedAllOf bool
	if v := schema.OneOf; len(v) > 0 {
		discriminatorRef, err := schema.resolveDiscriminatorRef(value)
		if err != nil {
			return err, false
		}

		var (
			ok                  = 0
			validationErrors    = multiErrorForOneOf{}
			matchedOneOfIndices = make([]int, 0)
			tempValue           = value
		)
		for idx, item := range v {
			v := item.Value
			if v == nil {
				return newUnresolvedRef(item.Ref, item.Origin), false
			}

			if discriminatorRef != "" && discriminatorRef != item.Ref {
				continue
			}

			// make a deep copy to protect origin value from being injected default value that defined in mismatched oneOf schema
			if settings.asreq || settings.asrep {
				tempValue = deepCopyJSONValue(value)
			}

			if err := v.visitJSON(settings, tempValue); err != nil {
				validationErrors = append(validationErrors, err)
				continue
			}

			matchedOneOfIndices = append(matchedOneOfIndices, idx)
			ok++
		}

		if ok != 1 {
			if settings.failfast {
				return errSchema, false
			}
			e := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "oneOf",
				customizeMessageError: settings.customizeMessageError,
			}
			if ok > 1 {
				e.Origin = ErrOneOfConflict
				e.Reason = fmt.Sprintf(`value matches more than one schema from "oneOf" (matches schemas at indices %v)`, matchedOneOfIndices)
			} else {
				e.Origin = fmt.Errorf("doesn't match schema due to: %w", validationErrors)
				e.Reason = `value doesn't match any schema from "oneOf"`
			}

			return e, false
		}

		// run again to inject default value that defined in matched oneOf schema
		if settings.asreq || settings.asrep {
			_ = v[matchedOneOfIndices[0]].Value.visitJSON(settings, value)
		}
		visitedOneOf = true
	}

	if v := schema.AnyOf; len(v) > 0 {
		discriminatorRef, err := schema.resolveDiscriminatorRef(value)
		if err != nil {
			return err, false
		}

		var (
			ok              = false
			matchedAnyOfIdx = 0
			tempValue       = value
		)
		for idx, item := range v {
			v := item.Value
			if v == nil {
				return newUnresolvedRef(item.Ref, item.Origin), false
			}

			if discriminatorRef != "" && discriminatorRef != item.Ref {
				continue
			}

			// make a deep copy to protect origin value from being injected default value that defined in mismatched anyOf schema
			if settings.asreq || settings.asrep {
				tempValue = deepCopyJSONValue(value)
			}
			if err := v.visitJSON(settings, tempValue); err == nil {
				ok = true
				matchedAnyOfIdx = idx
				break
			}
		}
		if !ok {
			if settings.failfast {
				return errSchema, false
			}
			return &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "anyOf",
				Reason:                `doesn't match any schema from "anyOf"`,
				customizeMessageError: settings.customizeMessageError,
			}, false
		}

		_ = v[matchedAnyOfIdx].Value.visitJSON(settings, value)
		visitedAnyOf = true
	}

	validationErrors := multiErrorForAllOf{}
	for _, item := range schema.AllOf {
		v := item.Value
		if v == nil {
			return newUnresolvedRef(item.Ref, item.Origin), false
		}
		if err := v.visitJSON(settings, value); err != nil {
			if settings.failfast {
				return errSchema, false
			}
			validationErrors = append(validationErrors, err)
		}
		visitedAllOf = true
	}
	if len(validationErrors) > 0 {
		return &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "allOf",
			Reason:                `doesn't match all schemas from "allOf"`,
			Origin:                fmt.Errorf("doesn't match schema due to: %w", validationErrors),
			customizeMessageError: settings.customizeMessageError,
		}, false
	}

	run = !((visitedOneOf || visitedAnyOf || visitedAllOf) && value == nil)
	return
}

// The value is not considered in visitJSONNull because according to the spec
// "null is not supported as a type" unless `nullable` is also set to true
// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#data-types
// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#schema-object
func (schema *Schema) visitJSONNull(settings *schemaValidationSettings) (err error) {
	if schema.PermitsNull() {
		return
	}
	if settings.failfast {
		return errSchema
	}
	return &SchemaError{
		Value:                 nil,
		Schema:                schema,
		SchemaField:           "nullable",
		Reason:                "Value is not nullable",
		customizeMessageError: settings.customizeMessageError,
	}
}

func (schema *Schema) VisitJSONBoolean(value bool) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONBoolean(settings, value)
}

func (schema *Schema) visitJSONBoolean(settings *schemaValidationSettings, value bool) (err error) {
	if !schema.Type.Permits(TypeBoolean) {
		return schema.expectedType(settings, value)
	}
	return
}

func (schema *Schema) VisitJSONNumber(value float64) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONNumber(settings, value)
}

func (schema *Schema) visitJSONNumber(settings *schemaValidationSettings, value float64) error {
	var me MultiError
	schemaType := schema.Type
	requireInteger := false
	if schemaType.Permits(TypeInteger) && !schemaType.Permits(TypeNumber) {
		requireInteger = true
		if bigFloat := big.NewFloat(value); !bigFloat.IsInt() {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "type",
				Reason:                "value must be an integer",
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	} else if !(schemaType.Permits(TypeInteger) || schemaType.Permits(TypeNumber)) {
		return schema.expectedType(settings, value)
	}

	// formats
	var formatStrErr string
	var formatErr error
	format := schema.Format
	if format != "" {
		if requireInteger {
			// Check per-validation validators first, then fall back to global
			f, ok := settings.integerFormats[format]
			if !ok {
				f, ok = SchemaIntegerFormats[format]
			}
			if ok {
				if err := f.Validate(int64(value)); err != nil {
					var reason string
					schemaErr := &SchemaError{}
					if errors.As(err, &schemaErr) {
						reason = schemaErr.Reason
					} else {
						reason = err.Error()
					}
					formatStrErr = fmt.Sprintf(`integer doesn't match the format %q (%v)`, format, reason)
					formatErr = fmt.Errorf("integer doesn't match the format %q: %w", format, err)
				}
			}
		} else {
			// Check per-validation validators first, then fall back to global
			f, ok := settings.numberFormats[format]
			if !ok {
				f, ok = SchemaNumberFormats[format]
			}
			if ok {
				if err := f.Validate(value); err != nil {
					var reason string
					schemaErr := &SchemaError{}
					if errors.As(err, &schemaErr) {
						reason = schemaErr.Reason
					} else {
						reason = err.Error()
					}
					formatStrErr = fmt.Sprintf(`number doesn't match the format %q (%v)`, format, reason)
					formatErr = fmt.Errorf("number doesn't match the format %q: %w", format, err)
				}
			}
		}
	}

	if formatStrErr != "" || formatErr != nil {
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "format",
			Reason:                formatStrErr,
			Origin:                formatErr,
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "exclusiveMinimum"
	// OpenAPI 3.0: boolean modifier for minimum
	// OpenAPI 3.1: number representing the actual exclusive bound
	if eb := schema.ExclusiveMin; eb.IsSet() {
		var exclusiveMinBound float64
		var valid bool
		if eb.Value != nil {
			// OpenAPI 3.1 style: exclusiveMinimum is the bound itself
			exclusiveMinBound = *eb.Value
			valid = value > exclusiveMinBound
		} else if eb.Bool != nil && *eb.Bool && schema.Min != nil {
			// OpenAPI 3.0 style: exclusiveMinimum modifies minimum
			exclusiveMinBound = *schema.Min
			valid = value > exclusiveMinBound
		} else {
			valid = true
		}
		if !valid {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "exclusiveMinimum",
				Reason:                fmt.Sprintf("number must be more than %g", exclusiveMinBound),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	// "exclusiveMaximum"
	// OpenAPI 3.0: boolean modifier for maximum
	// OpenAPI 3.1: number representing the actual exclusive bound
	if eb := schema.ExclusiveMax; eb.IsSet() {
		var exclusiveMaxBound float64
		var valid bool
		if eb.Value != nil {
			// OpenAPI 3.1 style: exclusiveMaximum is the bound itself
			exclusiveMaxBound = *eb.Value
			valid = value < exclusiveMaxBound
		} else if eb.Bool != nil && *eb.Bool && schema.Max != nil {
			// OpenAPI 3.0 style: exclusiveMaximum modifies maximum
			exclusiveMaxBound = *schema.Max
			valid = value < exclusiveMaxBound
		} else {
			valid = true
		}
		if !valid {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "exclusiveMaximum",
				Reason:                fmt.Sprintf("number must be less than %g", exclusiveMaxBound),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	// "minimum"
	if v := schema.Min; v != nil && !(*v <= value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "minimum",
			Reason:                fmt.Sprintf("number must be at least %g", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "maximum"
	if v := schema.Max; v != nil && !(*v >= value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "maximum",
			Reason:                fmt.Sprintf("number must be at most %g", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "multipleOf"
	if v := schema.MultipleOf; v != nil {
		// "A numeric instance is valid only if division by this keyword's
		//    value results in an integer."
		numRat, denRat := &big.Rat{}, &big.Rat{}
		numRat.SetString(fmt.Sprintf("%.10f", value))
		denRat.SetString(fmt.Sprintf("%.10f", *v))
		if !(&big.Rat{}).Quo(numRat, denRat).IsInt() {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "multipleOf",
				Reason:                fmt.Sprintf("number must be a multiple of %g", *v),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) VisitJSONString(value string) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONString(settings, value)
}

func (schema *Schema) visitJSONString(settings *schemaValidationSettings, value string) error {
	if !schema.Type.Permits(TypeString) {
		return schema.expectedType(settings, value)
	}

	var me MultiError

	// "minLength" and "maxLength"
	minLength := schema.MinLength
	maxLength := schema.MaxLength
	if minLength != 0 || maxLength != nil {
		// JSON schema string lengths are UTF-16, not UTF-8!
		length := int64(0)
		for _, r := range value {
			if utf16.IsSurrogate(r) {
				length += 2
			} else {
				length++
			}
		}
		if minLength != 0 && length < int64(minLength) {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "minLength",
				Reason:                fmt.Sprintf("minimum string length is %d", minLength),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
		if maxLength != nil && length > int64(*maxLength) {
			if settings.failfast {
				return errSchema
			}
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "maxLength",
				Reason:                fmt.Sprintf("maximum string length is %d", *maxLength),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	// "pattern"
	if !settings.patternValidationDisabled && schema.Pattern != "" {
		cpiface, _ := compiledPatterns.Load(schema.Pattern)
		cp, _ := cpiface.(RegexMatcher)
		if cp == nil {
			var err error
			if cp, err = schema.compilePattern(settings.regexCompiler); err != nil {
				if !settings.multiError {
					return err
				}
				me = append(me, err)
			}
		}
		if !cp.MatchString(value) {
			err := &SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "pattern",
				Reason:                fmt.Sprintf(`string doesn't match the regular expression "%s"`, schema.Pattern),
				customizeMessageError: settings.customizeMessageError,
			}
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	// "format"
	var formatStrErr string
	var formatErr error
	if format := schema.Format; format != "" {
		// Check per-validation validators first, then fall back to global
		f, ok := settings.stringFormats[format]
		if !ok {
			f, ok = SchemaStringFormats[format]
		}
		if ok {
			if err := f.Validate(value); err != nil {
				var reason string
				schemaErr := &SchemaError{}
				if errors.As(err, &schemaErr) {
					reason = schemaErr.Reason
				} else {
					reason = err.Error()
				}
				formatStrErr = fmt.Sprintf(`string doesn't match the format %q (%v)`, format, reason)
				formatErr = fmt.Errorf("string doesn't match the format %q: %w", format, err)
			}
		}
	}
	if formatStrErr != "" || formatErr != nil {
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "format",
			Reason:                formatStrErr,
			Origin:                formatErr,
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)

	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) VisitJSONArray(value []any) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONArray(settings, value)
}

func (schema *Schema) visitJSONArray(settings *schemaValidationSettings, value []any) error {
	if !schema.Type.Permits(TypeArray) {
		return schema.expectedType(settings, value)
	}

	var me MultiError

	lenValue := int64(len(value))

	// "minItems"
	if v := schema.MinItems; v != 0 && lenValue < int64(v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "minItems",
			Reason:                fmt.Sprintf("minimum number of items is %d", v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "maxItems"
	if v := schema.MaxItems; v != nil && lenValue > int64(*v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "maxItems",
			Reason:                fmt.Sprintf("maximum number of items is %d", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "uniqueItems"
	if sliceUniqueItemsChecker == nil {
		sliceUniqueItemsChecker = isSliceOfUniqueItems
	}
	if v := schema.UniqueItems; v && !sliceUniqueItemsChecker(value) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "uniqueItems",
			Reason:                "duplicate items found",
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "items"
	if itemSchemaRef := schema.Items; itemSchemaRef != nil {
		itemSchema := itemSchemaRef.Value
		if itemSchema == nil {
			return newUnresolvedRef(itemSchemaRef.Ref, itemSchemaRef.Origin)
		}
		for i, item := range value {
			if err := itemSchema.visitJSON(settings, item); err != nil {
				err = markSchemaErrorIndex(err, i)
				if !settings.multiError {
					return err
				}
				if itemMe, ok := err.(MultiError); ok {
					me = append(me, itemMe...)
				} else {
					me = append(me, err)
				}
			}
		}
	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) VisitJSONObject(value map[string]any) error {
	settings := newSchemaValidationSettings()
	return schema.visitJSONObject(settings, value)
}

func (schema *Schema) visitJSONObject(settings *schemaValidationSettings, value map[string]any) error {
	if !schema.Type.Permits(TypeObject) {
		return schema.expectedType(settings, value)
	}

	var me MultiError

	if settings.asreq || settings.asrep {
		for _, propName := range componentNames(schema.Properties) {
			propSchema := schema.Properties[propName]
			reqRO := settings.asreq && propSchema.Value.ReadOnly && !settings.readOnlyValidationDisabled
			repWO := settings.asrep && propSchema.Value.WriteOnly && !settings.writeOnlyValidationDisabled

			if f := settings.defaultsSet; f != nil && value[propName] == nil {
				if dflt := propSchema.Value.Default; dflt != nil && !reqRO && !repWO {
					value[propName] = dflt
					settings.onceSettingDefaults.Do(f)
				}
			}

			if value[propName] != nil {
				if reqRO {
					me = append(me, fmt.Errorf("readOnly property %q in request", propName))
				} else if repWO {
					me = append(me, fmt.Errorf("writeOnly property %q in response", propName))
				}
			}
		}
	}

	// "properties"
	properties := schema.Properties
	lenValue := int64(len(value))

	// "minProperties"
	if v := schema.MinProps; v != 0 && lenValue < int64(v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "minProperties",
			Reason:                fmt.Sprintf("there must be at least %d properties", v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "maxProperties"
	if v := schema.MaxProps; v != nil && lenValue > int64(*v) {
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "maxProperties",
			Reason:                fmt.Sprintf("there must be at most %d properties", *v),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "additionalProperties"
	var additionalProperties *Schema
	if ref := schema.AdditionalProperties.Schema; ref != nil {
		additionalProperties = ref.Value
	}
	for _, k := range componentNames(value) {
		v := value[k]
		if properties != nil {
			propertyRef := properties[k]
			if propertyRef != nil {
				p := propertyRef.Value
				if p == nil {
					return newUnresolvedRef(propertyRef.Ref, propertyRef.Origin)
				}
				if err := p.visitJSON(settings, v); err != nil {
					if settings.failfast {
						return errSchema
					}
					err = markSchemaErrorKey(err, k)
					if !settings.multiError {
						return err
					}
					if v, ok := err.(MultiError); ok {
						me = append(me, v...)
						continue
					}
					me = append(me, err)
				}
				continue
			}
		}
		if allowed := schema.AdditionalProperties.Has; allowed == nil || *allowed {
			if additionalProperties != nil {
				if err := additionalProperties.visitJSON(settings, v); err != nil {
					if settings.failfast {
						return errSchema
					}
					err = markSchemaErrorKey(err, k)
					if !settings.multiError {
						return err
					}
					if v, ok := err.(MultiError); ok {
						me = append(me, v...)
						continue
					}
					me = append(me, err)
				}
			}
			continue
		}
		if settings.failfast {
			return errSchema
		}
		err := &SchemaError{
			Value:                 value,
			Schema:                schema,
			SchemaField:           "properties",
			Reason:                fmt.Sprintf("property %q is unsupported", k),
			customizeMessageError: settings.customizeMessageError,
		}
		if !settings.multiError {
			return err
		}
		me = append(me, err)
	}

	// "required"
	for _, k := range schema.Required {
		if _, ok := value[k]; !ok {
			if s := schema.Properties[k]; s != nil && s.Value.ReadOnly && settings.asreq {
				continue
			}
			if s := schema.Properties[k]; s != nil && s.Value.WriteOnly && settings.asrep {
				continue
			}
			if settings.failfast {
				return errSchema
			}
			err := markSchemaErrorKey(&SchemaError{
				Value:                 value,
				Schema:                schema,
				SchemaField:           "required",
				Reason:                fmt.Sprintf("property %q is missing", k),
				customizeMessageError: settings.customizeMessageError,
			}, k)
			if !settings.multiError {
				return err
			}
			me = append(me, err)
		}
	}

	if len(me) > 0 {
		return me
	}

	return nil
}

func (schema *Schema) expectedType(settings *schemaValidationSettings, value any) error {
	if settings.failfast {
		return errSchema
	}

	a := "a"
	var x string
	schemaTypes := (*schema.Type)
	if len(schemaTypes) == 1 {
		x = schemaTypes[0]
		switch x {
		case TypeArray, TypeObject, TypeInteger:
			a = "an"
		}
	} else {
		a = "one of"
		x = strings.Join(schemaTypes, ", ")
	}
	return &SchemaError{
		Value:                 value,
		Schema:                schema,
		SchemaField:           "type",
		Reason:                fmt.Sprintf("value must be %s %s", a, x),
		customizeMessageError: settings.customizeMessageError,
	}
}

// SchemaError is an error that occurs during schema validation.
type SchemaError struct {
	// Value is the value that failed validation.
	Value any
	// reversePath is the path to the value that failed validation.
	reversePath []string
	// Schema is the schema that failed validation.
	Schema *Schema
	// SchemaField is the field of the schema that failed validation.
	SchemaField string
	// Reason is a human-readable message describing the error.
	// The message should never include the original value to prevent leakage of potentially sensitive inputs in error messages.
	Reason string
	// Origin is the original error that caused this error.
	Origin error
	// customizeMessageError is a function that can be used to customize the error message.
	customizeMessageError func(err *SchemaError) string
}

var _ interface{ Unwrap() error } = SchemaError{}

func markSchemaErrorKey(err error, key string) error {

	if v, ok := err.(*SchemaError); ok {
		v.reversePath = append(v.reversePath, key)
		if v.Origin != nil {
			if unwrapped := errors.Unwrap(v.Origin); unwrapped != nil {
				if me, ok := unwrapped.(multiErrorForOneOf); ok {
					_ = markSchemaErrorKey(MultiError(me), key)
				}
				if me, ok := unwrapped.(multiErrorForAllOf); ok {
					_ = markSchemaErrorKey(MultiError(me), key)
				}
			}
		}
		return v
	}
	if v, ok := err.(MultiError); ok {
		for _, e := range v {
			_ = markSchemaErrorKey(e, key)
		}
		return v
	}
	return err
}

func markSchemaErrorIndex(err error, index int) error {
	return markSchemaErrorKey(err, strconv.FormatInt(int64(index), 10))
}

func (err *SchemaError) JSONPointer() []string {
	reversePath := err.reversePath
	path := append([]string(nil), reversePath...)
	for left, right := 0, len(path)-1; left < right; left, right = left+1, right-1 {
		path[left], path[right] = path[right], path[left]
	}
	return path
}

func (err *SchemaError) Error() string {
	if err.customizeMessageError != nil {
		if msg := err.customizeMessageError(err); msg != "" {
			return msg
		}
	}

	buf := bytes.NewBuffer(make([]byte, 0, 256))

	if len(err.reversePath) > 0 {
		buf.WriteString(`Error at "`)
		reversePath := err.reversePath
		for _, r := range slices.Backward(reversePath) {
			buf.WriteByte('/')
			buf.WriteString(r)
		}
		buf.WriteString(`": `)
	}

	if err.Origin != nil {
		buf.WriteString(err.Origin.Error())

		return buf.String()
	}

	reason := err.Reason
	if reason == "" {
		buf.WriteString(`Doesn't match schema "`)
		buf.WriteString(err.SchemaField)
		buf.WriteString(`"`)
	} else {
		buf.WriteString(reason)
	}

	if !SchemaErrorDetailsDisabled {
		buf.WriteString("\nSchema:\n  ")
		encoder := json.NewEncoder(buf)
		encoder.SetIndent("  ", "  ")
		if err := encoder.Encode(err.Schema); err != nil {
			panic(err)
		}
		buf.WriteString("\nValue:\n  ")
		if err := encoder.Encode(err.Value); err != nil {
			panic(err)
		}
	}

	return buf.String()
}

func (err SchemaError) Unwrap() error {
	return err.Origin
}

func isSliceOfUniqueItems(xs []any) bool {
	s := len(xs)
	m := make(map[string]struct{}, s)
	for _, x := range xs {
		// The input slice is converted from a JSON string, there shall
		// have no error when convert it back.
		key, _ := json.Marshal(&x)
		m[string(key)] = struct{}{}
	}
	return s == len(m)
}

// SliceUniqueItemsChecker is an function used to check if an given slice
// have unique items.
type SliceUniqueItemsChecker func(items []any) bool

// By default using predefined func isSliceOfUniqueItems which make use of
// json.Marshal to generate a key for map used to check if a given slice
// have unique items.
var sliceUniqueItemsChecker SliceUniqueItemsChecker = isSliceOfUniqueItems

// RegisterArrayUniqueItemsChecker is used to register a customized function
// used to check if JSON array have unique items.
func RegisterArrayUniqueItemsChecker(fn SliceUniqueItemsChecker) {
	sliceUniqueItemsChecker = fn
}

func unsupportedFormat(format string) error {
	return fmt.Errorf("unsupported 'format' value %q", format)
}

func deepCopyJSONValue(v any) any {
	switch v := v.(type) {
	case map[string]any:
		cp := make(map[string]any, len(v))
		for k, val := range v {
			cp[k] = deepCopyJSONValue(val)
		}
		return cp
	case []any:
		cp := make([]any, 0, len(v))
		for _, val := range v {
			cp = append(cp, deepCopyJSONValue(val))
		}
		return cp
	default:
		return v // string, float64, bool, nil — all immutable
	}
}
