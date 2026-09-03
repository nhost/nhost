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
				`    pub aliases: Option<Vec<Option<String>>>,`,
				`    pub labels: Option<HashMap<String, Option<String>>>,`,
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
			name:        "mixed-binary-void-response.yaml",
			fixturePath: "testdata/mixed-binary-void-response.yaml",
			contains: []string{
				") -> Result<Response<bytes::Bytes>, Error> {",
				"        let body = bytes;",
			},
			notContains: []string{
				") -> Result<Response<serde_json::Value>, Error> {",
				"        let body = serde_json::from_slice(&bytes)?;",
			},
		},
		{
			name:        "multipart.yaml",
			fixturePath: "testdata/multipart.yaml",
			contains: []string{
				"    pub file: Option<FilePart>,",
				"    pub files: Vec<FilePart>,",
				"    pub optional_files: Option<Vec<FilePart>>",
				"        if let Some(v) = body.file {",
				"        if let Some(v) = &body.label {",
				"        for item in body.files {",
				"        if let Some(items) = body.optional_files {",
				`Error::Config(format!("invalid multipart content type {content_type:?}"))`,
			},
			notContains: []string{
				".clone()).file_name(",
				"file_name(format!(\"file-",
			},
		},
		{
			name:        "escaped-wire-names.yaml",
			fixturePath: "testdata/escaped-wire-names.yaml",
			contains: []string{
				`#[serde(rename = "file\"part\\path")]`,
				`q.push(("query\"name\\path".to_string(), v.to_string()));`,
				`headers.push(("X-Header\"Name\\Path".to_string(), v.to_string()));`,
				`form = form.part("file\"part\\path", part);`,
				`form = form.text("text\"field\\path", v.to_string());`,
				`form = form.text("line\nfield", v.to_string());`,
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
				"pub type Rfc2822Date = crate::custom_types::Rfc2822Date;",
				"pub struct GetFileParams {",
				"pub if_none_match: Option<String>,",
				"pub if_modified_since: Option<crate::custom_types::Rfc2822Date>,",
				"pub range: Option<String>,",
				"pub x_custom_metadata: Option<crate::custom_types::CustomMetadata>,",
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
			name:        "reserved-type-names.yaml",
			fixturePath: "testdata/reserved-type-names.yaml",
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

func TestMultipartFixtureUsesReferencedBody(t *testing.T) {
	t.Parallel()

	doc, err := getModel("testdata/multipart.yaml")
	if err != nil {
		t.Fatalf("failed to get model: %v", err)
	}

	ir, err := processor.NewInterMediateRepresentation(doc, &rust.Rust{})
	if err != nil {
		t.Fatalf("failed to create intermediate representation: %v", err)
	}

	body, ok := ir.Methods[0].RequestFormData().(*processor.TypeObject)
	if !ok {
		t.Fatal("multipart request body is not an object")
	}

	// Keep the render test on the component-reference path without constraining
	// whether the shared IR deduplicates referenced objects in the future.
	if !body.Schema().IsReference() {
		t.Fatal("multipart fixture request body must reference a component schema")
	}

	assert.Equal(t, "#/components/schemas/UploadFilesBody", body.Schema().GetReference())
}

func TestRustRejectsMultipartFileTypeOutsideMultipart(t *testing.T) {
	t.Parallel()

	const specTemplate = `openapi: "3.0.0"
paths:
  /upload:
    post:
      operationId: upload
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              $ref: "#/components/schemas/SharedBody"
      responses:
        "204":
          description: Uploaded
%s
components:
  schemas:
    SharedBody:
      type: object
      properties:
        file:
          type: string
          format: binary
      required:
        - file
    Wrapper:
      type: object
      properties:
        upload:
          $ref: "#/components/schemas/SharedBody"
      required:
        - upload
`

	tests := []struct {
		name        string
		contextSpec string
		wantContext string
	}{
		{
			name: "JSON request body",
			contextSpec: `  /mirror:
    post:
      operationId: mirrorUpload
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/SharedBody"
      responses:
        "204":
          description: Mirrored`,
			wantContext: `application/json request body for operation "mirrorUpload"`,
		},
		{
			name: "form URL-encoded request body",
			contextSpec: `  /submit:
    post:
      operationId: submitUpload
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              $ref: "#/components/schemas/SharedBody"
      responses:
        "204":
          description: Submitted`,
			wantContext: `application/x-www-form-urlencoded request body for operation "submitUpload"`,
		},
		{
			name: "JSON response",
			contextSpec: `  /download:
    get:
      operationId: downloadUpload
      responses:
        "200":
          description: Downloaded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SharedBody"`,
			wantContext: `application/json response for status 200 in operation "downloadUpload"`,
		},
		{
			name: "array JSON response",
			contextSpec: `  /downloads:
    get:
      operationId: downloadUploads
      responses:
        "200":
          description: Downloaded
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/SharedBody"`,
			wantContext: `application/json response for status 200 in operation "downloadUploads"`,
		},
		{
			name: "nested JSON request body",
			contextSpec: `  /mirror-wrapper:
    post:
      operationId: mirrorUploadWrapper
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/Wrapper"
      responses:
        "204":
          description: Mirrored`,
			wantContext: `application/json request body for operation "mirrorUploadWrapper"`,
		},
		{
			name: "query parameter",
			contextSpec: `  /search:
    get:
      operationId: searchUploads
      parameters:
        - name: upload
          in: query
          schema:
            $ref: "#/components/schemas/SharedBody"
      responses:
        "204":
          description: Searched`,
			wantContext: `query parameter "upload" for operation "searchUploads"`,
		},
		{
			name: "header parameter",
			contextSpec: `  /inspect:
    get:
      operationId: inspectUpload
      parameters:
        - name: x-upload
          in: header
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SharedBody"
      responses:
        "204":
          description: Inspected`,
			wantContext: `header parameter "x-upload" for operation "inspectUpload"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			path := t.TempDir() + "/shared-multipart-type.yaml"
			spec := fmt.Sprintf(specTemplate, tt.contextSpec)

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

			err = ir.Render(bytes.NewBuffer(nil))
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("render error = %v, want ErrUnsupportedFeature", err)
			}

			assert.Contains(
				t,
				err.Error(),
				"Rust type SharedBody uses FilePart for multipart/form-data and cannot also be used as "+
					tt.wantContext,
			)
		})
	}
}

func TestRustRejectsIdentifierCollisions(t *testing.T) {
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
				"type namespace collision",
				`type "Thing-One"`,
				`type "Thing_One"`,
				`identifier "ThingOne"`,
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
        refreshToken: {type: string}
        refresh_token: {type: string}
`,
			want: []string{
				`field namespace for type "Thing" collision`,
				`property "refreshToken"`,
				`property "refresh_token"`,
				`identifier "refresh_token"`,
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
				"client method namespace collision",
				`operation "get-thing"`,
				`operation "get_thing"`,
				`identifier "get_thing"`,
			},
		},
		{
			name: "generated client method",
			spec: `openapi: "3.0.0"
paths:
  /role:
    get:
      operationId: withRole
      responses:
        "204": {description: Done}
`,
			want: []string{
				"client method namespace collision",
				`generated Client method "with_role"`,
				`operation "withRole"`,
				`identifier "with_role"`,
			},
		},
		{
			name: "request parameter fields",
			spec: `openapi: "3.0.0"
paths:
  /things:
    get:
      operationId: listThings
      parameters:
        - {name: refreshToken, in: query, schema: {type: string}}
        - {name: refresh_token, in: header, schema: {type: string}}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`parameter struct for operation "listThings" collision`,
				`query parameter "refreshToken"`,
				`header parameter "refresh_token"`,
				`identifier "refresh_token"`,
			},
		},
		{
			name: "path parameter and request body",
			spec: `openapi: "3.0.0"
paths:
  /things/{body}:
    post:
      operationId: makeThing
      parameters:
        - name: body
          in: path
          required: true
          schema: {type: string}
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                value: {type: string}
      responses:
        "204": {description: Done}
`,
			want: []string{
				`argument list for operation "makeThing" collision`,
				"generated request body argument",
				`path parameter "body"`,
				`identifier "body"`,
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			path := t.TempDir() + "/collision.yaml"
			if err := os.WriteFile(path, []byte(test.spec), 0o600); err != nil {
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

			err = ir.Render(bytes.NewBuffer(nil))
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("render error = %v, want ErrUnsupportedFeature", err)
			}

			for _, want := range test.want {
				assert.Contains(t, err.Error(), want)
			}
		})
	}
}

func TestRustRejectsFalseSensitiveExtension(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		fixturePath string
		property    string
	}{
		{
			name:        "unusual field",
			fixturePath: "testdata/invalid/sensitive-false-unusual.yaml",
			property:    "unusualValue",
		},
		{
			name:        "built-in credential name",
			fixturePath: "testdata/invalid/sensitive-false-vocabulary.yaml",
			property:    "password",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			doc, err := getModel(test.fixturePath)
			if err != nil {
				t.Fatalf("failed to get model: %v", err)
			}

			ir, err := processor.NewInterMediateRepresentation(doc, &rust.Rust{})
			if err != nil {
				t.Fatalf("failed to create intermediate representation: %v", err)
			}

			err = ir.Render(bytes.NewBuffer(nil))
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("render error = %v, want ErrUnsupportedFeature", err)
			}

			assert.Contains(
				t,
				err.Error(),
				fmt.Sprintf(
					"x-nhost-sensitive on property %q of type \"Payload\" must be true",
					test.property,
				),
			)
		})
	}
}

func TestRustRejectsMalformedExtensions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		extension string
		want      string
	}{
		{
			name:      "sensitive extension must be boolean",
			extension: `x-nhost-sensitive: "true"`,
			want:      "x-nhost-sensitive on property \"customField\" of type \"Payload\" must be the boolean true",
		},
		{
			name:      "custom type extension must be string",
			extension: "x-rust-type: true",
			want:      "x-rust-type on property \"customField\" of type \"Payload\" must be a string",
		},
		{
			name:      "custom type extension must not be empty",
			extension: `x-rust-type: ""`,
			want:      "x-rust-type on property \"customField\" of type \"Payload\" must be a non-empty string",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
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
`, test.extension)

			path := t.TempDir() + "/malformed-extension.yaml"
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

			err = ir.Render(bytes.NewBuffer(nil))
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("render error = %v, want ErrUnsupportedFeature", err)
			}

			assert.Contains(t, err.Error(), test.want)
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
