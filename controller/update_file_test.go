package controller_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock_controller"
	"github.com/sirupsen/logrus"
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
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := logrus.New()
			logger.SetLevel(logrus.ErrorLevel)

			file := fakeFile{
				"some content", fakeFileMetadata{"a_file.txt", uuid.New().String()},
			}

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock_controller.NewMockMetadataStorage(c)
			contentStorage := mock_controller.NewMockContentStorage(c)

			metadataStorage.EXPECT().GetFileByID(
				gomock.Any(), file.md.ID, gomock.Any(),
			).Return(
				controller.FileMetadataWithBucket{
					FileMetadata: controller.FileMetadata{
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
					Bucket: controller.BucketMetadata{
						ID:                   "blah",
						MinUploadFile:        0,
						MaxUploadFile:        100,
						PresignedURLsEnabled: true,
						DownloadExpiration:   30,
						CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
						UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
					},
				},
				nil,
			)

			metadataStorage.EXPECT().SetIsUploaded(
				gomock.Any(), file.md.ID, false, gomock.Any(),
			).Return(nil)

			contentStorage.EXPECT().PutFile(
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
				},
				nil)

			ctrl := controller.New("http://asd", "asdasd", metadataStorage, contentStorage, logger)

			router, _ := ctrl.SetupRouter(nil, ginLogger(logger))

			body, contentType := createUpdateMultiForm(t, file)

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(context.Background(), "PUT", "/v1/storage/files/"+file.md.ID, body)

			req.Header.Add("x-hasura-user-id", "some-valid-uuid")

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
				},
				nil,
			}, resp,
				cmpopts.IgnoreFields(controller.FileMetadata{}, "ID", "CreatedAt", "UpdatedAt"),
			)
		})
	}
}
