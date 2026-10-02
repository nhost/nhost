package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
	"slices"
)

// SecurityScheme is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#security-scheme-object
// and https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#security-scheme-object
type SecurityScheme struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	Type             string      `json:"type,omitempty" yaml:"type,omitempty"`
	Description      string      `json:"description,omitempty" yaml:"description,omitempty"`
	Name             string      `json:"name,omitempty" yaml:"name,omitempty"`
	In               string      `json:"in,omitempty" yaml:"in,omitempty"`
	Scheme           string      `json:"scheme,omitempty" yaml:"scheme,omitempty"`
	BearerFormat     string      `json:"bearerFormat,omitempty" yaml:"bearerFormat,omitempty"`
	Flows            *OAuthFlows `json:"flows,omitempty" yaml:"flows,omitempty"`
	OpenIdConnectUrl string      `json:"openIdConnectUrl,omitempty" yaml:"openIdConnectUrl,omitempty"`
}

func NewSecurityScheme() *SecurityScheme {
	return &SecurityScheme{}
}

func NewCSRFSecurityScheme() *SecurityScheme {
	return &SecurityScheme{
		Type: "apiKey",
		In:   "header",
		Name: "X-XSRF-TOKEN",
	}
}

func NewOIDCSecurityScheme(oidcUrl string) *SecurityScheme {
	return &SecurityScheme{
		Type:             "openIdConnect",
		OpenIdConnectUrl: oidcUrl,
	}
}

func NewJWTSecurityScheme() *SecurityScheme {
	return &SecurityScheme{
		Type:         "http",
		Scheme:       "bearer",
		BearerFormat: "JWT",
	}
}

// MarshalJSON returns the JSON encoding of SecurityScheme.
func (ss SecurityScheme) MarshalJSON() ([]byte, error) {
	x, err := ss.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of SecurityScheme.
func (ss SecurityScheme) MarshalYAML() (any, error) {
	m := make(map[string]any, 8+len(ss.Extensions))
	maps.Copy(m, ss.Extensions)
	if x := ss.Type; x != "" {
		m["type"] = x
	}
	if x := ss.Description; x != "" {
		m["description"] = x
	}
	if x := ss.Name; x != "" {
		m["name"] = x
	}
	if x := ss.In; x != "" {
		m["in"] = x
	}
	if x := ss.Scheme; x != "" {
		m["scheme"] = x
	}
	if x := ss.BearerFormat; x != "" {
		m["bearerFormat"] = x
	}
	if x := ss.Flows; x != nil {
		m["flows"] = x
	}
	if x := ss.OpenIdConnectUrl; x != "" {
		m["openIdConnectUrl"] = x
	}
	return m, nil
}

// UnmarshalJSON sets SecurityScheme to a copy of data.
func (ss *SecurityScheme) UnmarshalJSON(data []byte) error {
	type SecuritySchemeBis SecurityScheme
	var x SecuritySchemeBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "type")
	delete(x.Extensions, "description")
	delete(x.Extensions, "name")
	delete(x.Extensions, "in")
	delete(x.Extensions, "scheme")
	delete(x.Extensions, "bearerFormat")
	delete(x.Extensions, "flows")
	delete(x.Extensions, "openIdConnectUrl")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*ss = SecurityScheme(x)
	return nil
}

func (ss *SecurityScheme) WithType(value string) *SecurityScheme {
	ss.Type = value
	return ss
}

func (ss *SecurityScheme) WithDescription(value string) *SecurityScheme {
	ss.Description = value
	return ss
}

func (ss *SecurityScheme) WithName(value string) *SecurityScheme {
	ss.Name = value
	return ss
}

func (ss *SecurityScheme) WithIn(value string) *SecurityScheme {
	ss.In = value
	return ss
}

func (ss *SecurityScheme) WithScheme(value string) *SecurityScheme {
	ss.Scheme = value
	return ss
}

func (ss *SecurityScheme) WithBearerFormat(value string) *SecurityScheme {
	ss.BearerFormat = value
	return ss
}

