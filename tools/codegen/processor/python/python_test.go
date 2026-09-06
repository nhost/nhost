package python_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/python"
	"github.com/pb33f/libopenapi"
	"github.com/pb33f/libopenapi/datamodel/high/base"
	"github.com/pb33f/libopenapi/orderedmap"
	"gopkg.in/yaml.v3"
)

func schemaExtensions(customType string) *orderedmap.Map[string, *yaml.Node] {
	extensions := orderedmap.New[string, *yaml.Node]()
	if customType != "" {
		extensions.Set("x-python-type", &yaml.Node{
			Kind:  yaml.ScalarNode,
			Tag:   "!!str",
			Value: customType,
		})
	}

	return extensions
}

func testScalar(
	t *testing.T,
	plugin *python.Python,
	schemaType, schemaFormat string,
) *processor.TypeScalar {
	t.Helper()

	typeValue, _, err := processor.GetType(
		base.CreateSchemaProxy(&base.Schema{
			Type:       []string{schemaType},
			Format:     schemaFormat,
			Extensions: schemaExtensions(""),
		}),
		"Scalar",
		plugin,
		false,
	)
	if err != nil {
		t.Fatalf("create %s/%s scalar: %v", schemaType, schemaFormat, err)
	}

	scalar, ok := typeValue.(*processor.TypeScalar)
	if !ok {
		t.Fatalf("type = %T, want *processor.TypeScalar", typeValue)
	}

	return scalar
}

func testArray(
	t *testing.T,
	plugin *python.Python,
	itemNullable bool,
) *processor.TypeArray {
	t.Helper()

	item := base.CreateSchemaProxy(&base.Schema{
		Type:       []string{"string"},
		Nullable:   &itemNullable,
		Extensions: schemaExtensions(""),
	})

	typeValue, _, err := processor.GetType(
		base.CreateSchemaProxy(&base.Schema{
			Type:       []string{"array"},
			Extensions: schemaExtensions(""),
			Items: &base.DynamicValue[*base.SchemaProxy, bool]{
				A: item,
			},
		}),
		"Array",
		plugin,
		false,
	)
	if err != nil {
		t.Fatalf("create array with nullable=%t item: %v", itemNullable, err)
	}

	array, ok := typeValue.(*processor.TypeArray)
	if !ok {
		t.Fatalf("type = %T, want *processor.TypeArray", typeValue)
	}

	return array
}

func testMap(
	t *testing.T,
	plugin *python.Python,
	customType string,
) *processor.TypeMap {
	t.Helper()

	typeValue, _, err := processor.GetType(
		base.CreateSchemaProxy(&base.Schema{
			Type:       []string{"object"},
			Extensions: schemaExtensions(customType),
			AdditionalProperties: &base.DynamicValue[*base.SchemaProxy, bool]{
				B: true,
			},
		}),
		"Map",
		plugin,
		false,
	)
	if err != nil {
		t.Fatalf("create map with custom type %q: %v", customType, err)
	}

	mapType, ok := typeValue.(*processor.TypeMap)
	if !ok {
		t.Fatalf("type = %T, want *processor.TypeMap", typeValue)
	}

	return mapType
}

