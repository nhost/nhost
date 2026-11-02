package controller_test

import (
	"bytes"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	gomock "go.uber.org/mock/gomock"
)

func createReplaceMultiForm(t *testing.T, filename, contents, metadata string) *multipart.Reader {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	boundary := writer.Boundary()

	formWriter, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}

	_, err = io.Copy(formWriter, strings.NewReader(contents))
	if err != nil {
		t.Fatal(err)
	}

	if metadata != "" {
		formWriter, err = writer.CreateFormField("metadata")
		if err != nil {
			t.Fatal(err)
		}

		_, err = io.Copy(formWriter, strings.NewReader(metadata))
		if err != nil {
			t.Fatal(err)
		}
	}

	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	return multipart.NewReader(bytes.NewReader(body.Bytes()), boundary)
}

func TestReplaceFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		contents         string
		filename         string
		metadata         string
		expectedName     string
		expectedMetadata map[string]any
	}{
		{
			name:             "metadata name overrides multipart filename",
			contents:         "some content",
			filename:         "upload.txt",
			metadata:         `{"name":"renamed.txt","metadata":{"some":"metadata"}}`,
			expectedName:     "renamed.txt",
			expectedMetadata: map[string]any{"some": "metadata"},
		},
		{
			name:             "successful with large file exceeding maxFormMemory",
			contents:         strings.Repeat("x", 1<<20+1),
			filename:         "a_file.txt",
			metadata:         `{"name":"a_file.txt","metadata":{"some":"metadata"}}`,
			expectedName:     "a_file.txt",
			expectedMetadata: map[string]any{"some": "metadata"},
		},
		{
			name:             "metadata omits name",
			contents:         "some content",
			filename:         "upload.txt",
			metadata:         `{"metadata":{"department":"finance"}}`,
			expectedName:     "upload.txt",
			expectedMetadata: map[string]any{"department": "finance"},
		},
		{
			name:             "metadata name is empty",
			contents:         "some content",
			filename:         "upload.txt",
			metadata:         `{"name":"","metadata":{"department":"finance"}}`,
			expectedName:     "upload.txt",
			expectedMetadata: map[string]any{"department": "finance"},
		},
		{
			name:             "no metadata part",
			contents:         "some content",
			filename:         "upload.txt",
			metadata:         "",
			expectedName:     "upload.txt",
			expectedMetadata: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := slog.New(
				slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}),
			)

			fileID := uuid.New().String()

			var responseMetadata *map[string]any
			if tc.expectedMetadata != nil {
				responseMetadata = new(tc.expectedMetadata)
			}

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)
			av := mock.NewMockAntivirus(c)

			metadataStorage.EXPECT().GetFileByID(
				gomock.Any(), fileID, gomock.Any(),
			).Return(
				api.FileMetadata{
					Id:               fileID,
					Name:             "original.txt",
					Size:             int64(len(tc.contents)),
					BucketId:         "blah",
					Etag:             "some-etag",
					CreatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC), // ignored
					UpdatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC), // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserId: new("some-valid-uuid"),
				},
				nil,
			)
			metadataStorage.EXPECT().GetBucketByID(
				gomock.Any(), "blah", gomock.Any(),
			).Return(
				controller.BucketMetadata{
					ID:                   "blah",
					MinUploadFile:        0,
					MaxUploadFile:        2 << 20,
					PresignedURLsEnabled: true,
					DownloadExpiration:   30,
					CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
					UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
				},
				nil,
			)

			metadataStorage.EXPECT().SetIsUploaded(
				gomock.Any(), fileID, false, gomock.Any(),
			).Return(nil)

			contentStorage.EXPECT().PutFile(
				gomock.Any(),
				ReaderMatcher(
					tc.contents,
				),
				fileID,
				"text/plain; charset=utf-8",
			).Return("some-etag", nil)

			metadataStorage.EXPECT().PopulateMetadata(
				gomock.Any(),
				fileID,
				tc.expectedName,
				int64(len(tc.contents)),
				"blah",
				"some-etag",
				true,
				"text/plain; charset=utf-8",
				tc.expectedMetadata,
				gomock.Any(),
			).Return(
				api.FileMetadata{
					Id:               fileID,
					Name:             tc.expectedName,
					Size:             int64(len(tc.contents)),
					BucketId:         "blah",
					Etag:             "some-etag",
					CreatedAt:        time.Time{}, // ignored
					UpdatedAt:        time.Time{}, // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserId: new("some-valid-uuid"),
					Metadata:         responseMetadata,
				},
				nil,
			)

			av.EXPECT().ScanReader(gomock.Any(), gomock.Any()).Return(nil)

			ctrl := controller.New(
				"http://asd",
				"/v1",
				"asdasd",
				metadataStorage,
				contentStorage,
				nil,
				av,
				logger,
			)

			resp, err := ctrl.ReplaceFile(
				t.Context(),
				api.ReplaceFileRequestObject{
					Id:   fileID,
					Body: createReplaceMultiForm(t, tc.filename, tc.contents, tc.metadata),
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(
				t, api.ReplaceFile200JSONResponse{
					Id:               fileID,
					Name:             tc.expectedName,
					Size:             int64(len(tc.contents)),
					BucketId:         "blah",
					Etag:             "some-etag",
					CreatedAt:        time.Time{}, // ignored
					UpdatedAt:        time.Time{}, // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserId: new("some-valid-uuid"),
					Metadata:         responseMetadata,
				}, resp,
				cmpopts.IgnoreFields(api.FileMetadata{}, "Id", "CreatedAt", "UpdatedAt"),
			)
		})
	}
}

