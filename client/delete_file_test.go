// +build integration

package client_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
	"github.com/nhost/hasura-storage/controller"
)

func TestDeleteFile(t *testing.T) {
	baseURL := "http://localhost:8000/api/v1"
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
		expectedErr error
	}{
		{
			name:   "success",
			fileID: id1,
		},
		{
			name:   "wrong id",
			fileID: "asdadasdads",
			expectedErr: &client.APIResponseError{
				StatusCode: 400,
				ErrorResponse: &controller.ErrorResponse{
					Message: `Message: invalid input syntax for type uuid: "asdadasdads", Locations: []`,
				},
				Response: nil,
			},
		},
		{
			name:   "not found",
			fileID: "08c75a05-1b6a-42aa-b5ba-d9e1d5f3e8ca",
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

			err := cl.DeleteFile(context.Background(), tc.fileID)

			if !cmp.Equal(err, tc.expectedErr) {
				t.Error(cmp.Diff(err, tc.expectedErr))
			}

			if err == nil {
				_, err := cl.GetFile(context.Background(), tc.fileID)
				fileNotFoundErr := &client.APIResponseError{
					StatusCode: 404,
					ErrorResponse: &controller.ErrorResponse{
						Message: "file not found",
					},
					Response: nil,
				}
				if !cmp.Equal(err, fileNotFoundErr) {
					t.Error(cmp.Diff(err, fileNotFoundErr))
				}
			}
		})
	}
}
