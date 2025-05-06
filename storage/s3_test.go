//go:build integration
// +build integration

package storage_test

import (
	"context"
	"io"
	"net/http"
	"os"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/storage"
	"github.com/sirupsen/logrus"
)

func getS3() *storage.S3 {
	logger := logrus.New()
	ctx := context.Background()
	config, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("eu-central-1"),
		config.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(
				os.Getenv("TEST_S3_ACCESS_KEY"),
				os.Getenv("TEST_S3_SECRET_KEY"),
				"",
			),
		),
	)
	if err != nil {
		logger.Error(err)
	}
	url := "http://localhost:9000"
	client := s3.NewFromConfig(config,
		func(o *s3.Options) {
			o.BaseEndpoint = aws.String(url)
			o.UsePathStyle = true
			o.EndpointOptions.DisableHTTPS = true
		})
	st := storage.NewS3(client, "default", "f215cf48-7458-4596-9aa5-2159fc6a3caf", url, logger)
	return st
}

func findFile(t *testing.T, s3 *storage.S3, filename string) bool {
	t.Helper()

	ff, err := s3.ListFiles(context.TODO())
	if err != nil {
		t.Fatal(err)
	}
	found := slices.Contains(ff, filename)

	return found
}

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	s3 := getS3()

	f, err := os.Open("s3_test.go")
	if err != nil {
		t.Fatal(err)
	}

	_, apiErr := s3.PutFile(context.TODO(), f, "s3_test.go", "text")
	if apiErr != nil {
		t.Fatal(apiErr)
	}

	if !findFile(t, s3, "s3_test.go") {
		t.Fatal("couldn't find test file")
	}

	cases := []struct {
		name     string
		filepath string
	}{
		{
			name:     "success",
			filepath: "s3_test.go",
		},
		{
			name:     "file not found",
			filepath: "qwenmzxcxzcsadsad",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			err := s3.DeleteFile(context.TODO(), tc.filepath)
			if err != nil {
				t.Error(err)
			}

			if findFile(t, s3, tc.filepath) {
				t.Error("file wasn't deleted")
			}
		})
	}
}

func TestListFiles(t *testing.T) {
	cases := []struct {
		name string
	}{
		{
			name: "success",
		},
	}
	s3 := getS3()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := s3.ListFiles(context.TODO())
			if err != nil {
				t.Error(err)
			}

			if len(got) == 0 {
				t.Error("found no files")
			}

			for _, f := range got {
				if strings.HasPrefix(f, "this-shouldnt-show-in-list") {
					t.Errorf("found extraneous file: %s", f)
				}
			}
		})
	}
}

func TestGetFilePresignedURL(t *testing.T) {
	t.Parallel()

	s3 := getS3()

	f, err := os.Open("testdata/sample.txt")
	if err != nil {
		t.Fatal(err)
	}

	_, apiErr := s3.PutFile(context.TODO(), f, "sample.txt", "text")
	if apiErr != nil {
		t.Fatal(apiErr)
	}

	if !findFile(t, s3, "sample.txt") {
		t.Fatal("couldn't find test file")
	}

	cases := []struct {
		name               string
		filepath           string
		sleep              time.Duration
		requestHeaders     http.Header
		expected           *controller.File
		expectedContent    string
		expectedErr        *controller.ErrorResponse
		expectedStatusCode int
	}{
		{
			name:     "success",
			filepath: "sample.txt",
			expected: &controller.File{
				ContentType:   "text",
				ContentLength: 17,
				Etag:          `"8ba761284b556cd234f73ec0b75fa054"`,
				StatusCode:    200,
				Body:          nil,
				ExtraHeaders: map[string][]string{
					"Accept-Ranges": {"bytes"},
				},
			},
			expectedContent:    "this is a sample\n",
			expectedStatusCode: http.StatusOK,
		},
		{
			name:     "not modified",
			filepath: "sample.txt",
			requestHeaders: http.Header{
				"If-None-Match": {`"8ba761284b556cd234f73ec0b75fa054"`},
			},
			expected: &controller.File{
				ContentLength: 0,
				Etag:          `"8ba761284b556cd234f73ec0b75fa054"`,
				StatusCode:    304,
				Body:          nil,
				ExtraHeaders:  map[string][]string{},
			},
			expectedContent:    "",
			expectedStatusCode: http.StatusNotModified,
		},
		{
			name:     "file not found",
			filepath: "qwenmzxcxzcsadsad",
			expectedErr: &controller.ErrorResponse{
				Message: "The specified key does not exist.",
			},
			expectedStatusCode: http.StatusNotFound,
		},
		{
			name:     "expired",
			filepath: "sample.txt",
			sleep:    time.Second * 2,
			expectedErr: &controller.ErrorResponse{
				Message: "Request has expired",
			},
			expectedStatusCode: http.StatusForbidden,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			signature, apiErr := s3.CreatePresignedURL(context.TODO(), tc.filepath, time.Second)
			if apiErr != nil {
				t.Error(apiErr)
			}

			if signature == "" {
				t.Error("expected a signature back but got nothing")
			}

			time.Sleep(tc.sleep)

			got, apiErr := s3.GetFileWithPresignedURL(
				context.Background(),
				tc.filepath,
				signature,
				tc.requestHeaders,
			)
			opts := cmp.Options{
				cmpopts.IgnoreFields(controller.File{}, "Body"),
			}
			if !cmp.Equal(got, tc.expected, opts) {
				t.Error(cmp.Diff(got, tc.expected, opts))
			}

			statusCode := 0
			if got != nil {
				statusCode = got.StatusCode
			}

			var publicResponse *controller.ErrorResponse
			if apiErr != nil {
				statusCode = apiErr.StatusCode()
				publicResponse = apiErr.PublicResponse()
			}

			if statusCode != tc.expectedStatusCode {
				t.Errorf("expected status code %d but got %d", tc.expectedStatusCode, statusCode)
			}

			if !cmp.Equal(publicResponse, tc.expectedErr) {
				t.Error(cmp.Diff(publicResponse, tc.expectedErr))
			}

			if tc.expectedContent != "" {
				b, err := io.ReadAll(got.Body)
				if err != nil {
					t.Error(err)
				}
				if !cmp.Equal(string(b), tc.expectedContent) {
					t.Error(cmp.Diff(string(b), tc.expectedContent))
				}
			}
		})
	}
}