func TestReplaceFile_FileSize(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name            string
		contents        string
		minUploadFile   int
		maxUploadFile   int
		expectedMessage string
		expectedData    map[string]any
	}{
		{
			name:            "file too big",
			contents:        strings.Repeat("a", 100),
			minUploadFile:   0,
			maxUploadFile:   10,
			expectedMessage: "file too big",
			expectedData: map[string]any{
				"filename": "big.txt",
				"size":     100,
				"maxSize":  10,
			},
		},
		{
			name:            "file too small",
			contents:        "tiny",
			minUploadFile:   100,
			maxUploadFile:   1 << 20,
			expectedMessage: "file too small",
			expectedData: map[string]any{
				"filename": "big.txt",
				"size":     4,
				"minSize":  100,
			},
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
			av := mock.NewMockAntivirus(c)

			file := fakeFile{
				contents:    tc.contents,
				contentType: "",
				md: fakeFileMetadata{
					Name:     "big.txt",
					ID:       uuid.New().String(),
					Metadata: map[string]any{},
				},
			}

			metadataStorage.EXPECT().GetFileByID(
				gomock.Any(), file.md.ID, gomock.Any(),
			).Return(
				api.FileMetadata{
					Id:         file.md.ID,
					Name:       file.md.Name,
					BucketId:   "blah",
					IsUploaded: true,
				},
				nil,
			)
			metadataStorage.EXPECT().GetBucketByID(
				gomock.Any(), "blah", gomock.Any(),
			).Return(
				controller.BucketMetadata{
					ID:                   "blah",
					MinUploadFile:        tc.minUploadFile,
					MaxUploadFile:        tc.maxUploadFile,
					PresignedURLsEnabled: false,
					DownloadExpiration:   30,
					CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
					UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
				},
				nil,
			)

			ctrl := controller.New(
				"http://asd",
				"/v1",
				"asdasd",
				metadataStorage,
				contentStorage,
				nil,
				av,
				logger,
			)

			resp, err := ctrl.ReplaceFile(
				t.Context(),
				api.ReplaceFileRequestObject{
					Id:   file.md.ID,
					Body: createReplaceMultiForm(t, file.md.Name, file.contents, file.md.encode()),
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			apiErr, ok := resp.(*controller.APIError)
			if !ok {
				t.Fatalf("expected *controller.APIError, got %T", resp)
			}

			assert(t, apiErr.StatusCode(), http.StatusBadRequest)
			assert(t, apiErr.PublicMessage(), tc.expectedMessage)
			assert(t, apiErr.PublicResponse(), &controller.ErrorResponse{
				Message: tc.expectedMessage,
				Data:    tc.expectedData,
			})
		})
	}
}
