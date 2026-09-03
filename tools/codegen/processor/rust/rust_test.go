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

type rustRenderCase struct {
	name        string
	fixturePath string
	contains    []string
	notContains []string
}

// TestRustRender renders each shared OpenAPI fixture through the rust plugin and
// compares the result against a committed golden file. Run with -update to
// regenerate the goldens after an intentional template or mapping change. The
// fixtures are the same ones the typescript plugin uses, so the two plugins
// stay exercised against an identical surface.
func TestRustRender(t *testing.T) {
	t.Parallel()

	cases := []rustRenderCase{
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
				`let url = http::append_path(self.base_url.as_str(), &["files", id])?;`,
				"pub struct FilePart {",
				"    pub file_name: String,\n    /// The complete file contents.\n    pub content: Vec<u8>",
				"    pub content_type: Option<String>,",
				"    pub file: Vec<FilePart>,",
				"    pub file: FilePart,",
				"        if let Some(body) = body {\n            let mut form = reqwest::multipart::Form::new();",
				"        for item in body.file {",
				"            let part = reqwest::multipart::Part::bytes(item.content)\n                .file_name(item.file_name);",
				"            let v = body.file;",
				"            request = request.multipart(form);\n        }",
				") -> Result<Response<()>, Error> {",
				") -> Result<Response<bytes::Bytes>, Error> {",
				"        let body = bytes;",
				"        Ok(Response {\n            body,\n            status,\n            headers,\n        })",
			},
			notContains: []string{
				"let (_status, _headers, bytes) = http::send",
				"Part::bytes(item.clone())",
				"Part::bytes(v.clone())",
				"file_name(format!(\"file-",
				"let body = bytes.to_vec();",
			},
		},
		{
			name:        "multipart.yaml",
			fixturePath: "testdata/multipart.yaml",
			contains: []string{
				"    pub file: Option<FilePart>,",
				"    pub files: Vec<FilePart>,",
				"        if let Some(v) = body.file {",
				"        if let Some(v) = &body.label {",
				"        for item in body.files {",
			},
			notContains: []string{
				".clone()).file_name(",
				"file_name(format!(\"file-",
			},
		},
		{
			name:        "path-parameter.yaml",
			fixturePath: "testdata/path-parameter.yaml",
			contains: []string{
				`fn urlencode(s: &str) -> String {`,
				`let url = http::append_path(self.base_url.as_str(), &["files", id])?;`,
				`let mut url = http::append_path(self.base_url.as_str(), &["signin", "provider", provider])?.to_string();`,
			},
			notContains: []string{
				`urlencode(id)`,
				`urlencode(provider)`,
			},
		},
		{
			name:        "required-query-parameter.yaml",
			fixturePath: "testdata/required-query-parameter.yaml",
			contains: []string{
				"pub async fn required_request(\n        &self,\n        params: RequiredRequestParams,",
				"request = request.query(&params.to_query());",
				"pub async fn optional_request(\n        &self,\n        params: Option<OptionalRequestParams>,",
				"pub fn required_redirect_url(\n        &self,\n        params: &RequiredRedirectParams,",
				"pub fn optional_redirect_url(\n        &self,\n        params: Option<&OptionalRedirectParams>,",
			},
			notContains: []string{
				"params: Option<RequiredRequestParams>",
				"params: Option<&RequiredRedirectParams>",
			},
		},
		{
			name:        "header-parameter.yaml",
			fixturePath: "testdata/header-parameter.yaml",
			contains: []string{
				"pub struct GetFileParams {",
				"pub if_none_match: Option<String>,",
				"pub if_modified_since: Option<Rfc2822Date>,",
				"pub range: Option<String>,",
				"fn to_headers(&self) -> Vec<(String, String)>",
				`headers.push(("Range".to_string(), v.to_string()));`,
				"for (name, value) in p.to_headers() {",
				"pub async fn required_header(\n        &self,\n        params: RequiredHeaderParams,",
			},
			notContains: []string{
				"params: Option<RequiredHeaderParams>",
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
				`let mut url = http::append_path(self.base_url.as_str(), &["signin", "provider", provider])?.to_string();`,
				`q.push((format!("{key}[{k}]"), query_scalar(v)));`,
				`push_query(&mut q, "upstreamParams", &serde_json::to_value(v).unwrap_or_default(), "deepObject", true);`,
			},
		},
		{
			name:        "sensitive-fields.yaml",
			fixturePath: "testdata/sensitive-fields.yaml",
			contains: []string{
				"#[derive(Clone, Serialize, Deserialize)]\npub struct Credentials",
				`debug.field("username", &self.username);`,
				`debug.field("password", &"<redacted>");`,
				`debug.field("access_token", &"<redacted>");`,
				`debug.field("code_challenge", &self.code_challenge);`,
				`debug.field("hmac_create_secret", &self.hmac_create_secret);`,
				`debug.field("unusual_value", &"<redacted>");`,
				"#[derive(Clone, Serialize, Deserialize)]\npub struct InspectCredentialsParams",
				`debug.field("ticket", &"<redacted>");`,
				`debug.field("authorization", &"<redacted>");`,
				`debug.field("trace", &"<redacted>");`,
			},
			notContains: []string{
				"#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct Credentials",
				`debug.field("password", &self.password);`,
				`debug.field("trace", &self.trace);`,
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
			assertRustRenderCase(t, tc)
		})
	}
}

func assertRustRenderCase(t *testing.T, tc rustRenderCase) {
	t.Helper()

	fixturePath := tc.fixturePath
	if fixturePath == "" {
		fixturePath = "../testdata/" + tc.name
	}

	doc, err := getModel(fixturePath)
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

	golden := fixturePath + ".rs"
	if *flagUpdate {
		f, err := os.OpenFile(golden, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
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
}

func TestRefreshTokenRequestUsesOperationDefinition(t *testing.T) {
	t.Parallel()

	const spec = `openapi: "3.0.0"
paths:
  /v1/token:
    put:
      operationId: refreshToken
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RotatedTokenRequest"
      responses:
        "200":
          description: OK
components:
  schemas:
    RotatedTokenRequest:
      type: object
      required: [refreshToken]
      properties:
        refreshToken:
          type: string
`

	path := t.TempDir() + "/refresh-token.yaml"
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

	assert.Contains(t, buf.String(), `    pub(crate) fn refresh_token_request(
        &self,
        body: &RotatedTokenRequest,
    ) -> Result<http::RequestBuilder, Error> {
        let url = http::append_path(self.base_url.as_str(), &["v1", "token"])?;
        Ok(self.http.request(reqwest::Method::PUT, url).json(body))
    }

    /// Performs PUT /v1/token.`)
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
