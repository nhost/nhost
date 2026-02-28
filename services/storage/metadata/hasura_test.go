//go:build integration

package metadata_test

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/metadata"
)

const (
	hasuraURL = "http://localhost:8080/v1/graphql"
)

func getAuthHeader() http.Header {
	headers := http.Header{}
	bearer := os.Getenv("HASURA_AUTH_BEARER")
	headers.Add("Authorization", "Bearer "+bearer)

	return headers
}

func TestGetBucketByID(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                   string
		bucketID               string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
		expected               controller.BucketMetadata
	}{
		{
			name:                   "success",
			bucketID:               "default",
			headers:                getAuthHeader(),
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
			expected: controller.BucketMetadata{
				ID:                   "default",
				MinUploadFile:        1,
				MaxUploadFile:        50000000,
				PresignedURLsEnabled: true,
				DownloadExpiration:   30,
				CreatedAt:            "",
				UpdatedAt:            "",
				CacheControl:         "max-age=3600",
			},
		},
		{
			name:               "not found",
			bucketID:           "asdsad",
			headers:            getAuthHeader(),
			expectedStatusCode: 404,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "bucket not found",
			},
			expected: controller.BucketMetadata{},
		},
		{
			name:               "not authorized",
			bucketID:           "asdsad",
			expectedStatusCode: 403,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
			expected: controller.BucketMetadata{},
		},
	}

	hasura := metadata.NewHasura(hasuraURL)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			bucket, err := hasura.GetBucketByID(context.Background(), tc.bucketID, tc.headers)

			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
			}

			if err != nil {
				if !cmp.Equal(err.PublicResponse(), tc.expectedPublicResponse) {
					t.Error(cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse))
				}
			} else {
				opts := cmp.Options{
					cmpopts.IgnoreFields(controller.BucketMetadata{}, "CreatedAt", "UpdatedAt"),
				}
				if !cmp.Equal(bucket, tc.expected, opts...) {
					t.Error(cmp.Diff(bucket, tc.expected, opts...))
				}
			}
		})
	}
}

func TestInitializeFile(t *testing.T) {
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
			fileID:                 uuid.New().String(),
			headers:                getAuthHeader(),
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
		},
		{
			name:               "wrong format",
			fileID:             "asdsad",
			headers:            getAuthHeader(),
			expectedStatusCode: 400,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: `{"networkErrors":null,"graphqlErrors":[{"message":"invalid input syntax for type uuid: \"asdsad\"","extensions":{"code":"data-exception","path":"$.selectionSet.insertFile.args.object"}}]}`,
			},
		},
		{
			name:               "not authorized",
			fileID:             "asdsad",
			expectedStatusCode: 403,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			hasura := metadata.NewHasura(hasuraURL)

			err := hasura.InitializeFile(
				context.Background(),
				tc.fileID,
				"name",
				123,
				"default",
				"mimetype",
				tc.headers,
			)

			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
			}
			if err != nil {
				if !cmp.Equal(err.PublicResponse(), tc.expectedPublicResponse) {
					t.Error(cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse))
				}
			}
		})
	}
}

func ptr[T any](v T) *T {
	return &v
}

