package client_test

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/client"
)

const cspValue = "default-src 'none'; sandbox"

// uploadHTMLFile uploads a script-bearing HTML document, the canonical
// stored-XSS payload the CSP must neutralise. The storage server detects the
// MIME type from content, so it is served back as text/html (active content).
func uploadHTMLFile(t *testing.T, cl client.ClientWithResponsesInterface, id string) {
	t.Helper()

	const htmlContent = `<!DOCTYPE html><html><head><title>xss</title></head>` +
		`<body><script>alert(1)</script></body></html>`

	body, contentType, err := client.CreateUploadMultiForm(
		"default",
		client.NewFile(
			"index.html",
			strings.NewReader(htmlContent),
			&client.UploadFileMetadata{Id: &id},
		),
	)
	if err != nil {
		t.Fatalf("failed to create upload multi-form: %v", err)
	}

	resp, err := cl.UploadFilesWithBodyWithResponse(
		t.Context(),
		contentType,
		body,
		WithAccessToken(accessTokenValidUser),
	)
	if err != nil {
		t.Fatalf("failed to upload html file: %v", err)
	}

	if resp.JSONDefault != nil {
		t.Fatalf("unexpected error response: %v", resp.JSONDefault)
	}

	if len(resp.JSON201.ProcessedFiles) == 0 {
		t.Fatal("no files were processed")
	}
}

// getFileViaPresignedURL downloads a file through the unauthenticated,
// self-authenticating presigned-URL path, the shareable vector the headers must
// also cover, and returns its response headers.
func getFileViaPresignedURL(
	t *testing.T,
	cl client.ClientWithResponsesInterface,
	id string,
) http.Header {
	t.Helper()

	presigned, err := cl.GetFilePresignedURLWithResponse(
		t.Context(), id, WithAccessToken(accessTokenValidUser),
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	presignedURL, err := url.Parse(presigned.JSON200.Url)
	if err != nil {
		t.Fatalf("failed to parse presigned URL: %v", err)
	}

	query := presignedURL.Query()

	// No access token: a presigned URL is self-authenticating.
	resp, err := cl.GetFileWithPresignedURLWithResponse(
		t.Context(),
		id,
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

	return resp.HTTPResponse.Header
}

func assertNoSniff(t *testing.T, h http.Header) {
	t.Helper()

	if got := h.Get("X-Content-Type-Options"); got != "nosniff" {
		t.Errorf("X-Content-Type-Options: want %q, got %q", "nosniff", got)
	}
}

// TestGetFileSecurityHeaders asserts that the securityheaders middleware is
// wired into the running storage server and behaves as scoped on real file
// responses:
//
//   - X-Content-Type-Options: nosniff is present on every response.
//   - Content-Security-Policy is present only for active-content types: it is
//     set on an HTML file (the stored-XSS vector) but absent on an image, so the
//     browser can still render/embed non-active files (e.g. inline PDF/image).
//
// Both the authenticated and the unauthenticated presigned-URL paths are
// covered. The per-endpoint golden tests intentionally ignore these
// cross-cutting headers (see IgnoreResponseHeaders), so this test is the guard
// against a regression in the serve.go registration or its ordering.
func TestGetFileSecurityHeaders(t *testing.T) {
	t.Parallel()

	cl, err := client.NewClientWithResponses(testBaseURL)
	if err != nil {
		t.Fatalf("failed to create client: %v", err)
	}

	textID := uuid.NewString()
	imageID := uuid.NewString()
	uploadInitialFile(t, cl, textID, imageID) // imageID -> image/jpeg (not active)

	htmlID := uuid.NewString()
	uploadHTMLFile(t, cl, htmlID) // -> text/html (active content)

	t.Run("html authenticated download is sandboxed", func(t *testing.T) {
		t.Parallel()

		resp, err := cl.GetFileWithResponse(
			t.Context(), htmlID, nil, WithAccessToken(accessTokenValidUser),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if resp.StatusCode() != http.StatusOK {
			t.Fatalf("expected status code %d, got %d", http.StatusOK, resp.StatusCode())
		}

		assertNoSniff(t, resp.HTTPResponse.Header)

		if got := resp.HTTPResponse.Header.Get("Content-Security-Policy"); got != cspValue {
			t.Errorf("Content-Security-Policy: want %q, got %q", cspValue, got)
		}
	})

	t.Run("html unauthenticated presigned download is sandboxed", func(t *testing.T) {
		t.Parallel()

		h := getFileViaPresignedURL(t, cl, htmlID)

		assertNoSniff(t, h)

		if got := h.Get("Content-Security-Policy"); got != cspValue {
			t.Errorf("Content-Security-Policy: want %q, got %q", cspValue, got)
		}
	})

	t.Run("image download is not sandboxed", func(t *testing.T) {
		t.Parallel()

		resp, err := cl.GetFileWithResponse(
			t.Context(), imageID, nil, WithAccessToken(accessTokenValidUser),
		)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if resp.StatusCode() != http.StatusOK {
			t.Fatalf("expected status code %d, got %d", http.StatusOK, resp.StatusCode())
		}

		// nosniff is still set; the sandboxing CSP must be absent so the browser
		// can render/embed the image.
		assertNoSniff(t, resp.HTTPResponse.Header)

		if got := resp.HTTPResponse.Header.Get("Content-Security-Policy"); got != "" {
			t.Errorf("Content-Security-Policy: want no header, got %q", got)
		}
	})
}
