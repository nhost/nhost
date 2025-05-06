package controller_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

type fakeFileMetadata struct {
	Name     string         `json:"name"`
	ID       string         `json:"id"`
	Metadata map[string]any `json:"metadata"`
}

func (f fakeFileMetadata) encode() string {
	b, err := json.Marshal(f)
	if err != nil {
		panic(err)
	}
	return string(b)
}

type fakeFile struct {
	contents    string
	contentType string
	md          fakeFileMetadata
}

func createMultiForm(t *testing.T, files ...fakeFile) (io.Reader, string) {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	formWriter, err := writer.CreateFormField("bucket-id")
	if err != nil {
		t.Fatal(err)
	}
	_, err = io.Copy(formWriter, strings.NewReader("blah"))
	if err != nil {
		t.Fatal(err)
	}

	for _, file := range files {
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition",
			fmt.Sprintf(`form-data; name="%s"; filename="%s"`,
				"file[]", file.md.Name))
		h.Set("Content-Type", file.contentType)
		formWriter, err := writer.CreatePart(h)
		if err != nil {
			t.Fatal(err)
		}
		_, err = io.Copy(formWriter, strings.NewReader(file.contents))
		if err != nil {
			t.Fatal(err)
		}

		formWriter, err = writer.CreateFormField("metadata[]")
		if err != nil {
			t.Fatal(err)
		}
		_, err = io.Copy(formWriter, strings.NewReader(file.md.encode()))
		if err != nil {
			t.Fatal(err)
		}
	}

	writer.Close()

	return bytes.NewReader(body.Bytes()), writer.FormDataContentType()
}

func TestUploadFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		presigned bool
	}{
		{
			name:      "successful with presigned URL",
			presigned: true,
		},
		{
			name:      "successful without presigned URL",
			presigned: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := logrus.New()
			logger.SetLevel(logrus.ErrorLevel)

			files := []fakeFile{
				{
					contents:    "some content",
					contentType: "",
					md: fakeFileMetadata{
						Name:     "a_file.txt",
						ID:       uuid.New().String(),
						Metadata: map[string]any{},
					},
				},
				{
					contents:    "more content",
					contentType: "text/markdown",
					md: fakeFileMetadata{
						Name:     "another_file.md",
						ID:       uuid.New().String(),
						Metadata: map[string]any{"some": "metadata"},
					},
				},
			}

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)
			av := mock.NewMockAntivirus(c)

			metadataStorage.EXPECT().GetBucketByID(
				gomock.Any(), "blah", gomock.Any(),
			).Return(controller.BucketMetadata{
				ID:                   "blah",
				MinUploadFile:        0,
				MaxUploadFile:        100,
				PresignedURLsEnabled: tc.presigned,
				DownloadExpiration:   30,
				CreatedAt:            "2021-12-15T13:26:52.082485+00:00",
				UpdatedAt:            "2021-12-15T13:26:52.082485+00:00",
			}, nil)

			{
				// file 1
				file := files[0]
				metadataStorage.EXPECT().InitializeFile(
					gomock.Any(),
					file.md.ID,
					file.md.Name,
					int64(len(file.contents)),
					"blah",
					"text/plain; charset=utf-8",
					gomock.Any(),
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
						Metadata:         map[string]any{},
					},
					nil)
			}

			{
				// file 2
				file := files[1]
				metadataStorage.EXPECT().InitializeFile(
					gomock.Any(),
					file.md.ID,
					file.md.Name,
					int64(len(file.contents)),
					"blah",
					"text/markdown",
					gomock.Any(),
				).Return(nil)

				contentStorage.EXPECT().PutFile(
					gomock.Any(),
					ReaderMatcher(
						file.contents,
					),
					file.md.ID,
					"text/markdown",
				).Return("some-etag", nil)

				metadataStorage.EXPECT().PopulateMetadata(
					gomock.Any(),
					file.md.ID,
					file.md.Name,
					int64(len(file.contents)),
					"blah",
					"some-etag",
					true,
					"text/markdown",
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
						MimeType:         "text/markdown",
						UploadedByUserID: "some-valid-uuid",
						Metadata:         map[string]any{"some": "metadata"},
					},
					nil)
			}

			av.EXPECT().ScanReader(gomock.Any()).Return(nil)
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

			body, contentType := createMultiForm(t, files...)

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(t.Context(), "POST", "/v1/files/", body)

			req.Header.Set("Content-Type", contentType)

			router.ServeHTTP(responseRecorder, req)

			assert(t, 201, responseRecorder.Code)

			resp := &controller.UploadFileResponse{}
			if err := json.Unmarshal(responseRecorder.Body.Bytes(), &resp); err != nil {
				t.Fatal(err)
			}
			assert(t, &controller.UploadFileResponse{
				ProcessedFiles: []controller.FileMetadata{
					{
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
						Metadata:         map[string]any{},
					},
					{
						ID:               "d041c7c5-10e7-410e-a599-799409b5",
						Name:             "another_file.md",
						Size:             12,
						BucketID:         "blah",
						ETag:             "some-etag",
						CreatedAt:        "",
						UpdatedAt:        "",
						IsUploaded:       true,
						MimeType:         "text/markdown",
						UploadedByUserID: "some-valid-uuid",
						Metadata:         map[string]any{"some": "metadata"},
					},
				},
				Error: nil,
			}, resp,
				cmpopts.IgnoreFields(controller.FileMetadata{}, "ID", "CreatedAt", "UpdatedAt"),
			)
		})
	}
}
