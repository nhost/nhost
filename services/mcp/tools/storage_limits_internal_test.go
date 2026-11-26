package tools

import (
	"io"
	"net/http"
	"testing"
)

const testStorageTransferBytes = 1024

type transferBody struct {
	remaining int
	read      int
	closed    bool
}

func (b *transferBody) Read(p []byte) (int, error) {
	if b.remaining == 0 {
		return 0, io.EOF
	}

	n := min(len(p), b.remaining)
	clear(p[:n])
	b.remaining -= n
	b.read += n

	return n, nil
}

func (b *transferBody) Close() error {
	b.closed = true

	return nil
}

type transferHTTPClient struct {
	response *http.Response
}

func (c transferHTTPClient) Do(_ *http.Request) (*http.Response, error) {
	return c.response, nil
}

func TestStorageDownloadReadLimit(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		contentLength int64
		status        int
		bodyBytes     int
		wantRead      int
		wantError     bool
	}{
		{
			"known oversized download",
			testStorageTransferBytes + 1,
			http.StatusOK,
			testStorageTransferBytes * 2,
			0,
			true,
		},
		{
			"unknown length download",
			-1,
			http.StatusOK,
			testStorageTransferBytes * 2,
			testStorageTransferBytes + 1,
			true,
		},
		{
			"understated download length",
			1,
			http.StatusOK,
			testStorageTransferBytes * 2,
			testStorageTransferBytes + 1,
			true,
		},
		{
			"known oversized upstream error",
			testStorageTransferBytes + 1,
			http.StatusBadGateway,
			testStorageTransferBytes * 2,
			0,
			true,
		},
		{
			"unknown length upstream error",
			-1,
			http.StatusBadGateway,
			testStorageTransferBytes * 2,
			testStorageTransferBytes + 1,
			true,
		},
		{
			"exact limit download",
			testStorageTransferBytes,
			http.StatusOK,
			testStorageTransferBytes,
			testStorageTransferBytes,
			false,
		},
		{
			"exact limit unknown length",
			-1,
			http.StatusOK,
			testStorageTransferBytes,
			testStorageTransferBytes,
			false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			body := &transferBody{remaining: tt.bodyBytes}
			tool := &storageTool{
				endpoint:         "http://storage.example/v1",
				maxTransferBytes: testStorageTransferBytes,
				client: transferHTTPClient{response: &http.Response{
					StatusCode:    tt.status,
					Header:        http.Header{},
					ContentLength: tt.contentLength,
					Body:          body,
				}},
			}

			result, err := tool.fetchDownload(t.Context(), "/files/id", nil, nil)
			if err != nil {
				t.Fatal(err)
			}

			if result.IsError != tt.wantError {
				t.Errorf("IsError=%v, want %v", result.IsError, tt.wantError)
			}

			if body.read != tt.wantRead || !body.closed {
				t.Errorf(
					"read %d bytes, closed=%v; want %d bytes and closed body",
					body.read,
					body.closed,
					tt.wantRead,
				)
			}
		})
	}
}
