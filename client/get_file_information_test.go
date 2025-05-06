//go:build integration
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
	baseURL := "http://localhost:8000/v1"
	cl := client.New(baseURL, os.Getenv("HASURA_AUTH_BEARER"))

	files := []fileHelper{
		{
			path: "testdata/alphabet.txt",
			id:   uuid.NewString(),
		},
		{
			path: "testdata/nhost.jpg",
			id:   uuid.NewString(),
		},
	}
	testFiles, err := uploadFiles(t, cl, files...)
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfMatch(testFiles.ProcessedFiles[0].ETag),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithNoneMatch(testFiles.ProcessedFiles[0].ETag),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfModifiedSince("Thu, 23 Dec 2025 10:00:00 UTC"),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfModifiedSince("Thu, 23 Dec 2020 10:00:00 UTC"),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfUnmodifiedSince("Thu, 23 Dec 2025 10:00:00 UTC"),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfUnmodifiedSince("Thu, 23 Dec 2020 10:00:00 UTC"),
			},
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
					Message: `{"networkErrors":null,"graphqlErrors":[{"message":"invalid input syntax for type uuid: \"asdadasdads\"","extensions":{"code":"data-exception","path":"$"}}]}`,
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
		{
			name: "image",
			id:   testFiles.ProcessedFiles[1].ID,
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 33399,
				ContentType:   "image/jpeg",
				Etag:          `"78b676e65ebc31f0bb1f2f0d05098572"`,
				LastModified:  "",
				Error:         "",
				StatusCode:    200,
			},
			expectedErr: nil,
			opts:        []client.GetFileInformationOpt{},
		},
		{
			name: "image/blur",
			id:   testFiles.ProcessedFiles[1].ID,
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 16897,
				ContentType:   "image/jpeg",
				Etag:          `"0b038c3afbe8a848974874aad4fb11983d45ab84d9113eb4260c4ed34d2d03d6"`,
				LastModified:  "",
				Error:         "",
				StatusCode:    200,
			},
			expectedErr: nil,
			opts: []client.GetFileInformationOpt{
				client.WithImageBlur(2),
			},
		},
		{
			name: "image/resized",
			id:   testFiles.ProcessedFiles[1].ID,
			expected: &client.FileInformationHeader{
				CacheControl:  "max-age=3600",
				ContentLength: 12490,
				ContentType:   "image/jpeg",
				Etag:          `"55de6c49d308de6158f713ea84f476096d227bcf7a2395c10617193e9c80eeb2"`,
				LastModified:  "",
				Error:         "",
				StatusCode:    200,
			},
			expectedErr: nil,
			opts: []client.GetFileInformationOpt{
				client.WithImageSize(200, 200),
				client.WithImageQuality(90),
			},
		},
		{
			name: "get text file manipulated",
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithImageSize(600, 200),
				client.WithImageQuality(50),
				client.WithImageBlur(5),
			},
			expectedErr: &client.APIResponseError{
				StatusCode: 400,
				ErrorResponse: &controller.ErrorResponse{
					Message: "image manipulation features are not supported for 'text/plain; charset=utf-8'",
				},
				Response: nil,
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := cl.GetFileInformation(context.Background(), tc.id, tc.opts...)

			if !cmp.Equal(err, tc.expectedErr) {
				t.Error(cmp.Diff(err, tc.expectedErr))
			}

			copts := cmp.Options{
				cmpopts.IgnoreFields(client.FileInformationHeader{}, "LastModified"),
			}

			if !cmp.Equal(got, tc.expected, copts...) {
				t.Error(cmp.Diff(got, tc.expected, copts...))
			}
		})
	}
}
