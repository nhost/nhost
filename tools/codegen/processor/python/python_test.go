package python_test

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/python"
	"github.com/pb33f/libopenapi"
)

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
