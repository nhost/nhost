package provider

import (
	"context"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"google.golang.org/genai"
)

var (
	errGoogleGeminiTestReadMarker  = errors.New("secret-read-error-marker")
	errGoogleGeminiTestCloseMarker = errors.New("secret-close-error-marker")
)

type capturedGoogleGeminiRequest struct {
	method   string
	path     string
	rawQuery string
	header   http.Header
	body     string
}

type collectedGoogleGeminiEvents struct {
	content     string
	stopReasons []string
	err         error
}

func mustGoogleGemini(
	t *testing.T,
	baseURL string,
	headers map[string]string,
) *googleGemini {
	t.Helper()

	configuration, err := newGoogleGeminiConfiguration(baseURL, headers)
	if err != nil {
		t.Fatalf("configure Google Gemini: %v", err)
	}

	provider, err := newGoogleGemini(t.Context(), configuration)
	if err != nil {
		t.Fatalf("construct Google Gemini: %v", err)
	}

	return provider
}

func googleGeminiStreamRequest(model string) StreamRequest {
	return StreamRequest{
		Model:        model,
		SystemPrompt: "system-marker",
		Messages: []Message{
			{
				Role:       RoleUser,
				Content:    "question-marker",
				ToolCalls:  nil,
				ToolCallID: "",
				ToolName:   "",
			},
		},
		Tools: nil,
	}
}

func collectGoogleGeminiEvents(ch <-chan Event) collectedGoogleGeminiEvents {
	var result collectedGoogleGeminiEvents

	for event := range ch {
		switch event.Type {
		case EventContentDelta:
			result.content += event.Content
		case EventComplete:
			result.stopReasons = append(result.stopReasons, event.StopReason)
		case EventError:
			result.err = event.Error
		case EventToolUseStart, EventToolUseDelta, EventToolUseDone:
		}
	}

	return result
}

func writeGoogleGeminiStream(t *testing.T, w http.ResponseWriter, content string) {
	t.Helper()

	w.Header().Set("Content-Type", "text/event-stream")
	w.WriteHeader(http.StatusOK)

	_, err := fmt.Fprintf(
		w,
		"data: %s\n\n",
		fmt.Sprintf(
			`{"candidates":[{"content":{"parts":[{"text":%q}],"role":"model"},"finishReason":"STOP"}]}`,
			content,
		),
	)
	if err != nil {
		t.Errorf("write Google Gemini stream: %v", err)
	}
}

