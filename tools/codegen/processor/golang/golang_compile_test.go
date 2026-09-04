package golang_test

import (
	"bytes"
	"fmt"
	goformat "go/format"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	"github.com/nhost/nhost/tools/codegen/processor/golang"
)

const transportStub = `package transport

import "net/http"

type Response struct {
	Status  int
	Headers http.Header
}

type APIError struct{}

func (e *APIError) Error() string { return "API error" }

func NewAPIErrorFromResponse(*http.Response) error { return &APIError{} }

func DecodeJSON(*http.Response, any) error { return nil }
`

const generatedRequestPathEscapingTest = `package testpkg

import (
	"fmt"
	"net/http"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestRequestPathParameterEscaping(t *testing.T) {
	tests := []struct {
		name      string
		parameter string
		wantPath  string
	}{
		{name: "slash", parameter: "directory/file", wantPath: "/files/directory%2Ffile"},
		{name: "dot segment", parameter: "..", wantPath: "/files/%2E%2E"},
		{name: "query and fragment", parameter: "file?x=1#frag", wantPath: "/files/file%3Fx=1%23frag"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var gotPath, gotQuery string
			httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				gotPath = req.URL.EscapedPath()
				gotQuery = req.URL.RawQuery

				return &http.Response{
					StatusCode: http.StatusOK,
					Header:     make(http.Header),
					Body:       http.NoBody,
					Request:    req,
				}, nil
			})}

			client := NewClient("https://example.com", httpClient)
			if _, _, err := client.GetFile(t.Context(), tt.parameter, nil, nil); err != nil {
				t.Fatalf("GetFile returned an error: %v", err)
			}
			if gotPath != tt.wantPath {
				t.Errorf("escaped path = %q, want %q", gotPath, tt.wantPath)
			}
			if gotQuery != "" {
				t.Errorf("raw query = %q, want empty", gotQuery)
			}
		})
	}
}

func TestEscapePathSegmentFormatsNonStrings(t *testing.T) {
	if got := escapePathSegment(42); got != "42" {
		t.Errorf("escaped integer = %q, want %q", got, "42")
	}
	if got := escapePathSegment(fmt.Stringer(testStringer{})); got != "directory%2Ffile" {
		t.Errorf("escaped Stringer = %q, want %q", got, "directory%2Ffile")
	}
}

type testStringer struct{}

func (testStringer) String() string { return "directory/file" }
`

const generatedSpecTextEscapingTest = `package testpkg

import (
	"net/http"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestSpecTextEscaping(t *testing.T) {
	var gotURL string
	httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		gotURL = req.URL.String()

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       http.NoBody,
			Request:    req,
		}, nil
	})}

	client := NewClient("https://example.com", httpClient)
	if _, _, err := client.GetEscapedThing(t.Context(), "id1", nil); err != nil {
		t.Fatalf("GetEscapedThing returned an error: %v", err)
	}
	if want := "https://example.com/things/100%25/id1"; gotURL != want {
		t.Errorf("request URL = %q, want %q", gotURL, want)
	}
}
`

const generatedRedirectPathEscapingTest = `package testpkg

import "testing"

func TestRedirectPathParameterEscaping(t *testing.T) {
	tests := []struct {
		name      string
		parameter string
		wantURL   string
	}{
		{name: "slash", parameter: "oauth/provider", wantURL: "https://example.com/signin/provider/oauth%2Fprovider"},
		{name: "dot segment", parameter: "..", wantURL: "https://example.com/signin/provider/%2E%2E"},
	}

	client := NewClient("https://example.com", nil)
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := client.SignInProviderURL(tt.parameter, nil); got != tt.wantURL {
				t.Errorf("redirect URL = %q, want %q", got, tt.wantURL)
			}
		})
	}
}
`

const generatedDeepObjectQueryTest = `package testpkg

import "testing"

func TestDeepObjectQuerySerialization(t *testing.T) {
	redirectTo := "https://app.example.com/callback"
	upstreamParams := map[string]any{
		"connection": "abc",
		"org":        "o1",
	}

	client := NewClient("https://auth.example.com", nil)
	got := client.SignInProviderURL("google", &SignInProviderParams{
		RedirectTo:     &redirectTo,
		UpstreamParams: &upstreamParams,
	})
	want := "https://auth.example.com/signin/provider/google?redirectTo=https%3A%2F%2Fapp.example.com%2Fcallback&upstreamParams%5Bconnection%5D=abc&upstreamParams%5Borg%5D=o1"
	if got != want {
		t.Errorf("redirect URL = %q, want %q", got, want)
	}
}
`

