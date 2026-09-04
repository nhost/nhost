package golang_test

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/golang"
	"github.com/pb33f/libopenapi"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/stretchr/testify/assert"
)

//nolint:gochecknoglobals
var flagUpdate = flag.Bool(
	"update", false, "update expected output files with current output",
)

// getModel builds a v3 OpenAPI model from a spec file on disk. It mirrors the
// helper used by the intermediate-representation tests; the golang plugin lives
// in its own package so it needs its own copy rather than reaching into
// processor_test.
func getModel(filepath string) (*libopenapi.DocumentModel[v3.Document], error) {
	b, err := os.ReadFile(filepath)
	if err != nil {
		return nil, fmt.Errorf("failed to read openapi spec: %w", err)
	}

	document, err := libopenapi.NewDocument(b)
	if err != nil {
		return nil, fmt.Errorf("cannot create new document: %w", err)
	}

	docModel, errorsList := document.BuildV3Model()
	if len(errorsList) > 0 {
		var wrappedError error
		for i := range errorsList {
			wrappedError = errors.Join(wrappedError, errorsList[i])
		}

		return nil, fmt.Errorf("cannot create v3 model from document: %w", wrappedError)
	}

	return docModel, nil
}

// TestGolangRender renders each shared OpenAPI fixture through the golang plugin
// and compares the result against a committed golden file. Run with -update to
// regenerate the goldens after an intentional template or mapping change. The
// fixtures are the same ones the typescript plugin uses, so the plugins stay
// exercised against an identical surface. Goldens use a ".go.golden" extension
// (not ".go") so the tree-wide golines/gofumpt formatter leaves them untouched.
func TestNewRejectsInvalidPackageNames(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		packageName string
	}{
		{name: "empty", packageName: ""},
		{name: "blank identifier", packageName: "_"},
		{name: "invalid identifier", packageName: "my-pkg 3"},
		{name: "keyword", packageName: "package"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if _, err := golang.New(test.packageName); err == nil {
				t.Fatalf(
					"New(%q) error = nil, want an invalid package name error",
					test.packageName,
				)
			}
		})
	}
}

func TestGolangUsesSDKScopedCustomTypeExtension(t *testing.T) {
	t.Parallel()

	const spec = `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Container:
      type: object
      required: [legacy, sdk]
      properties:
        legacy:
          type: object
          additionalProperties: true
          x-go-type: ServerMap
        sdk:
          type: object
          additionalProperties: true
          x-nhost-go-type: SDKMapValue
`

	filename := t.TempDir() + "/custom-type.yaml"
	if err := os.WriteFile(filename, []byte(spec), 0o600); err != nil {
		t.Fatalf("failed to write test spec: %v", err)
	}

	output, err := renderGolangFixture(filename)
	if err != nil {
		t.Fatalf("failed to render spec: %v", err)
	}

	assert.Contains(t, string(output), "Legacy map[string]any")
	assert.Contains(t, string(output), "SDKMapValue")
	assert.NotContains(t, string(output), "ServerMap")
}