// This test changes process environment variables, so it cannot run in parallel.
func TestGoogleGeminiWireContractIgnoresAmbientConfiguration(t *testing.T) {
	ambientMarkers := map[string]string{
		"GOOGLE_API_KEY":                 "ambient-google-api-key-marker",
		"GEMINI_API_KEY":                 "ambient-gemini-api-key-marker",
		"GOOGLE_GENAI_USE_VERTEXAI":      "true",
		"GOOGLE_CLOUD_PROJECT":           "ambient-project-marker",
		"GOOGLE_CLOUD_LOCATION":          "ambient-location-marker",
		"GOOGLE_CLOUD_REGION":            "ambient-region-marker",
		"GOOGLE_GEMINI_BASE_URL":         "https://ambient-base-url-marker.invalid",
		"GOOGLE_APPLICATION_CREDENTIALS": "/ambient-adc-marker.json",
	}

	t.Setenv("GOOGLE_API_KEY", ambientMarkers["GOOGLE_API_KEY"])
	t.Setenv("GEMINI_API_KEY", ambientMarkers["GEMINI_API_KEY"])
	t.Setenv("GOOGLE_GENAI_USE_VERTEXAI", ambientMarkers["GOOGLE_GENAI_USE_VERTEXAI"])
	t.Setenv("GOOGLE_CLOUD_PROJECT", ambientMarkers["GOOGLE_CLOUD_PROJECT"])
	t.Setenv("GOOGLE_CLOUD_LOCATION", ambientMarkers["GOOGLE_CLOUD_LOCATION"])
	t.Setenv("GOOGLE_CLOUD_REGION", ambientMarkers["GOOGLE_CLOUD_REGION"])
	t.Setenv("GOOGLE_GEMINI_BASE_URL", ambientMarkers["GOOGLE_GEMINI_BASE_URL"])
	t.Setenv(
		"GOOGLE_APPLICATION_CREDENTIALS",
		ambientMarkers["GOOGLE_APPLICATION_CREDENTIALS"],
	)

	tests := []struct {
		name       string
		headers    map[string]string
		wantAPIKey string
	}{
		{
			name: "configured API key",
			headers: map[string]string{
				"X-Goog-Api-Key":             "configured-api-key-marker",
				"X-Configured-Custom-Header": "configured-header-marker",
			},
			wantAPIKey: "configured-api-key-marker",
		},
		{
			name: "explicitly empty API key",
			headers: map[string]string{
				"x-goog-api-key":             "",
				"X-Configured-Custom-Header": "configured-header-marker",
			},
			wantAPIKey: "",
		},
		{
			name: "missing API key",
			headers: map[string]string{
				"X-Configured-Custom-Header": "configured-header-marker",
			},
			wantAPIKey: "",
		},
	}

	// These subtests share the hostile process environment set above.
	//nolint:paralleltest // Go prohibits parallel descendants after t.Setenv.
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestCh := make(chan capturedGoogleGeminiRequest, 1)
			server := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, r *http.Request) {
					body, err := io.ReadAll(r.Body)
					if err != nil {
						t.Errorf("read Google Gemini request: %v", err)
					}

					requestCh <- capturedGoogleGeminiRequest{
						method:   r.Method,
						path:     r.URL.Path,
						rawQuery: r.URL.RawQuery,
						header:   r.Header.Clone(),
						body:     string(body),
					}

					writeGoogleGeminiStream(t, w, "hello-marker")
				},
			))
			t.Cleanup(server.Close)

			headers := make(map[string]string, len(test.headers))
			maps.Copy(headers, test.headers)

			provider := mustGoogleGemini(t, server.URL+"/gateway", headers)
			for name := range headers {
				headers[name] = "mutated-after-construction-marker"
			}

			events := collectGoogleGeminiEvents(provider.StreamResponse(
				t.Context(),
				googleGeminiStreamRequest("gemini-model-marker"),
			))
			if events.err != nil {
				t.Fatalf("stream Google Gemini response: %v", events.err)
			}

			if events.content != "hello-marker" {
				t.Errorf("content = %q, want hello-marker", events.content)
			}

			if diff := cmp.Diff([]string{StopReasonEndTurn}, events.stopReasons); diff != "" {
				t.Errorf("stop reasons mismatch (-want +got):\n%s", diff)
			}

			captured := <-requestCh
			if captured.method != http.MethodPost {
				t.Errorf("method = %q, want POST", captured.method)
			}

			wantPath := "/gateway/v1beta/models/gemini-model-marker:streamGenerateContent"
			if captured.path != wantPath {
				t.Errorf("path = %q, want %q", captured.path, wantPath)
			}

			query, err := url.ParseQuery(captured.rawQuery)
			if err != nil {
				t.Fatalf("parse query: %v", err)
			}

			if diff := cmp.Diff(url.Values{"alt": []string{"sse"}}, query); diff != "" {
				t.Errorf("query mismatch (-want +got):\n%s", diff)
			}

			if got := captured.header.Values(googleGeminiKeyHeader); !cmp.Equal(
				got,
				valueOrEmptySlice(test.wantAPIKey),
			) {
				t.Errorf("API key header = %q, want %q", got, test.wantAPIKey)
			}

			if got := captured.header.Values("X-Configured-Custom-Header"); !cmp.Equal(
				got,
				[]string{"configured-header-marker"},
			) {
				t.Errorf("custom header = %q, want configured value", got)
			}

			wirePayload := captured.path + "\n" + captured.rawQuery + "\n" +
				fmt.Sprint(captured.header) + "\n" + captured.body
			for _, marker := range ambientMarkers {
				if strings.Contains(wirePayload, marker) {
					t.Errorf("wire request exposed ambient marker %q", marker)
				}
			}

			for _, marker := range []string{
				googleGeminiKeySentinel,
				"mutated-after-construction-marker",
			} {
				if strings.Contains(wirePayload, marker) {
					t.Errorf("wire request exposed marker %q", marker)
				}
			}
		})
	}
}

func valueOrEmptySlice(value string) []string {
	if value == "" {
		return nil
	}

	return []string{value}
}

