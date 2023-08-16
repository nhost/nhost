//go:build integration
// +build integration

package client_test

import (
	"context"
	"net/http"
	"os"
	"path"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
	"github.com/nhost/hasura-storage/controller"
)

type fileHelper struct {
	path     string
	id       string
	metadata map[string]any
}

func uploadFiles(
	t *testing.T, cl *client.Client, files ...fileHelper,
) (*controller.UploadFileResponse, error) {
	t.Helper()

	filesToUpload := make([]*client.File, len(files))

	for i, file := range files {
		f, err := os.Open(file.path)
		if err != nil {
			t.Fatal(err)
		}

		filesToUpload[i] = client.NewFile(
			path.Base(file.path), f, client.WithUUID(file.id), client.WithMetadata(file.metadata),
		)
	}

	return cl.UploadFile(context.Background(), filesToUpload...)
}

func TestUploadFile(t *testing.T) {
	baseURL := "http://localhost:8000/v1"
	cl := client.New(baseURL, os.Getenv("HASURA_AUTH_BEARER"))

	id1 := uuid.NewString()
	id2 := uuid.NewString()

	cases := []struct {
		name        string
		files       []fileHelper
		expected    *controller.UploadFileResponse
		expectedErr error
	}{
		{
			name: "success",
			files: []fileHelper{
				{"testdata/alphabet.txt", id1, map[string]any{"foo": "bar"}},
				{"testdata/greek.txt", id2, nil},
			},
			expected: &controller.UploadFileResponse{
				ProcessedFiles: []controller.FileMetadata{
					{
						ID:         id1,
						Name:       "alphabet.txt",
						Size:       63,
						BucketID:   "default",
						ETag:       `"588be441fe7a59460850b0aa3e1c5a65"`,
						CreatedAt:  "2022-01-18T12:58:16.754894+00:00",
						UpdatedAt:  "2022-01-18T12:58:16.839344+00:00",
						IsUploaded: true,
						MimeType:   "text/plain; charset=utf-8",
						Metadata: map[string]any{
							"foo": "bar",
						},
					},
					{
						ID:         id2,
						Name:       "greek.txt",
						Size:       103,
						BucketID:   "default",
						ETag:       `"d4b4575c5af8c28b4486acd1051ddf37"`,
						CreatedAt:  "2022-01-18T12:58:16.876285+00:00",
						UpdatedAt:  "2022-01-18T12:58:16.95204+00:00",
						IsUploaded: true,
						MimeType:   "text/plain; charset=utf-8",
					},
				},
			},
		},
		{
			name: "duplicated",
			files: []fileHelper{
				{"testdata/alphabet.txt", id1, map[string]any{"foo": "bar"}},
				{"testdata/greek.txt", id2, nil},
			},
			expectedErr: &client.APIResponseError{
				StatusCode: http.StatusBadRequest,
				ErrorResponse: &controller.ErrorResponse{
					Message: `{"networkErrors":null,"graphqlErrors":[{"message":"Uniqueness violation. duplicate key value violates unique constraint \"files_pkey\"","extensions":{"code":"constraint-violation","path":"$.selectionSet.insertFile.args.object"}}]}`,
					Data:    nil,
				},
				Response: &controller.UploadFileResponse{
					Error: &controller.ErrorResponse{
						Message: `{"networkErrors":null,"graphqlErrors":[{"message":"Uniqueness violation. duplicate key value violates unique constraint \"files_pkey\"","extensions":{"code":"constraint-violation","path":"$.selectionSet.insertFile.args.object"}}]}`,
					},
				},
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tc := tc

			got, err := uploadFiles(t, cl, tc.files...)

			if !cmp.Equal(err, tc.expectedErr) {
				t.Error(cmp.Diff(err, tc.expectedErr))
			}

			opts := cmp.Options{
				cmpopts.IgnoreFields(controller.FileMetadata{}, "CreatedAt", "UpdatedAt"),
			}

			if !cmp.Equal(got, tc.expected, opts...) {
				t.Error(cmp.Diff(got, tc.expected, opts...))
			}
		})
	}
}
