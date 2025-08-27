package typescript

import (
	"embed"
	"fmt"
	"io/fs"
	"strings"

	"github.com/nhost/nhost/tools/codegen/format"
	"github.com/nhost/nhost/tools/codegen/processor"
)

const extCustomType = "x-ts-type"

//go:embed templates/*.tmpl
var templatesFS embed.FS

type Typescript struct{}

func (t *Typescript) GetTemplates() fs.FS {
	return templatesFS
}

func quotePropertyIfNeeded(name string) string {
	if strings.Contains(name, "-") || strings.Contains(name, "[") {
		return fmt.Sprintf("\"%s\"", name)
	}

	return name
}

func (t *Typescript) GetFuncMap() map[string]any {
	return map[string]any{
		"quotePropertyIfNeeded": quotePropertyIfNeeded,
	}
}

func (t *Typescript) TypeObjectName(name string) string {
	return format.ToCamelCase(name)
}

func (t *Typescript) TypeScalarName(scalar *processor.TypeScalar) string {
	switch scalar.Schema().Schema().Type[0] {
	case "integer":
		return "number"
	case "string":
		if scalar.Schema().Schema().Format == "binary" {
			return "Blob"
		}
	}

	return scalar.Schema().Schema().Type[0]
}

func (t *Typescript) TypeArrayName(array *processor.TypeArray) string {
	return array.Item.Name() + "[]"
}

func (t *Typescript) TypeEnumName(name string) string {
	return format.ToCamelCase(name)
}

func (t *Typescript) TypeEnumValues(values []any) []string {
	enumValues := make([]string, len(values))
	if len(values) == 0 {
		return enumValues
	}

	for i, v := range values {
		if s, ok := v.(string); ok {
			enumValues[i] = fmt.Sprintf("\"%v\"", s)
		} else {
			enumValues[i] = fmt.Sprintf("%v", v)
		}
	}

	return enumValues
}

func (t *Typescript) TypeMapName(schema *processor.TypeMap) string {
	if v, ok := schema.Schema().Schema().Extensions.Get(extCustomType); ok {
		return v.Value
	}

	return "Record<string, unknown>"
}

func (t *Typescript) MethodName(name string) string {
	return format.AntiTitle(format.ToCamelCase(name))
}

func (t *Typescript) MethodPath(name string) string {
	return strings.ReplaceAll(name, "{", "${")
}

func (t *Typescript) ParameterName(name string) string {
	return name
}

func (t *Typescript) PropertyName(name string) string {
	return name
}

func (t *Typescript) BinaryType() string {
	return "Blob"
}