func TestGoogleGeminiConfigurationValidation(t *testing.T) {
	t.Parallel()

	accepted := []struct {
		name    string
		baseURL string
		headers map[string]string
	}{
		{name: "vendor root", baseURL: "https://generativelanguage.googleapis.com"},
		{name: "gateway path", baseURL: "https://example.com/gateway/"},
		{name: "loopback HTTP", baseURL: "http://127.0.0.1:8080"},
		{name: "private HTTP", baseURL: "http://10.0.0.7/gateway"},
		{name: "IPv6 literal", baseURL: "http://[::1]:8080/gateway"},
		{
			name:    "authentication headers",
			baseURL: "https://example.com",
			headers: map[string]string{
				"Authorization":  "Bearer marker",
				"x-goog-api-key": "",
			},
		},
	}

	for _, test := range accepted {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			if _, err := newGoogleGeminiConfiguration(test.baseURL, test.headers); err != nil {
				t.Errorf("configuration rejected: %v", err)
			}
		})
	}

	rejected := []struct {
		name    string
		baseURL string
		headers map[string]string
	}{
		{name: "final v1beta", baseURL: "https://example.com/v1beta"},
		{name: "final v1beta slash", baseURL: "https://example.com/gateway/v1beta/"},
		{name: "models collection path", baseURL: "https://example.com/v1beta/models"},
		{name: "models path", baseURL: "https://example.com/v1beta/models/gemini"},
		{name: "generate operation", baseURL: "https://example.com/model:generateContent"},
		{
			name:    "stream operation",
			baseURL: "https://example.com/model:streamGenerateContent",
		},
		{
			name:    "SDK client header",
			baseURL: "https://example.com",
			headers: map[string]string{"X-Goog-Api-Client": "marker"},
		},
		{
			name:    "SDK user agent",
			baseURL: "https://example.com",
			headers: map[string]string{"User-Agent": "marker"},
		},
		{
			name:    "SDK timeout header",
			baseURL: "https://example.com",
			headers: map[string]string{"X-Server-Timeout": "marker"},
		},
	}

	for _, test := range rejected {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			_, err := newGoogleGeminiConfiguration(test.baseURL, test.headers)
			if err == nil {
				t.Fatal("configuration succeeded, want error")
			}

			if strings.Contains(err.Error(), test.baseURL) ||
				strings.Contains(err.Error(), "marker") {
				t.Errorf("configuration error exposed rejected value: %v", err)
			}
		})
	}
}

func TestGoogleGeminiConfiguredRegistry(t *testing.T) {
	t.Parallel()

	raw := "[" + strings.Join([]string{
		providerDeclarationObjectForType(
			"openai-instance",
			providerTypeOpenAIChatCompletions,
			"https://example.com/openai/v1",
			"",
		),
		providerDeclarationObjectForType(
			"anthropic-instance",
			providerTypeAnthropicMessages,
			"https://example.com/anthropic",
			"",
		),
		providerDeclarationObjectForType(
			providerTypeGoogleGemini,
			providerTypeGoogleGemini,
			"https://example.com/gemini",
			`,"headers":{"x-goog-api-key":""}`,
		),
	}, ",") + "]"

	registry, typesByName, err := BuildConfiguredProviders(t.Context(), raw)
	if err != nil {
		t.Fatalf("build configured providers: %v", err)
	}

	if _, ok := registry["openai-instance"].(*openAIChatCompletions); !ok {
		t.Errorf("OpenAI provider has type %T", registry["openai-instance"])
	}

	if _, ok := registry["anthropic-instance"].(*anthropicMessages); !ok {
		t.Errorf("Anthropic provider has type %T", registry["anthropic-instance"])
	}

	if _, ok := registry[providerTypeGoogleGemini].(*googleGemini); !ok {
		t.Errorf("Google provider has type %T", registry[providerTypeGoogleGemini])
	}

	wantTypes := map[string]string{
		"anthropic-instance":     providerTypeAnthropicMessages,
		providerTypeGoogleGemini: providerTypeGoogleGemini,
		"openai-instance":        providerTypeOpenAIChatCompletions,
	}
	if diff := cmp.Diff(wantTypes, typesByName); diff != "" {
		t.Errorf("provider type metadata mismatch (-want +got):\n%s", diff)
	}
}