const mixedEnumParameterSpec = `openapi: "3.0.0"
paths:
  /items/{state}:
    get:
      operationId: getItem
      parameters:
        - name: state
          in: path
          required: true
          schema:
            type: string
            enum: [0, "one", true]
        - name: filter
          in: query
          required: false
          schema:
            type: string
            enum: [0, "one", true]
        - name: filters
          in: query
          required: false
          schema:
            type: array
            items:
              $ref: "#/components/schemas/MixedState"
      responses:
        "204": {description: OK}
  /form:
    post:
      operationId: submitForm
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              type: object
              required: [state, states]
              properties:
                state:
                  type: string
                  enum: [0, "one", true]
                states:
                  type: array
                  items:
                    $ref: "#/components/schemas/MixedState"
      responses:
        "204": {description: OK}
  /multipart:
    post:
      operationId: submitMultipart
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              required: [state, states]
              properties:
                state:
                  type: string
                  enum: [0, "one", true]
                states:
                  type: array
                  items:
                    $ref: "#/components/schemas/MixedState"
      responses:
        "204": {description: OK}
components:
  schemas:
    MixedState:
      type: string
      enum: [0, "one", true]
`

const generatedEnumParameterTest = `package testpkg

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"slices"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestMixedEnumParametersUseWireScalars(t *testing.T) {
	requestCount := 0
	expectedWire := ""
	httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		requestCount++

		switch req.URL.Path {
		case "/items/" + expectedWire:
			if got := req.URL.Query().Get("filter"); got != expectedWire {
				t.Errorf("query enum = %q, want %q", got, expectedWire)
			}
			if got, want := req.URL.Query()["filters"], []string{expectedWire}; !slices.Equal(got, want) {
				t.Errorf("query enum array = %q, want %q", got, want)
			}
		case "/form":
			body, err := io.ReadAll(req.Body)
			if err != nil {
				t.Fatalf("read form body: %v", err)
			}
			values, err := url.ParseQuery(string(body))
			if err != nil {
				t.Fatalf("parse form body: %v", err)
			}
			if got := values.Get("state"); got != expectedWire {
				t.Errorf("URL-encoded enum = %q, want %q", got, expectedWire)
			}
			if got, want := values["states"], []string{expectedWire}; !slices.Equal(got, want) {
				t.Errorf("URL-encoded enum array = %q, want %q", got, want)
			}
		case "/multipart":
			if err := req.ParseMultipartForm(1024); err != nil {
				t.Fatalf("parse multipart body: %v", err)
			}
			if got := req.FormValue("state"); got != expectedWire {
				t.Errorf("multipart enum = %q, want %q", got, expectedWire)
			}
			if got, want := req.MultipartForm.Value["states"], []string{expectedWire}; !slices.Equal(got, want) {
				t.Errorf("multipart enum array = %q, want %q", got, want)
			}
		default:
			t.Errorf("request path = %q, want one of the generated endpoints", req.URL.EscapedPath())
		}

		return &http.Response{
			StatusCode: http.StatusNoContent,
			Header:     make(http.Header),
			Body:       http.NoBody,
			Request:    req,
		}, nil
	})}

	client := NewClient("https://example.com", httpClient)
	testCases := []struct {
		name      string
		jsonValue string
		wireValue string
	}{
		{name: "string", jsonValue: ` + "`\"one\"`" + `, wireValue: "one"},
		{name: "number", jsonValue: "1", wireValue: "1"},
		{name: "boolean", jsonValue: "true", wireValue: "true"},
	}

	for _, tt := range testCases {
		t.Run(tt.name, func(t *testing.T) {
			expectedWire = tt.wireValue
			enumValue := json.RawMessage(tt.jsonValue)
			queryFilter := GetFilter(enumValue)
			states := []MixedState{enumValue}

			if _, _, err := client.GetItem(t.Context(), tt.wireValue, &GetItemParams{
				Filter:  &queryFilter,
				Filters: &states,
			}, nil); err != nil {
				t.Fatalf("GetItem returned an error: %v", err)
			}
			if _, _, err := client.SubmitForm(t.Context(), SubmitFormBody{
				State:  enumValue,
				States: states,
			}, nil); err != nil {
				t.Fatalf("SubmitForm returned an error: %v", err)
			}
			if _, _, err := client.SubmitMultipart(t.Context(), SubmitMultipartBody{
				State:  enumValue,
				States: states,
			}, nil); err != nil {
				t.Fatalf("SubmitMultipart returned an error: %v", err)
			}
		})
	}

	if want := len(testCases) * 3; requestCount != want {
		t.Errorf("request count = %d, want %d", requestCount, want)
	}
}
`