func TestGolangRejectsIdentifierCollisions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		spec string
		want []string
	}{
		{
			name: "top-level types",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing-One:
      type: object
      properties:
        value: {type: string}
    Thing_One:
      type: object
      properties:
        value: {type: string}
`,
			want: []string{
				"Go type namespace collision",
				`type "Thing-One"`,
				`type "Thing_One"`,
				`identifier "ThingOne"`,
			},
		},
		{
			name: "generated Client type",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Client:
      type: object
      properties:
        value: {type: string}
`,
			want: []string{
				"Go type namespace collision",
				`generated type "Client"`,
				`type "Client"`,
				`identifier "Client"`,
			},
		},
		{
			name: "generated NewClient function",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    NewClient:
      type: object
      properties:
        value: {type: string}
`,
			want: []string{
				"Go type namespace collision",
				`generated function "NewClient"`,
				`type "NewClient"`,
				`identifier "NewClient"`,
			},
		},
		{
			name: "generated parameter type",
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
				"Go type namespace collision",
				`type "ListThingsParams"`,
				`parameter struct for operation "listThings"`,
				`identifier "ListThingsParams"`,
			},
		},
		{
			name: "object properties",
			spec: `openapi: "3.0.0"
paths: {}
components:
  schemas:
    Thing:
      type: object
      properties:
        user_id: {type: string}
        userId: {type: string}
`,
			want: []string{
				`Go field namespace for type "Thing" collision`,
				`property "user_id"`,
				`property "userId"`,
				`identifier "UserID"`,
			},
		},
		{
			name: "parameter fields",
			spec: `openapi: "3.0.0"
paths:
  /things:
    get:
      operationId: listThings
      parameters:
        - {name: user_id, in: query, schema: {type: string}}
        - {name: userId, in: query, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Go parameter struct for operation "listThings" collision`,
				`query parameter "user_id"`,
				`query parameter "userId"`,
				`identifier "UserID"`,
			},
		},
		{
			name: "query and header parameter fields",
			spec: `openapi: "3.0.0"
paths:
  /things:
    get:
      operationId: listThings
      parameters:
        - {name: request_id, in: query, schema: {type: string}}
        - {name: requestId, in: header, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Go parameter struct for operation "listThings" collision`,
				`query parameter "request_id"`,
				`header parameter "requestId"`,
				`identifier "RequestID"`,
			},
		},
		{
			name: "operation methods",
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
				"Go client method namespace collision",
				`operation "get-thing"`,
				`operation "get_thing"`,
				`identifier "GetThing"`,
			},
		},
		{
			name: "redirect method suffix",
			spec: `openapi: "3.0.0"
paths:
  /redirect:
    get:
      operationId: getThing
      responses:
        "302": {description: Redirect}
  /url:
    get:
      operationId: getThingURL
      responses:
        "204": {description: Done}
`,
			want: []string{
				"Go client method namespace collision",
				`operation "getThing"`,
				`operation "getThingURL"`,
				`identifier "GetThingURL"`,
			},
		},
		{
			name: "generated Client field",
			spec: `openapi: "3.0.0"
paths:
  /base-url:
    get:
      operationId: base_url
      responses:
        "204": {description: Done}
`,
			want: []string{
				"Go client method namespace collision",
				`generated Client field "BaseURL"`,
				`operation "base_url"`,
				`identifier "BaseURL"`,
			},
		},
		{
			name: "path parameter and generated headers argument",
			spec: `openapi: "3.0.0"
paths:
  /things/{headers}:
    get:
      operationId: getThing
      parameters:
        - {name: headers, in: path, required: true, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Go argument list for operation "getThing" collision`,
				"generated request headers argument",
				`path parameter "headers"`,
				`identifier "headers"`,
			},
		},
		{
			name: "path parameter and generated payload local",
			spec: `openapi: "3.0.0"
paths:
  /things/{payload}:
    get:
      operationId: getThing
      parameters:
        - {name: payload, in: path, required: true, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Go argument list for operation "getThing" collision`,
				"generated response payload local",
				`path parameter "payload"`,
				`identifier "payload"`,
			},
		},
		{
			name: "path parameter and generated import",
			spec: `openapi: "3.0.0"
paths:
  /things/{json}:
    get:
      operationId: getThing
      parameters:
        - {name: json, in: path, required: true, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Go argument list for operation "getThing" collision`,
				`generated import "encoding/json"`,
				`path parameter "json"`,
				`identifier "json"`,
			},
		},
		{
			name: "path parameters",
			spec: `openapi: "3.0.0"
paths:
  /things/{user_id}/{userId}:
    get:
      operationId: getThing
      parameters:
        - {name: user_id, in: path, required: true, schema: {type: string}}
        - {name: userId, in: path, required: true, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`Go argument list for operation "getThing" collision`,
				`path parameter "user_id"`,
				`path parameter "userId"`,
				`identifier "userID"`,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			filename := t.TempDir() + "/collision.yaml"
			if err := os.WriteFile(filename, []byte(test.spec), 0o600); err != nil {
				t.Fatalf("failed to write test spec: %v", err)
			}

			_, err := renderGolangFixture(filename)
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("render error = %v, want ErrUnsupportedFeature", err)
			}

			for _, want := range test.want {
				assert.Contains(t, err.Error(), want)
			}
		})
	}
}

func TestGolangSuffixesPredeclaredMethodArguments(t *testing.T) {
	t.Parallel()

	const spec = `openapi: "3.0.0"
paths:
  /things/{len}/{string}:
    get:
      operationId: getThing
      parameters:
        - {name: len, in: path, required: true, schema: {type: string}}
        - {name: string, in: path, required: true, schema: {type: string}}
      responses:
        "204": {description: Done}
`

	filename := t.TempDir() + "/predeclared.yaml"
	if err := os.WriteFile(filename, []byte(spec), 0o600); err != nil {
		t.Fatalf("failed to write test spec: %v", err)
	}

	output, err := renderGolangFixture(filename)
	if err != nil {
		t.Fatalf("failed to render spec: %v", err)
	}

	assert.Contains(t, string(output), "len_ string")
	assert.Contains(t, string(output), "string_ string")
	assert.Contains(t, string(output), "escapePathSegment(len_)")
	assert.Contains(t, string(output), "escapePathSegment(string_)")
}

func TestGolangRender(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
	}{
		{name: "types.yaml"},
		{name: "methods_ref.yaml"},
		{name: "content.yaml"},
		{name: "form-url-encoded.yaml"},
		{name: "optional-form-url-encoded.yaml"},
		{name: "deepobject-map.yaml"},
		{name: "escaped-go-source.yaml"},
		{name: "required-object-query.yaml"},
		{name: "header-parameters.yaml"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc, err := getModel("../testdata/" + tc.name)
			if err != nil {
				t.Fatalf("failed to get model: %v", err)
			}

			goPlugin, err := golang.New("testpkg")
			if err != nil {
				t.Fatalf("failed to create Go plugin: %v", err)
			}

			ir, err := processor.NewInterMediateRepresentation(doc, goPlugin)
			if err != nil {
				t.Fatalf("failed to create intermediate representation: %v", err)
			}

			buf := bytes.NewBuffer(nil)
			if err := ir.Render(buf); err != nil {
				t.Fatalf("failed to render intermediate representation: %v", err)
			}

			output := buf.String()

			golden := "../testdata/" + tc.name + ".go.golden"

			if *flagUpdate {
				f, err := os.OpenFile(
					golden,
					os.O_CREATE|os.O_WRONLY|os.O_TRUNC,
					0o644,
				)
				if err != nil {
					t.Fatalf("failed to open output file: %v", err)
				}
				defer f.Close()

				if _, err := f.WriteString(output); err != nil {
					t.Fatalf("failed to write output file: %v", err)
				}
			}

			b, err := os.ReadFile(golden)
			if err != nil {
				t.Fatalf("failed to read expected output file: %v", err)
			}

			assert.Equal(t, string(b), output,
				"rendered output does not match expected output for %s", tc.name)
		})
	}
}