func TestGoogleGeminiRegistryErrorsAreAttributableAndAtomic(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		baseURL       string
		headersSuffix string
		wantRule      string
	}{
		{
			name:          "operation URL",
			baseURL:       "https://example.com/secret-url-marker:streamGenerateContent",
			headersSuffix: "",
			wantRule:      "invalid base_url",
		},
		{
			name:          "SDK-owned header",
			baseURL:       "https://example.com/secret-url-marker",
			headersSuffix: `,"headers":{"X-Goog-Api-Client":"secret-header-marker"}`,
			wantRule:      "invalid headers",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			raw := "[" + strings.Join([]string{
				providerDeclarationObjectForType(
					"first",
					providerTypeOpenAIChatCompletions,
					"https://example.com/v1",
					"",
				),
				providerDeclarationObjectForType(
					"google-instance",
					providerTypeGoogleGemini,
					test.baseURL,
					test.headersSuffix,
				),
			}, ",") + "]"

			registry, typesByName, err := BuildConfiguredProviders(t.Context(), raw)
			if !errors.Is(err, errInvalidAgentProviderConfiguration) {
				t.Fatalf("error = %v, want configuration error", err)
			}

			if registry != nil || typesByName != nil {
				t.Fatalf("partial result = %#v, %#v; want nil results", registry, typesByName)
			}

			for _, want := range []string{"declaration 1", "google-instance", test.wantRule} {
				if !strings.Contains(err.Error(), want) {
					t.Errorf("error %q does not contain safe context %q", err, want)
				}
			}

			for _, marker := range []string{
				"secret-url-marker",
				"secret-header-marker",
			} {
				if strings.Contains(err.Error(), marker) {
					t.Errorf("error exposed marker %q: %v", marker, err)
				}
			}
		})
	}
}

func providerDeclarationObjectForType(
	name string,
	providerType string,
	baseURL string,
	headersSuffix string,
) string {
	return fmt.Sprintf(
		`{"name":%q,"type":%q,"configuration":{"base_url":%q%s}}`,
		name,
		providerType,
		baseURL,
		headersSuffix,
	)
}

type googleGeminiRoundTripFunc func(*http.Request) (*http.Response, error)

func (f googleGeminiRoundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return f(request)
}

func TestGoogleGeminiTransportClonesRequestAndHeaders(t *testing.T) {
	t.Parallel()

	var captured *http.Request

	transport := &googleGeminiTransport{
		base: googleGeminiRoundTripFunc(func(request *http.Request) (*http.Response, error) {
			captured = request

			return &http.Response{
				Status:           "200 OK",
				StatusCode:       http.StatusOK,
				Proto:            "HTTP/1.1",
				ProtoMajor:       1,
				ProtoMinor:       1,
				Header:           make(http.Header),
				Body:             io.NopCloser(strings.NewReader("")),
				ContentLength:    0,
				TransferEncoding: nil,
				Close:            false,
				Uncompressed:     false,
				Trailer:          nil,
				Request:          request,
				TLS:              nil,
			}, nil
		}),
		scrubAPIKey: true,
	}

	request := httptest.NewRequest(http.MethodPost, "https://example.com", strings.NewReader("{}"))
	request.Header.Set(googleGeminiKeyHeader, googleGeminiKeySentinel)
	request.Header.Set("X-Custom", "original")

	response, err := transport.RoundTrip(request)
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}

	t.Cleanup(func() {
		if err := response.Body.Close(); err != nil {
			t.Errorf("close response: %v", err)
		}
	})

	if captured == request {
		t.Error("transport passed the original request to its base transport")
	}

	if got := captured.Header.Get(googleGeminiKeyHeader); got != "" {
		t.Errorf("captured API key = %q, want empty", got)
	}

	if got := request.Header.Get(googleGeminiKeyHeader); got != googleGeminiKeySentinel {
		t.Errorf("original API key = %q, want sentinel unchanged", got)
	}

	captured.Header.Set("X-Custom", "mutated")

	if got := request.Header.Get("X-Custom"); got != "original" {
		t.Errorf("original custom header = %q, want original", got)
	}

	if response == nil || response.Body == nil {
		t.Fatal("transport returned no response body")
	}
}

