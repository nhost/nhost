package processor_test

import (
	"bytes"
	"errors"
	"flag"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/nhost/nhost/tools/codegen/processor"
	swiftprocessor "github.com/nhost/nhost/tools/codegen/processor/swift"
	"github.com/nhost/nhost/tools/codegen/processor/typescript"
	"github.com/pb33f/libopenapi"
	v3 "github.com/pb33f/libopenapi/datamodel/high/v3"
	"github.com/stretchr/testify/assert"
)

//nolint:gochecknoglobals
var flagUpdate = flag.Bool("update", false, "update expected output files with current output")

func getModel(filepath string) (*libopenapi.DocumentModel[v3.Document], error) {
	// Read OpenAPI file
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

func TestInterMediateRepresentationRender(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		plugin     processor.Plugin
		goldenFile string
	}{
		{
			name:       "types.yaml",
			plugin:     &typescript.Typescript{},
			goldenFile: "types.yaml.ts",
		},
		{
			name:       "methods_ref.yaml",
			plugin:     &typescript.Typescript{},
			goldenFile: "methods_ref.yaml.ts",
		},
		{
			name:       "content.yaml",
			plugin:     &typescript.Typescript{},
			goldenFile: "content.yaml.ts",
		},
		{
			name:       "form-url-encoded.yaml",
			plugin:     &typescript.Typescript{},
			goldenFile: "form-url-encoded.yaml.ts",
		},
		{
			name: "swift-features.yaml",
			plugin: &swiftprocessor.Swift{
				Namespace: "Test",
			},
			goldenFile: "swift-features.yaml.swift",
		},
		{
			name: "swift-keyword-names.yaml",
			plugin: &swiftprocessor.Swift{
				Namespace: "Type",
			},
			goldenFile: "swift-keyword-names.yaml.swift",
		},
		{
			name: "swift-methods.yaml",
			plugin: &swiftprocessor.Swift{
				Namespace:  "Fixture",
				ClientName: "GeneratedFixtureClient",
			},
			goldenFile: "swift-methods.yaml.swift",
		},
	}

	for _, tc := range cases {
		t.Run(tc.goldenFile, func(t *testing.T) {
			t.Parallel()

			doc, err := getModel("testdata/" + tc.name)
			if err != nil {
				t.Fatalf("failed to get model: %v", err)
			}

			ir, err := processor.NewInterMediateRepresentation(doc, tc.plugin)
			if err != nil {
				t.Fatalf("failed to create intermediate representation: %v", err)
			}

			buf := bytes.NewBuffer(nil)
			if err := ir.Render(buf); err != nil {
				t.Fatalf("failed to render intermediate representation: %v", err)
			}

			output := buf.String()

			if *flagUpdate {
				f, err := os.OpenFile(
					"testdata/"+tc.goldenFile,
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

			b, err := os.ReadFile("testdata/" + tc.goldenFile)
			if err != nil {
				t.Fatalf("failed to read expected output file: %v", err)
			}

			assert.Equal(t, string(b), output,
				"rendered output does not match expected output for %s", tc.goldenFile)
		})
	}
}

func TestSwiftUnsupportedFeatureErrors(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		expectedError string
	}{
		{
			name:          "swift-unsupported-success.yaml",
			expectedError: "incompatible multiple 2xx success response shapes",
		},
		{
			name:          "swift-unsupported-request-body.yaml",
			expectedError: "unsupported request body media type text/plain",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			doc, err := getModel("testdata/" + tc.name)
			if err != nil {
				t.Fatalf("failed to get model: %v", err)
			}

			ir, err := processor.NewInterMediateRepresentation(doc, &swiftprocessor.Swift{})
			if err != nil {
				t.Fatalf("failed to create intermediate representation: %v", err)
			}

			buf := bytes.NewBuffer(nil)

			err = ir.Render(buf)
			if !errors.Is(err, processor.ErrUnsupportedFeature) {
				t.Fatalf("expected ErrUnsupportedFeature, got %v", err)
			}

			if err == nil || !strings.Contains(err.Error(), tc.expectedError) {
				t.Fatalf("expected error containing %q, got %v", tc.expectedError, err)
			}
		})
	}
}