func TestGetTemplates(t *testing.T) {
	t.Parallel()

	got, err := fs.Glob((&python.Python{}).GetTemplates(), "templates/*.tmpl")
	if err != nil {
		t.Fatalf("GetTemplates glob: %v", err)
	}

	want := []string{
		"templates/client.tmpl",
		"templates/main.tmpl",
		"templates/types.tmpl",
	}
	if len(got) != len(want) {
		t.Fatalf("GetTemplates files = %v, want %v", got, want)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Errorf("GetTemplates files[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestTypeObjectName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "lowercase", input: "profile", want: "Profile"},
		{name: "kebab case", input: "user-profile", want: "UserProfile"},
		{name: "space separated", input: "user profile", want: "UserProfile"},
		{name: "underscore preserved", input: "user_profile", want: "User_profile"},
		{name: "empty", input: "", want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := plugin.TypeObjectName(test.input); got != test.want {
				t.Errorf("TypeObjectName(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestTypeScalarName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	tests := []struct {
		name         string
		schemaType   string
		schemaFormat string
		want         string
	}{
		{name: "integer", schemaType: "integer", want: "int"},
		{name: "integer int32", schemaType: "integer", schemaFormat: "int32", want: "int"},
		{name: "integer int64", schemaType: "integer", schemaFormat: "int64", want: "int"},
		{name: "number", schemaType: "number", want: "float"},
		{name: "number float", schemaType: "number", schemaFormat: "float", want: "float"},
		{name: "number double", schemaType: "number", schemaFormat: "double", want: "float"},
		{name: "boolean", schemaType: "boolean", want: "bool"},
		{name: "string", schemaType: "string", want: "str"},
		{name: "string byte", schemaType: "string", schemaFormat: "byte", want: "str"},
		{name: "string date", schemaType: "string", schemaFormat: "date", want: "str"},
		{name: "string date time", schemaType: "string", schemaFormat: "date-time", want: "str"},
		{name: "string password", schemaType: "string", schemaFormat: "password", want: "str"},
		{
			name:         "string binary",
			schemaType:   "string",
			schemaFormat: "binary",
			want:         "bytes | UploadFile",
		},
		{name: "unknown", schemaType: "null", want: "Any"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			scalar := testScalar(t, plugin, test.schemaType, test.schemaFormat)
			if got := plugin.TypeScalarName(scalar); got != test.want {
				t.Errorf(
					"TypeScalarName(%q, %q) = %q, want %q",
					test.schemaType,
					test.schemaFormat,
					got,
					test.want,
				)
			}
		})
	}
}

func TestTypeArrayName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	tests := []struct {
		name         string
		itemNullable bool
		want         string
	}{
		{name: "non-null items", itemNullable: false, want: "list[str]"},
		{name: "nullable items", itemNullable: true, want: "list[str | None]"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			array := testArray(t, plugin, test.itemNullable)
			if got := plugin.TypeArrayName(array); got != test.want {
				t.Errorf(
					"TypeArrayName(nullable=%t) = %q, want %q",
					test.itemNullable,
					got,
					test.want,
				)
			}
		})
	}
}

func TestTypeEnumName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "lowercase", input: "status", want: "Status"},
		{name: "kebab case", input: "account-status", want: "AccountStatus"},
		{name: "underscore preserved", input: "account_status", want: "Account_status"},
		{name: "empty", input: "", want: ""},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := plugin.TypeEnumName(test.input); got != test.want {
				t.Errorf("TypeEnumName(%q) = %q, want %q", test.input, got, test.want)
			}
		})
	}
}

func TestTypeMapName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	tests := []struct {
		name       string
		customType string
		want       string
	}{
		{name: "default", want: "dict[str, Any]"},
		{name: "custom Python type", customType: "Mapping[str, UUID]", want: "Mapping[str, UUID]"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			mapType := testMap(t, plugin, test.customType)
			if got := plugin.TypeMapName(mapType); got != test.want {
				t.Errorf("TypeMapName(custom=%q) = %q, want %q", test.customType, got, test.want)
			}
		})
	}
}

func testIdentifierName(
	t *testing.T,
	methodName string,
	mapName func(string) string,
) {
	t.Helper()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "camel case", input: "getUserJSON", want: "get_user_json"},
		{name: "hard keyword", input: "class", want: "class_"},
		{name: "soft keyword type", input: "type", want: "type"},
		{name: "soft keyword match", input: "match", want: "match"},
		{name: "soft keyword case", input: "case", want: "case"},
		{name: "leading digit", input: "2fa", want: "field_2fa"},
		{name: "pydantic protected prefix", input: "model_config", want: "model_config_"},
		{name: "empty", input: "[]", want: "field"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if got := mapName(test.input); got != test.want {
				t.Errorf("%s(%q) = %q, want %q", methodName, test.input, got, test.want)
			}
		})
	}
}