func TestGoogleGeminiClientConfigurationIsExplicitAndIsolated(t *testing.T) {
	t.Parallel()

	first := mustGoogleGemini(t, "https://example.com/first", map[string]string{
		googleGeminiKeyHeader: "first-key-marker",
		"X-Instance":          "first-header-marker",
	})
	second := mustGoogleGemini(t, "https://example.com/second", map[string]string{
		googleGeminiKeyHeader: "second-key-marker",
		"X-Instance":          "second-header-marker",
	})

	firstConfig := first.client.ClientConfig()
	secondConfig := second.client.ClientConfig()

	for name, config := range map[string]genai.ClientConfig{
		"first":  firstConfig,
		"second": secondConfig,
	} {
		if config.APIKey != name+"-key-marker" {
			t.Errorf("%s client did not retain its configured API key", name)
		}

		if config.Backend != genai.BackendGeminiAPI {
			t.Errorf("%s backend = %s, want Gemini API", name, config.Backend)
		}

		if config.HTTPOptions.BaseURL != "https://example.com/"+name {
			t.Errorf("%s client did not retain its configured base URL", name)
		}

		if config.HTTPOptions.APIVersion != googleGeminiAPIVersion {
			t.Errorf(
				"%s API version = %q, want %q",
				name,
				config.HTTPOptions.APIVersion,
				googleGeminiAPIVersion,
			)
		}

		if got := config.HTTPOptions.Headers.Get(googleGeminiKeyHeader); got != "" {
			t.Errorf("%s HTTP options retained an API key header", name)
		}

		if got := config.HTTPOptions.Headers.Get("X-Instance"); got != name+"-header-marker" {
			t.Errorf("%s client did not retain its configured custom header", name)
		}

		transport, ok := config.HTTPClient.Transport.(*googleGeminiTransport)
		if !ok {
			t.Errorf("%s HTTP transport has type %T", name, config.HTTPClient.Transport)

			continue
		}

		if transport.base == http.DefaultTransport {
			t.Errorf("%s transport uses the process-wide default transport", name)
		}
	}

	if firstConfig.HTTPClient == secondConfig.HTTPClient {
		t.Error("configured instances share an HTTP client")
	}

	if firstConfig.HTTPClient.Transport == secondConfig.HTTPClient.Transport {
		t.Error("configured instances share an HTTP transport")
	}
}

type googleGeminiFailingBody struct {
	readErr  error
	closeErr error
}

func (b *googleGeminiFailingBody) Read(_ []byte) (int, error) {
	return 0, b.readErr
}

func (b *googleGeminiFailingBody) Close() error {
	return b.closeErr
}

func TestGoogleGeminiResponseBodyErrorsAreSafe(t *testing.T) {
	t.Parallel()

	body := &googleGeminiResponseBody{ReadCloser: &googleGeminiFailingBody{
		readErr:  errGoogleGeminiTestReadMarker,
		closeErr: errGoogleGeminiTestCloseMarker,
	}}

	bytesRead, readErr := body.Read(make([]byte, 1))
	if bytesRead != 0 {
		t.Errorf("bytes read = %d, want 0", bytesRead)
	}

	if !errors.Is(readErr, errGoogleGeminiResponseBody) ||
		strings.Contains(readErr.Error(), "secret-read-error-marker") {
		t.Errorf("read error is not safe: %v", readErr)
	}

	closeErr := body.Close()
	if !errors.Is(closeErr, errGoogleGeminiResponseBody) ||
		strings.Contains(closeErr.Error(), "secret-close-error-marker") {
		t.Errorf("close error is not safe: %v", closeErr)
	}
}