func TestPopulateMetadata(t *testing.T) {
	t.Parallel()

	hasura := metadata.NewHasura(hasuraURL)

	fileID := uuid.New().String()
	if err := hasura.InitializeFile(
		context.Background(), fileID, "name", 123, "default", "mimetype", getAuthHeader(),
	); err != nil {
		panic(err)
	}

	cases := []struct {
		name                   string
		fileID                 string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
		expected               api.FileMetadata
	}{
		{
			name:                   "success",
			fileID:                 fileID,
			headers:                getAuthHeader(),
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
			expected: api.FileMetadata{
				Id:               fileID,
				Name:             "name",
				Size:             123,
				BucketId:         "default",
				Etag:             "asdasd",
				CreatedAt:        time.Time{},
				UpdatedAt:        time.Time{},
				IsUploaded:       true,
				MimeType:         "text",
				UploadedByUserId: nil,
				Metadata:         ptr[map[string]any](nil),
			},
		},
		{
			name:               "wrong format",
			fileID:             "asdasdasd",
			headers:            getAuthHeader(),
			expectedStatusCode: 400,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: `{"networkErrors":null,"graphqlErrors":[{"message":"invalid input syntax for type uuid: \"asdasdasd\"","extensions":{"code":"data-exception","path":"$"}}]}`,
			},
			expected: api.FileMetadata{},
		},
		{
			name:               "not found",
			fileID:             uuid.New().String(),
			headers:            getAuthHeader(),
			expectedStatusCode: 404,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "file not found",
			},
			expected: api.FileMetadata{},
		},
		{
			name:               "not authorized",
			expectedStatusCode: 403,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
			expected: api.FileMetadata{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := hasura.PopulateMetadata(
				context.Background(),
				tc.fileID,
				"name",
				123,
				"default",
				"asdasd",
				true,
				"text",
				nil,
				tc.headers,
			)

			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
			}
			if err != nil {
				if diff := cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse); diff != "" {
					t.Errorf("unexpected error response: %s", diff)
				}
			} else {
				opts := cmp.Options{
					cmpopts.IgnoreFields(api.FileMetadata{}, "CreatedAt", "UpdatedAt"),
				}
				if diff := cmp.Diff(got, tc.expected, opts...); diff != "" {
					t.Errorf("unexpected file metadata: %s", diff)
				}
			}
		})
	}
}

func TestGetFileByID(t *testing.T) {
	t.Parallel()

	hasura := metadata.NewHasura(hasuraURL)

	fileID := uuid.New().String()
	if err := hasura.InitializeFile(
		context.Background(), fileID, "name", 123, "default", "mimetype", getAuthHeader(),
	); err != nil {
		panic(err)
	}

	if _, err := hasura.PopulateMetadata(
		context.Background(),
		fileID,
		"name",
		123,
		"default",
		"asdasd",
		true,
		"text",
		nil,
		getAuthHeader(),
	); err != nil {
		panic(err)
	}

	cases := []struct {
		name                   string
		fileID                 string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
		expected               api.FileMetadata
	}{
		{
			name:                   "success",
			fileID:                 fileID,
			headers:                getAuthHeader(),
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
			expected: api.FileMetadata{
				Id:               fileID,
				Name:             "name",
				Size:             123,
				BucketId:         "default",
				Etag:             "asdasd",
				CreatedAt:        time.Time{},
				UpdatedAt:        time.Time{},
				IsUploaded:       true,
				MimeType:         "text",
				UploadedByUserId: nil,
				Metadata:         ptr[map[string]any](nil),
			},
		},
		{
			name:               "wrong format",
			fileID:             "asdasdasd",
			headers:            getAuthHeader(),
			expectedStatusCode: 400,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: `{"networkErrors":null,"graphqlErrors":[{"message":"invalid input syntax for type uuid: \"asdasdasd\"","extensions":{"code":"data-exception","path":"$"}}]}`,
			},
			expected: api.FileMetadata{},
		},
		{
			name:               "not found",
			fileID:             uuid.New().String(),
			headers:            getAuthHeader(),
			expectedStatusCode: 404,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "file not found",
			},
			expected: api.FileMetadata{},
		},
		{
			name:               "not authorized",
			expectedStatusCode: 403,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
			expected: api.FileMetadata{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got, err := hasura.GetFileByID(context.Background(), tc.fileID, tc.headers)

			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
			}
			if err != nil {
				if !cmp.Equal(err.PublicResponse(), tc.expectedPublicResponse) {
					t.Error(cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse))
				}
			} else {
				opts := cmp.Options{
					cmpopts.IgnoreFields(api.FileMetadata{}, "CreatedAt", "UpdatedAt"),
					cmpopts.IgnoreFields(controller.BucketMetadata{}, "CreatedAt", "UpdatedAt"),
				}
				if !cmp.Equal(got, tc.expected, opts...) {
					t.Error(cmp.Diff(got, tc.expected, opts...))
				}
			}
		})
	}
}

