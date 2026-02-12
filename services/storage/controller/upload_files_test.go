package controller_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/textproto"
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

func createMultiForm(t *testing.T, files ...fakeFile) *multipart.Reader {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Store the boundary before we close the writer
	boundary := writer.Boundary()

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

	// Create and return a multipart.Reader
	return multipart.NewReader(bytes.NewReader(body.Bytes()), boundary)
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

			logger := slog.New(
				slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}),
			)

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
						UploadedByUserId: new("some-valid-uuid"),
						Metadata:         new(map[string]any{}),
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
					api.FileMetadata{
						Id:               file.md.ID,
						Name:             file.md.Name,
						Size:             int64(len(file.contents)),
						BucketId:         "blah",
						Etag:             "some-etag",
						CreatedAt:        time.Time{}, // ignored
						UpdatedAt:        time.Time{}, // ignored
						IsUploaded:       true,
						MimeType:         "text/markdown",
						UploadedByUserId: new("some-valid-uuid"),
						Metadata:         new(map[string]any{"some": "metadata"}),
					},
					nil)
			}

			av.EXPECT().ScanReader(gomock.Any(), gomock.Any()).Return(nil)
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

			resp, err := ctrl.UploadFiles(
				t.Context(),
				api.UploadFilesRequestObject{
					Body: createMultiForm(t, files...),
				},
			)
			if err != nil {
				t.Fatal(err)
			}

			assert(t, api.UploadFiles201JSONResponse{
				ProcessedFiles: []api.FileMetadata{
					{
						Id:               "38288c85-02af-416b-b075-11c4dae9",
						Name:             "a_file.txt",
						Size:             12,
						BucketId:         "blah",
						Etag:             "some-etag",
						CreatedAt:        time.Time{}, // ignored
						UpdatedAt:        time.Time{}, // ignored
						IsUploaded:       true,
						MimeType:         "text/plain; charset=utf-8",
						UploadedByUserId: new("some-valid-uuid"),
						Metadata:         new(map[string]any{}),
					},
					{
						Id:               "d041c7c5-10e7-410e-a599-799409b5",
						Name:             "another_file.md",
						Size:             12,
						BucketId:         "blah",
						Etag:             "some-etag",
						CreatedAt:        time.Time{}, // ignored
						UpdatedAt:        time.Time{}, // ignored
						IsUploaded:       true,
						MimeType:         "text/markdown",
						UploadedByUserId: new("some-valid-uuid"),
						Metadata:         new(map[string]any{"some": "metadata"}),
					},
				},
			}, resp,
				cmpopts.IgnoreFields(api.FileMetadata{}, "Id", "CreatedAt", "UpdatedAt"),
			)
		})
	}
}