// Validate returns an error if SecurityScheme does not comply with the OpenAPI spec.
func (ss *SecurityScheme) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	hasIn := false
	hasBearerFormat := false
	hasFlow := false
	switch ss.Type {
	case "apiKey":
		hasIn = true
	case "http":
		scheme := ss.Scheme
		switch scheme {
		case "bearer":
			hasBearerFormat = true
		case "basic", "negotiate", "digest":
		default:
			return newInvalidHTTPScheme(scheme, ss.Origin)
		}
	case "oauth2":
		hasFlow = true
	case "openIdConnect":
		if ss.OpenIdConnectUrl == "" {
			return newOpenIDConnectURLRequired(ss.Name, ss.Origin)
		}
	case "mutualTLS":
		if !getValidationOptions(ctx).isOpenAPI31OrLater {
			return errValueOfFieldFor31Plus(ss.Type, "type")
		}
	default:
		return newInvalidSecuritySchemeType(ss.Type, ss.Origin)
	}

	// Validate "in" and "name"
	if hasIn {
		switch ss.In {
		case "query", "header", "cookie":
		default:
			return newAPIKeyInInvalid(ss.In, ss.Origin)
		}
		if ss.Name == "" {
			return newAPIKeySecuritySchemeNameRequired(ss.Origin)
		}
	} else if len(ss.In) > 0 {
		return newSecuritySchemeInForbidden(ss.Type, ss.Origin)
	} else if len(ss.Name) > 0 {
		return newSecuritySchemeNameForbidden(ss.Type, ss.Origin)
	}

	// Validate "format"
	// "bearerFormat" is an arbitrary string so we only check if the scheme supports it
	if !hasBearerFormat && len(ss.BearerFormat) > 0 {
		return newSecuritySchemeBearerFormatForbidden(ss.Type, ss.Origin)
	}

	// Validate "flow"
	if hasFlow {
		flow := ss.Flows
		if flow == nil {
			return newSecuritySchemeFlowsRequired(ss.Type, ss.Origin)
		}
		if err := flow.Validate(ctx); err != nil {
			return &SecuritySchemeFlowValidationError{Cause: err}
		}
	} else if ss.Flows != nil {
		return newSecuritySchemeFlowsForbidden(ss.Type, ss.Origin)
	}

	return validateExtensions(ctx, ss.Extensions, ss.Origin)
}

// OAuthFlows is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#oauth-flows-object
type OAuthFlows struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	Implicit          *OAuthFlow `json:"implicit,omitempty" yaml:"implicit,omitempty"`
	Password          *OAuthFlow `json:"password,omitempty" yaml:"password,omitempty"`
	ClientCredentials *OAuthFlow `json:"clientCredentials,omitempty" yaml:"clientCredentials,omitempty"`
	AuthorizationCode *OAuthFlow `json:"authorizationCode,omitempty" yaml:"authorizationCode,omitempty"`
}

type oAuthFlowType int

const (
	oAuthFlowTypeImplicit oAuthFlowType = iota
	oAuthFlowTypePassword
	oAuthFlowTypeClientCredentials
	oAuthFlowAuthorizationCode
)

// MarshalJSON returns the JSON encoding of OAuthFlows.
func (flows OAuthFlows) MarshalJSON() ([]byte, error) {
	x, err := flows.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of OAuthFlows.
func (flows OAuthFlows) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(flows.Extensions))
	maps.Copy(m, flows.Extensions)
	if x := flows.Implicit; x != nil {
		m["implicit"] = x
	}
	if x := flows.Password; x != nil {
		m["password"] = x
	}
	if x := flows.ClientCredentials; x != nil {
		m["clientCredentials"] = x
	}
	if x := flows.AuthorizationCode; x != nil {
		m["authorizationCode"] = x
	}
	return m, nil
}

// UnmarshalJSON sets OAuthFlows to a copy of data.
func (flows *OAuthFlows) UnmarshalJSON(data []byte) error {
	type OAuthFlowsBis OAuthFlows
	var x OAuthFlowsBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "implicit")
	delete(x.Extensions, "password")
	delete(x.Extensions, "clientCredentials")
	delete(x.Extensions, "authorizationCode")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*flows = OAuthFlows(x)
	return nil
}