const generatedEnumJSONTest = `package testpkg

import (
	"encoding/json"
	"testing"
)

func TestEnumJSONRoundTripPreservesScalarTypes(t *testing.T) {
	const payload = ` + "`" + `{"statusInt":1,"statusMixed":true}` + "`" + `

	var object SimpleObject
	if err := json.Unmarshal([]byte(payload), &object); err != nil {
		t.Fatalf("unmarshal enum payload: %v", err)
	}
	if object.StatusInt == nil || *object.StatusInt != SimpleObjectStatusInt(1) {
		t.Errorf("integer enum = %v, want 1", object.StatusInt)
	}
	if object.StatusMixed == nil || string(*object.StatusMixed) != "true" {
		t.Errorf("mixed enum = %s, want true", object.StatusMixed)
	}

	encoded, err := json.Marshal(object)
	if err != nil {
		t.Fatalf("marshal enum payload: %v", err)
	}

	var fields map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &fields); err != nil {
		t.Fatalf("unmarshal round-trip payload: %v", err)
	}
	if string(fields["statusInt"]) != "1" {
		t.Errorf("round-trip integer enum = %s, want 1", fields["statusInt"])
	}
	if string(fields["statusMixed"]) != "true" {
		t.Errorf("round-trip mixed enum = %s, want true", fields["statusMixed"])
	}
}
`

const generatedRequiredQueryTest = `package testpkg

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequiredQueryIsSent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if got := req.URL.Query().Get("term"); got != "required-value" {
			t.Errorf("term query = %q, want %q", got, "required-value")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient(server.URL, server.Client())
	// GetItems requires a params value; replacing it with nil must not compile.
	if _, _, err := client.GetItems(t.Context(), GetItemsParams{
		Filter: Filter{Term: "required-value"},
	}, nil); err != nil {
		t.Fatalf("GetItems returned an error: %v", err)
	}
}
`

const generatedOptionalHeadersTest = `package testpkg

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTypedOptionalHeadersAndCallerOverride(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		wantHeaders := map[string]string{
			"if-match":            "typed-match",
			"if-none-match":       "caller-override",
			"if-modified-since":   "typed-modified",
			"if-unmodified-since": "typed-unmodified",
		}
		for name, want := range wantHeaders {
			if got := req.Header.Get(name); got != want {
				t.Errorf("header %s = %q, want %q", name, got, want)
			}
		}
		if values := req.Header.Values("if-none-match"); len(values) != 1 {
			t.Errorf("if-none-match values = %q, want caller value only", values)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ifMatch := IfMatch("typed-match")
	ifNoneMatch := IfNoneMatch("typed-none")
	ifModifiedSince := IfModifiedSince("typed-modified")
	ifUnmodifiedSince := IfUnmodifiedSince("typed-unmodified")
	client := NewClient(server.URL, server.Client())
	if _, _, err := client.GetFile(t.Context(), "file-id", &GetFileParams{
		IfMatch:           &ifMatch,
		IfNoneMatch:       &ifNoneMatch,
		IfModifiedSince:   &ifModifiedSince,
		IfUnmodifiedSince: &ifUnmodifiedSince,
	}, http.Header{"if-none-match": {"caller-override"}}); err != nil {
		t.Fatalf("GetFile returned an error: %v", err)
	}
}
`

