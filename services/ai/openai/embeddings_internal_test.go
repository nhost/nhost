package openai

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
	oai "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
)

type embeddingClientFunc func(
	ctx context.Context,
	params oai.EmbeddingNewParams,
	opts ...option.RequestOption,
) (*oai.CreateEmbeddingResponse, error)

func (f embeddingClientFunc) New(
	ctx context.Context,
	params oai.EmbeddingNewParams,
	opts ...option.RequestOption,
) (*oai.CreateEmbeddingResponse, error) {
	return f(ctx, params, opts...)
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
	var requestHeaders http.Header

	server := httptest.NewServer(
		http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
			requestHeaders = request.Header.Clone()
			w.Header().Set("Content-Type", "application/json")

			_, err := w.Write([]byte(`{
			"data":[{"embedding":[0.25],"index":0,"object":"embedding"}],
			"model":"text-embedding-3-small",
			"object":"list",
			"usage":{"prompt_tokens":1,"total_tokens":1}
		}`))
			if err != nil {
				t.Errorf("writing response: %v", err)
			}
		}),
	)
	defer server.Close()

	t.Setenv("OPENAI_BASE_URL", server.URL+"/")

	client := New("test-key", "test-organization")
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

	if got := requestHeaders.Get("OpenAI-Organization"); got != "test-organization" {
		t.Errorf("OpenAI-Organization = %q, want test-organization", got)
	}
}
