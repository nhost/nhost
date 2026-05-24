// Package graph provides an intermediate GraphQL schema representation
// that can be customised before conversion to a gqlparser AST.
package graph

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/vektah/gqlparser/v2/ast"
)

// Schema represents an intermediate GraphQL schema that can be customized
// before being converted to a gqlparser AST. This allows connectors to return
// a generic representation that can be transformed (e.g., field renaming,
// adding directives) before generating the final GraphQL schema.
type Schema struct {
	Types      []*ObjectType
	Scalars    []*ScalarType
	Enums      []*EnumType
	Interfaces []*InterfaceType
	Unions     []*UnionType
	Inputs     []*InputObjectType
	Directives []*DirectiveDefinition
	// Root operation types (if nil, GraphQL defaults are used)
	QueryType        *string
	MutationType     *string
	SubscriptionType *string
}

// ObjectType represents a GraphQL object type with fields.
type ObjectType struct {
	Name        string
	Description string
	Fields      []*Field
	Interfaces  []string
	Directives  []*Directive
}

// Field represents a field on an object, interface, or input type.
type Field struct {
	Name        string
	Description string
	Type        *Type
	Arguments   []*Argument
	Directives  []*Directive
}

// Type represents a GraphQL type reference (can be scalar, object, list, non-null, etc).
// A type is a list iff Elem is non-nil; otherwise NamedType identifies the base type.
// Prefer the New* constructors (NewNamedType, NewNonNullType, NewListType,
// NewNonNullListType) over struct literals — they enforce the invariant below.
type Type struct {
	// NamedType is the base type name (e.g., "String", "User"). It MUST be the
	// empty string when Elem is non-nil; consumers (e.g. convertType) only
	// consult NamedType in the named-type branch, so setting both fields is
	// incorrect and will cause NamedType to be silently dropped.
	NamedType string
	// NonNull reports whether this type is non-nullable (!).
	NonNull bool
	// Elem is the element type for lists (supports nested lists). It MUST be
	// nil for named types. Setting Elem AND NamedType simultaneously is
	// incorrect; see NamedType.
	Elem *Type
}

// Argument represents an argument to a field.
type Argument struct {
	Name         string
	Description  string
	Type         *Type
	DefaultValue *string // Optional default value
	Directives   []*Directive
}

// ScalarType represents a custom scalar type.
type ScalarType struct {
	Name        string
	Description string
	Directives  []*Directive
}

// EnumType represents a GraphQL enum.
type EnumType struct {
	Name        string
	Description string
	Values      []*EnumValue
	Directives  []*Directive
}

// EnumValue represents a value in an enum.
type EnumValue struct {
	Name        string
	Description string
	Directives  []*Directive
}

// InterfaceType represents a GraphQL interface.
type InterfaceType struct {
	Name        string
	Description string
	Fields      []*Field
	Interfaces  []string // Interfaces can implement other interfaces (GraphQL 2018 spec)
	Directives  []*Directive
}

// UnionType represents a GraphQL union.
type UnionType struct {
	Name        string
	Description string
	Types       []string
	Directives  []*Directive
}

// InputObjectType represents a GraphQL input object.
type InputObjectType struct {
	Name        string
	Description string
	Fields      []*InputField
	Directives  []*Directive
}

// InputField represents a field on an input object.
type InputField struct {
	Name         string
	Description  string
	Type         *Type
	DefaultValue *string
	Directives   []*Directive
}

// DirectiveDefinition represents a directive definition in the schema.
type DirectiveDefinition struct {
	Name        string
	Description string
	Arguments   []*Argument
	Locations   []DirectiveLocation
	Repeatable  bool
}

// DirectiveLocation represents where a directive can be used. Values must match
// the GraphQL spec's ExecutableDirectiveLocation and TypeSystemDirectiveLocation
// productions; see https://spec.graphql.org/October2021/#DirectiveLocation. The
// string is cast directly to gqlparser's ast.DirectiveLocation in ToAST, so
// callers should prefer the Location* constants below over string literals to
// catch misspellings at compile time rather than downstream schema validation.
type DirectiveLocation string