const requiredHeaderSpec = `openapi: "3.0.0"
paths:
  /required-header:
    get:
      operationId: requiredHeader
      parameters:
        - name: x-request-token
          in: header
          required: true
          schema:
            type: string
      responses:
        "204":
          description: Success
`

const generatedRequiredHeaderTest = `package testpkg

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequiredHeaderIsSent(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if got := req.Header.Get("x-request-token"); got != "required-token" {
			t.Errorf("x-request-token = %q, want %q", got, "required-token")
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient(server.URL, server.Client())
	if _, _, err := client.RequiredHeader(t.Context(), RequiredHeaderParams{
		XRequestToken: "required-token",
	}, nil); err != nil {
		t.Fatalf("RequiredHeader returned an error: %v", err)
	}
}
`

const generatedHeaderValuesTest = `package testpkg

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHeaderValuesUseExactWireScalars(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		wantHeaders := map[string]string{
			"x-first-json":  "\"first\"",
			"x-second-json": "true",
			"x-count":       "1000000",
			"x-number":      "12.5",
			"x-enabled":     "true",
			"x-mode":        "one",
		}
		for name, want := range wantHeaders {
			if got := req.Header.Get(name); got != want {
				t.Errorf("header %s = %q, want %q", name, got, want)
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClient(server.URL, server.Client())
	if _, _, err := client.HeaderValues(t.Context(), HeaderValuesParams{
		XFirstJSON:  "first",
		XSecondJSON: true,
		XCount:      1000000,
		XNumber:     12.5,
		XEnabled:    true,
		XMode:       json.RawMessage(` + "`\"one\"`" + `),
	}, nil); err != nil {
		t.Fatalf("HeaderValues returned an error: %v", err)
	}
}
`

const generatedOptionalBodyTestPrefix = `package testpkg

import (
	"net/http"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func TestNilOptionalBodySendsNoPayload(t *testing.T) {
	var gotBody bool
	var gotContentType string
	httpClient := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		gotBody = req.Body != nil
		gotContentType = req.Header.Get("Content-Type")

		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       http.NoBody,
			Request:    req,
		}, nil
	})}

	client := NewClient("https://example.com", httpClient)
	if _, _, err := `

const generatedOptionalBodyTestSuffix = `; err != nil {
		t.Fatalf("request with nil optional body returned an error: %v", err)
	}
	if gotBody {
		t.Error("request with nil optional body sent a payload")
	}
	if gotContentType != "" {
		t.Errorf("Content-Type = %q, want empty", gotContentType)
	}
}
`

func generatedOptionalBodyTest(operationCall string) string {
	return generatedOptionalBodyTestPrefix + operationCall + generatedOptionalBodyTestSuffix
}

func TestGolangGeneratedOutputIsGofmtStable(t *testing.T) {
	t.Parallel()

	fixtures := golangFixturePaths(t)

	for _, fixture := range fixtures {
		output, renderErr := renderGolangFixture(fixture)
		if renderErr != nil {
			t.Fatalf("failed to render %s: %v", filepath.Base(fixture), renderErr)
		}

		formatted, formatErr := goformat.Source(output)
		if formatErr != nil {
			t.Fatalf("failed to format rendered %s: %v", filepath.Base(fixture), formatErr)
		}

		if !bytes.Equal(output, formatted) {
			t.Errorf("rendered %s is not gofmt-stable", filepath.Base(fixture))
		}
	}
}

func TestGolangProcessSourceRejectsInvalidGo(t *testing.T) {
	t.Parallel()

	if _, err := (&golang.Golang{}).ProcessSource([]byte("not Go source")); err == nil {
		t.Fatal("ProcessSource accepted invalid Go source")
	}
}

func TestGolangGeneratedEnumsPreserveJSONScalarTypes(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	output, renderErr := renderGolangFixture("../testdata/types.yaml")
	if renderErr != nil {
		t.Fatalf("failed to render types.yaml: %v", renderErr)
	}

	writeCompileFixture(t, moduleDir, "enums/generated.go", string(output))
	writeCompileFixture(t, moduleDir, "enums/generated_test.go", generatedEnumJSONTest)

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./enums")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	commandOutput, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated enum JSON tests failed: %v\n%s", err, commandOutput)
	}
}

