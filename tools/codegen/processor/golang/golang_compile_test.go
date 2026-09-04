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

	fixtures, err := filepath.Glob("../testdata/*.yaml")
	if err != nil {
		t.Fatalf("failed to find shared OpenAPI fixtures: %v", err)
	}

	if len(fixtures) == 0 {
		t.Fatal("no OpenAPI fixtures found")
	}

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

func TestGolangGeneratedOutputCompiles(t *testing.T) {
	t.Parallel()

	goTool, err := exec.LookPath("go")
	if err != nil {
		t.Fatal("go is not available; generated Go output cannot be verified")
	}

	fixtures, err := filepath.Glob("../testdata/*.yaml")
	if err != nil {
		t.Fatalf("failed to find shared OpenAPI fixtures: %v", err)
	}

	if len(fixtures) == 0 {
		t.Fatal("no OpenAPI fixtures found")
	}

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

func renderGolangFixture(filename string) ([]byte, error) {
	doc, err := getModel(filename)
	if err != nil {
		return nil, fmt.Errorf("building OpenAPI model: %w", err)
	}

	ir, err := processor.NewInterMediateRepresentation(
		doc,
		&golang.Golang{Package: "testpkg"},
	)
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
