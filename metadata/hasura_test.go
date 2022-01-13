// +build integration

package metadata_test

import (
	"context"
	"net/http"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/metadata"
)

func getAuthHeader() http.Header {
	headers := http.Header{}

	bearer := os.Getenv("HASURA_AUTH_BEARER")
	headers.Add("Authorization", "Bearer "+bearer)

	return headers
}

func TestSetUploadPending(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                   string
		fileID                 string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
	}{
		{
			name:                   "success",
			fileID:                 "fe07bc9c-2a18-42b4-817f-97cfdc8f79bb",
			headers:                getAuthHeader(),
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
		},
		{
			name:               "file not found",
			fileID:             "aaaaaaaa-1111-bbbb-2222-cccccccccccc",
			headers:            getAuthHeader(),
			expectedStatusCode: http.StatusNotFound,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "file not found",
			},
		},
		{
			name:               "not authorized",
			fileID:             "aaaaaaaa-1111-bbbb-2222-cccccccccccc",
			headers:            map[string][]string{},
			expectedStatusCode: http.StatusForbidden,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
		},
		{
			name:               "wrong id",
			fileID:             "",
			headers:            getAuthHeader(),
			expectedStatusCode: http.StatusBadRequest,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "Message: invalid input syntax for type uuid: \"\", Locations: []",
			},
		},
	}

	hasura := metadata.NewHasura("http://localhost:8080/v1/graphql", metadata.ForWardHeadersAuthorizer)

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc

			err := hasura.SetIsUploaded(context.Background(), tc.fileID, true, tc.headers)
			if err != nil && tc.expectedStatusCode == 0 {
				t.Error(err)
			}

			if err != nil {
				if !cmp.Equal(err.PublicResponse(), tc.expectedPublicResponse) {
					t.Error(cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse))
				}
			}
		})
	}
}