func TestGoogleGeminiFailuresAreSafe(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		write      func(http.ResponseWriter) error
		wantStatus string
	}{
		{
			name: "HTTP status",
			write: func(w http.ResponseWriter) error {
				const payload = `{"error":{"code":418,"message":"response-body-secret-marker"}}`

				w.WriteHeader(http.StatusTeapot)

				bytesWritten, err := io.WriteString(w, payload)
				if err != nil {
					return fmt.Errorf("write HTTP status response: %w", err)
				}

				if bytesWritten != len(payload) {
					return fmt.Errorf("write HTTP status response: %w", io.ErrShortWrite)
				}

				return nil
			},
			wantStatus: "HTTP status 418",
		},
		{
			name: "malformed stream",
			write: func(w http.ResponseWriter) error {
				const payload = "data: response-body-secret-marker\n\n"

				w.Header().Set("Content-Type", "text/event-stream")
				w.WriteHeader(http.StatusOK)

				bytesWritten, err := io.WriteString(w, payload)
				if err != nil {
					return fmt.Errorf("write malformed stream response: %w", err)
				}

				if bytesWritten != len(payload) {
					return fmt.Errorf("write malformed stream response: %w", io.ErrShortWrite)
				}

				return nil
			},
			wantStatus: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()

			server := httptest.NewServer(http.HandlerFunc(
				func(w http.ResponseWriter, _ *http.Request) {
					if err := test.write(w); err != nil {
						t.Errorf("write Google Gemini failure response: %v", err)
					}
				},
			))
			t.Cleanup(server.Close)

			provider := mustGoogleGemini(
				t,
				server.URL+"/configured-url-secret-marker",
				map[string]string{
					googleGeminiKeyHeader: "configured-api-key-secret-marker",
					"X-Credential":        "configured-header-secret-marker",
				},
			)

			events := collectGoogleGeminiEvents(provider.StreamResponse(
				t.Context(),
				googleGeminiStreamRequest("model-marker"),
			))
			if !errors.Is(events.err, errGoogleGeminiRequest) {
				t.Fatalf("error = %v, want Google Gemini request error", events.err)
			}

			if test.wantStatus != "" && !strings.Contains(events.err.Error(), test.wantStatus) {
				t.Errorf("error = %q, want %q", events.err, test.wantStatus)
			}

			markers := []string{
				"response-body-secret-marker",
				"configured-url-secret-marker",
				"configured-api-key-secret-marker",
				"configured-header-secret-marker",
				googleGeminiKeySentinel,
			}
			for _, marker := range markers {
				if strings.Contains(events.err.Error(), marker) {
					t.Errorf("error exposed marker %q: %v", marker, events.err)
				}
			}
		})
	}
}

func TestGoogleGeminiRefusesRedirects(t *testing.T) {
	t.Parallel()

	const configuredKey = "configured-redirect-key-marker"

	var targetRequests atomic.Int64

	target := httptest.NewServer(http.HandlerFunc(
		func(_ http.ResponseWriter, _ *http.Request) {
			targetRequests.Add(1)
		},
	))
	t.Cleanup(target.Close)

	var sourceRequests atomic.Int64

	source := httptest.NewServer(http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {
			sourceRequests.Add(1)

			if got := r.Header.Get(googleGeminiKeyHeader); got != configuredKey {
				t.Errorf("source API key = %q, want configured key", got)
			}

			http.Redirect(
				w,
				r,
				target.URL+"/redirect-target-secret-marker",
				http.StatusTemporaryRedirect,
			)
		},
	))
	t.Cleanup(source.Close)

	provider := mustGoogleGemini(
		t,
		source.URL+"/source-secret-marker",
		map[string]string{googleGeminiKeyHeader: configuredKey},
	)

	events := collectGoogleGeminiEvents(provider.StreamResponse(
		t.Context(),
		googleGeminiStreamRequest("model-marker"),
	))
	if !errors.Is(events.err, errGoogleGeminiRequest) {
		t.Fatalf("error = %v, want Google Gemini request error", events.err)
	}

	for _, marker := range []string{
		configuredKey,
		target.URL,
		"redirect-target-secret-marker",
		"source-secret-marker",
	} {
		if strings.Contains(events.err.Error(), marker) {
			t.Errorf("redirect error exposed marker %q: %v", marker, events.err)
		}
	}

	if sourceRequests.Load() != 1 {
		t.Errorf("source requests = %d, want 1", sourceRequests.Load())
	}

	if targetRequests.Load() != 0 {
		t.Errorf("redirect target requests = %d, want 0", targetRequests.Load())
	}
}

func TestGoogleGeminiCancellationClosesChannel(t *testing.T) {
	t.Parallel()

	requestStarted := make(chan struct{})

	// Release the handler explicitly because an HTTP/1.1 request context may
	// remain active until the handler returns, which would block Server.Close.
	releaseRequest := make(chan struct{})

	var releaseOnce sync.Once

	release := func() {
		releaseOnce.Do(func() {
			close(releaseRequest)
		})
	}

	server := httptest.NewServer(http.HandlerFunc(
		func(_ http.ResponseWriter, r *http.Request) {
			close(requestStarted)

			select {
			case <-r.Context().Done():
			case <-releaseRequest:
			}
		},
	))
	t.Cleanup(server.Close)
	t.Cleanup(release)

	provider := mustGoogleGemini(t, server.URL, nil)
	ctx, cancel := context.WithCancel(t.Context())
	stream := provider.StreamResponse(ctx, googleGeminiStreamRequest("model-marker"))

	select {
	case <-requestStarted:
	case <-time.After(2 * time.Second):
		t.Fatal("Google Gemini request did not start")
	}

	cancel()

	select {
	case _, ok := <-stream:
		if ok {
			t.Error("stream emitted an event after cancellation")
		}
	case <-time.After(2 * time.Second):
		t.Fatal("Google Gemini stream channel did not close")
	}

	release()
}

