//go:build integration
// +build integration

package client_test

import (
	"crypto/sha256"
	"fmt"
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
		expected    *client.FileInformationHeaderWithReader
		expectedSha string
		expectedErr error
		opts        []client.GetFileInformationOpt
	}{
		{
			name: "get file, range",
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{client.WithRange("bytes=1-3")},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "alphabet.txt",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 3,
					ContentType:   "text/plain; charset=utf-8",
					Etag:          `"588be441fe7a59460850b0aa3e1c5a65"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    206,
				},
			},
			expectedSha: "f7000c92088f827e35e0280d3b6ae7afbaccbc9ad5c9f9159df5f0202852107c",
		},
		{
			name: "get file, if-match==etag",
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfMatch(testFiles.ProcessedFiles[0].ETag),
			},
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
			expectedSha: "2e7ef00280a48b02e0d77d4727db841b311a7c12e755b43f66ead3e451a9611e",
		},
		{
			name: "get file, if-match!=etag",
			id:   testFiles.ProcessedFiles[0].ID,
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithNoneMatch(testFiles.ProcessedFiles[0].ETag),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
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
			expectedSha: "2e7ef00280a48b02e0d77d4727db841b311a7c12e755b43f66ead3e451a9611e",
		},
		{
			name: "get file, if-modified-since!=date",
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfModifiedSince("Thu, 23 Dec 2025 10:00:00 UTC"),
			},
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
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfModifiedSince("Thu, 23 Dec 2020 10:00:00 UTC"),
			},
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
			expectedSha: "2e7ef00280a48b02e0d77d4727db841b311a7c12e755b43f66ead3e451a9611e",
		},
		{
			name: "get file, if-unmodified-since!=date",
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfUnmodifiedSince("Thu, 23 Dec 2025 10:00:00 UTC"),
			},
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
			expectedSha: "2e7ef00280a48b02e0d77d4727db841b311a7c12e755b43f66ead3e451a9611e",
		},
		{
			name: "get file, if-unmodified-since==date",
			id:   testFiles.ProcessedFiles[0].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfUnmodifiedSince("Thu, 23 Dec 2020 10:00:00 UTC"),
			},
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
			name: "get image, if-match==etag",
			id:   testFiles.ProcessedFiles[1].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfMatch(testFiles.ProcessedFiles[1].ETag),
			},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "nhost.jpg",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 33399,
					ContentType:   "image/jpeg",
					Etag:          `"78b676e65ebc31f0bb1f2f0d05098572"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    200,
				},
			},
			expectedSha: "7f2ed9ccb9259bef6e317b4e51e935f61e632dbad5d2ac36430c51b0390aab64",
		},
		{
			name: "get image manipulated, if-match==etag",
			id:   testFiles.ProcessedFiles[1].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfMatch(
					`"e913f1f35e9e833dd73b4ef9e0d7470db9e40520165528dde01b3b02ce8d53ec"`,
				),
				client.WithImageSize(600, 200),
				client.WithImageQuality(50),
				client.WithImageBlur(5),
			},
			expected: &client.FileInformationHeaderWithReader{
				Filename: "nhost.jpg",
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 12602,
					ContentType:   "image/jpeg",
					Etag:          `"e913f1f35e9e833dd73b4ef9e0d7470db9e40520165528dde01b3b02ce8d53ec"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    200,
				},
			},
			expectedSha: "e913f1f35e9e833dd73b4ef9e0d7470db9e40520165528dde01b3b02ce8d53ec",
		},
		{
			name: "get image manipulated, if-match!=etag",
			id:   testFiles.ProcessedFiles[1].ID,
			opts: []client.GetFileInformationOpt{
				client.WithIfMatch(`"I don't match"`),
				client.WithImageSize(600, 200),
				client.WithImageQuality(50),
				client.WithImageBlur(5),
			},
			expected: &client.FileInformationHeaderWithReader{
				FileInformationHeader: &client.FileInformationHeader{
					CacheControl:  "max-age=3600",
					ContentLength: 12602,
					ContentType:   "image/jpeg",
					Etag:          `"e913f1f35e9e833dd73b4ef9e0d7470db9e40520165528dde01b3b02ce8d53ec"`,
					LastModified:  "Tue, 18 Jan 2022 13:18:04 UTC",
					StatusCode:    412,
				},
			},
			expectedSha: "",
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
			got, err := cl.GetFile(context.Background(), tc.id, tc.opts...)

			if !cmp.Equal(err, tc.expectedErr) {
				t.Error(cmp.Diff(err, tc.expectedErr))
			}

			copts := cmp.Options{
				cmpopts.IgnoreFields(client.FileInformationHeaderWithReader{}, "Body"),
				cmpopts.IgnoreFields(client.FileInformationHeader{}, "LastModified"),
			}

			if !cmp.Equal(got, tc.expected, copts...) {
				t.Error(cmp.Diff(got, tc.expected, copts...))
			}

			if got == nil {
				return
			}

			if got.Body == nil && tc.expectedSha != "" {
				t.Error("expected a file but got no body")
			} else if got.Body != nil && tc.expectedSha == "" {
				t.Error("didn't expect a body but got one")
			} else if got.Body == nil && tc.expectedSha == "" {
			} else {
				hash := sha256.New()
				_, err := io.Copy(hash, got.Body)
				if err != nil {
					t.Fatal(err)
				}
				sha := fmt.Sprintf("%x", hash.Sum(nil))
				if !cmp.Equal(sha, tc.expectedSha) {
					t.Error(cmp.Diff(sha, tc.expectedSha))
				}
			}
		})
	}
}
