package controller_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/nhost/nhost/services/storage/metadata"
	gomock "go.uber.org/mock/gomock"
)

func TestDeleteOrphans(t *testing.T) {
	t.Parallel()

	const orphanID = "e6aad336-ad79-4df7-a09b-5782f71948f4"

	lookupError := controller.InternalServerError(context.DeadlineExceeded)
	otherNotFound := controller.NewAPIError(
		http.StatusNotFound, "unexpected resource missing", io.EOF, nil,
	)
	deleteError := controller.InternalServerError(io.ErrUnexpectedEOF)

	cases := []struct {
		name          string
		orphanKey     string
		checkMetadata bool
		lookupError   *controller.APIError
		deleteObject  bool
		deleteError   *controller.APIError
		expectedFiles []string
		expectedError *controller.APIError
	}{
		{
			name:          "successful",
			orphanKey:     "default/garbage",
			deleteObject:  true,
			expectedFiles: []string{"default/garbage"},
		},
		{
			name:          "UUID orphan",
			orphanKey:     "default/" + orphanID,
			checkMetadata: true,
			lookupError:   controller.ErrFileNotFound,
			deleteObject:  true,
			expectedFiles: []string{"default/" + orphanID},
		},
		{
			name:          "metadata now exists",
			orphanKey:     "default/" + orphanID,
			checkMetadata: true,
			expectedFiles: []string{},
		},
		{
			name:          "metadata lookup fails closed",
			orphanKey:     "default/" + orphanID,
			checkMetadata: true,
			lookupError:   lookupError,
			expectedError: lookupError,
		},
		{
			name:          "unrelated not found error fails closed",
			orphanKey:     "default/" + orphanID,
			checkMetadata: true,
			lookupError:   otherNotFound,
			expectedError: otherNotFound,
		},
		{
			name:          "content deletion fails",
			orphanKey:     "default/" + orphanID,
			checkMetadata: true,
			lookupError:   controller.ErrFileNotFound,
			deleteObject:  true,
			deleteError:   deleteError,
			expectedError: deleteError,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := slog.New(
				slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}),
			)

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)
			adminHeaders := http.Header{"x-hasura-admin-secret": []string{"test-admin"}}

			gomock.InOrder(
				contentStorage.EXPECT().ListFiles(gomock.Any()).Return(
					[]string{
						"default/b3b4e653-ca59-412c-a165-92d251c3fe86",
						"default/7dc0b0d0-b100-4667-89f1-0434942d9c15",
						tc.orphanKey,
					}, nil,
				),
				metadataStorage.EXPECT().ListFiles(gomock.Any(), adminHeaders).Return(
					[]controller.FileSummary{
						{
							ID:         "b3b4e653-ca59-412c-a165-92d251c3fe86",
							Name:       "file-1.txt",
							IsUploaded: true,
							BucketID:   "default",
						},
						{
							ID:         "7dc0b0d0-b100-4667-89f1-0434942d9c15",
							Name:       "file-two.txt",
							IsUploaded: true,
							BucketID:   "default",
						},
					}, nil,
				),
			)

			var lookup *gomock.Call
			if tc.checkMetadata {
				lookup = metadataStorage.EXPECT().GetFileByID(
					gomock.Any(), orphanID, adminHeaders,
				).Return(api.FileMetadata{}, tc.lookupError)
			}

			if tc.deleteObject {
				deletion := contentStorage.EXPECT().DeleteFile(
					gomock.Any(), tc.orphanKey,
				).Return(tc.deleteError)
				if lookup != nil {
					deletion.After(lookup)
				}
			}

			ctrl := controller.New(
				"http://asd", "/v1", "test-admin",
				metadataStorage, contentStorage, nil, nil, logger,
			)

			resp, err := ctrl.DeleteOrphanedFiles(
				t.Context(), api.DeleteOrphanedFilesRequestObject{},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tc.expectedError != nil {
				if resp != tc.expectedError {
					t.Fatalf("expected API error %v, got %v", tc.expectedError, resp)
				}

				return
			}

			assert(t, api.DeleteOrphanedFiles200JSONResponse{Files: &tc.expectedFiles}, resp)
		})
	}
}

