// +build integration

package client_test

import (
	"io"
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

func TestGetFile(t *testing.T) {
	baseURL := "http://localhost:8000/api/v1"
	cl := client.New(baseURL, os.Getenv("HASURA_AUTH_BEARER"))

	file := fileHelper{
		path: "testdata/alphabet.txt",
		id:   uuid.NewString(),
	}

	testFile, err := uploadFiles(t, cl, file)
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name         string
		id           string
		expected     *client.FileInformationHeaderWithReader
		expectedBody string
		expectedErr  error
		opts         []client.GetFileInformationOpt
	}{
		{
			name: "get file, if-match==etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfMatch(testFile.ProcessedFiles[0].ETag)},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "alphabet.txt",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 63,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    200,
				},
			},
			expectedBody: "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789\n",
		},
		{

			name: "get file, if-match!=etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfMatch("garbage")},
			expected: &client.FileInformationHeaderWithReader{
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 63,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    412,
				},
			},
		},
		{

			name: "get file, if-none-match==etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithNoneMatch(testFile.ProcessedFiles[0].ETag)},
			expected: &client.FileInformationHeaderWithReader{
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 0,
					ContentType:   "",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    304,
				},
			},
		},
		{

			name: "get file, if-none-match!=etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithNoneMatch("garbage")},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "alphabet.txt",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 63,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    200,
				},
			},
			expectedBody: "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789\n",
		},
		{

			name: "get file, if-modified-since!=date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfModifiedSince("Thu, 23 Dec 2025 10:00:00 UTC")},
			expected: &client.FileInformationHeaderWithReader{
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 0,
					ContentType:   "",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    304,
				},
			},
		},
		{

			name: "get file, if-modified-since==date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfModifiedSince("Thu, 23 Dec 2020 10:00:00 UTC")},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "alphabet.txt",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 63,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    200,
				},
			},
			expectedBody: "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789\n",
		},
		{

			name: "get file, if-unmodified-since!=date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfUnmodifiedSince("Thu, 23 Dec 2025 10:00:00 UTC")},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "alphabet.txt",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 63,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    200,
				},
			},
			expectedBody: "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789\n",
		},
		{
			name: "get file, if-unmodified-since==date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfUnmodifiedSince("Thu, 23 Dec 2020 10:00:00 UTC")},
			expected: &client.FileInformationHeaderWithReader{
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 63,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    412,
				},
			},
		},
		{

			name: "bad id",
			id:   "asdadasdads",
			expectedErr: &client.APIResponseError{
				StatusCode: 400,
				ErrorResponse: &controller.ErrorResponse{
					Message: `Message: invalid input syntax for type uuid: "asdadasdads", Locations: []`,
				},
				Response: nil,
			},
		},
		{

			name: "not found",
			id:   "93aa5806-3050-4810-817a-c917245bb6c1",
			expectedErr: &client.APIResponseError{
				StatusCode: 404,
				ErrorResponse: &controller.ErrorResponse{
					Message: "file not found",
				},
				Response: nil,
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tc := tc

			got, err := cl.GetFile(context.Background(), tc.id, tc.opts...)

			if !cmp.Equal(err, tc.expectedErr) {
				t.Errorf(cmp.Diff(err, tc.expectedErr))
			}

			copts := cmp.Options{
				cmpopts.IgnoreFields(client.FileInformationHeaderWithReader{}, "Body"),
				cmpopts.IgnoreFields(client.FileInformationHeader{}, "LastModified"),
			}

			if !cmp.Equal(got, tc.expected, copts...) {
				t.Errorf(cmp.Diff(got, tc.expected, copts...))
			}

			if got == nil {
				return
			}

			if got.Body == nil && tc.expectedBody != "" {
				t.Error("expected a file but got no body")
			} else if got.Body != nil && tc.expectedBody == "" {
				t.Error("didn't expect a body but got one")
			} else if got.Body == nil && tc.expectedBody == "" {
			} else {
				b, err := io.ReadAll(got.Body)
				if err != nil {
					t.Fatal(err)
				}
				if !cmp.Equal(string(b), tc.expectedBody) {
					t.Error(cmp.Diff(string(b), tc.expectedBody))
				}
			}
		})
	}
}
