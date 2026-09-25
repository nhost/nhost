package typescript_test

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/typescript"
	"github.com/pb33f/libopenapi"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/stretchr/testify/assert"
)

// getModel mirrors the shared processor test helper; the TypeScript plugin lives
// in its own package, so it keeps a local copy instead of reaching into
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

func render(t *testing.T, fixture string) string {
	t.Helper()

	doc, err := getModel("../testdata/" + fixture)
	if err != nil {
		t.Fatalf("failed to get model: %v", err)
	}

	ir, err := processor.NewInterMediateRepresentation(doc, &typescript.Typescript{})
	if err != nil {
		t.Fatalf("failed to create intermediate representation: %v", err)
	}

	buf := bytes.NewBuffer(nil)
	if err := ir.Render(buf); err != nil {
		t.Fatalf("failed to render intermediate representation: %v", err)
	}

	return buf.String()
}

// TestQueryParameterSerialization pins the query serialization styles the plugin
// must honour. Objects and arrays without explode are comma-joined per OpenAPI
// rather than JSON-encoded, and a content-typed parameter is always JSON.
func TestQueryParameterSerialization(t *testing.T) {
	t.Parallel()

	t.Run("non-exploded object is comma joined", func(t *testing.T) {
		t.Parallel()

		output := render(t, "non-exploded-object-query.yaml")

		assert.Contains(t, output, `if (key === "filter") {`)
		assert.Contains(t, output, "// Object with explode: false - name=k1,v1,k2,v2")
		assert.Contains(
			t,
			output,
			"const parts = Object.entries(value).flatMap(([k, v]) => [k, String(v)])",
		)
	})

	t.Run("content typed parameter is json encoded", func(t *testing.T) {
		t.Parallel()

		output := render(t, "content.yaml")

		assert.Contains(
			t,
			output,
			"// content-typed parameter - serialized as JSON regardless of shape",
		)
		assert.Contains(
			t,
			output,
			"return [`${key}=${encodeURIComponent(JSON.stringify(value))}`]",
		)
	})

	t.Run("deepObject retains bracketed keys", func(t *testing.T) {
		t.Parallel()

		output := render(t, "deepobject-map.yaml")

		assert.Contains(t, output, "// deepObject with explode: true - upstreamParams[prop]=value")
	})
}

// TestHeaderParameters covers the header parameters the plugin previously
// dropped entirely: they must reach the request, and a caller-supplied header
// must still win.
func TestHeaderParameters(t *testing.T) {
	t.Parallel()

	output := render(t, "header-parameters.yaml")

	assert.Contains(t, output, "const parameterHeaders: Record<string, string> = {}")

	// Quoted property names: header names are not always valid TS identifiers.
	assert.Contains(t, output, `"x-first-json"`)
	assert.Contains(t, output, `"x-count"`)

	// content: application/json parameters are JSON encoded, scalars stringified.
	assert.Contains(
		t,
		output,
		`parameterHeaders["x-first-json"] = JSON.stringify(params["x-first-json"])`,
	)
	assert.Contains(t, output, `parameterHeaders["x-count"] = String(params["x-count"])`)

	// The caller's own headers are spread last so they override parameters.
	assert.Contains(t, output, "...parameterHeaders,")
	assert.Contains(t, output, "...options?.headers,")

	// A required header parameter makes the params argument mandatory.
	assert.Contains(t, output, "params: HeaderValuesParams,")
	assert.NotContains(t, output, "params?: HeaderValuesParams,")
}

// TestRedirectMethodsIgnoreHeaderParameters guards the redirect builder, which
// returns a URL and therefore has nowhere to put a request header.
func TestRedirectMethodsIgnoreHeaderParameters(t *testing.T) {
	t.Parallel()

	output := render(t, "header-parameters.yaml")

	// The redirect builder must still compile: it takes no header plumbing.
	assert.Contains(t, output, "headerOnlyRedirectURL")
}
