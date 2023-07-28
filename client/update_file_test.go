//go:build integration
// +build integration

package client_test

import (
	"os"
	"path"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

func updateFile(
	t *testing.T, cl *client.Client, fileID string, file fileHelper,
) (*controller.UpdateFileResponse, error) {
	t.Helper()

	f, err := os.Open(file.path)
	if err != nil {
		t.Fatal(err)
	}

	fileToUpload := client.NewFile(path.Base(file.path), f, client.WithUUID(file.id))

	return cl.UpdateFile(context.Background(), fileID, fileToUpload)
}

func TestUpdateFile(t *testing.T) {
	baseURL := "http://localhost:8000/v1"
	cl := client.New(baseURL, os.Getenv("HASURA_AUTH_BEARER"))

	id1 := uuid.NewString()

	file := fileHelper{
		path: "testdata/alphabet.txt",
		id:   id1,
	}

	_, err := uploadFiles(t, cl, file)
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name        string
		fileID      string
		file        fileHelper
		expected    *controller.UpdateFileResponse
		expectedErr error
	}{
		{
			name:   "success",
			fileID: id1,
			file: fileHelper{
				"testdata/rick.gif", id1,
			},
			expected: &controller.UpdateFileResponse{
				FileMetadata: &controller.FileMetadata{
					ID:         id1,
					Name:       "rick.gif",
					Size:       51271,
					BucketID:   "default",
					ETag:       `"40dca5f6097e48ee06aa7c3177fd44bd"`,
					CreatedAt:  "2022-01-18T12:58:16.754894+00:00",
					UpdatedAt:  "2022-01-18T12:58:16.839344+00:00",
					IsUploaded: true,
					MimeType:   "image/gif",
				},
			},
		},
		{
			name:   "wrong id",
			fileID: "asdadasdads",
			file: fileHelper{
				"testdata/rick.gif", id1,
			},
			expectedErr: &client.APIResponseError{
				StatusCode: 400,
				ErrorResponse: &controller.ErrorResponse{
					Message: "Message: invalid input syntax for type uuid: \"asdadasdads\", Locations: [], Extensions: map[code:data-exception path:$]",
				},
				Response: nil,
			},
		},
		{
			name:   "not found",
			fileID: "08c75a05-1b6a-42aa-b5ba-d9e1d5f3e8ca",
			file: fileHelper{
				"testdata/rick.gif", id1,
			},
			expectedErr: &client.APIResponseError{
				StatusCode: 404,
				ErrorResponse: &controller.ErrorResponse{
					Message: "file not found",
				},
				Response: nil,
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tc := tc

			got, err := updateFile(t, cl, tc.fileID, tc.file)

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
