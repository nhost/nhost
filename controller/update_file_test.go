package controller_test

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

func createUpdateMultiForm(t *testing.T, file fakeFile) (io.Reader, string) {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

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

	return bytes.NewReader(body.Bytes()), writer.FormDataContentType()
}

func TestUpdateFile(t *testing.T) {
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
				controller.FileMetadata{
					ID:               file.md.ID,
					Name:             file.md.Name,
					Size:             int64(len(file.contents)),
					BucketID:         "blah",
					ETag:             "some-etag",
					CreatedAt:        "", // ignored
					UpdatedAt:        "", // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserID: "some-valid-uuid",
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
				controller.FileMetadata{
					ID:               file.md.ID,
					Name:             file.md.Name,
					Size:             int64(len(file.contents)),
					BucketID:         "blah",
					ETag:             "some-etag",
					CreatedAt:        "", // ignored
					UpdatedAt:        "", // ignored
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserID: "some-valid-uuid",
					Metadata:         map[string]any{"some": "metadata"},
				},
				nil)

			av.EXPECT().ScanReader(gomock.Any()).Return(nil)

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

			router, _ := ctrl.SetupRouter(nil, "/v1", []string{"*"}, false, ginLogger(logger))

			body, contentType := createUpdateMultiForm(t, file)

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(
				t.Context(),
				"PUT",
				"/v1/files/"+file.md.ID,
				body,
			)

			req.Header.Add("X-Hasura-User-Id", "some-valid-uuid")

			req.Header.Set("Content-Type", contentType)

			router.ServeHTTP(responseRecorder, req)

			assert(t, 200, responseRecorder.Code)

			resp := &controller.UpdateFileResponse{}
			if err := json.Unmarshal(responseRecorder.Body.Bytes(), &resp); err != nil {
				t.Fatal(err)
			}
			assert(t, &controller.UpdateFileResponse{
				&controller.FileMetadata{
					ID:               "38288c85-02af-416b-b075-11c4dae9",
					Name:             "a_file.txt",
					Size:             12,
					BucketID:         "blah",
					ETag:             "some-etag",
					CreatedAt:        "",
					UpdatedAt:        "",
					IsUploaded:       true,
					MimeType:         "text/plain; charset=utf-8",
					UploadedByUserID: "some-valid-uuid",
					Metadata:         map[string]any{"some": "metadata"},
				},
				nil,
			}, resp,
				cmpopts.IgnoreFields(controller.FileMetadata{}, "ID", "CreatedAt", "UpdatedAt"),
			)
		})
	}
}