// Executable directive locations defined by the GraphQL spec. These mirror the
// values exported by gqlparser's ast package so the two type domains stay in
// lockstep.
const (
	LocationQuery              DirectiveLocation = "QUERY"
	LocationMutation           DirectiveLocation = "MUTATION"
	LocationSubscription       DirectiveLocation = "SUBSCRIPTION"
	LocationField              DirectiveLocation = "FIELD"
	LocationFragmentDefinition DirectiveLocation = "FRAGMENT_DEFINITION"
	LocationFragmentSpread     DirectiveLocation = "FRAGMENT_SPREAD"
	LocationInlineFragment     DirectiveLocation = "INLINE_FRAGMENT"
)

// Type-system directive locations defined by the GraphQL spec.
const (
	LocationSchema               DirectiveLocation = "SCHEMA"
	LocationScalar               DirectiveLocation = "SCALAR"
	LocationObject               DirectiveLocation = "OBJECT"
	LocationFieldDefinition      DirectiveLocation = "FIELD_DEFINITION"
	LocationArgumentDefinition   DirectiveLocation = "ARGUMENT_DEFINITION"
	LocationInterface            DirectiveLocation = "INTERFACE"
	LocationUnion                DirectiveLocation = "UNION"
	LocationEnum                 DirectiveLocation = "ENUM"
	LocationEnumValue            DirectiveLocation = "ENUM_VALUE"
	LocationInputObject          DirectiveLocation = "INPUT_OBJECT"
	LocationInputFieldDefinition DirectiveLocation = "INPUT_FIELD_DEFINITION"
	LocationVariableDefinition   DirectiveLocation = "VARIABLE_DEFINITION"
)

// Directive represents an applied directive (e.g., @deprecated).
type Directive struct {
	Name      string
	Arguments []*DirectiveArgument
}

// DirectiveArgument represents an argument value for an applied directive.
// Value must be one of: string, int/int32/int64, float32/float64, or bool —
// anything else is rendered via fmt.Sprintf("%v", v) as a StringValue.
type DirectiveArgument struct {
	Name  string
	Value any
}

// ToAST converts the intermediate schema representation to a gqlparser SchemaDocument.
// This returns a SchemaDocument that contains only the user-defined types (no built-ins),
// ready to be combined with validator.Prelude for parsing.
func (s *Schema) ToAST() *ast.SchemaDocument {
	schemaDoc := &ast.SchemaDocument{ //nolint:exhaustruct
		Definitions: make([]*ast.Definition, 0),
		Directives:  make([]*ast.DirectiveDefinition, 0),
	}

	s.appendScalars(schemaDoc)
	s.appendEnums(schemaDoc)
	s.appendInterfaces(schemaDoc)
	s.appendUnions(schemaDoc)
	s.appendObjects(schemaDoc)
	s.appendInputs(schemaDoc)
	s.appendDirectives(schemaDoc)
	s.appendSchemaDefinition(schemaDoc)

	return schemaDoc
}

func (s *Schema) appendScalars(schemaDoc *ast.SchemaDocument) {
	for _, scalar := range s.Scalars {
		schemaDoc.Definitions = append(schemaDoc.Definitions, &ast.Definition{ //nolint:exhaustruct
			Kind:        ast.Scalar,
			Name:        scalar.Name,
			Description: scalar.Description,
			Directives:  convertDirectives(scalar.Directives),
		})
	}
}

func (s *Schema) appendEnums(schemaDoc *ast.SchemaDocument) {
	for _, enum := range s.Enums {
		values := make([]*ast.EnumValueDefinition, len(enum.Values))
		for i, val := range enum.Values {
			values[i] = &ast.EnumValueDefinition{ //nolint:exhaustruct
				Name:        val.Name,
				Description: val.Description,
				Directives:  convertDirectives(val.Directives),
			}
		}

		schemaDoc.Definitions = append(schemaDoc.Definitions, &ast.Definition{ //nolint:exhaustruct
			Kind:        ast.Enum,
			Name:        enum.Name,
			Description: enum.Description,
			EnumValues:  values,
			Directives:  convertDirectives(enum.Directives),
		})
	}
}

func (s *Schema) appendInterfaces(schemaDoc *ast.SchemaDocument) {
	for _, iface := range s.Interfaces {
		schemaDoc.Definitions = append(schemaDoc.Definitions, &ast.Definition{ //nolint:exhaustruct
			Kind:        ast.Interface,
			Name:        iface.Name,
			Description: iface.Description,
			Fields:      convertFields(iface.Fields),
			Interfaces:  iface.Interfaces,
			Directives:  convertDirectives(iface.Directives),
		})
	}
}

