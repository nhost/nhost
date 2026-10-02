package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"maps"
	"net/url"
	"strings"
)

// Servers is specified by OpenAPI/Swagger standard version 3.
type Servers []*Server

// Validate returns an error if Servers does not comply with the OpenAPI spec.
func (servers Servers) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	me := newErrCollector(ctx)

	for _, v := range servers {
		if err := me.emit(v.Validate(ctx)); err != nil {
			return err
		}
	}
	return me.result()
}

// BasePath returns the base path of the first server in the list, or /.
func (servers Servers) BasePath() (string, error) {
	for _, server := range servers {
		return server.BasePath()
	}
	return "/", nil
}

func (servers Servers) MatchURL(parsedURL *url.URL) (*Server, []string, string) {
	rawURL := parsedURL.String()
	if i := strings.IndexByte(rawURL, '?'); i >= 0 {
		rawURL = rawURL[:i]
	}
	for _, server := range servers {
		pathParams, remaining, ok := server.MatchRawURL(rawURL)
		if ok {
			return server, pathParams, remaining
		}
	}
	return nil, nil, ""
}

// Server is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#server-object
type Server struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	URL         string          `json:"url" yaml:"url"` // Required
	Description string          `json:"description,omitempty" yaml:"description,omitempty"`
	Variables   ServerVariables `json:"variables,omitempty" yaml:"variables,omitempty"`
}

// BasePath returns the base path extracted from the default values of variables, if any.
// Assumes a valid struct (per Validate()).
func (server *Server) BasePath() (string, error) {
	if server == nil {
		return "/", nil
	}

	uri := server.URL
	for _, name := range componentNames(server.Variables) {
		uri = strings.ReplaceAll(uri, "{"+name+"}", server.Variables[name].Default)
	}

	u, err := url.ParseRequestURI(uri)
	if err != nil {
		return "", err
	}

	if bp := u.Path; bp != "" {
		return bp, nil
	}

	return "/", nil
}

// MarshalJSON returns the JSON encoding of Server.
func (server Server) MarshalJSON() ([]byte, error) {
	x, err := server.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of Server.
func (server Server) MarshalYAML() (any, error) {
	m := make(map[string]any, 3+len(server.Extensions))
	maps.Copy(m, server.Extensions)
	m["url"] = server.URL
	if x := server.Description; x != "" {
		m["description"] = x
	}
	if x := server.Variables; len(x) != 0 {
		m["variables"] = x
	}
	return m, nil
}

// UnmarshalJSON sets Server to a copy of data.
func (server *Server) UnmarshalJSON(data []byte) error {
	type ServerBis Server
	var x ServerBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "url")
	delete(x.Extensions, "description")
	delete(x.Extensions, "variables")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*server = Server(x)
	return nil
}

func (server Server) ParameterNames() ([]string, error) {
	pattern := server.URL
	var params []string
	for len(pattern) > 0 {
		i := strings.IndexByte(pattern, '{')
		if i < 0 {
			break
		}
		pattern = pattern[i+1:]
		i = strings.IndexByte(pattern, '}')
		if i < 0 {
			return nil, errors.New("missing '}'")
		}
		params = append(params, strings.TrimSpace(pattern[:i]))
		pattern = pattern[i+1:]
	}
	return params, nil
}

func (server Server) MatchRawURL(input string) ([]string, string, bool) {
	pattern := server.URL
	var params []string
	for len(pattern) > 0 {
		c := pattern[0]
		if len(pattern) == 1 && c == '/' {
			break
		}
		if c == '{' {
			// Find end of pattern
			i := strings.IndexByte(pattern, '}')
			if i < 0 {
				return nil, "", false
			}
			pattern = pattern[i+1:]

			// Find next matching pattern character or next '/' whichever comes first
			np := -1
			if len(pattern) > 0 {
				np = strings.IndexByte(input, pattern[0])
			}
			ns := strings.IndexByte(input, '/')

			if np < 0 {
				i = ns
			} else if ns < 0 {
				i = np
			} else {
				i = min(np, ns)
			}
			if i < 0 {
				i = len(input)
			}
			params = append(params, input[:i])
			input = input[i:]
			continue
		}
		if len(input) == 0 || input[0] != c {
			return nil, "", false
		}
		pattern = pattern[1:]
		input = input[1:]
	}
	if input == "" {
		input = "/"
	}
	if input[0] != '/' {
		return nil, "", false
	}
	return params, input, true
}

// Validate returns an error if Server does not comply with the OpenAPI spec.
func (server *Server) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)
	me := newErrCollector(ctx)

	if server.URL == "" {
		if err := me.emit(newServerURLRequired(server.Origin)); err != nil {
			return err
		}
	}

	opening, closing := strings.Count(server.URL, "{"), strings.Count(server.URL, "}")
	if opening != closing {
		if err := me.emit(newServerURLMismatchedBraces(server.URL, server.Origin)); err != nil {
			return err
		}
	}

	if opening != len(server.Variables) {
		if err := me.emit(newServerURLUndeclaredVariables(server.URL, server.Origin)); err != nil {
			return err
		}
	}

	for _, name := range componentNames(server.Variables) {
		v := server.Variables[name]
		if !strings.Contains(server.URL, "{"+name+"}") {
			if err := me.emit(newServerURLUndeclaredVariables(server.URL, server.Origin)); err != nil {
				return err
			}
			// Variable name doesn't appear in the URL template; descending
			// into its Validate would surface findings under a variable
			// the URL never references, with no resolution path until the
			// URL is fixed.
			continue
		}
		if err := me.emit(v.Validate(ctx)); err != nil {
			return err
		}
	}

	return me.finalize(validateExtensions(ctx, server.Extensions, server.Origin))
}

// ServerVariable is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#server-variable-object
// ServerVariables is a map of ServerVariable objects keyed by variable name.
type ServerVariables map[string]*ServerVariable

type ServerVariable struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	Enum        []string `json:"enum,omitempty" yaml:"enum,omitempty"`
	Default     string   `json:"default,omitempty" yaml:"default,omitempty"`
	Description string   `json:"description,omitempty" yaml:"description,omitempty"`
}

// MarshalJSON returns the JSON encoding of ServerVariable.
func (serverVariable ServerVariable) MarshalJSON() ([]byte, error) {
	x, err := serverVariable.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of ServerVariable.
func (serverVariable ServerVariable) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(serverVariable.Extensions))
	maps.Copy(m, serverVariable.Extensions)
	if x := serverVariable.Enum; len(x) != 0 {
		m["enum"] = x
	}
	if x := serverVariable.Default; x != "" {
		m["default"] = x
	}
	if x := serverVariable.Description; x != "" {
		m["description"] = x
	}
	return m, nil
}

// UnmarshalJSON sets ServerVariable to a copy of data.
func (serverVariable *ServerVariable) UnmarshalJSON(data []byte) error {
	type ServerVariableBis ServerVariable
	var x ServerVariableBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "enum")
	delete(x.Extensions, "default")
	delete(x.Extensions, "description")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*serverVariable = ServerVariable(x)
	return nil
}

// Validate returns an error if ServerVariable does not comply with the OpenAPI spec.
func (serverVariable *ServerVariable) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if serverVariable.Default == "" {
		data, err := serverVariable.MarshalJSON()
		if err != nil {
			return err
		}
		return newServerVariableDefaultRequired(string(data), serverVariable.Origin)
	}

	return validateExtensions(ctx, serverVariable.Extensions, serverVariable.Origin)
}
