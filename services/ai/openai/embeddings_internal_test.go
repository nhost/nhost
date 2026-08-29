package openai

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
	oai "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

const embeddingResponseJSON = `{
	"data":[{"embedding":[0.25],"index":0,"object":"embedding"}],
	"model":"text-embedding-3-small",
	"object":"list",
	"usage":{"prompt_tokens":1,"total_tokens":1}
}`

type embeddingClientFunc func(
	ctx context.Context,
	params oai.EmbeddingNewParams,
	opts ...option.RequestOption,
) (*oai.CreateEmbeddingResponse, error)

type roundTripperFunc func(*http.Request) (*http.Response, error)

func (f embeddingClientFunc) New(
	ctx context.Context,
	params oai.EmbeddingNewParams,
	opts ...option.RequestOption,
) (*oai.CreateEmbeddingResponse, error) {
	return f(ctx, params, opts...)
}

func (f roundTripperFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestEmbeddingsGenerate(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name     string
		response *oai.CreateEmbeddingResponse
		err      error
		want     []float64
		wantErr  error
	}{
		{
			name: "success",
			response: &oai.CreateEmbeddingResponse{
				Data: []oai.Embedding{{Embedding: []float64{0.25, 0.5}}},
			},
			err:     nil,
			want:    []float64{0.25, 0.5},
			wantErr: nil,
		},
		{
			name:     "SDK failure",
			response: nil,
			err:      io.ErrUnexpectedEOF,
			want:     nil,
			wantErr:  io.ErrUnexpectedEOF,
		},
		{
			name:     "nil response",
			response: nil,
			err:      nil,
			want:     nil,
			wantErr:  errEmptyEmbeddingResponse,
		},
		{
			name:     "empty response",
			response: &oai.CreateEmbeddingResponse{Data: nil},
			err:      nil,
			want:     nil,
			wantErr:  errEmptyEmbeddingResponse,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			client := &Client{
				embeddings: embeddingClientFunc(func(
					_ context.Context,
					params oai.EmbeddingNewParams,
					_ ...option.RequestOption,
				) (*oai.CreateEmbeddingResponse, error) {
					if params.Input.OfString.Value != "input" {
						t.Errorf("input = %q, want input", params.Input.OfString.Value)
					}

					if params.Model != "model" {
						t.Errorf("model = %q, want model", params.Model)
					}

					return testCase.response, testCase.err
				}),
			}

			got, err := client.EmbeddingsGenerate(t.Context(), "input", "model")
			if !errors.Is(err, testCase.wantErr) {
				t.Fatalf("EmbeddingsGenerate() error = %v, want %v", err, testCase.wantErr)
			}

			if diff := cmp.Diff(testCase.want, got); diff != "" {
				t.Errorf("EmbeddingsGenerate() mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestNewConfiguresCredentials(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name                    string
		organization            string
		wantOrganizationHeaders []string
	}{
		{
			name:                    "organization configured",
			organization:            "test-organization",
			wantOrganizationHeaders: []string{"test-organization"},
		},
		{
			name:                    "organization omitted",
			organization:            "",
			wantOrganizationHeaders: nil,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()

			var requestHeaders http.Header

			server := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
					requestHeaders = request.Header.Clone()
					w.Header().Set("Content-Type", "application/json")

					if _, err := w.Write([]byte(embeddingResponseJSON)); err != nil {
						t.Errorf("writing response: %v", err)
					}
				}),
			)
			defer server.Close()

			client := New(
				"test-key",
				testCase.organization,
				option.WithBaseURL(server.URL+"/"),
			)
			if _, err := client.EmbeddingsGenerate(
				t.Context(),
				"input",
				"text-embedding-3-small",
			); err != nil {
				t.Fatalf("EmbeddingsGenerate() error: %v", err)
			}

			if got := requestHeaders.Get("Authorization"); got != "Bearer test-key" {
				t.Errorf("Authorization = %q, want Bearer test-key", got)
			}

			if diff := cmp.Diff(
				testCase.wantOrganizationHeaders,
				requestHeaders.Values("OpenAI-Organization"),
			); diff != "" {
				t.Errorf("OpenAI-Organization headers mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestNewIgnoresSDKEnvironment(t *testing.T) {
	t.Setenv("OPENAI_API_KEY", "environment-key")
	t.Setenv("OPENAI_BASE_URL", "https://untrusted.example/v1/")
	t.Setenv("OPENAI_ORG_ID", "environment-organization")
	t.Setenv("OPENAI_PROJECT_ID", "environment-project")
	t.Setenv("OPENAI_WEBHOOK_SECRET", "environment-secret")

	var (
		requestURL     string
		requestHeaders http.Header
	)

	httpClient := new(http.Client)
	httpClient.Transport = roundTripperFunc(func(request *http.Request) (*http.Response, error) {
		requestURL = request.URL.String()
		requestHeaders = request.Header.Clone()

		response := httptest.NewRecorder()
		response.Header().Set("Content-Type", "application/json")

		if _, err := response.WriteString(embeddingResponseJSON); err != nil {
			return nil, fmt.Errorf("writing response: %w", err)
		}

		return response.Result(), nil
	})

	client := New("explicit-key", "", option.WithHTTPClient(httpClient))
	if _, err := client.EmbeddingsGenerate(
		t.Context(),
		"input",
		"text-embedding-3-small",
	); err != nil {
		t.Fatalf("EmbeddingsGenerate() error: %v", err)
	}

	if requestURL != "https://api.openai.com/v1/embeddings" {
		t.Errorf(
			"request URL = %q, want https://api.openai.com/v1/embeddings",
			requestURL,
		)
	}

	if got := requestHeaders.Get("Authorization"); got != "Bearer explicit-key" {
		t.Errorf("Authorization = %q, want Bearer explicit-key", got)
	}

	if got := requestHeaders.Values("OpenAI-Organization"); got != nil {
		t.Errorf("OpenAI-Organization headers = %q, want none", got)
	}

	if got := requestHeaders.Values("OpenAI-Project"); got != nil {
		t.Errorf("OpenAI-Project headers = %q, want none", got)
	}
}