func TestMethodName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	testIdentifierName(t, "MethodName", plugin.MethodName)
}

func TestParameterName(t *testing.T) {
	t.Parallel()

	plugin := &python.Python{}
	testIdentifierName(t, "ParameterName", plugin.ParameterName)
}

func TestBinaryType(t *testing.T) {
	t.Parallel()

	if got := (&python.Python{}).BinaryType(); got != "bytes" {
		t.Errorf("BinaryType() = %q, want %q", got, "bytes")
	}
}

func TestPyReturnType(t *testing.T) {
	t.Parallel()

	p := &python.Python{}

	fn, ok := p.GetFuncMap()["pyReturnType"].(func(string) string)
	if !ok {
		t.Fatal("pyReturnType not registered as func(string) string")
	}

	cases := map[string]string{
		"":                 "None",
		"void":             "None",
		"SomeType":         "SomeType",
		"SomeType | void":  "SomeType | None",
		"void | SomeType":  "None | SomeType",
		"Avoidance":        "Avoidance",        // real name containing "void" is untouched
		"Avoidance | void": "Avoidance | None", // only the sentinel is mapped
		"list[Avoidance]":  "list[Avoidance]",  // nested name with "void" is untouched
	}

	for in, want := range cases {
		if got := fn(in); got != want {
			t.Errorf("pyReturnType(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestMethodPath(t *testing.T) {
	t.Parallel()

	p := &python.Python{}
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "escapes path parameter",
			input: "/things/100%25/{item-id}",
			want:  "/things/100%25/{_escape_path(item_id)}",
		},
		{
			name:  "escapes each path parameter",
			input: "/users/{userID}/files/{file_id}",
			want:  "/users/{_escape_path(user_id)}/files/{_escape_path(file_id)}",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := p.MethodPath(tt.input); got != tt.want {
				t.Errorf("MethodPath(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestIdentifierMapping(t *testing.T) {
	t.Parallel()

	p := &python.Python{}
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "hard keyword", input: "class", want: "class_"},
		{name: "soft keyword match", input: "match", want: "match"},
		{name: "soft keyword case", input: "case", want: "case"},
		{name: "soft keyword type", input: "type", want: "type"},
		{name: "leading digit", input: "2fa", want: "field_2fa"},
		{name: "empty", input: "", want: "field"},
		{name: "punctuation only", input: "!!!", want: "field"},
		{name: "non-identifier separator", input: "file$id", want: "file_id"},
		{name: "dunder", input: "__name__", want: "name"},
		{name: "pydantic model config", input: "model_config", want: "model_config_"},
		{name: "pydantic protected prefix", input: "model_dump", want: "model_dump_"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			if got := p.PropertyName(tt.input); got != tt.want {
				t.Errorf("PropertyName(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestRejectsUnsafePythonIdentifiers(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		spec string
		want []string
	}{
		{
			name: "folded property names",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        fileId: {type: string}
        file_id: {type: integer}
`,
			want: []string{
				`Python field namespace for type "Thing" collision`,
				`property "fileId"`,
				`property "file_id"`,
				`identifier "file_id"`,
			},
		},
		{
			name: "separator collision",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        file-id: {type: string}
        file.id: {type: string}
`,
			want: []string{`property "file-id"`, `property "file.id"`, `identifier "file_id"`},
		},
		{
			name: "dunder collision",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        __name__: {type: string}
        name: {type: string}
`,
			want: []string{`property "__name__"`, `property "name"`, `identifier "name"`},
		},
		{
			name: "keyword collision",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        class: {type: string}
        class_: {type: string}
`,
			want: []string{`property "class"`, `property "class_"`, `identifier "class_"`},
		},
		{
			name: "leading digit collision",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        2fa: {type: string}
        field_2fa: {type: string}
`,
			want: []string{`property "2fa"`, `property "field_2fa"`, `identifier "field_2fa"`},
		},
		{
			name: "empty mapped name collision",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        "!!!": {type: string}
        field: {type: string}
`,
			want: []string{`property "!!!"`, `property "field"`, `identifier "field"`},
		},
		{
			name: "pydantic protected name collision",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        model_config: {type: string}
        model_config_: {type: string}
`,
			want: []string{
				`property "model_config"`,
				`property "model_config_"`,
				`identifier "model_config_"`,
			},
		},
		{
			name: "parameter model fields",
			spec: `openapi: "3.0.0"
paths:
  /things:
    get:
      operationId: listThings
      parameters:
        - {name: request-id, in: query, schema: {type: string}}
        - {name: request.id, in: header, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Python parameter model for operation "listThings" collision`,
				`query parameter "request-id"`,
				`header parameter "request.id"`,
				`identifier "request_id"`,
			},
		},
		{
			name: "client methods",
			spec: `openapi: "3.0.0"
paths:
  /one:
    get:
      operationId: get-thing
      responses:
        "204": {description: Done}
  /two:
    get:
      operationId: get_thing
      responses:
        "204": {description: Done}
`,
			want: []string{
				"Python Client namespace collision",
				`operation "get-thing"`,
				`operation "get_thing"`,
				`identifier "get_thing"`,
			},
		},
		{
			name: "generated client attribute",
			spec: `openapi: "3.0.0"
paths:
  /base:
    get:
      operationId: baseUrl
      responses:
        "204": {description: Done}
`,
			want: []string{
				`generated Client attribute "base_url"`,
				`operation "baseUrl"`,
				`identifier "base_url"`,
			},
		},
		{
			name: "generated parameter model",
			spec: `openapi: "3.0.0"
paths:
  /things:
    get:
      operationId: listThings
      parameters:
        - {name: page, in: query, schema: {type: string}}
      responses:
        "204": {description: Done}
components:
  schemas:
    ListThingsParams:
      type: object
      properties:
        value: {type: string}
`,
			want: []string{
				"Python module namespace collision",
				`type "ListThingsParams"`,
				`parameter model for operation "listThings"`,
				`identifier "ListThingsParams"`,
			},
		},
		{
			name: "path parameter binding",
			spec: `openapi: "3.0.0"
paths:
  /things/{self}:
    get:
      operationId: getThing
      parameters:
        - {name: self, in: path, required: true, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Python method bindings for operation "getThing" collision`,
				"generated Client receiver",
				`path parameter "self"`,
				`identifier "self"`,
			},
		},
		{
			name: "invalid top-level type",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    bad.name:
      type: object
      properties:
        value: {type: string}
`,
			want: []string{
				"Python module namespace contains invalid identifier",
				`identifier "Bad.name"`,
				`type "bad.name"`,
			},
		},
		{
			name: "reserved dunder type",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    __all__:
      type: object
      properties:
        value: {type: string}
`,
			want: []string{
				"Python module namespace contains reserved dunder identifier",
				`identifier "__all__"`,
				`type "__all__"`,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			document, err := libopenapi.NewDocument([]byte(tt.spec))
			if err != nil {
				t.Fatalf("failed to parse fixture: %v", err)
			}

			model, modelErrors := document.BuildV3Model()
			if len(modelErrors) > 0 {
				t.Fatalf("failed to build fixture: %v", modelErrors)
			}

			ir, err := processor.NewInterMediateRepresentation(model, &python.Python{})
			if err != nil {
				t.Fatalf("failed to build intermediate representation: %v", err)
			}

			err = ir.Render(bytes.NewBuffer(nil))
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("generation error = %v, want ErrUnsupportedFeature", err)
			}

			for _, want := range tt.want {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("generation error = %q, want it to contain %q", err, want)
				}
			}
		})
	}
}

func TestRejectsUnsupportedParameterSerialization(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		in        string
		style     string
		required  bool
		response  string
		wantErr   string
		operation string
	}{
		{
			name:      "query style",
			in:        "query",
			style:     "pipeDelimited",
			response:  `"200"`,
			wantErr:   `unsupported query serialization: query parameter "value"`,
			operation: "listItems",
		},
		{
			name:      "header style",
			in:        "header",
			style:     "matrix",
			response:  `"200"`,
			wantErr:   `unsupported header serialization: header parameter "value"`,
			operation: "listItems",
		},
		{
			name:      "required redirect header",
			in:        "header",
			style:     "simple",
			required:  true,
			response:  `"302"`,
			wantErr:   `unsupported redirect header parameter: required header parameter "value"`,
			operation: "redirectItems",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec := fmt.Sprintf(`openapi: "3.0.0"
paths:
  /items:
    get:
      operationId: %s
      parameters:
        - name: value
          in: %s
          style: %s
          required: %t
          schema:
            type: string
      responses:
        %s:
          description: ok
`, tt.operation, tt.in, tt.style, tt.required, tt.response)

			document, err := libopenapi.NewDocument([]byte(spec))
			if err != nil {
				t.Fatalf("failed to parse fixture: %v", err)
			}

			model, modelErrors := document.BuildV3Model()
			if len(modelErrors) > 0 {
				t.Fatalf("failed to build fixture: %v", modelErrors)
			}

			ir, err := processor.NewInterMediateRepresentation(model, &python.Python{})
			if err != nil {
				t.Fatalf("failed to build intermediate representation: %v", err)
			}

			err = ir.Render(io.Discard)
			if err == nil {
				t.Fatal("generation accepted unsupported parameter serialization")
			}

			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("generation error = %q, want it to contain %q", err, tt.wantErr)
			}
		})
	}
}

func quoteJSON(t *testing.T, value string) string {
	t.Helper()

	quoted, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("failed to encode description: %v", err)
	}

	return string(quoted)
}

func TestDocumentationEscapingAndRoundTrip(t *testing.T) {
	t.Parallel()

	pythonPath, err := exec.LookPath("python3")
	if err != nil {
		t.Skip("python3 is not available; skipping generated Python AST validation")
	}

	modelDescription := "  Héllo from a model with \"\"\" delimiters.\n" +
		"A line with spaces.  \rNUL:\x00\\"
	fieldDescription := "  Field documentation with leading and trailing whitespace, enough " +
		"prose to require value-preserving source wrapping, and a multi-byte 🧪 character.  "
	fieldDocumentation := fieldDescription +
		"\n\nExample: \"sample \\\"value\\\"\"\n\nPattern: ^[é]+$\n\nFormat: credential"
	methodDescription := "Method documentation has \"\"\", a newline\n" +
		"then a CR\rNUL:\x00 and ends in a backslash\\"

	quotedMethodDescription := quoteJSON(t, methodDescription)
	quotedModelDescription := quoteJSON(t, modelDescription)
	quotedFieldDescription := quoteJSON(t, fieldDescription)

	spec := fmt.Sprintf(`{
  "openapi": "3.0.0",
  "paths": {
    "/items/{item-id}": {
      "get": {
        "operationId": "getItem",
        "summary": "Get an item",
        "description": %s,
        "parameters": [{
          "name": "item-id",
          "in": "path",
          "required": true,
          "description": "The item identifier.",
          "schema": {"type": "string"}
        }],
        "responses": {"200": {"description": "ok"}}
      }
    },
    "/redirect/{item-id}": {
      "get": {
        "operationId": "redirectItem",
        "summary": "Redirect to an item",
        "parameters": [{
          "name": "item-id",
          "in": "path",
          "required": true,
          "schema": {"type": "string"}
        }],
        "responses": {"302": {"description": "redirect"}}
      }
    }
  },
  "components": {
    "schemas": {
      "Payload": {
        "type": "object",
        "description": %s,
        "properties": {
          "secret": {
            "type": "string",
            "description": %s,
            "example": "sample \"value\"",
            "pattern": "^[é]+$",
            "format": "credential"
          }
        }
      },
      "WhitespacePayload": {
        "type": "object",
        "description": %s,
        "properties": {"value": {"type": "string"}}
      }
    }
  }
}`, quotedMethodDescription, quotedModelDescription, quotedFieldDescription, quotedFieldDescription)

	document, err := libopenapi.NewDocument([]byte(spec))
	if err != nil {
		t.Fatalf("failed to parse fixture: %v", err)
	}

	model, modelErrors := document.BuildV3Model()
	if len(modelErrors) > 0 {
		t.Fatalf("failed to build fixture: %v", modelErrors)
	}

	ir, err := processor.NewInterMediateRepresentation(model, &python.Python{})
	if err != nil {
		t.Fatalf("failed to build intermediate representation: %v", err)
	}

	var output bytes.Buffer
	if err := ir.Render(&output); err != nil {
		t.Fatalf("failed to render fixture: %v", err)
	}

	if bytes.IndexByte(output.Bytes(), 0) >= 0 {
		t.Fatal("generated Python contains a literal NUL byte")
	}

	generatedPath := t.TempDir() + "/client.py"
	if err := os.WriteFile(generatedPath, output.Bytes(), 0o600); err != nil {
		t.Fatalf("failed to write generated Python: %v", err)
	}

	validation := `
import ast
import base64
import pathlib
import sys

source = pathlib.Path(sys.argv[1]).read_text()
tree = ast.parse(source)
compile(tree, sys.argv[1], "exec")
expected_model = base64.b64decode(sys.argv[2]).decode()
expected_field = base64.b64decode(sys.argv[3]).decode()
expected_field_documentation = base64.b64decode(sys.argv[4]).decode()
expected_method = base64.b64decode(sys.argv[5]).decode()


def assert_source_width(node):
    lines = source.splitlines()
    assert all(len(line) <= 100 for line in lines[node.lineno - 1:node.end_lineno])

payload = next(
    node for node in tree.body
    if isinstance(node, ast.ClassDef) and node.name == "Payload"
)
assert ast.get_docstring(payload, clean=False) == expected_model
assert_source_width(payload.body[0])
whitespace_payload = next(
    node for node in tree.body
    if isinstance(node, ast.ClassDef) and node.name == "WhitespacePayload"
)
assert ast.get_docstring(whitespace_payload, clean=False) == expected_field
assert_source_width(whitespace_payload.body[0])
secret = next(
    node for node in payload.body
    if isinstance(node, ast.AnnAssign) and node.target.id == "secret"
)
keywords = {keyword.arg: ast.literal_eval(keyword.value) for keyword in secret.value.keywords}
assert keywords["description"] == expected_field_documentation
assert keywords["repr"] is False
assert_source_width(secret.value)

client = next(
    node for node in tree.body
    if isinstance(node, ast.ClassDef) and node.name == "Client"
)
get_item = next(
    node for node in client.body
    if isinstance(node, ast.AsyncFunctionDef) and node.name == "get_item"
)
redirect_item = next(
    node for node in client.body
    if isinstance(node, ast.FunctionDef) and node.name == "redirect_item_url"
)
assert expected_method in ast.get_docstring(get_item, clean=False)
assert "Args:\n    item_id (str): The item identifier." in ast.get_docstring(get_item, clean=False)
assert "Returns:\n    FetchResponse[None]:" in ast.get_docstring(get_item, clean=False)
assert_source_width(get_item.body[0])
assert "Args:\n    item_id (str): Path parameter." in ast.get_docstring(redirect_item, clean=False)
assert "Returns:\n    str:" in ast.get_docstring(redirect_item, clean=False)
assert_source_width(redirect_item.body[0])
`

	command := exec.CommandContext(
		t.Context(),
		pythonPath,
		"-c",
		validation,
		generatedPath,
		base64.StdEncoding.EncodeToString([]byte(modelDescription)),
		base64.StdEncoding.EncodeToString([]byte(fieldDescription)),
		base64.StdEncoding.EncodeToString([]byte(fieldDocumentation)),
		base64.StdEncoding.EncodeToString([]byte(methodDescription)),
	)
	if validationOutput, err := command.CombinedOutput(); err != nil {
		t.Fatalf("generated Python failed AST validation: %v\n%s", err, validationOutput)
	}
}

func TestSensitiveFieldRedaction(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		fieldName string
		fieldType string
		extension string
		wantField string
	}{
		{
			name:      "explicit marker",
			fieldName: "unusualValue",
			fieldType: "string",
			extension: "x-nhost-sensitive: true",
			wantField: `unusual_value: str = Field(alias="unusualValue", repr=False)`,
		},
		{
			name:      "heuristic suffix",
			fieldName: "accessToken",
			fieldType: "string",
			wantField: `access_token: str = Field(alias="accessToken", repr=False)`,
		},
		{
			name:      "innocuous similar name",
			fieldName: "codeChallenge",
			fieldType: "string",
			wantField: `code_challenge: str = Field(alias="codeChallenge")`,
		},
		{
			name:      "non credential scalar",
			fieldName: "hmacCreateSecret",
			fieldType: "boolean",
			wantField: `hmac_create_secret: bool = Field(alias="hmacCreateSecret")`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec := fmt.Sprintf(`openapi: "3.0.0"
paths: {}
components:
  schemas:
    Payload:
      type: object
      properties:
        %s:
          type: %s
          %s
      required: [%s]
`, tt.fieldName, tt.fieldType, tt.extension, tt.fieldName)

			document, err := libopenapi.NewDocument([]byte(spec))
			if err != nil {
				t.Fatalf("failed to parse fixture: %v", err)
			}

			model, modelErrors := document.BuildV3Model()
			if len(modelErrors) > 0 {
				t.Fatalf("failed to build fixture: %v", modelErrors)
			}

			ir, err := processor.NewInterMediateRepresentation(model, &python.Python{})
			if err != nil {
				t.Fatalf("failed to build intermediate representation: %v", err)
			}

			var output bytes.Buffer
			if err := ir.Render(&output); err != nil {
				t.Fatalf("failed to render fixture: %v", err)
			}

			if !strings.Contains(output.String(), tt.wantField) {
				t.Errorf("generated output does not contain %q", tt.wantField)
			}
		})
	}
}

func TestRejectsMalformedSensitiveExtension(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		extension string
		want      string
	}{
		{
			name:      "must be true",
			extension: "x-nhost-sensitive: false",
			want:      `x-nhost-sensitive on property "customField" of type "Payload" must be true`,
		},
		{
			name:      "must be boolean",
			extension: `x-nhost-sensitive: "true"`,
			want:      `x-nhost-sensitive on property "customField" of type "Payload" must be the boolean true`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec := fmt.Sprintf(`openapi: "3.0.0"
paths: {}
components:
  schemas:
    Payload:
      type: object
      properties:
        customField:
          type: string
          %s
`, tt.extension)

			document, err := libopenapi.NewDocument([]byte(spec))
			if err != nil {
				t.Fatalf("failed to parse fixture: %v", err)
			}

			model, modelErrors := document.BuildV3Model()
			if len(modelErrors) > 0 {
				t.Fatalf("failed to build fixture: %v", modelErrors)
			}

			ir, err := processor.NewInterMediateRepresentation(model, &python.Python{})
			if err != nil {
				t.Fatalf("failed to build intermediate representation: %v", err)
			}

			err = ir.Render(io.Discard)
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("generation error = %v, want ErrUnsupportedFeature", err)
			}

			if !strings.Contains(err.Error(), tt.want) {
				t.Errorf("generation error = %q, want it to contain %q", err, tt.want)
			}
		})
	}
}

func TestTypeEnumValues(t *testing.T) {
	t.Parallel()

	p := &python.Python{}
	got := p.TypeEnumValues([]any{"packed", true, false, nil, 1, 2.5})
	want := []string{`"packed"`, "True", "False", "None", "1", "2.5"}

	if len(got) != len(want) {
		t.Fatalf("TypeEnumValues length = %d, want %d (%v)", len(got), len(want), got)
	}

	for i := range want {
		if got[i] != want[i] {
			t.Errorf("TypeEnumValues[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}