func TestGolangGeneratedMixedEnumParametersSerializeAsWireScalars(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	specPath := filepath.Join(moduleDir, "mixed-enum-parameters.yaml")
	writeCompileFixture(t, "", specPath, mixedEnumParameterSpec)

	output, renderErr := renderGolangFixture(specPath)
	if renderErr != nil {
		t.Fatalf("failed to render mixed enum parameters: %v", renderErr)
	}

	writeCompileFixture(t, moduleDir, "mixed/generated.go", string(output))
	writeCompileFixture(t, moduleDir, "mixed/generated_test.go", generatedEnumParameterTest)

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./mixed")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	commandOutput, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated mixed enum parameter tests failed: %v\n%s", err, commandOutput)
	}
}

func TestGolangGeneratedPathParametersAreEscaped(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	fixtures := []struct {
		name       string
		testSource string
	}{
		{name: "methods_ref.yaml", testSource: generatedRequestPathEscapingTest},
		{name: "content.yaml", testSource: generatedRedirectPathEscapingTest},
		{name: "escaped-go-source.yaml", testSource: generatedSpecTextEscapingTest},
	}

	for _, fixture := range fixtures {
		output, renderErr := renderGolangFixture("../testdata/" + fixture.name)
		if renderErr != nil {
			t.Fatalf("failed to render %s: %v", fixture.name, renderErr)
		}

		packageDir := strings.NewReplacer("-", "_", ".", "_").Replace(fixture.name)
		writeCompileFixture(t, moduleDir, filepath.Join(packageDir, "generated.go"), string(output))
		writeCompileFixture(
			t,
			moduleDir,
			filepath.Join(packageDir, "generated_test.go"),
			fixture.testSource,
		)
	}

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./...")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated path escaping tests failed: %v\n%s", err, output)
	}
}

func TestGolangGeneratedDeepObjectQueryUsesParameterName(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	output, renderErr := renderGolangFixture("../testdata/deepobject-map.yaml")
	if renderErr != nil {
		t.Fatalf("failed to render deepobject-map.yaml: %v", renderErr)
	}

	writeCompileFixture(t, moduleDir, "deepobject/generated.go", string(output))
	writeCompileFixture(t, moduleDir, "deepobject/generated_test.go", generatedDeepObjectQueryTest)

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./deepobject")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	commandOutput, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated deepObject query test failed: %v\n%s", err, commandOutput)
	}
}

func TestGolangRejectsUnsupportedJSONWireNames(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		wireName string
	}{
		{name: "backtick", wireName: "back`tick"},
		{name: "double quote", wireName: "double\"quote"},
		{name: "backslash", wireName: "back\\slash"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec := fmt.Sprintf(`openapi: "3.0.0"
components:
  schemas:
    BadWireNames:
      type: object
      properties:
        '%s':
          type: string
`, tt.wireName)
			filename := filepath.Join(t.TempDir(), "invalid-wire-name.yaml")
			writeCompileFixture(t, "", filename, spec)

			_, renderErr := renderGolangFixture(filename)
			if renderErr == nil {
				t.Fatal(
					"generation accepted a JSON property name that encoding/json cannot represent",
				)
			}

			wantErr := fmt.Sprintf(
				"unsupported JSON wire name: property %q on type %q",
				tt.wireName,
				"BadWireNames",
			)
			if !strings.Contains(renderErr.Error(), wantErr) {
				t.Errorf("generation error = %q, want it to contain %q", renderErr, wantErr)
			}
		})
	}
}

func TestGolangRejectsUnsupportedHeaderWireNames(t *testing.T) {
	t.Parallel()

	const spec = `openapi: "3.0.0"
paths:
  /items:
    get:
      operationId: getItems
      parameters:
        - name: 'bad"header'
          in: header
          schema:
            type: string
      responses:
        "204":
          description: Done
`

	filename := filepath.Join(t.TempDir(), "invalid-header.yaml")
	writeCompileFixture(t, "", filename, spec)

	_, renderErr := renderGolangFixture(filename)
	if renderErr == nil {
		t.Fatal("generation accepted an unsupported header wire name")
	}

	wantErr := `unsupported JSON wire name: header parameter "bad\"header" on method "getItems"`
	if !strings.Contains(renderErr.Error(), wantErr) {
		t.Errorf("generation error = %q, want it to contain %q", renderErr, wantErr)
	}
}

