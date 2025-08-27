package processor

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"maps"
	"slices"
	"strings"
	"text/template"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/pb33f/libopenapi"
	"github.com/pb33f/libopenapi/datamodel/high/base"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/pb33f/libopenapi/orderedmap"
)

type InterMediateRepresentation struct {
	plugin  Plugin
	Types   []Type
	Methods []*Method
}

/*
When processing the OpenAPI document, we need to create an intermediate representation.

In this represntation, we create:

- Create a type for each schema in the OpenAPI document.
- Create a type for each nested object inside another object.
- Create a type for each enum in the OpenAPI document.
*/
func NewInterMediateRepresentation(
	doc *libopenapi.DocumentModel[v3.Document], plugin Plugin,
) (*InterMediateRepresentation, error) {
	types := make([]Type, 0, 10) //nolint:mnd

	if doc.Model.Components != nil && doc.Model.Components.Schemas != nil {
		var err error

		types, err = newInterMediateRepresentationComponentsSchemas(
			doc.Model.Components.Schemas, plugin,
		)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to create intermediate representation components: %w",
				err,
			)
		}
	}

	if doc.Model.Components != nil && doc.Model.Components.Parameters != nil {
		var err error

		types2, err := newInterMediateRepresentationComponentsParameters(
			doc.Model.Components.Parameters, plugin,
		)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to create intermediate representation components parameters: %w",
				err,
			)
		}

		types = append(types, types2...)
	}

	var methods []*Method

	if doc.Model.Paths != nil {
		m, types2, err := newInterMediateRepresentationPaths(doc, plugin)
		if err != nil {
			return nil, fmt.Errorf("failed to create intermediate representation paths: %w", err)
		}

		types = append(types, types2...)
		methods = m
	}

	return &InterMediateRepresentation{
		plugin:  plugin,
		Types:   types,
		Methods: methods,
	}, nil
}

func newInterMediateRepresentationComponentsSchemas(
	schemas *orderedmap.Map[string, *base.SchemaProxy], plugin Plugin,
) ([]Type, error) {
	types := make([]Type, 0, 10) //nolint:mnd

	for schemaPairs := schemas.First(); schemaPairs != nil; schemaPairs = schemaPairs.Next() {
		schemaName := schemaPairs.Key()
		proxy := schemaPairs.Value()

		if proxy.Schema() != nil && len(proxy.Schema().Type) > 0 {
			_, tt, err := GetType(proxy, schemaName, plugin, true)
			if err != nil {
				return nil, fmt.Errorf("failed to create type %s: %w", schemaName, err)
			}

			// types = append(types, t)
			types = append(types, tt...)
		} else {
			return nil, fmt.Errorf("%w: schema %s is not an object", ErrUnknownType, schemaName)
		}
	}

	return types, nil
}

func newInterMediateRepresentationComponentsParameters(
	schemas *orderedmap.Map[string, *v3.Parameter], plugin Plugin,
) ([]Type, error) {
	types := make([]Type, 0, 10) //nolint:mnd

	for paramPairs := schemas.First(); paramPairs != nil; paramPairs = paramPairs.Next() {
		schemaName := paramPairs.Key()
		proxy := paramPairs.Value()

		_, tt, err := GetType(proxy.Schema, schemaName, plugin, true)
		if err != nil {
			return nil, fmt.Errorf("failed to create type %s: %w", schemaName, err)
		}

		types = append(types, tt...)
	}

	return types, nil
}

func newInterMediateRepresentationPaths(
	doc *libopenapi.DocumentModel[v3.Document], plugin Plugin,
) ([]*Method, []Type, error) {
	methods := make([]*Method, 0, 10) //nolint:mnd
	types := make([]Type, 0, 10)      //nolint:mnd

	for pathPairs := doc.Model.Paths.PathItems.First(); pathPairs != nil; pathPairs = pathPairs.Next() {
		path := pathPairs.Key()
		item := pathPairs.Value()

		for opPairs := item.GetOperations().First(); opPairs != nil; opPairs = opPairs.Next() {
			if slices.Contains(opPairs.Value().Tags, "excludeme") {
				continue
			}

			m, tt, err := GetMethod(path, opPairs.Key(), opPairs.Value(), plugin)
			if err != nil {
				return nil, nil, fmt.Errorf("failed to create method for path %s: %w", path, err)
			}

			methods = append(methods, m)
			types = append(types, tt...)
		}
	}

	return methods, types, nil
}

func (ir *InterMediateRepresentation) Render(out io.Writer) error {
	templatesFS := ir.plugin.GetTemplates()
	// ReadDir to get list of embedded templates
	entries, err := fs.ReadDir(templatesFS, "templates")
	if err != nil {
		return fmt.Errorf("failed to read templates directory: %w", err)
	}

	var filenames []string

	for _, entry := range entries {
		if !entry.IsDir() {
			filenames = append(filenames, "templates/"+entry.Name())
		}
	}

	funcs := template.FuncMap{
		"title":   format.Title,
		"join":    strings.Join,
		"example": templateFnExample,
		"pattern": templateFnPattern,
		"format":  templateFnFormat,
	}
	maps.Copy(funcs, ir.plugin.GetFuncMap())

	tmpl, err := template.New("").Funcs(funcs).ParseFS(templatesFS, filenames...)
	if err != nil {
		return fmt.Errorf("failed to parse interface template: %w", err)
	}

	if err := tmpl.ExecuteTemplate(out, "main.tmpl", ir); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	return nil
}

type getSchemaer interface {
	Schema() *base.SchemaProxy
}

func templateFnExample(obj getSchemaer) string {
	if obj.Schema().Schema().Example == nil {
		return ""
	}

	var a any
	if err := obj.Schema().Schema().Example.Decode(&a); err != nil {
		return fmt.Sprintf("Error decoding example: %v", err)
	}

	b, err := json.Marshal(a)
	if err != nil {
		return fmt.Sprintf("Error marshaling example: %v", err)
	}

	return string(b)
}

func templateFnPattern(obj getSchemaer) string {
	return obj.Schema().Schema().Pattern
}

func templateFnFormat(obj getSchemaer) string {
	return obj.Schema().Schema().Format
}
