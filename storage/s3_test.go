//go:build integration
// +build integration

package storage_test

import (
	"context"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/storage"
	"github.com/sirupsen/logrus"
)

func getS3() *storage.S3 {
	config := &aws.Config{ // nolint: exhaustivestruct
		Credentials: credentials.NewStaticCredentials(
			os.Getenv("TEST_S3_ACCESS_KEY"),
			os.Getenv("TEST_S3_SECRET_KEY"),
			"",
		),
		Endpoint:         aws.String("http://localhost:9000"),
		Region:           aws.String("eu-central-1"),
		DisableSSL:       aws.Bool(true),
		S3ForcePathStyle: aws.Bool(true),
	}

	logger := logrus.New()

	url := "http://localhost:9000"
	st, err := storage.NewS3(config, "default", "f215cf48-7458-4596-9aa5-2159fc6a3caf", url, logger)
	if err != nil {
		panic(err)
	}
	return st
}

func findFile(t *testing.T, s3 *storage.S3, root, filename string) bool {
	t.Helper()

	ff, err := s3.ListFiles()
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, file := range ff {
		if file == root+"/"+filename {
			found = true
			break
		}
	}

	return found
}

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	s3 := getS3()

	f, err := os.Open("s3_test.go")
	if err != nil {
		t.Fatal(err)
	}

	_, apiErr := s3.PutFile(f, "s3_test.go", "text")
	if apiErr != nil {
		t.Fatal(apiErr)
	}

	if !findFile(t, s3, "f215cf48-7458-4596-9aa5-2159fc6a3caf", "s3_test.go") {
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
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc
			err := s3.DeleteFile(tc.filepath)
			if err != nil {
				t.Error(err)
			}

			if findFile(t, s3, "f215cf48-7458-4596-9aa5-2159fc6a3caf", tc.filepath) {
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
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got, err := s3.ListFiles()
			if err != nil {
				t.Error(err)
			}

			if len(got) == 0 {
				t.Error("found no files")
			}

			for _, f := range got {
				fmt.Println(f)
				if !strings.HasPrefix(f, "f215cf48-7458-4596-9aa5-2159fc6a3caf/") {
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

	_, apiErr := s3.PutFile(f, "sample.txt", "text")
	if apiErr != nil {
		t.Fatal(apiErr)
	}

	if !findFile(t, s3, "f215cf48-7458-4596-9aa5-2159fc6a3caf", "sample.txt") {
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
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc := tc
			signature, apiErr := s3.CreatePresignedURL(tc.filepath, time.Second)
			if apiErr != nil {
				t.Error(apiErr)
			}

			if signature == "" {
				t.Error("expected a signature back but got nothing")
			}

			time.Sleep(tc.sleep)

			got, apiErr := s3.GetFileWithPresignedURL(context.Background(), tc.filepath, signature, tc.requestHeaders)
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
				t.Errorf(cmp.Diff(publicResponse, tc.expectedErr))
			}

			if tc.expectedContent != "" {
				b, err := ioutil.ReadAll(got.Body)
				if err != nil {
					t.Error(err)
				}
				if !cmp.Equal(string(b), tc.expectedContent) {
					t.Errorf(cmp.Diff(string(b), tc.expectedContent))
				}
			}
		})
	}
}