func TestGolangRejectsUnsupportedQuerySerialization(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		style   string
		explode bool
		schema  string
		wantErr string
	}{
		{
			name:    "unsupported style",
			style:   "pipeDelimited",
			schema:  "            type: array\n            items:\n              type: string",
			wantErr: `uses unsupported style "pipeDelimited"`,
		},
		{
			name:    "deepObject without explode",
			style:   "deepObject",
			schema:  "            type: object\n            additionalProperties:\n              type: string",
			wantErr: "uses deepObject with explode=false",
		},
		{
			name:    "deepObject scalar",
			style:   "deepObject",
			explode: true,
			schema:  "            type: string",
			wantErr: "uses deepObject with unsupported scalar type",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			spec := fmt.Sprintf(`openapi: "3.0.0"
paths:
  /items:
    get:
      operationId: listItems
      parameters:
        - name: filter
          in: query
          style: %s
          explode: %t
          schema:
%s
      responses:
        "200":
          description: ok
`, tt.style, tt.explode, tt.schema)
			filename := filepath.Join(t.TempDir(), "unsupported.yaml")
			writeCompileFixture(t, "", filename, spec)

			_, renderErr := renderGolangFixture(filename)
			if renderErr == nil {
				t.Fatal("generation accepted unsupported query serialization")
			}

			if !strings.Contains(renderErr.Error(), tt.wantErr) {
				t.Errorf("generation error = %q, want it to contain %q", renderErr, tt.wantErr)
			}
		})
	}
}

func TestGolangGeneratedOptionalFormBodiesAreAbsent(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	fixtures := []struct {
		name          string
		operationCall string
	}{
		{
			name:          "optional-form-url-encoded.yaml",
			operationCall: "client.SubmitOptionalForm(t.Context(), nil, nil)",
		},
		{
			name:          "methods_ref.yaml",
			operationCall: "client.ReplaceFile(t.Context(), \"id\", nil, nil)",
		},
	}

	for _, fixture := range fixtures {
		output, renderErr := renderGolangFixture("../testdata/" + fixture.name)
		if renderErr != nil {
			t.Fatalf("failed to render %s: %v", fixture.name, renderErr)
		}

		packageDir := strings.NewReplacer("-", "_", ".", "_").Replace(fixture.name)
		writeCompileFixture(t, moduleDir, filepath.Join(packageDir, "generated.go"), string(output))
		writeCompileFixture(
			t,
			moduleDir,
			filepath.Join(packageDir, "generated_test.go"),
			generatedOptionalBodyTest(fixture.operationCall),
		)
	}

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./...")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated optional body tests failed: %v\n%s", err, output)
	}
}

