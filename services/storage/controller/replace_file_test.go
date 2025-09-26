package controller_test

import (
	"bytes"
	"io"
	"mime/multipart"
	"strings"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/controller"
	"github.com/nhost/nhost/services/storage/controller/mock"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

func createReplaceMultiForm(t *testing.T, file fakeFile) *multipart.Reader {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Store the boundary before we close the writer
	boundary := writer.Boundary()

	formWriter, err := writer.CreateFormFile("file", file.md.Name)
	if err != nil {
		t.Fatal(err)
	}

	_, err = io.Copy(formWriter, strings.NewReader(file.contents))
	if err != nil {
		t.Fatal(err)
	}

	formWriter, err = writer.CreateFormField("metadata")
	if err != nil {
		t.Fatal(err)
	}

	_, err = io.Copy(formWriter, strings.NewReader(file.md.encode()))
	if err != nil {
		t.Fatal(err)
	}

	writer.Close()

	// Create and return a multipart.Reader
	return multipart.NewReader(bytes.NewReader(body.Bytes()), boundary)
}

func TestReplaceFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
	}{
		{
			name: "successful",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := logrus.New()
			logger.SetLevel(logrus.ErrorLevel)

			file := fakeFile{
				contents:    "some content",
				contentType: "",
				md: fakeFileMetadata{
					Name: "a_file.txt",
					ID:   uuid.New().String(),
					Metadata: map[string]any{
						"some": "metadata",
					},
				},
			}

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)
			av := mock.NewMockAntivirus(c)

			metadataStorage.EXPECT().GetFileByID(
				gomock.Any(), file.md.ID, gomock.Any(),
			).Return(
				api.FileMetadata{
					Id:               file.md.ID,
					Name:             file.md.Name,
					Size:             int64(len(file.contents)),
					BucketId:         "blah",
					Etag:             "some-etag",
					CreatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC), // ignored
					UpdatedAt:        time.Date(2021, 12, 27, 9, 58, 11, 0, time.UTC), // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserId: ptr("some-valid-uuid"),
				},
				nil,
			)
			metadataStorage.EXPECT().GetBucketByID(
				gomock.Any(), "blah", gomock.Any(),
			).Return(
				controller.BucketMetadata{
					ID:                   "blah",
					MinUploadFile:        0,
					MaxUploadFile:        100,
					PresignedURLsEnabled: true,
					DownloadExpiration:   30,
					CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
					UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
				},
				nil,
			)

			metadataStorage.EXPECT().SetIsUploaded(
				gomock.Any(), file.md.ID, false, gomock.Any(),
			).Return(nil)

			contentStorage.EXPECT().PutFile(
				gomock.Any(),
				ReaderMatcher(
					file.contents,
				),
				file.md.ID,
				"text/plain; charset=utf-8",
			).Return("some-etag", nil)

			metadataStorage.EXPECT().PopulateMetadata(
				gomock.Any(),
				file.md.ID,
				file.md.Name,
				int64(len(file.contents)),
				"blah",
				"some-etag",
				true,
				"text/plain; charset=utf-8",
				file.md.Metadata,
				gomock.Any(),
			).Return(
				api.FileMetadata{
					Id:               file.md.ID,
					Name:             file.md.Name,
					Size:             int64(len(file.contents)),
					BucketId:         "blah",
					Etag:             "some-etag",
					CreatedAt:        time.Time{}, // ignored
					UpdatedAt:        time.Time{}, // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserId: ptr("some-valid-uuid"),
					Metadata:         ptr(map[string]any{"some": "metadata"}),
				},
				nil)

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
					Id:   file.md.ID,
					Body: createReplaceMultiForm(t, file),
				},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, api.ReplaceFile200JSONResponse{
				Id:               file.md.ID,
				Name:             "a_file.txt",
				Size:             12,
				BucketId:         "blah",
				Etag:             "some-etag",
				CreatedAt:        time.Time{}, // ignored
				UpdatedAt:        time.Time{}, // ignored
				IsUploaded:       true,
				MimeType:         "text/plain; charset=utf-8",
				UploadedByUserId: ptr("some-valid-uuid"),
				Metadata:         ptr(map[string]any{"some": "metadata"}),
			}, resp,
				cmpopts.IgnoreFields(api.FileMetadata{}, "Id", "CreatedAt", "UpdatedAt"),
			)
		})
	}
}