func TestGoogleGeminiConcurrentInstancesAreIsolated(t *testing.T) {
	t.Parallel()

	type instance struct {
		name       string
		apiKey     string
		header     string
		model      string
		provider   *googleGemini
		capturedCh chan capturedGoogleGeminiRequest
	}

	type instanceResult struct {
		name   string
		events collectedGoogleGeminiEvents
	}

	newInstance := func(name string) instance {
		capturedCh := make(chan capturedGoogleGeminiRequest, 1)
		server := httptest.NewServer(http.HandlerFunc(
			func(w http.ResponseWriter, r *http.Request) {
				body, err := io.ReadAll(r.Body)
				if err != nil {
					t.Errorf("read %s request: %v", name, err)
				}

				capturedCh <- capturedGoogleGeminiRequest{
					method:   r.Method,
					path:     r.URL.Path,
					rawQuery: r.URL.RawQuery,
					header:   r.Header.Clone(),
					body:     string(body),
				}

				writeGoogleGeminiStream(t, w, name+"-content")
			},
		))
		t.Cleanup(server.Close)

		apiKey := name + "-api-key"
		header := name + "-header"

		return instance{
			name:   name,
			apiKey: apiKey,
			header: header,
			model:  name + "-model",
			provider: mustGoogleGemini(t, server.URL+"/"+name, map[string]string{
				googleGeminiKeyHeader: apiKey,
				"X-Instance":          header,
			}),
			capturedCh: capturedCh,
		}
	}

	instances := []instance{newInstance("first"), newInstance("second")}
	results := make(chan instanceResult, len(instances))

	var waitGroup sync.WaitGroup
	for _, configuredInstance := range instances {
		waitGroup.Go(func() {
			results <- instanceResult{
				name: configuredInstance.name,
				events: collectGoogleGeminiEvents(configuredInstance.provider.StreamResponse(
					t.Context(),
					googleGeminiStreamRequest(configuredInstance.model),
				)),
			}
		})
	}

	waitGroup.Wait()
	close(results)

	for result := range results {
		if result.events.err != nil {
			t.Errorf("stream %s instance: %v", result.name, result.events.err)
		}

		wantContent := result.name + "-content"
		if result.events.content != wantContent {
			t.Errorf(
				"%s content = %q, want %q",
				result.name,
				result.events.content,
				wantContent,
			)
		}
	}

	for _, configuredInstance := range instances {
		captured := <-configuredInstance.capturedCh
		if got := captured.header.Get(googleGeminiKeyHeader); got != configuredInstance.apiKey {
			t.Errorf(
				"%s API key = %q, want %q",
				configuredInstance.name,
				got,
				configuredInstance.apiKey,
			)
		}

		if got := captured.header.Get("X-Instance"); got != configuredInstance.header {
			t.Errorf(
				"%s header = %q, want %q",
				configuredInstance.name,
				got,
				configuredInstance.header,
			)
		}

		wantPath := fmt.Sprintf(
			"/%s/v1beta/models/%s:streamGenerateContent",
			configuredInstance.name,
			configuredInstance.model,
		)
		if captured.path != wantPath {
			t.Errorf("%s path = %q, want %q", configuredInstance.name, captured.path, wantPath)
		}

		otherName := "first"
		if configuredInstance.name == otherName {
			otherName = "second"
		}

		payload := captured.path + "\n" + captured.body + "\n" + fmt.Sprint(captured.header)
		if strings.Contains(payload, otherName+"-api-key") ||
			strings.Contains(payload, otherName+"-header") ||
			strings.Contains(payload, otherName+"-model") {
			t.Errorf(
				"%s request contains %s instance configuration",
				configuredInstance.name,
				otherName,
			)
		}
	}
}
