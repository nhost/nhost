package processor

import (
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/nhost/nhost/tools/codegen/format"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
)

const (
	minStatusForError           = 300
	mediaApplicationJSON        = "application/json"
	mediaApplicationOctetStream = "application/octet-stream"
)

type Method struct {
	name       string
	method     string
	path       string
	Operation  *v3.Operation
	Parameters []*Parameter
	// key is the media type (e.g., "application/json")
	Bodies       map[string]Type
	BodyRequired bool
	// first key is the response code (e.g., "200")
	// second key is the media type (e.g., "application/json")
	Responses map[string]map[string]Type
	p         Plugin
}

func (m *Method) Name() string {
	return m.p.MethodName(m.name)
}

func (m *Method) Method() string {
	return strings.ToUpper(m.method)
}

func (m *Method) Path() string {
	return m.p.MethodPath(m.path)
}

func (m *Method) PathParameters() []*Parameter {
	params := make([]*Parameter, 0, 10) //nolint:mnd
	for _, param := range m.Parameters {
		if param.Parameter.In == "path" {
			params = append(params, param)
		}
	}

	return params
}

func (m *Method) HasQueryParameters() bool {
	for _, param := range m.Parameters {
		if param.Parameter.In == "query" {
			return true
		}
	}

	return false
}

func (m *Method) QueryParameters() []*Parameter {
	params := make([]*Parameter, 0, 10) //nolint:mnd
	for _, param := range m.Parameters {
		if param.Parameter.In == "query" {
			params = append(params, param)
		}
	}

	return params
}

func (m *Method) QueryParametersTypeName() string {
	return m.p.TypeObjectName(m.Name() + "Parameters")
}

func addIfNotPresent[S ~[]E, E comparable](s S, v E) S { //nolint:ireturn
	if !slices.Contains(s, v) {
		return append(s, v)
	}

	return s
}

func (m *Method) ReturnType() string {
	tt := make([]string, 0, 10) //nolint:mnd

	for c, resp := range m.Responses {
		code, err := strconv.Atoi(c)
		if err != nil {
			panic(fmt.Sprintf("invalid response code %s: %v", c, err))
		}

		if code >= minStatusForError {
			continue
		}

		if len(resp) == 0 {
			tt = addIfNotPresent(tt, "void")
		}

		for media, typ := range resp {
			switch media {
			case mediaApplicationJSON:
				tt = addIfNotPresent(tt, typ.Name())
			case mediaApplicationOctetStream:
				tt = addIfNotPresent(tt, m.p.BinaryType())
			}
		}
	}

	return strings.Join(tt, " | ")
}

func (m *Method) RequestJSON() Type { //nolint:ireturn
	for m, t := range m.Bodies {
		if m == mediaApplicationJSON {
			return t
		}
	}

	return nil
}

func (m *Method) RequestFormData() Type { //nolint:ireturn
	for m, t := range m.Bodies {
		if m == "multipart/form-data" {
			return t
		}
	}

	return nil
}

func (m *Method) RequestHasBody() bool {
	return len(m.Bodies) > 0
}

func (m *Method) ResponseJSON() bool {
	for c, resp := range m.Responses {
		code, err := strconv.Atoi(c)
		if err != nil {
			panic(fmt.Sprintf("invalid response code %s: %v", c, err))
		}

		if code >= minStatusForError {
			continue
		}

		for media := range resp {
			return media == mediaApplicationJSON
		}
	}

	return false
}

func (m *Method) ResponseBinary() bool {
	for c, resp := range m.Responses {
		code, err := strconv.Atoi(c)
		if err != nil {
			panic(fmt.Sprintf("invalid response code %s: %v", c, err))
		}

		if code >= minStatusForError {
			continue
		}

		for media := range resp {
			return media == mediaApplicationOctetStream
		}
	}

	return false
}

func (m *Method) IsRedirect() bool {
	for code := range m.Responses {
		return code == strconv.Itoa(http.StatusFound)
	}

	return false
}

func (m *Method) HasResponseBody() bool {
	for c, resp := range m.Responses {
		code, err := strconv.Atoi(c)
		if err != nil {
			panic(fmt.Sprintf("invalid response code %s: %v", c, err))
		}

		if code >= minStatusForError {
			continue
		}

		return len(resp) > 0
	}

	return false
}

type Parameter struct {
	name      string
	Parameter *v3.Parameter
	Type      Type
	p         Plugin
}

func (p *Parameter) Name() string {
	return p.p.ParameterName(p.name)
}

func (p *Parameter) Required() bool {
	if p.Parameter.Required != nil {
		return *p.Parameter.Required
	}

	if p.Parameter.In == "path" {
		return true
	}

	return false
}

func (p *Parameter) Style() string {
	if p.Parameter.Style != "" {
		return p.Parameter.Style
	}

	// Default based on location per OpenAPI 3.0 spec
	if p.Parameter.In == "query" || p.Parameter.In == "cookie" {
		return "form"
	}

	return "simple"
}

func (p *Parameter) Explode() bool {
	if p.Parameter.Explode != nil {
		return *p.Parameter.Explode
	}

	// Default based on style per OpenAPI 3.0 spec
	// form style defaults to true, others default to false
	return p.Style() == "form"
}