func (s *Schema) appendUnions(schemaDoc *ast.SchemaDocument) {
	for _, union := range s.Unions {
		schemaDoc.Definitions = append(schemaDoc.Definitions, &ast.Definition{ //nolint:exhaustruct
			Kind:        ast.Union,
			Name:        union.Name,
			Description: union.Description,
			Types:       union.Types,
			Directives:  convertDirectives(union.Directives),
		})
	}
}

func (s *Schema) appendObjects(schemaDoc *ast.SchemaDocument) {
	for _, obj := range s.Types {
		schemaDoc.Definitions = append(schemaDoc.Definitions, &ast.Definition{ //nolint:exhaustruct
			Kind:        ast.Object,
			Name:        obj.Name,
			Description: obj.Description,
			Fields:      convertFields(obj.Fields),
			Interfaces:  obj.Interfaces,
			Directives:  convertDirectives(obj.Directives),
		})
	}
}

func (s *Schema) appendInputs(schemaDoc *ast.SchemaDocument) {
	for _, input := range s.Inputs {
		fields := make(ast.FieldList, len(input.Fields))
		for i, f := range input.Fields {
			fields[i] = convertInputField(f)
		}

		schemaDoc.Definitions = append(schemaDoc.Definitions, &ast.Definition{ //nolint:exhaustruct
			Kind:        ast.InputObject,
			Name:        input.Name,
			Description: input.Description,
			Fields:      fields,
			Directives:  convertDirectives(input.Directives),
		})
	}
}

func convertInputField(f *InputField) *ast.FieldDefinition {
	defaultVal := (*ast.Value)(nil)
	if f.DefaultValue != nil {
		defaultVal = &ast.Value{ //nolint:exhaustruct
			Raw:  *f.DefaultValue,
			Kind: detectValueKind(*f.DefaultValue),
		}
	}

	return &ast.FieldDefinition{ //nolint:exhaustruct
		Name:         f.Name,
		Description:  f.Description,
		Type:         convertType(f.Type),
		DefaultValue: defaultVal,
		Directives:   convertDirectives(f.Directives),
	}
}

func (s *Schema) appendDirectives(schemaDoc *ast.SchemaDocument) {
	for _, dir := range s.Directives {
		locations := make([]ast.DirectiveLocation, len(dir.Locations))
		for i, loc := range dir.Locations {
			locations[i] = ast.DirectiveLocation(loc)
		}

		schemaDoc.Directives = append(
			schemaDoc.Directives,
			&ast.DirectiveDefinition{ //nolint:exhaustruct
				Name:         dir.Name,
				Description:  dir.Description,
				Arguments:    convertArguments(dir.Arguments),
				Locations:    locations,
				IsRepeatable: dir.Repeatable,
			},
		)
	}
}

func (s *Schema) appendSchemaDefinition(schemaDoc *ast.SchemaDocument) {
	if s.QueryType == nil && s.MutationType == nil && s.SubscriptionType == nil {
		return
	}

	opTypes := make([]*ast.OperationTypeDefinition, 0, 3) //nolint:mnd

	if s.QueryType != nil {
		opTypes = append(opTypes, &ast.OperationTypeDefinition{ //nolint:exhaustruct
			Operation: ast.Query,
			Type:      *s.QueryType,
		})
	}

	if s.MutationType != nil {
		opTypes = append(opTypes, &ast.OperationTypeDefinition{ //nolint:exhaustruct
			Operation: ast.Mutation,
			Type:      *s.MutationType,
		})
	}

	if s.SubscriptionType != nil {
		opTypes = append(opTypes, &ast.OperationTypeDefinition{ //nolint:exhaustruct
			Operation: ast.Subscription,
			Type:      *s.SubscriptionType,
		})
	}

	schemaDoc.Schema = append(schemaDoc.Schema, &ast.SchemaDefinition{ //nolint:exhaustruct
		OperationTypes: opTypes,
	})
}

func convertFields(fields []*Field) ast.FieldList {
	result := make(ast.FieldList, len(fields))
	for i, f := range fields {
		result[i] = &ast.FieldDefinition{ //nolint:exhaustruct
			Name:        f.Name,
			Description: f.Description,
			Type:        convertType(f.Type),
			Arguments:   convertArguments(f.Arguments),
			Directives:  convertDirectives(f.Directives),
		}
	}

	return result
}

