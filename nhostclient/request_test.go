package nhostclient_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/cli/nhostclient"
)

func TestMakeJSONRequest(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name              string
		requestBody       any
		headers           http.Header
		responseValidator func(resp *http.Response) error
		retryer           nhostclient.BasicRetryer

		expectedRequestMethod   string
		expectedErr             error
		expectedResponsePayload any
	}{
		{
			name:        "success",
			requestBody: map[string]any{"foo": "bar"},
			headers: http.Header{
				"X-Test":          []string{"test"},
				"Accept-Encoding": []string{"gzip"},
				"User-Agent":      []string{"Go-http-client/1.1"},
			},
			responseValidator: func(_ *http.Response) error {
				return nil
			},
			retryer:                 nhostclient.NewBasicRetryer(1, 1),
			expectedRequestMethod:   http.MethodPost,
			expectedResponsePayload: map[string]any{"FOO": "BAR"},
			expectedErr:             nil,
		},
		{
			name:        "failure after 2 attempts",
			requestBody: map[string]any{"foo": "bar"},
			headers: http.Header{
				"X-Test":          []string{"test"},
				"Accept-Encoding": []string{"gzip"},
				"User-Agent":      []string{"Go-http-client/1.1"},
			},
			responseValidator: func(_ *http.Response) error {
				return errTest
			},
			retryer:                 nhostclient.NewBasicRetryer(2, 2),
			expectedRequestMethod:   http.MethodPost,
			expectedResponsePayload: nil,
			expectedErr:             errTest,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != tc.expectedRequestMethod {
					t.Errorf(
						"expected request method: %s, got: %s",
						tc.expectedRequestMethod,
						r.Method,
					)
				}
				if diff := cmp.Diff(tc.headers, r.Header); diff != "" {
					t.Errorf("%s", diff)
				}

				var requestBody any
				if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
					t.Errorf("failed to decode request body: %v", err)
				}

				if diff := cmp.Diff(tc.requestBody, requestBody); diff != "" {
					t.Errorf("%s", diff)
				}

				w.WriteHeader(http.StatusOK)
				w.Header().Set("Content-Type", "application/json")
				if err := json.NewEncoder(w).Encode(tc.expectedResponsePayload); err != nil {
					t.Errorf("failed to encode response body: %v", err)
				}
			}))
			defer ts.Close()

			var responsePayload any
			err := nhostclient.MakeJSONRequest(
				t.Context(),
				&http.Client{}, //nolint: exhaustruct
				ts.URL,
				http.MethodPost,
				tc.requestBody,
				tc.headers,
				&responsePayload,
				tc.responseValidator,
				tc.retryer,
			)

			if !errors.Is(err, tc.expectedErr) {
				t.Errorf("expected error: %v, got: %v", tc.expectedErr, err)
			}

			if diff := cmp.Diff(tc.expectedResponsePayload, responsePayload); diff != "" {
				t.Errorf("%s", diff)
			}
		})
	}
}