func GetMethod(
	path string,
	method string,
	operation *v3.Operation,
	p Plugin,
) (*Method, []Type, error) {
	if operation.OperationId == "" {
		return nil, nil,
			fmt.Errorf(
				"%w: operation %s %s has no operationId",
				ErrRequiredOptionMissing,
				method,
				path,
			)
	}

	params, types, err := getMethodParameters(method, operation, p)
	if err != nil {
		return nil, nil, fmt.Errorf(
			"failed to get method parameters for %s: %w",
			operation.OperationId,
			err,
		)
	}

	bodies, tt, err := getMethodBodies(operation, p)
	if err != nil {
		return nil, nil,
			fmt.Errorf("failed to get method bodies for %s: %w", operation.OperationId, err)
	}

	types = append(types, tt...)

	responses, tt, err := getMethodResponses(operation, p)
	if err != nil {
		return nil, nil,
			fmt.Errorf("failed to get method responses for %s: %w", operation.OperationId, err)
	}

	types = append(types, tt...)

	return &Method{
		name:       operation.OperationId,
		method:     method,
		path:       path,
		Parameters: params,
		Bodies:     bodies,
		Operation:  operation,
		BodyRequired: operation.RequestBody != nil && operation.RequestBody.Required != nil &&
			*operation.RequestBody.Required,
		Responses: responses,
		p:         p,
	}, types, nil
}

func getMethodParameters(
	method string,
	operation *v3.Operation,
	p Plugin,
) ([]*Parameter, []Type, error) {
	params := make([]*Parameter, len(operation.Parameters))
	types := make([]Type, 0, 10) //nolint:mnd

	for i, param := range operation.Parameters {
		var t Type
		if param.GoLow().IsReference() {
			t = &TypeEnum{
				schema: param.Schema,
				name:   format.GetNameFromComponentRef(param.GoLow().GetReference()),
				values: nil, // No values for reference types
				p:      p,
			}
		} else {
			switch {
			case param.Schema != nil:
				t2, tt, err := GetType(param.Schema, method+format.Title(param.Name), p, false)
				if err != nil {
					return nil, nil, fmt.Errorf("failed to get type for parameter %s: %w", param.Name, err)
				}

				types = append(types, tt...)
				t = t2
			case param.Content != nil:
				jsonMediaType, ok := param.Content.Get("application/json")
				if !ok {
					return nil, nil, fmt.Errorf( //nolint:err113
						"parameter %s in operation %s has no application/json content defined",
						param.Name,
						operation.OperationId,
					)
				}

				t2, tt, err := GetType(jsonMediaType.Schema, method+format.Title(param.Name), p, false)
				if err != nil {
					return nil, nil, fmt.Errorf("failed to get type for parameter %s: %w", param.Name, err)
				}

				types = append(types, tt...)
				t = t2
			default:
				return nil, nil, fmt.Errorf("parameter %s in operation %s has no schema or content defined", param.Name, operation.OperationId) //nolint:err113,lll
			}
		}

		params[i] = &Parameter{
			name:      param.Name,
			Parameter: param,
			Type:      t,
			p:         p,
		}
	}

	return params, types, nil
}

func getMethodBodies(
	operation *v3.Operation,
	p Plugin,
) (map[string]Type, []Type, error) {
	bodies := make(map[string]Type)

	if operation.RequestBody == nil {
		return nil, nil, nil
	}

	pair := operation.RequestBody.Content.First()
	if pair == nil {
		return nil, nil, nil
	}

	if pair.Next() != nil {
		return nil, nil,
			fmt.Errorf(
				"%w: operation %s has multiple request bodies",
				ErrUnsupportedFeature,
				operation.OperationId,
			)
	}

	var tt []Type

	for pair := operation.RequestBody.Content.First(); pair != nil; pair = pair.Next() {
		mediaType := pair.Key()
		proxy := pair.Value()

		name := operation.OperationId + "Body"

		var (
			t   Type
			err error
		)

		t, tt, err = GetType(proxy.Schema, name, p, false)
		if err != nil {
			return nil, nil, fmt.Errorf(
				"failed to get type for body with media type %s: %w",
				mediaType,
				err,
			)
		}

		bodies[mediaType] = t
	}

	return bodies, tt, nil
}

func getMethodResponses(
	operation *v3.Operation,
	p Plugin,
) (map[string]map[string]Type, []Type, error) {
	responses := make(map[string]map[string]Type)
	types := make([]Type, 0, 10) //nolint:mnd

	for pcodes := operation.Responses.Codes.First(); pcodes != nil; pcodes = pcodes.Next() {
		code := pcodes.Key()
		response := pcodes.Value()

		responses[code] = make(map[string]Type)

		if response == nil || response.Content == nil {
			continue
		}

		pcontent := response.Content.First()
		if pcontent == nil {
			continue
		}

		if pcontent.Next() != nil {
			return nil, nil, fmt.Errorf(
				"%w: operation %s has multiple response bodies for code %s",
				ErrUnsupportedFeature, operation.OperationId, code)
		}

		mediaType := pcontent.Key()
		proxy := pcontent.Value()

		// some types may not have a schema defined, e.g., for 204 No Content responses or binary responses
		if proxy.Schema == nil {
			responses[code][mediaType] = nil
			continue
		}

		name := operation.OperationId + "Response" + code

		t, tt, err := GetType(proxy.Schema, name, p, false)
		if err != nil {
			return nil, nil, fmt.Errorf(
				"failed to get type for response with media type %s: %w",
				mediaType,
				err,
			)
		}

		responses[code][mediaType] = t

		types = append(types, tt...)
	}

	return responses, types, nil
}
