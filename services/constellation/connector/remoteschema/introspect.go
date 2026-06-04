package remoteschema

import (
	"context"
	"encoding/json/jsontext"
	json "encoding/json/v2"
	"fmt"
	"net/http"
	"strings"

	"github.com/nhost/nhost/services/constellation/graph"
)

const introspectionQuery = `
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      ...FullType
    }
  }
}

fragment FullType on __Type {
  kind
  name
  description
  fields(includeDeprecated: true) {
    name
    description
    args {
      ...InputValue
    }
    type {
      ...TypeRef
    }
    isDeprecated
    deprecationReason
  }
  inputFields {
    ...InputValue
  }
  interfaces {
    ...TypeRef
  }
  enumValues(includeDeprecated: true) {
    name
    description
    isDeprecated
    deprecationReason
  }
  possibleTypes {
    ...TypeRef
  }
}

fragment InputValue on __InputValue {
  name
  description
  type {
    ...TypeRef
  }
  defaultValue
}

fragment TypeRef on __Type {
  kind
  name
  ofType {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
}
`

// Introspect fetches the schema from a GraphQL endpoint via the standard
// introspection query and returns it as a graph.Schema. Headers are sent on the
// request alongside Content-Type. Passing nil for doer falls back to
// http.DefaultClient.
//
// This is the same wire dance used internally to bootstrap a Connector's admin
// schema, exposed for callers (e.g. CLI tools) that want a one-shot SDL dump
// without standing up a full remote-schema connector.
func Introspect(
	ctx context.Context,
	url string,
	headers map[string]string,
	doer HTTPDoer,
) (*graph.Schema, error) {
	if doer == nil {
		doer = http.DefaultClient
	}

	return introspectViaHTTP(ctx, &httpClient{
		url:     url,
		headers: headers,
		client:  doer,
	})
}

// introspectRemoteSchema fetches the schema from a remote GraphQL endpoint and returns a graph.Schema.
func (c *Connector) introspectRemoteSchema(ctx context.Context) (*graph.Schema, error) {
	return introspectViaHTTP(ctx, c.httpClient)
}

func introspectViaHTTP(ctx context.Context, client *httpClient) (*graph.Schema, error) {
	// Introspection is done with admin context, no session variables or client headers
	body, err := client.do(ctx, map[string]string{
		"query": introspectionQuery,
	}, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to execute introspection query: %w", err)
	}

	var result struct {
		Data struct {
			Schema introspectionSchema `json:"__schema"`
		} `json:"data"`
		Errors []struct {
			Message string `json:"message"`
		} `json:"errors"`
	}

	if err := json.Unmarshal(
		body, &result,
		jsontext.AllowDuplicateNames(true),
		jsontext.AllowInvalidUTF8(true),
	); err != nil {
		return nil, fmt.Errorf("failed to parse introspection response: %w", err)
	}

	if len(result.Errors) > 0 {
		messages := make([]string, len(result.Errors))
		for i, e := range result.Errors {
			messages[i] = e.Message
		}

		return nil, fmt.Errorf("%w: %s", ErrIntrospectionResponse, strings.Join(messages, "; "))
	}

	schema := introspectionToGraphSchema(&result.Data.Schema)

	pruneUnreachableTypes(schema)

	return schema, nil
}

type introspectionSchema struct {
	QueryType        *introspectionTypeRef `json:"queryType"`
	MutationType     *introspectionTypeRef `json:"mutationType"`
	SubscriptionType *introspectionTypeRef `json:"subscriptionType"`
	Types            []introspectionType   `json:"types"`
}

type introspectionTypeRef struct {
	Kind   string                `json:"kind"`
	Name   string                `json:"name"`
	OfType *introspectionTypeRef `json:"ofType"`
}

type introspectionType struct {
	Kind          string                    `json:"kind"`
	Name          string                    `json:"name"`
	Description   string                    `json:"description"`
	Fields        []introspectionField      `json:"fields"`
	InputFields   []introspectionInputValue `json:"inputFields"`
	Interfaces    []introspectionTypeRef    `json:"interfaces"`
	EnumValues    []introspectionEnumValue  `json:"enumValues"`
	PossibleTypes []introspectionTypeRef    `json:"possibleTypes"`
}

type introspectionField struct {
	Name              string                    `json:"name"`
	Description       string                    `json:"description"`
	Args              []introspectionInputValue `json:"args"`
	Type              introspectionTypeRef      `json:"type"`
	IsDeprecated      bool                      `json:"isDeprecated"`
	DeprecationReason string                    `json:"deprecationReason"`
}

type introspectionInputValue struct {
	Name         string               `json:"name"`
	Description  string               `json:"description"`
	Type         introspectionTypeRef `json:"type"`
	DefaultValue *string              `json:"defaultValue"`
}

type introspectionEnumValue struct {
	Name              string `json:"name"`
	Description       string `json:"description"`
	IsDeprecated      bool   `json:"isDeprecated"`
	DeprecationReason string `json:"deprecationReason"`
}