func convertType(t *Type) *ast.Type {
	if t == nil {
		return nil
	}

	result := &ast.Type{} //nolint:exhaustruct

	if t.Elem != nil {
		result.Elem = convertType(t.Elem)
	} else {
		result.NamedType = t.NamedType
	}

	result.NonNull = t.NonNull

	return result
}

func convertArguments(args []*Argument) ast.ArgumentDefinitionList {
	result := make(ast.ArgumentDefinitionList, len(args))
	for i, arg := range args {
		defaultVal := (*ast.Value)(nil)
		if arg.DefaultValue != nil {
			defaultVal = &ast.Value{ //nolint:exhaustruct
				Raw:  *arg.DefaultValue,
				Kind: detectValueKind(*arg.DefaultValue),
			}
		}

		result[i] = &ast.ArgumentDefinition{ //nolint:exhaustruct
			Name:         arg.Name,
			Description:  arg.Description,
			Type:         convertType(arg.Type),
			DefaultValue: defaultVal,
			Directives:   convertDirectives(arg.Directives),
		}
	}

	return result
}

func convertDirectives(directives []*Directive) ast.DirectiveList {
	result := make(ast.DirectiveList, len(directives))
	for i, dir := range directives {
		args := make(ast.ArgumentList, len(dir.Arguments))
		for j, arg := range dir.Arguments {
			args[j] = &ast.Argument{ //nolint:exhaustruct
				Name:  arg.Name,
				Value: convertDirectiveValue(arg.Value),
			}
		}

		result[i] = &ast.Directive{ //nolint:exhaustruct
			Name:      dir.Name,
			Arguments: args,
		}
	}

	return result
}

func detectValueKind(raw string) ast.ValueKind {
	if len(raw) == 0 {
		return ast.StringValue
	}

	// Exact-match the keyword literals so that e.g. a default string of "test"
	// or "never" isn't misclassified as a boolean/null just because of its
	// first character.
	switch raw {
	case "true", "false":
		return ast.BooleanValue
	case "null":
		return ast.NullValue
	}

	switch raw[0] {
	case '[':
		return ast.ListValue
	case '{':
		return ast.ObjectValue
	case '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-':
		if strings.ContainsAny(raw, ".eE") {
			return ast.FloatValue
		}

		return ast.IntValue
	default:
		return ast.StringValue
	}
}

func convertDirectiveValue(val any) *ast.Value {
	switch v := val.(type) {
	case string:
		return &ast.Value{Raw: v, Kind: ast.StringValue} //nolint:exhaustruct
	case int:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatInt(int64(v), 10),
			Kind: ast.IntValue,
		}
	case int32:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatInt(int64(v), 10),
			Kind: ast.IntValue,
		}
	case int64:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatInt(v, 10),
			Kind: ast.IntValue,
		}
	case uint:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatUint(uint64(v), 10),
			Kind: ast.IntValue,
		}
	case uint32:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatUint(uint64(v), 10),
			Kind: ast.IntValue,
		}
	case uint64:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatUint(v, 10),
			Kind: ast.IntValue,
		}
	case float32:
		// 'g' with precision -1 emits the shortest round-trippable form, avoiding
		// the noise/precision-loss of "%f"'s fixed 6-decimal default.
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatFloat(float64(v), 'g', -1, 32),
			Kind: ast.FloatValue,
		}
	case float64:
		return &ast.Value{ //nolint:exhaustruct
			Raw:  strconv.FormatFloat(v, 'g', -1, 64),
			Kind: ast.FloatValue,
		}
	case bool:
		return &ast.Value{Raw: strconv.FormatBool(v), Kind: ast.BooleanValue} //nolint:exhaustruct
	default:
		return &ast.Value{Raw: fmt.Sprintf("%v", v), Kind: ast.StringValue} //nolint:exhaustruct
	}
}

// NewNamedType creates a simple named type reference.
func NewNamedType(name string) *Type {
	return &Type{NamedType: name, NonNull: false, Elem: nil}
}

// NewNonNullType creates a non-nullable type reference.
func NewNonNullType(name string) *Type {
	return &Type{NamedType: name, NonNull: true, Elem: nil}
}

// NewListType creates a list type.
func NewListType(elem *Type) *Type {
	return &Type{NamedType: "", NonNull: false, Elem: elem}
}

// NewNonNullListType creates a non-nullable list type.
func NewNonNullListType(elem *Type) *Type {
	return &Type{NamedType: "", NonNull: true, Elem: elem}
}
