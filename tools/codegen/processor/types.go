package processor

import (
	"fmt"
	"io/fs"
	"slices"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/pb33f/libopenapi/datamodel/high/base"
)

type KindIdentifier string

const (
	KindIdentifierObject KindIdentifier = "object"
	KindIdentifierScalar KindIdentifier = "scalar"
	KindIdentifierArray  KindIdentifier = "array"
	KindIdentifierEnum   KindIdentifier = "enum"
	KindIdentifierMap    KindIdentifier = "map"
	KindIdentifierAlias  KindIdentifier = "alias"
)

type Plugin interface { //nolint:interfacebloat
	GetTemplates() fs.FS
	GetFuncMap() map[string]any
	TypeObjectName(name string) string
	TypeScalarName(scalar *TypeScalar) string
	TypeArrayName(array *TypeArray) string
	TypeEnumName(name string) string
	TypeEnumValues(values []any) []string
	TypeMapName(mapType *TypeMap) string
	MethodName(name string) string
	MethodPath(name string) string
	ParameterName(name string) string
	PropertyName(name string) string
	BinaryType() string
}

type Type interface {
	Name() string
	Kind() KindIdentifier
	Schema() *base.SchemaProxy
}

type TypeObject struct {
	name       string
	schema     *base.SchemaProxy
	properties []*Property
	p          Plugin
}

func (t *TypeObject) Name() string {
	return t.p.TypeObjectName(t.name)
}

func (t *TypeObject) Kind() KindIdentifier {
	return KindIdentifierObject
}

func (t *TypeObject) Schema() *base.SchemaProxy {
	return t.schema
}

func (t *TypeObject) Properties() []*Property {
	return t.properties
}

type Property struct {
	// the name of the field for this property
	name string
	// The parent type that this property belongs to
	Parent Type
	// The type of the property
	Type Type
	p    Plugin
}

func (p *Property) Name() string {
	return p.p.PropertyName(p.name)
}

func (p *Property) Required() bool {
	return slices.Contains(
		p.Parent.Schema().Schema().Required,
		p.name,
	)
}

type TypeEnum struct {
	name   string
	schema *base.SchemaProxy
	values []any
	p      Plugin
}

func (t *TypeEnum) Name() string {
	return t.p.TypeEnumName(t.name)
}

func (t *TypeEnum) Values() []string {
	return t.p.TypeEnumValues(t.values)
}

func (t *TypeEnum) Kind() KindIdentifier {
	return KindIdentifierEnum
}

func (t *TypeEnum) Schema() *base.SchemaProxy {
	return t.schema
}

type TypeAlias struct {
	name   string
	schema *base.SchemaProxy
	alias  Type
	p      Plugin
}

func (t *TypeAlias) Name() string {
	return t.p.TypeObjectName(t.name)
}

func (t *TypeAlias) Alias() Type { //nolint:ireturn
	return t.alias
}

func (t *TypeAlias) Kind() KindIdentifier {
	return KindIdentifierAlias
}

func (t *TypeAlias) Schema() *base.SchemaProxy {
	return t.schema
}

type TypeScalar struct {
	schema *base.SchemaProxy
	p      Plugin
}

func (t *TypeScalar) Name() string {
	return t.p.TypeScalarName(t)
}

func (t *TypeScalar) Kind() KindIdentifier {
	return KindIdentifierScalar
}

func (t *TypeScalar) Schema() *base.SchemaProxy {
	return t.schema
}

type TypeArray struct {
	schema *base.SchemaProxy
	Item   Type
	p      Plugin
}

func (t *TypeArray) Name() string {
	return t.p.TypeArrayName(t)
}

func (t *TypeArray) Kind() KindIdentifier {
	return KindIdentifierArray
}

func (t *TypeArray) Schema() *base.SchemaProxy {
	return t.schema
}

type TypeMap struct {
	schema *base.SchemaProxy
	p      Plugin
}

func (t *TypeMap) Name() string {
	return t.p.TypeMapName(t)
}

func (t *TypeMap) Kind() KindIdentifier {
	return KindIdentifierMap
}

func (t *TypeMap) Schema() *base.SchemaProxy {
	return t.schema
}

