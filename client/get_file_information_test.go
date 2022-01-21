// +build integration

package client_test

import (
	"os"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-storage/client"
	"github.com/nhost/hasura-storage/controller"
	"golang.org/x/net/context"
)

func TestGetFileInformation(t *testing.T) {
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
		name        string
		id          string
		expected    *client.FileInformationHeader
		expectedErr error
		opts        []client.GetFileInformationOpt
	}{
		{
			name: "get file information, if-match==etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfMatch(testFile.ProcessedFiles[0].ETag)},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 63,
				ContentType:   "text/plain; charset=utf-8",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    200,
			},
		},
		{

			name: "get file information, if-match!=etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfMatch("garbage")},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 63,
				ContentType:   "text/plain; charset=utf-8",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    412,
			},
		},
		{

			name: "get file information, if-none-match==etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithNoneMatch(testFile.ProcessedFiles[0].ETag)},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 0,
				ContentType:   "",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    304,
			},
		},
		{

			name: "get file information, if-none-match!=etag",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithNoneMatch("garbage")},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 63,
				ContentType:   "text/plain; charset=utf-8",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    200,
			},
		},
		{

			name: "get file information, if-modified-since!=date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfModifiedSince("Thu, 23 Dec 2025 10:00:00 UTC")},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 0,
				ContentType:   "",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    304,
			},
		},
		{

			name: "get file information, if-modified-since==date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfModifiedSince("Thu, 23 Dec 2020 10:00:00 UTC")},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 63,
				ContentType:   "text/plain; charset=utf-8",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    200,
			},
		},
		{

			name: "get file information, if-unmodified-since!=date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfUnmodifiedSince("Thu, 23 Dec 2025 10:00:00 UTC")},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 63,
				ContentType:   "text/plain; charset=utf-8",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    200,
			},
		},
		{

			name: "get file information, if-unmodified-since==date",
			id:   testFile.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithIfUnmodifiedSince("Thu, 23 Dec 2020 10:00:00 UTC")},
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 63,
				ContentType:   "text/plain; charset=utf-8",
				Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
				LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
				StatusCode:    412,
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

			got, err := cl.GetFileInformation(context.Background(), tc.id, tc.opts...)

			if !cmp.Equal(err, tc.expectedErr) {
				t.Errorf(cmp.Diff(err, tc.expectedErr))
			}

			copts := cmp.Options{
				cmpopts.IgnoreFields(client.FileInformationHeader{}, "LastModified"),
			}

			if !cmp.Equal(got, tc.expected, copts...) {
				t.Errorf(cmp.Diff(got, tc.expected, copts...))
			}
		})
	}
}