func TestSetIsUploaded(t *testing.T) {
	t.Parallel()

	hasura := metadata.NewHasura(hasuraURL)

	fileID := uuid.New().String()
	if err := hasura.InitializeFile(
		context.Background(), fileID, "name", 123, "default", "mimetype", getAuthHeader(),
	); err != nil {
		panic(err)
	}

	cases := []struct {
		name                   string
		fileID                 string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
	}{
		{
			name:                   "success",
			fileID:                 fileID,
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
				Message: `{"networkErrors":null,"graphqlErrors":[{"message":"invalid input syntax for type uuid: \"\"","extensions":{"code":"data-exception","path":"$"}}]}`,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := hasura.SetIsUploaded(context.Background(), tc.fileID, true, tc.headers)
			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
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

	hasura := metadata.NewHasura(hasuraURL)

	fileID := uuid.New().String()
	if err := hasura.InitializeFile(
		context.Background(), fileID, "name", 123, "default", "mimetype", getAuthHeader(),
	); err != nil {
		panic(err)
	}

	if _, err := hasura.PopulateMetadata(
		context.Background(),
		fileID,
		"name",
		123,
		"default",
		"asdasd",
		true,
		"text",
		nil,
		getAuthHeader(),
	); err != nil {
		panic(err)
	}

	cases := []struct {
		name                   string
		fileID                 string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
	}{
		{
			name:                   "success",
			fileID:                 fileID,
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
				Message: `{"networkErrors":null,"graphqlErrors":[{"message":"invalid input syntax for type uuid: \"\"","extensions":{"code":"data-exception","path":"$"}}]}`,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := hasura.DeleteFileByID(context.Background(), tc.fileID, tc.headers)
			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
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
	hasura := metadata.NewHasura(hasuraURL)

	fileID1 := uuid.New().String()
	if err := hasura.InitializeFile(
		context.Background(), fileID1, "name", 123, "default", "mimetype", getAuthHeader(),
	); err != nil {
		panic(err)
	}

	if _, err := hasura.PopulateMetadata(
		context.Background(),
		fileID1,
		"name",
		123,
		"default",
		"asdasd",
		true,
		"text",
		nil,
		getAuthHeader(),
	); err != nil {
		panic(err)
	}

	fileID2 := uuid.New().String()
	if err := hasura.InitializeFile(
		context.Background(), fileID2, "name", 123, "default", "mimetype", getAuthHeader(),
	); err != nil {
		panic(err)
	}

	if _, err := hasura.PopulateMetadata(
		context.Background(),
		fileID2,
		"asdads",
		123,
		"default",
		"asdasd",
		true,
		"text",
		nil,
		getAuthHeader(),
	); err != nil {
		panic(err)
	}

	cases := []struct {
		name                   string
		headers                http.Header
		expectedStatusCode     int
		expectedPublicResponse *controller.ErrorResponse
	}{
		{
			name:                   "success",
			headers:                getAuthHeader(),
			expectedStatusCode:     0,
			expectedPublicResponse: &controller.ErrorResponse{},
		},
		{
			name:               "unauthorized",
			headers:            map[string][]string{},
			expectedStatusCode: 403,
			expectedPublicResponse: &controller.ErrorResponse{
				Message: "you are not authorized",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := hasura.ListFiles(context.Background(), tc.headers)
			if tc.expectedStatusCode != err.StatusCode() {
				t.Errorf(
					"wrong status code, expected %d, got %d",
					tc.expectedStatusCode,
					err.StatusCode(),
				)
			}

			if err != nil {
				if diff := cmp.Diff(err.PublicResponse(), tc.expectedPublicResponse); diff != "" {
					t.Errorf("unexpected error response: %s", diff)
				}
			} else {
				if len(got) == 0 {
					t.Error("we got an empty list")
				}

				found1 := false
				found2 := false
				for _, f := range got {
					switch f.ID {
					case fileID1:
						found1 = true
					case fileID2:
						found2 = true
					}
				}
				if !found1 || !found2 {
					t.Error("couldn't find some files in the list")
				}
			}
		})
	}
}