func getTypeObject( //nolint:ireturn
	schema *base.SchemaProxy, derivedName string, p Plugin,
) (Type, []Type, error) {
	if schema.IsReference() {
		derivedName = format.GetNameFromComponentRef(schema.GetReference())
	}

	if schema.Schema().Properties == nil {
		if schema.Schema().AdditionalProperties.B {
			return &TypeMap{
				schema: schema,
				p:      p,
			}, nil, nil
		}

		return nil, nil, fmt.Errorf(
			"%w: object schema %s has no properties and no additional properties",
			ErrUnknownType,
			derivedName,
		)
	}

	t, tt, err := NewObject(derivedName, schema, p)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create object type: %w", err)
	}

	if schema.IsReference() {
		return t, nil, nil
	}

	return t, append(tt, t), nil
}

func getTypeArray(schema *base.SchemaProxy, p Plugin) (Type, []Type, error) { //nolint:ireturn
	item := schema.Schema().Items.A
	if item.IsReference() {
		t, _, err := GetType(item, format.GetNameFromComponentRef(item.GetReference()), p, false)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to get type for array item: %w", err)
		}

		return &TypeArray{
			schema: schema,
			p:      p,
			Item:   t,
		}, nil, nil
	}

	return &TypeArray{
		schema: schema,
		p:      p,
		Item: &TypeScalar{
			schema: item,
			p:      p,
		},
	}, nil, nil
}

func getTypeEnum( //nolint:ireturn
	schema *base.SchemaProxy, derivedName string, p Plugin,
) (Type, []Type, error) {
	if schema.IsReference() {
		return &TypeEnum{
			schema: schema,
			name:   format.GetNameFromComponentRef(schema.GetReference()),
			values: nil, // No values for reference types
			p:      p,
		}, nil, nil
	}

	values := make([]any, 0, len(schema.Schema().Enum))
	for _, enum := range schema.Schema().Enum {
		var v any
		if err := enum.Decode(&v); err != nil {
			return nil, nil, fmt.Errorf("failed to decode enum value %v: %w", v, err)
		}

		values = append(values, v)
	}

	t := &TypeEnum{
		name:   format.Title(derivedName),
		schema: schema,
		values: values,
		p:      p,
	}

	return t, []Type{t}, nil
}

// getType determines the type of the schema and returns the corresponding Type.
// It also returns a slice of types that may include the main type and any additional types
// if those may need to be defined globally (e.g., nested objects or enums).
func GetType( //nolint:ireturn
	schema *base.SchemaProxy, derivedName string, p Plugin, isComponent bool,
) (Type, []Type, error) {
	switch {
	case schema.Schema().Type[0] == "object":
		return getTypeObject(schema, derivedName, p)

	case schema.Schema().Type[0] == "array":
		return getTypeArray(schema, p)

	case len(schema.Schema().Enum) > 0:
		return getTypeEnum(schema, derivedName, p)

	default:
		s := &TypeScalar{
			schema: schema,
			p:      p,
		}
		if isComponent {
			t := &TypeAlias{
				name:   derivedName,
				schema: schema,
				alias:  s,
				p:      p,
			}

			return t, []Type{t}, nil
		}

		return s, nil, nil
	}
}

func NewObject(
	name string,
	schema *base.SchemaProxy,
	p Plugin,
) (*TypeObject, []Type, error) {
	types := make([]Type, 0, 10)           //nolint:mnd
	properties := make([]*Property, 0, 10) //nolint:mnd

	obj := &TypeObject{
		name:       name,
		schema:     schema,
		properties: properties,
		p:          p,
	}

	for propPairs := schema.Schema().Properties.First(); propPairs != nil; propPairs = propPairs.Next() {
		propName := propPairs.Key()
		prop := propPairs.Value()

		derivedName := name + format.Title(propName)

		typ, tt, err := GetType(prop, derivedName, p, false)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to get type for property %s: %w", propName, err)
		}

		types = append(types, tt...)

		property := &Property{
			name:   propName,
			Parent: obj,
			Type:   typ,
			p:      p,
		}
		properties = append(properties, property)
	}

	obj.properties = properties

	return obj, types, nil
}
