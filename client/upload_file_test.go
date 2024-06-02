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

	id3 := uuid.NewString()
	id4 := uuid.NewString()
	id5 := uuid.NewString()

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
		{
			name: "with virus",
			files: []fileHelper{
				{"testdata/alphabet.txt", id3, nil},
				{"testdata/greek.txt", id4, nil},
				{"testdata/eicarcom2.zip", id5, map[string]any{"foo": "bar"}},
			},
			expected: nil,
			expectedErr: &client.APIResponseError{
				StatusCode: http.StatusForbidden,
				ErrorResponse: &controller.ErrorResponse{
					Message: `virus found: Win.Test.EICAR_HDB-1`,
					Data: map[string]any{
						"file":  "eicarcom2.zip",
						"virus": "Win.Test.EICAR_HDB-1",
					},
				},
				Response: &controller.UploadFileResponse{
					ProcessedFiles: []controller.FileMetadata{
						{
							ID:         id3,
							Name:       "alphabet.txt",
							Size:       63,
							BucketID:   "default",
							ETag:       `"588be441fe7a59460850b0aa3e1c5a65"`,
							CreatedAt:  "2023-08-16T11:21:08.976158+00:00",
							UpdatedAt:  "2023-08-16T11:21:08.980238+00:00",
							IsUploaded: true,
							MimeType:   "text/plain; charset=utf-8",
						},
						{
							ID:         id4,
							Name:       "greek.txt",
							Size:       103,
							BucketID:   "default",
							ETag:       `"d4b4575c5af8c28b4486acd1051ddf37"`,
							CreatedAt:  "2023-08-16T11:21:08.983204+00:00",
							UpdatedAt:  "2023-08-16T11:21:08.986171+00:00",
							IsUploaded: true,
							MimeType:   "text/plain; charset=utf-8",
						},
					},
					Error: &controller.ErrorResponse{
						Message: `virus found: Win.Test.EICAR_HDB-1`,
						Data: map[string]any{
							"file":  "eicarcom2.zip",
							"virus": "Win.Test.EICAR_HDB-1",
						},
					},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := uploadFiles(t, cl, tc.files...)

			opts := cmp.Options{
				cmpopts.IgnoreFields(controller.FileMetadata{}, "CreatedAt", "UpdatedAt"),
			}

			if diff := cmp.Diff(err, tc.expectedErr, opts...); diff != "" {
				t.Error(diff)
			}

			if diff := cmp.Diff(got, tc.expected, opts...); diff != "" {
				t.Error(diff)
			}
		})
	}
}
