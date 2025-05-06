//go:build integration
// +build integration

package client_test

import (
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

func EquateStrings(name string, expected string) cmp.Option {
	return cmp.Transformer(name, func(got string) string {
		if expected != "" && got != "" {
			return expected
		}
		return got
	})
}

func TestGetFilePresignedURL(t *testing.T) {
	baseURL := "http://localhost:8000/v1"
	cl := client.New(baseURL, os.Getenv("HASURA_AUTH_BEARER"))

	files := []fileHelper{
		{
			path: "testdata/alphabet.txt",
			id:   uuid.NewString(),
		},
	}

	testFiles, err := uploadFiles(t, cl, files...)
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name        string
		id          string
		expected    *controller.GetFilePresignedURLResponse
		expectedErr error
	}{
		{
			name: "success",
			id:   testFiles.ProcessedFiles[0].ID,
			expected: &controller.GetFilePresignedURLResponse{
				URL:        "http://...",
				Expiration: 30,
			},
		},
		{
			name: "dont exist",
			id:   uuid.NewString(),
			expected: &controller.GetFilePresignedURLResponse{
				Error: &controller.ErrorResponse{Message: "file not found"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := cl.GetFilePresignedURL(context.Background(), tc.id)
			if !cmp.Equal(err, tc.expectedErr) {
				t.Error(cmp.Diff(err, tc.expectedErr))
			}

			opts := cmp.Options{
				EquateStrings("URL", tc.expected.URL),
			}

			if !cmp.Equal(got, tc.expected, opts...) {
				t.Error(cmp.Diff(got, tc.expected, opts...))
			}
		})
	}
}
