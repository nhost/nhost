package rust_test

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/rust"
	"github.com/pb33f/libopenapi"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/stretchr/testify/assert"
)

//nolint:gochecknoglobals
var flagUpdate = flag.Bool(
	"update", false, "update expected output files with current output",
)

// getModel builds a v3 OpenAPI model from a spec file on disk. It mirrors the
// helper used by the intermediate-representation tests; the rust plugin lives
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

// TestRustRender renders each shared OpenAPI fixture through the rust plugin and
// compares the result against a committed golden file. Run with -update to
// regenerate the goldens after an intentional template or mapping change. The
// fixtures are the same ones the typescript plugin uses, so the two plugins
// stay exercised against an identical surface.
func TestRustRender(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name        string
		contains    []string
		notContains []string
	}{
		{
			name: "types.yaml",
			contains: []string{
				`pub type SimpleObjectStatusCode = serde_json::Value;`,
				`pub type SimpleObjectStatusInt = i64;`,
				`pub type SimpleObjectStatusMixed = serde_json::Value;`,
				`    pub metadata: Option<serde_json::Value>,`,
			},
			notContains: []string{
				"#[serde(skip_serializing_if = \"Option::is_none\", default)]\n    pub metadata",
			},
		},
		{
			name: "methods_ref.yaml",
			contains: []string{
				"use crate::http::{self, Response};",
				"        if let Some(body) = &body {\n            let mut form = reqwest::multipart::Form::new();",
				"            request = request.multipart(form);\n        }",
				") -> Result<Response<()>, Error> {",
				") -> Result<Response<Vec<u8>>, Error> {",
				"        Ok(Response {\n            body,\n            status,\n            headers,\n        })",
			},
			notContains: []string{
				"let (_status, _headers, bytes) = http::send",
			},
		},
		{
			name: "content.yaml",
			contains: []string{
				`q.push(("metadata".to_string(), serde_json::to_string(v).unwrap_or_default()));`,
				`push_query(&mut q, "providerSpecificParams", &serde_json::to_value(v).unwrap_or_default(), "form", true);`,
			},
			notContains: []string{`push_query(&mut q, "metadata"`},
		},
		{name: "form-url-encoded.yaml"},
		{
			name: "deepobject-map.yaml",
			contains: []string{
				`pub upstream_params: Option<HashMap<String, String>>,`,
				`q.push((format!("{key}[{k}]"), query_scalar(v)));`,
				`push_query(&mut q, "upstreamParams", &serde_json::to_value(v).unwrap_or_default(), "deepObject", true);`,
			},
		},
		{
			name: "required-object-query.yaml",
			contains: []string{
				"#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct GetItemsParams",
				"#[derive(Debug, Clone, Default, Serialize, Deserialize)]\npub struct GetOptionalItemsParams",
			},
			notContains: []string{
				"#[derive(Debug, Clone, Default, Serialize, Deserialize)]\npub struct GetItemsParams",
			},
		},
		{
			name: "reserved-type-names.yaml",
			contains: []string{
				"pub struct ArcType",
				"pub struct ClientType",
				"pub struct DeserializeType",
				"pub struct ErrorType",
				"pub struct ErrorTypeType",
				"pub struct HashMapType",
				"pub struct ResponseType",
				"pub struct SelfType",
				"pub struct SerializeType",
				"pub struct SessionStorageType",
				"pub struct SetHeadersType",
				"pub struct SetRoleType",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc, err := getModel("../testdata/" + tc.name)
			if err != nil {
				t.Fatalf("failed to get model: %v", err)
			}

			ir, err := processor.NewInterMediateRepresentation(doc, &rust.Rust{})
			if err != nil {
				t.Fatalf("failed to create intermediate representation: %v", err)
			}

			buf := bytes.NewBuffer(nil)
			if err := ir.Render(buf); err != nil {
				t.Fatalf("failed to render intermediate representation: %v", err)
			}

			output := buf.String()
			for _, expected := range tc.contains {
				assert.Contains(t, output, expected)
			}

			for _, unexpected := range tc.notContains {
				assert.NotContains(t, output, unexpected)
			}

			assert.NotRegexp(t, `(?m)^pub [a-z][a-z0-9_]*:`, output)

			golden := "../testdata/" + tc.name + ".rs"

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

func TestRustRenderMixedEnumQuery(t *testing.T) {
	t.Parallel()

	const spec = `openapi: "3.0.0"
paths:
  /items:
    get:
      operationId: listItems
      parameters:
        - name: state
          in: query
          required: false
          schema:
            type: string
            enum: [0, "one", true]
      responses:
        "200":
          description: OK
`

	path := t.TempDir() + "/mixed-enum-query.yaml"
	if err := os.WriteFile(path, []byte(spec), 0o600); err != nil {
		t.Fatalf("failed to write test spec: %v", err)
	}

	doc, err := getModel(path)
	if err != nil {
		t.Fatalf("failed to get model: %v", err)
	}

	ir, err := processor.NewInterMediateRepresentation(doc, &rust.Rust{})
	if err != nil {
		t.Fatalf("failed to create intermediate representation: %v", err)
	}

	buf := bytes.NewBuffer(nil)
	if err := ir.Render(buf); err != nil {
		t.Fatalf("failed to render intermediate representation: %v", err)
	}

	output := buf.String()
	assert.Contains(t, output, `pub type GetState = serde_json::Value;`)
	assert.Contains(
		t,
		output,
		`push_query(&mut q, "state", &serde_json::to_value(v).unwrap_or_default(), "form", true);`,
	)
	assert.NotContains(t, output, `q.push(("state".to_string(), v.to_string()));`)
}