func TestDeleteOrphansPendingMetadata(t *testing.T) {
	t.Parallel()

	const (
		pendingID  = "e6aad336-ad79-4df7-a09b-5782f71948f4"
		pendingKey = "default/" + pendingID
		orphanID   = "b3b4e653-ca59-412c-a165-92d251c3fe86"
		orphanKey  = "default/" + orphanID
	)

	// Use the real Hasura adapter: InitializeFile leaves etag NULL until
	// PopulateMetadata completes, even though the row already protects the ID.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var request struct {
			OperationName string `json:"operationName"`
			Variables     struct {
				ID string `json:"id"`
			} `json:"variables"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decoding GraphQL request: %v", err)
			http.Error(w, "invalid request", http.StatusBadRequest)

			return
		}

		if r.Header.Get("x-hasura-admin-secret") != "test-admin" {
			t.Error("expected admin metadata lookup")
			http.Error(w, "missing admin header", http.StatusForbidden)

			return
		}

		var response string
		switch request.OperationName {
		case "ListFilesSummary":
			// The pending row is created after this metadata snapshot.
			response = `{"data":{"files":[]}}`
		case "GetFile":
			switch request.Variables.ID {
			case pendingID:
				response = `{"data":{"file":{
					"id":"` + pendingID + `", "bucketId":"default",
					"name":"file.txt", "size":123, "mimeType":"text/plain",
					"etag":null, "isUploaded":false,
					"createdAt":"2026-01-01T00:00:00Z", "updatedAt":"2026-01-01T00:00:00Z",
					"metadata":null, "uploadedByUserId":null
				}}}`
			case orphanID:
				response = `{"data":{"file":null}}`
			}
		}

		if response == "" {
			t.Errorf(
				"unexpected GraphQL operation %q for ID %q",
				request.OperationName,
				request.Variables.ID,
			)
			http.Error(w, "unexpected request", http.StatusBadRequest)

			return
		}

		w.Header().Set("Content-Type", "application/json")

		if _, err := io.WriteString(w, response); err != nil {
			t.Errorf("writing GraphQL response: %v", err)
		}
	}))
	defer server.Close()

	c := gomock.NewController(t)
	contentStorage := mock.NewMockContentStorage(c)
	gomock.InOrder(
		contentStorage.EXPECT().ListFiles(gomock.Any()).Return(
			[]string{"default/garbage", pendingKey, orphanKey}, nil,
		),
		contentStorage.EXPECT().DeleteFile(gomock.Any(), "default/garbage").Return(nil),
		contentStorage.EXPECT().DeleteFile(gomock.Any(), orphanKey).Return(nil),
	)

	ctrl := controller.New(
		"http://asd", "/v1", "test-admin",
		metadata.NewHasura(server.URL), contentStorage, nil, nil, slog.Default(),
	)

	resp, err := ctrl.DeleteOrphanedFiles(t.Context(), api.DeleteOrphanedFilesRequestObject{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	assert(t, api.DeleteOrphanedFiles200JSONResponse{
		Files: &[]string{"default/garbage", orphanKey},
	}, resp)
}

func TestDeleteOrphansReupload(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name                 string
		initiallyHasMetadata bool
		uploadFinished       bool
	}{
		{
			name:           "existing orphan then re-upload",
			uploadFinished: true,
		},
		{
			name:                 "delete then re-upload between listings",
			initiallyHasMetadata: true,
			uploadFinished:       true,
		},
		{
			name: "re-upload still in progress",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			const (
				fileID = "e6aad336-ad79-4df7-a09b-5782f71948f4"
				key    = "default/" + fileID
			)

			hasMetadata := tc.initiallyHasMetadata
			content := "original"
			c := gomock.NewController(t)
			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)
			adminHeaders := http.Header{"x-hasura-admin-secret": []string{"test-admin"}}

			gomock.InOrder(
				contentStorage.EXPECT().ListFiles(gomock.Any()).DoAndReturn(
					func(context.Context) ([]string, *controller.APIError) {
						snapshot := []string{key}

						if hasMetadata {
							// The owner deletes the file after the S3 snapshot.
							hasMetadata = false
							content = ""
						}

						return snapshot, nil
					},
				),
				metadataStorage.EXPECT().ListFiles(gomock.Any(), adminHeaders).DoAndReturn(
					func(context.Context, http.Header) ([]controller.FileSummary, *controller.APIError) {
						if hasMetadata {
							t.Fatal("expected the metadata snapshot to omit the file")
						}

						// Re-upload the same ID after taking the metadata snapshot.
						hasMetadata = true
						content = "replacement"

						return []controller.FileSummary{}, nil
					},
				),
				metadataStorage.EXPECT().
					GetFileByID(gomock.Any(), fileID, adminHeaders).
					DoAndReturn(
						func(context.Context, string, http.Header) (api.FileMetadata, *controller.APIError) {
							if !hasMetadata {
								return api.FileMetadata{}, controller.ErrFileNotFound
							}

							file := api.FileMetadata{}
							file.Id = fileID
							file.IsUploaded = tc.uploadFinished

							return file, nil
						},
					),
			)
			contentStorage.EXPECT().DeleteFile(gomock.Any(), key).DoAndReturn(
				func(context.Context, string) *controller.APIError {
					t.Error("cleanup must not delete a re-uploaded file")

					content = ""

					return nil
				},
			).MaxTimes(1)

			ctrl := controller.New(
				"http://asd", "/v1", "test-admin",
				metadataStorage, contentStorage, nil, nil, slog.Default(),
			)

			resp, err := ctrl.DeleteOrphanedFiles(
				t.Context(),
				api.DeleteOrphanedFilesRequestObject{},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, api.DeleteOrphanedFiles200JSONResponse{Files: &[]string{}}, resp)

			if !hasMetadata || content != "replacement" {
				t.Fatalf("re-upload lost: metadata present=%v, content=%q", hasMetadata, content)
			}
		})
	}
}
