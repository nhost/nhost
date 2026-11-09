package storage_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/nhost/nhost/services/storage/storage"
)

func TestGetFileWithPresignedURLContentLength(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status int
		length string
		want   int64
	}{
		{name: "small file", status: http.StatusOK, length: "1024", want: 1024},
		{name: "3 GiB file", status: http.StatusOK, length: "3221225472", want: 3221225472},
		{
			name:   "3 GiB range part",
			status: http.StatusPartialContent,
			length: "3221225472",
			want:   3221225472,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			// Only the headers matter, so the body is never sent or read.
			srv := httptest.NewServer(
				http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					w.Header().Set("Content-Length", tt.length)
					w.WriteHeader(tt.status)
				}),
			)
			defer srv.Close()

			st := storage.NewS3(new(s3.Client), "default", "", srv.URL, discardLogger())

			file, apiErr := st.GetFileWithPresignedURL(
				t.Context(), "file", "X-Amz-Signature=test", http.Header{},
			)
			if apiErr != nil {
				t.Fatalf("unexpected error: %v", apiErr)
			}
			defer file.Body.Close()

			if file.ContentLength != tt.want {
				t.Errorf("got ContentLength %d, want %d", file.ContentLength, tt.want)
			}
		})
	}
}
