package graphqlutil

import (
	"encoding/json"
	"fmt"
)

// Kind represents a GraphQL type kind.
type Kind string

func (k *Kind) UnmarshalJSON(data []byte) error {
	var kind string
	if err := json.Unmarshal(data, &kind); err != nil {
		return err //nolint:wrapcheck
	}

	switch kind {
	case string(KindObject),
		string(KindNonNull),
		string(KindList),
		string(KindScalar),
		string(KindEnum),
		string(KindInputObject),
		string(KindUnion),
		string(KindInterface):
		*k = Kind(kind)
	default:
		return fmt.Errorf("invalid kind: %s", kind) //nolint:err113
	}

	return nil
}

const (
	KindObject      Kind = "OBJECT"
	KindNonNull     Kind = "NON_NULL"
	KindList        Kind = "LIST"
	KindScalar      Kind = "SCALAR"
	KindEnum        Kind = "ENUM"
	KindInputObject Kind = "INPUT_OBJECT"
	KindUnion       Kind = "UNION"
	KindInterface   Kind = "INTERFACE"
)

// ResponseIntrospection is the response type for an introspection query.
type ResponseIntrospection = Response[IntrospectionResponse]

// Response is a generic GraphQL response.
type Response[T any] struct {
	Data   T        `json:"data"`
	Errors []Errors `json:"errors"`
}

// Extensions holds error extension metadata.
type Extensions struct {
	Path string `json:"path"`
	Code string `json:"code"`
}

// Errors represents a GraphQL error.
type Errors struct {
	Message    string     `json:"message"`
	Extensions Extensions `json:"extensions"`
}

// IntrospectionResponse holds the __schema data.
type IntrospectionResponse struct {
	Schema Schema `json:"__schema"`
}

// Schema represents the GraphQL schema.
type Schema struct {
	QueryType    Type   `json:"queryType"`
	MutationType *Type  `json:"mutationType"`
	Types        []Type `json:"types"`
}

// Type represents a GraphQL type (__Type).
type Type struct {
	Kind          Kind         `json:"kind"`
	Name          *string      `json:"name"`
	Description   *string      `json:"description"`
	Fields        []Field      `json:"fields"`
	InputFields   []InputValue `json:"inputFields"`
	Interfaces    []Type       `json:"interfaces"`
	EnumValues    []EnumValue  `json:"enumValues"`
	PossibleTypes []Type       `json:"possibleTypes"`
	OfType        *Type        `json:"ofType"`
}

// Field represents a field in a GraphQL type.
type Field struct {
	Name        string       `json:"name"`
	Description *string      `json:"description"`
	Args        []InputValue `json:"args"`
	Type        Type         `json:"type"`
}

// InputValue represents an input value in a GraphQL schema.
type InputValue struct {
	Name         string  `json:"name"`
	Description  *string `json:"description"`
	Type         Type    `json:"type"`
	DefaultValue *string `json:"defaultValue"`
}

// EnumValue represents an enum value in a GraphQL schema.
type EnumValue struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}
