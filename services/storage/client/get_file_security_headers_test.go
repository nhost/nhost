package client_test

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

// TestGetFileSecurityHeaders asserts that the browser hardening headers set by
// the securityheaders middleware are wired into the running storage server and
// present on real file responses, including the unauthenticated presigned-URL
// download path. The per-endpoint golden tests intentionally ignore these
// cross-cutting headers (see IgnoreResponseHeaders), so this test is the guard
// against a regression in the serve.go registration or its ordering.
func TestGetFileSecurityHeaders(t *testing.T) {
	t.Parallel()

	wantHeaders := map[string]string{
		"X-Content-Type-Options":  "nosniff",
		"Content-Security-Policy": "default-src 'none'; sandbox",
	}

	assertSecurityHeaders := func(t *testing.T, h http.Header) {
		t.Helper()

		for name, want := range wantHeaders {
			if got := h.Get(name); got != want {
				t.Errorf("header %s: want %q, got %q", name, want, got)
			}
		}
	}

	cl, err := client.NewClientWithResponses(testBaseURL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	id1 := uuid.NewString()
	id2 := uuid.NewString()

	uploadInitialFile(t, cl, id1, id2)

	t.Run("authenticated download", func(t *testing.T) {
		t.Parallel()

		resp, err := cl.GetFileWithResponse(
			t.Context(),
			id1,
			nil,
			WithAccessToken(accessTokenValidUser),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if resp.StatusCode() != http.StatusOK {
			t.Fatalf("expected status code %d, got %d", http.StatusOK, resp.StatusCode())
		}

		assertSecurityHeaders(t, resp.HTTPResponse.Header)
	})

	t.Run("unauthenticated presigned download", func(t *testing.T) {
		t.Parallel()

		presigned, err := cl.GetFilePresignedURLWithResponse(
			t.Context(), id1, WithAccessToken(accessTokenValidUser),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		presignedURL, err := url.Parse(presigned.JSON200.Url)
		if err != nil {
			t.Fatalf("failed to parse presigned URL: %v", err)
		}

		query := presignedURL.Query()

		// No access token: a presigned URL is self-authenticating, and this is
		// the unauthenticated, shareable vector the headers must also cover.
		resp, err := cl.GetFileWithPresignedURLWithResponse(
			t.Context(),
			id1,
			&client.GetFileWithPresignedURLParams{
				XAmzAlgorithm:     query.Get("X-Amz-Algorithm"),
				XAmzChecksumMode:  query.Get("X-Amz-Checksum-Mode"),
				XAmzCredential:    query.Get("X-Amz-Credential"),
				XAmzDate:          query.Get("X-Amz-Date"),
				XAmzExpires:       query.Get("X-Amz-Expires"),
				XId:               query.Get("x-id"),
				XAmzSignature:     query.Get("X-Amz-Signature"),
				XAmzSignedHeaders: query.Get("X-Amz-SignedHeaders"),
			},
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if resp.StatusCode() != http.StatusOK {
			t.Fatalf("expected status code %d, got %d", http.StatusOK, resp.StatusCode())
		}

		assertSecurityHeaders(t, resp.HTTPResponse.Header)
	})
}
