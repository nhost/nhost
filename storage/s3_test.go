//go:build integration
// +build integration

package storage_test

import (
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
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

	st, err := storage.NewS3(config, "default", "f215cf48-7458-4596-9aa5-2159fc6a3caf", logger)
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
			url, err := s3.CreatePresignedURL(tc.filepath, time.Minute)
			if err != nil {
				t.Error(err)
			}

			if url == "" {
				t.Error("expected a url back but got nothing")
			}
		})
	}
}
