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

func TestDeleteFileByID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                   string
		fileID                 string
		headers                http.Header
		expectedMd             controller.FileMetadataWithBucket
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
	}{
		{
			name:    "success",
			fileID:  "57bddc2b-fdc6-4af2-9dba-5ee689936619",
			headers: getAuthHeader(),
			expectedMd: controller.FileMetadataWithBucket{
				FileMetadata: controller.FileMetadata{
					ID:               "57bddc2b-fdc6-4af2-9dba-5ee689936619",
					Name:             "some-file.txt",
					Size:             17,
					BucketID:         "default",
					ETag:             "\"nbdfgyrejhg324hjgadnbv\"",
					CreatedAt:        "2022-01-04T16:47:37.762868+00:00",
					UpdatedAt:        "2022-01-04T16:47:37.762868+00:00",
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserID: "a3dcdb8f-d1c7-4cfb-829b-57881633dadc",
				},
				Bucket: controller.BucketMetadata{
					ID:                   "default",
					MinUploadFile:        1,
					MaxUploadFile:        50000000,
					PresignedURLsEnabled: true,
					DownloadExpiration:   30,
					CreatedAt:            "2022-01-05T19:02:58.387709+00:00",
					UpdatedAt:            "2022-01-05T19:02:58.387709+00:00",
					CacheControl:         "max-age=3600",
				},
			},
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

			md, err := hasura.DeleteFileByID(context.Background(), tc.fileID, tc.headers)
			if err != nil && tc.expectedStatusCode == 0 {
				t.Error(err)
			} else {
				if !cmp.Equal(md, tc.expectedMd) {
					t.Error(cmp.Diff(md, tc.expectedMd))
				}
			}

			if err != nil {
				if !cmp.Equal(err.PublicResponse(), tc.expectedPublicResponse) {
					t.Error(cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse))
				}
			}
		})
	}
}

func TestListFiles(t *testing.T) {
	cases := []struct {
		name                   string
		headers                http.Header
		expectedList           []controller.FileSummary
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
	}{
		{
			name:    "success",
			headers: getAuthHeader(),
			expectedList: []controller.FileSummary{
				{
					ID:         "fe07bc9c-2a18-42b4-817f-97cfdc8f79bb",
					Name:       "some-file.txt",
					IsUploaded: true,
					BucketID:   "default",
				},
				{
					ID:         "57bddc2b-fdc6-4af2-9dba-5ee689936619",
					Name:       "some-file.txt",
					IsUploaded: true,
					BucketID:   "default",
				},
			},
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
		},
		{
			name:               "unauthorized",
			headers:            map[string][]string{},
			expectedList:       nil,
			expectedStatusCode: 503,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
		},
	}

	hasura := metadata.NewHasura("http://localhost:8080/v1/graphql", metadata.ForWardHeadersAuthorizer)

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tc := tc

			md, err := hasura.ListFiles(context.Background(), tc.headers)
			if err != nil && tc.expectedStatusCode == 0 {
				t.Error(err)
			} else {
				if !cmp.Equal(md, tc.expectedList) {
					t.Error(cmp.Diff(md, tc.expectedList))
				}
			}

			if err != nil {
				if !cmp.Equal(err.PublicResponse(), tc.expectedPublicResponse) {
					t.Error(cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse))
				}
			}
		})
	}
}