func TestGolangGeneratedRequestParameters(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	requiredQueryOutput, renderErr := renderGolangFixture(
		"../testdata/required-object-query.yaml",
	)
	if renderErr != nil {
		t.Fatalf("failed to render required query fixture: %v", renderErr)
	}

	if !strings.Contains(string(requiredQueryOutput), "params GetItemsParams") ||
		strings.Contains(string(requiredQueryOutput), "params *GetItemsParams") {
		t.Fatal("required query params are not generated as a non-nil value")
	}

	writeCompileFixture(
		t,
		moduleDir,
		"required_query/generated.go",
		string(requiredQueryOutput),
	)
	writeCompileFixture(
		t,
		moduleDir,
		"required_query/generated_test.go",
		generatedRequiredQueryTest,
	)

	optionalHeadersOutput, renderErr := renderGolangFixture("../testdata/methods_ref.yaml")
	if renderErr != nil {
		t.Fatalf("failed to render optional header fixture: %v", renderErr)
	}

	writeCompileFixture(
		t,
		moduleDir,
		"optional_headers/generated.go",
		string(optionalHeadersOutput),
	)
	writeCompileFixture(
		t,
		moduleDir,
		"optional_headers/generated_test.go",
		generatedOptionalHeadersTest,
	)

	requiredHeaderPath := filepath.Join(moduleDir, "required-header.yaml")
	writeCompileFixture(t, "", requiredHeaderPath, requiredHeaderSpec)

	requiredHeaderOutput, renderErr := renderGolangFixture(requiredHeaderPath)
	if renderErr != nil {
		t.Fatalf("failed to render required header fixture: %v", renderErr)
	}

	writeCompileFixture(
		t,
		moduleDir,
		"required_header/generated.go",
		string(requiredHeaderOutput),
	)
	writeCompileFixture(
		t,
		moduleDir,
		"required_header/generated_test.go",
		generatedRequiredHeaderTest,
	)

	headerValuesOutput, renderErr := renderGolangFixture("../testdata/header-parameters.yaml")
	if renderErr != nil {
		t.Fatalf("failed to render header values fixture: %v", renderErr)
	}

	if strings.Contains(string(headerValuesOutput), "type HeaderOnlyRedirectParams struct") {
		t.Fatal("header-only redirect generated an unusable Params struct")
	}

	writeCompileFixture(
		t,
		moduleDir,
		"header_values/generated.go",
		string(headerValuesOutput),
	)
	writeCompileFixture(
		t,
		moduleDir,
		"header_values/generated_test.go",
		generatedHeaderValuesTest,
	)

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./...")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated request parameter tests failed: %v\n%s", err, output)
	}
}

func TestGolangGeneratedOutputCompiles(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	fixtures := golangFixturePaths(t)

	moduleDir := t.TempDir()
	writeCompileFixture(t, moduleDir, "go.mod", "module github.com/nhost/nhost\n\ngo 1.26.0\n")
	writeCompileFixture(
		t,
		moduleDir,
		"packages/nhost-go/transport/transport.go",
		transportStub,
	)

	for _, fixture := range fixtures {
		output, renderErr := renderGolangFixture(fixture)
		if renderErr != nil {
			t.Fatalf("failed to render %s: %v", filepath.Base(fixture), renderErr)
		}

		packageDir := strings.NewReplacer("-", "_", ".", "_").Replace(filepath.Base(fixture))
		writeCompileFixture(t, moduleDir, filepath.Join(packageDir, "generated.go"), string(output))
	}

	cmd := exec.CommandContext(t.Context(), goTool, "test", "./...")
	cmd.Dir = moduleDir

	cmd.Env = append(os.Environ(), "GOFLAGS=", "GOWORK=off")

	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("generated Go output failed to compile: %v\n%s", err, output)
	}
}

func golangFixturePaths(t *testing.T) []string {
	t.Helper()

	patterns := []string{"../testdata/*.yaml", "testdata/*.yaml"}
	fixtures := make([]string, 0, len(patterns))

	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			t.Fatalf("failed to find OpenAPI fixtures matching %s: %v", pattern, err)
		}

		fixtures = append(fixtures, matches...)
	}

	if len(fixtures) == 0 {
		t.Fatal("no OpenAPI fixtures found")
	}

	return fixtures
}

func renderGolangFixture(filename string) ([]byte, error) {
	doc, err := getModel(filename)
	if err != nil {
		return nil, fmt.Errorf("building OpenAPI model: %w", err)
	}

	goPlugin, err := golang.New("testpkg")
	if err != nil {
		return nil, fmt.Errorf("creating Go plugin: %w", err)
	}

	ir, err := processor.NewInterMediateRepresentation(doc, goPlugin)
	if err != nil {
		return nil, fmt.Errorf("creating intermediate representation: %w", err)
	}

	var output bytes.Buffer
	if err := ir.Render(&output); err != nil {
		return nil, fmt.Errorf("rendering intermediate representation: %w", err)
	}

	return output.Bytes(), nil
}

func writeCompileFixture(t *testing.T, root, name, contents string) {
	t.Helper()

	filename := filepath.Join(root, name)
	if err := os.MkdirAll(filepath.Dir(filename), 0o750); err != nil {
		t.Fatalf("failed to create directory for %s: %v", name, err)
	}

	if err := os.WriteFile(filename, []byte(contents), 0o600); err != nil {
		t.Fatalf("failed to write %s: %v", name, err)
	}
}