// Validate returns an error if OAuthFlows does not comply with the OpenAPI spec.
func (flows *OAuthFlows) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if v := flows.Implicit; v != nil {
		if err := v.validate(ctx, oAuthFlowTypeImplicit, opts...); err != nil {
			return &OAuthFlowValidationError{FlowKind: "implicit", Cause: err}
		}
	}

	if v := flows.Password; v != nil {
		if err := v.validate(ctx, oAuthFlowTypePassword, opts...); err != nil {
			return &OAuthFlowValidationError{FlowKind: "password", Cause: err}
		}
	}

	if v := flows.ClientCredentials; v != nil {
		if err := v.validate(ctx, oAuthFlowTypeClientCredentials, opts...); err != nil {
			return &OAuthFlowValidationError{FlowKind: "clientCredentials", Cause: err}
		}
	}

	if v := flows.AuthorizationCode; v != nil {
		if err := v.validate(ctx, oAuthFlowAuthorizationCode, opts...); err != nil {
			return &OAuthFlowValidationError{FlowKind: "authorizationCode", Cause: err}
		}
	}

	return validateExtensions(ctx, flows.Extensions, flows.Origin)
}

// OAuthFlow is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#oauth-flow-object
type OAuthFlow struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	AuthorizationURL string            `json:"authorizationUrl,omitempty" yaml:"authorizationUrl,omitempty"`
	TokenURL         string            `json:"tokenUrl,omitempty" yaml:"tokenUrl,omitempty"`
	RefreshURL       string            `json:"refreshUrl,omitempty" yaml:"refreshUrl,omitempty"`
	Scopes           map[string]string `json:"scopes" yaml:"scopes"` // required
}

// MarshalJSON returns the JSON encoding of OAuthFlow.
func (flow OAuthFlow) MarshalJSON() ([]byte, error) {
	x, err := flow.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of OAuthFlow.
func (flow OAuthFlow) MarshalYAML() (any, error) {
	m := make(map[string]any, 4+len(flow.Extensions))
	maps.Copy(m, flow.Extensions)
	if x := flow.AuthorizationURL; x != "" {
		m["authorizationUrl"] = x
	}
	if x := flow.TokenURL; x != "" {
		m["tokenUrl"] = x
	}
	if x := flow.RefreshURL; x != "" {
		m["refreshUrl"] = x
	}
	m["scopes"] = flow.Scopes
	return m, nil
}

// UnmarshalJSON sets OAuthFlow to a copy of data.
func (flow *OAuthFlow) UnmarshalJSON(data []byte) error {
	type OAuthFlowBis OAuthFlow
	var x OAuthFlowBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)

	delete(x.Extensions, "authorizationUrl")
	delete(x.Extensions, "tokenUrl")
	delete(x.Extensions, "refreshUrl")
	delete(x.Extensions, "scopes")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*flow = OAuthFlow(x)
	return nil
}

// Validate returns an error if OAuthFlows does not comply with the OpenAPI spec.
func (flow *OAuthFlow) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	if v := flow.RefreshURL; v != "" {
		if _, err := url.Parse(v); err != nil {
			return &OAuthFlowFieldValidationError{Field: "refreshUrl", Cause: err}
		}
	}

	if flow.Scopes == nil {
		return newOAuthFlowScopesRequired(flow.Origin)
	}

	return validateExtensions(ctx, flow.Extensions, flow.Origin)
}

func (flow *OAuthFlow) validate(ctx context.Context, typ oAuthFlowType, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	typeIn := func(types ...oAuthFlowType) bool {
		return slices.Contains(types, typ)
	}

	if in := typeIn(oAuthFlowTypeImplicit, oAuthFlowAuthorizationCode); true {
		switch {
		case flow.AuthorizationURL == "" && in:
			return newOAuthFlowAuthorizationURLRequired(flow.Origin)
		case flow.AuthorizationURL != "" && !in:
			return newOAuthFlowAuthorizationURLForbidden(flow.Origin)
		case flow.AuthorizationURL != "":
			if _, err := url.Parse(flow.AuthorizationURL); err != nil {
				return fmt.Errorf("field 'authorizationUrl' is invalid: %w", err)
			}
		}
	}

	if in := typeIn(oAuthFlowTypePassword, oAuthFlowTypeClientCredentials, oAuthFlowAuthorizationCode); true {
		switch {
		case flow.TokenURL == "" && in:
			return newOAuthFlowTokenURLRequired(flow.Origin)
		case flow.TokenURL != "" && !in:
			return newOAuthFlowTokenURLForbidden(flow.Origin)
		case flow.TokenURL != "":
			if _, err := url.Parse(flow.TokenURL); err != nil {
				return fmt.Errorf("field 'tokenUrl' is invalid: %w", err)
			}
		}
	}

	return flow.Validate(ctx, opts...)
}
