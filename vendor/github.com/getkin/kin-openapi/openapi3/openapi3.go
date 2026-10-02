package openapi3

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"net/url"
	"slices"

	"github.com/go-openapi/jsonpointer"
)

// T is the root of an OpenAPI v3 document
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#openapi-object
// and https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.1.0.md#openapi-object
type T struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"-" yaml:"-"`

	OpenAPI           string               `json:"openapi" yaml:"openapi"` // Required
	Components        *Components          `json:"components,omitempty" yaml:"components,omitempty"`
	Info              *Info                `json:"info" yaml:"info"`   // Required
	Paths             *Paths               `json:"paths" yaml:"paths"` // Required in 3.0, optional in 3.1
	Security          SecurityRequirements `json:"security,omitempty" yaml:"security,omitempty"`
	Servers           Servers              `json:"servers,omitempty" yaml:"servers,omitempty"`
	Tags              Tags                 `json:"tags,omitempty" yaml:"tags,omitempty"`
	ExternalDocs      *ExternalDocs        `json:"externalDocs,omitempty" yaml:"externalDocs,omitempty"`
	Webhooks          map[string]*PathItem `json:"webhooks,omitempty" yaml:"webhooks,omitempty"`                   // OpenAPI >=3.1
	JSONSchemaDialect string               `json:"jsonSchemaDialect,omitempty" yaml:"jsonSchemaDialect,omitempty"` // OpenAPI >=3.1

	visited visitedComponent
	url     *url.URL

	// Document-scoped format validators
	// These validators are automatically used by all schemas in this document
	stringFormats  map[string]StringFormatValidator
	numberFormats  map[string]NumberFormatValidator
	integerFormats map[string]IntegerFormatValidator
}

// IsOpenAPI30 returns whether doc is an OpenAPI document version 3.0.x.
// Returns true for 3, 3.0, 3.0.0, 3.0.1, 3.0.2, 3.0.3, 3.0.4, ...
// And false for 3.1.0, 3.2, ... and for invalid strings.
func (doc *T) IsOpenAPI30() bool {
	return doc.OpenAPIMajorMinor() == "3.0"
}

// IsOpenAPI31OrLater returns whether doc is an OpenAPI document version >=3.1.
// Returns true for 3.1, 3.1.0, 3.1.1, 3.1.2, 3.2.0, ...
// And false for cases where IsOpenAPI30 returns true and for invalid strings.
func (doc *T) IsOpenAPI31OrLater() bool {
	return slices.Contains([]string{"3.1", "3.2"}, doc.OpenAPIMajorMinor())
}

// IsOpenAPI32OrLater returns whether doc is an OpenAPI document version >=3.2.
// Returns true for 3.2, 3.2.0, ...
// And false for cases where IsOpenAPI31OrLater returns true for 3.1.x and for invalid strings.
func (doc *T) IsOpenAPI32OrLater() bool {
	return doc.OpenAPIMajorMinor() == "3.2"
}

func errValueOfFieldFor31Plus(value any, field string) error {
	return fmt.Errorf("value %q of field %s is for OpenAPI >=3.1", value, field)
}

// OpenAPIMajorMinor returns 3.y of the OpenAPI "3.y" or "3.y.z" version of the document.
// Returns the empty string for invalid OpenAPI version strings.
func (doc *T) OpenAPIMajorMinor() string {
	if doc == nil {
		return ""
	}
	switch doc.OpenAPI {
	case "3", "3.0", "3.0.0", "3.0.1", "3.0.2", "3.0.3", "3.0.4":
		return "3.0"
	case "3.1", "3.1.0", "3.1.1", "3.1.2":
		return "3.1"
	case "3.2", "3.2.0":
		return "3.2"
	default:
		return ""
	}
}

var _ jsonpointer.JSONPointable = (*T)(nil)

// JSONLookup implements https://pkg.go.dev/github.com/go-openapi/jsonpointer#JSONPointable
func (doc *T) JSONLookup(token string) (any, error) {
	switch token {
	case "openapi":
		return doc.OpenAPI, nil
	case "components":
		return doc.Components, nil
	case "info":
		return doc.Info, nil
	case "paths":
		return doc.Paths, nil
	case "security":
		return doc.Security, nil
	case "servers":
		return doc.Servers, nil
	case "tags":
		return doc.Tags, nil
	case "externalDocs":
		return doc.ExternalDocs, nil
	case "webhooks":
		return doc.Webhooks, nil
	case "jsonSchemaDialect":
		return doc.JSONSchemaDialect, nil
	}

	v, _, err := jsonpointer.GetForToken(doc.Extensions, token)
	return v, err
}

// MarshalJSON returns the JSON encoding of T.
func (doc *T) MarshalJSON() ([]byte, error) {
	x, err := doc.MarshalYAML()
	if err != nil {
		return nil, err
	}
	return json.Marshal(x)
}

// MarshalYAML returns the YAML encoding of T.
func (doc *T) MarshalYAML() (any, error) {
	if doc == nil {
		return nil, nil
	}
	m := make(map[string]any, 10+len(doc.Extensions))
	maps.Copy(m, doc.Extensions)
	m["openapi"] = doc.OpenAPI
	if x := doc.Components; x != nil {
		m["components"] = x
	}
	m["info"] = doc.Info
	m["paths"] = doc.Paths
	if x := doc.Security; len(x) != 0 {
		m["security"] = x
	}
	if x := doc.Servers; len(x) != 0 {
		m["servers"] = x
	}
	if x := doc.Tags; len(x) != 0 {
		m["tags"] = x
	}
	if x := doc.ExternalDocs; x != nil {
		m["externalDocs"] = x
	}
	if x := doc.Webhooks; len(x) != 0 {
		m["webhooks"] = x
	}
	if x := doc.JSONSchemaDialect; x != "" {
		m["jsonSchemaDialect"] = x
	}
	return m, nil
}

// UnmarshalJSON sets T to a copy of data.
func (doc *T) UnmarshalJSON(data []byte) error {
	type TBis T
	var x TBis
	if err := json.Unmarshal(data, &x); err != nil {
		return unmarshalError(err)
	}
	_ = json.Unmarshal(data, &x.Extensions)
	delete(x.Extensions, "openapi")
	delete(x.Extensions, "components")
	delete(x.Extensions, "info")
	delete(x.Extensions, "paths")
	delete(x.Extensions, "security")
	delete(x.Extensions, "servers")
	delete(x.Extensions, "tags")
	delete(x.Extensions, "externalDocs")
	delete(x.Extensions, "webhooks")
	delete(x.Extensions, "jsonSchemaDialect")
	if len(x.Extensions) == 0 {
		x.Extensions = nil
	}
	*doc = T(x)
	return nil
}

func (doc *T) AddOperation(path string, method string, operation *Operation) {
	if doc.Paths == nil {
		doc.Paths = NewPaths()
	}
	pathItem := doc.Paths.Value(path)
	if pathItem == nil {
		pathItem = &PathItem{}
		doc.Paths.Set(path, pathItem)
	}
	pathItem.SetOperation(method, operation)
}

func (doc *T) AddServer(server *Server) {
	doc.Servers = append(doc.Servers, server)
}

func (doc *T) AddServers(servers ...*Server) {
	doc.Servers = append(doc.Servers, servers...)
}

// SetStringFormatValidators sets document-scoped string format validators.
// These validators are automatically used by all schemas in this document.
func (doc *T) SetStringFormatValidators(validators map[string]StringFormatValidator) {
	doc.stringFormats = validators
}

// SetStringFormatValidator sets a single document-scoped string format validator.
func (doc *T) SetStringFormatValidator(name string, validator StringFormatValidator) {
	if doc.stringFormats == nil {
		doc.stringFormats = make(map[string]StringFormatValidator)
	}
	doc.stringFormats[name] = validator
}

// SetNumberFormatValidators sets document-scoped number format validators.
// These validators are automatically used by all schemas in this document.
func (doc *T) SetNumberFormatValidators(validators map[string]NumberFormatValidator) {
	doc.numberFormats = validators
}

// SetNumberFormatValidator sets a single document-scoped number format validator.
func (doc *T) SetNumberFormatValidator(name string, validator NumberFormatValidator) {
	if doc.numberFormats == nil {
		doc.numberFormats = make(map[string]NumberFormatValidator)
	}
	doc.numberFormats[name] = validator
}

// SetIntegerFormatValidators sets document-scoped integer format validators.
// These validators are automatically used by all schemas in this document.
func (doc *T) SetIntegerFormatValidators(validators map[string]IntegerFormatValidator) {
	doc.integerFormats = validators
}

// SetIntegerFormatValidator sets a single document-scoped integer format validator.
func (doc *T) SetIntegerFormatValidator(name string, validator IntegerFormatValidator) {
	if doc.integerFormats == nil {
		doc.integerFormats = make(map[string]IntegerFormatValidator)
	}
	doc.integerFormats[name] = validator
}

// GetSchemaValidationOptions returns SchemaValidationOptions that include
// this document's format validators. Use this when validating schemas from this document.
func (doc *T) GetSchemaValidationOptions() []SchemaValidationOption {
	var opts []SchemaValidationOption
	if doc.stringFormats != nil {
		opts = append(opts, WithStringFormatValidators(doc.stringFormats))
	}
	if doc.numberFormats != nil {
		opts = append(opts, WithNumberFormatValidators(doc.numberFormats))
	}
	if doc.integerFormats != nil {
		opts = append(opts, WithIntegerFormatValidators(doc.integerFormats))
	}
	return opts
}

// Validate returns an error if T does not comply with the OpenAPI spec.
// Validations Options can be provided to modify the validation behavior.
//
// By default, doc.OpenAPI's field dictates whether "JSON Schema Draft 2020-12" validation
// is enabled.
func (doc *T) Validate(ctx context.Context, opts ...ValidationOption) error {
	if doc.IsOpenAPI31OrLater() {
		opts = append(opts, IsOpenAPI31OrLater())
	}
	if doc.IsOpenAPI32OrLater() {
		opts = append(opts, IsOpenAPI32OrLater())
	}
	ctx = WithValidationOptions(ctx, opts...)
	me := newErrCollector(ctx)

	if doc.OpenAPI == "" {
		if err := me.emit(newOpenAPIVersionRequired(doc.Origin)); err != nil {
			return err
		}
	}

	if doc.Webhooks != nil && !doc.IsOpenAPI31OrLater() {
		if err := me.emit(newWebhooksFieldFor31Plus(doc.Origin)); err != nil {
			return err
		}
	}
	if doc.JSONSchemaDialect != "" && !doc.IsOpenAPI31OrLater() {
		if err := me.emit(newJSONSchemaDialectFieldFor31Plus(doc.Origin)); err != nil {
			return err
		}
	}

	wrapSection := func(section string) func(error) error {
		return func(e error) error { return &SectionValidationError{Section: section, Cause: e} }
	}

	var wrap func(error) error

	wrap = wrapSection("components")
	if v := doc.Components; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	}

	wrap = wrapSection("info")
	if v := doc.Info; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	} else if err := me.emit(wrap(newInfoRequired(doc.Origin))); err != nil {
		return err
	}

	wrap = wrapSection("paths")
	if v := doc.Paths; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	} else if doc.IsOpenAPI30() {
		if err := me.emit(wrap(newPathsRequired(doc.Origin))); err != nil {
			return err
		}
	}

	wrap = wrapSection("security")
	if v := doc.Security; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	}

	wrap = wrapSection("servers")
	if v := doc.Servers; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	}

	wrap = wrapSection("tags")
	if v := doc.Tags; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	}

	wrap = wrapSection("external docs")
	if v := doc.ExternalDocs; v != nil {
		if err := me.emitWrapped(wrap, v.Validate(ctx)); err != nil {
			return err
		}
	}

	wrap = wrapSection("webhooks")
	for _, name := range componentNames(doc.Webhooks) {
		pathItem := doc.Webhooks[name]
		if pathItem == nil {
			if err := me.emit(wrap(newWebhookNil(name))); err != nil {
				return err
			}
			// Nothing to descend into for a nil webhook; the nil itself
			// is the only finding under this name until the entry is
			// populated, so continue to the next webhook.
			continue
		}
		wrapWebhook := func(e error) error { return wrap(&WebhookValidationError{Name: name, Cause: e}) }
		if err := me.emitWrapped(wrapWebhook, pathItem.Validate(ctx)); err != nil {
			return err
		}
	}

	wrap = wrapSection("jsonSchemaDialect")
	if doc.JSONSchemaDialect != "" {
		u, err := url.Parse(doc.JSONSchemaDialect)
		if err != nil {
			if err = me.emit(wrap(err)); err != nil {
				return err
			}
		} else if u.Scheme == "" {
			if err := me.emit(wrap(newJSONSchemaDialectAbsoluteURIRequired(doc.Origin))); err != nil {
				return err
			}
		}
	}

	return me.finalize(validateExtensions(ctx, doc.Extensions, doc.Origin))
}

// ValidateSchemaJSON validates data against a schema using this document's format validators.
// This is a convenience method that automatically applies the document's format validators.
func (doc *T) ValidateSchemaJSON(schema *Schema, value any, opts ...SchemaValidationOption) error {
	// Combine document's validators with any additional options
	allOpts := append(doc.GetSchemaValidationOptions(), opts...)
	return schema.VisitJSON(value, allOpts...)
}