// introspectionToGraphSchema converts an introspection result directly to graph.Schema.
func introspectionToGraphSchema(schema *introspectionSchema) *graph.Schema {
	result := &graph.Schema{
		Types:            nil,
		Scalars:          nil,
		Enums:            nil,
		Interfaces:       nil,
		Unions:           nil,
		Inputs:           nil,
		Directives:       nil,
		QueryType:        nil,
		MutationType:     nil,
		SubscriptionType: nil,
	}

	if schema.QueryType != nil {
		result.QueryType = &schema.QueryType.Name
	}

	if schema.MutationType != nil {
		result.MutationType = &schema.MutationType.Name
	}

	if schema.SubscriptionType != nil {
		result.SubscriptionType = &schema.SubscriptionType.Name
	}

	for _, t := range schema.Types {
		if isBuiltinType(t.Name) {
			continue
		}

		switch t.Kind {
		case "SCALAR":
			result.Scalars = append(result.Scalars, &graph.ScalarType{
				Name:        t.Name,
				Description: t.Description,
				Directives:  nil,
			})

		case "ENUM":
			result.Enums = append(result.Enums, convertIntrospectionEnum(&t))

		case "INPUT_OBJECT":
			result.Inputs = append(result.Inputs, convertIntrospectionInput(&t))

		case "INTERFACE":
			result.Interfaces = append(result.Interfaces, convertIntrospectionInterface(&t))

		case "UNION":
			result.Unions = append(result.Unions, convertIntrospectionUnion(&t))

		case "OBJECT":
			result.Types = append(result.Types, convertIntrospectionObject(&t))
		}
	}

	return result
}

func convertIntrospectionEnum(t *introspectionType) *graph.EnumType {
	values := make([]*graph.EnumValue, len(t.EnumValues))

	for i, v := range t.EnumValues {
		values[i] = &graph.EnumValue{
			Name:        v.Name,
			Description: v.Description,
			Directives:  nil,
		}
	}

	return &graph.EnumType{
		Name:        t.Name,
		Description: t.Description,
		Values:      values,
		Directives:  nil,
	}
}

func convertIntrospectionInput(t *introspectionType) *graph.InputObjectType {
	fields := make([]*graph.InputField, len(t.InputFields))

	for i, f := range t.InputFields {
		fields[i] = &graph.InputField{
			Name:         f.Name,
			Description:  f.Description,
			Type:         convertIntrospectionTypeRef(&f.Type),
			DefaultValue: f.DefaultValue,
			Directives:   nil,
		}
	}

	return &graph.InputObjectType{
		Name:        t.Name,
		Description: t.Description,
		Fields:      fields,
		Directives:  nil,
	}
}

func convertIntrospectionInterface(t *introspectionType) *graph.InterfaceType {
	interfaces := make([]string, len(t.Interfaces))
	for i, iface := range t.Interfaces {
		interfaces[i] = iface.Name
	}

	return &graph.InterfaceType{
		Name:        t.Name,
		Description: t.Description,
		Fields:      convertIntrospectionFields(t.Fields),
		Interfaces:  interfaces,
		Directives:  nil,
	}
}

func convertIntrospectionUnion(t *introspectionType) *graph.UnionType {
	types := make([]string, len(t.PossibleTypes))
	for i, pt := range t.PossibleTypes {
		types[i] = pt.Name
	}

	return &graph.UnionType{
		Name:        t.Name,
		Description: t.Description,
		Types:       types,
		Directives:  nil,
	}
}

func convertIntrospectionObject(t *introspectionType) *graph.ObjectType {
	interfaces := make([]string, len(t.Interfaces))
	for i, iface := range t.Interfaces {
		interfaces[i] = iface.Name
	}

	return &graph.ObjectType{
		Name:        t.Name,
		Description: t.Description,
		Fields:      convertIntrospectionFields(t.Fields),
		Interfaces:  interfaces,
		Directives:  nil,
	}
}

func convertIntrospectionFields(fields []introspectionField) []*graph.Field {
	result := make([]*graph.Field, 0, len(fields))

	for _, f := range fields {
		// Skip introspection fields
		if len(f.Name) >= 2 && f.Name[0] == '_' && f.Name[1] == '_' {
			continue
		}

		args := make([]*graph.Argument, len(f.Args))
		for i, arg := range f.Args {
			args[i] = &graph.Argument{
				Name:         arg.Name,
				Description:  arg.Description,
				Type:         convertIntrospectionTypeRef(&arg.Type),
				DefaultValue: arg.DefaultValue,
				Directives:   nil,
			}
		}

		result = append(result, &graph.Field{
			Name:        f.Name,
			Description: f.Description,
			Type:        convertIntrospectionTypeRef(&f.Type),
			Arguments:   args,
			Directives:  nil,
		})
	}

	return result
}

func convertIntrospectionTypeRef(t *introspectionTypeRef) *graph.Type {
	if t == nil {
		return nil
	}

	switch t.Kind {
	case "NON_NULL":
		inner := convertIntrospectionTypeRef(t.OfType)
		if inner != nil {
			inner.NonNull = true
		}

		return inner

	case "LIST":
		return &graph.Type{
			NamedType: "",
			NonNull:   false,
			Elem:      convertIntrospectionTypeRef(t.OfType),
		}

	default:
		return &graph.Type{
			NamedType: t.Name,
			NonNull:   false,
			Elem:      nil,
		}
	}
}
