// +build integration

package storage_test

import (
	"os"
	"testing"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/google/go-cmp/cmp"
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

	st, err := storage.NewS3(config, "default", "a-root-folder", logger)
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
		t.Fatal(err)
	}

	if !findFile(t, s3, "a-root-folder", "s3_test.go") {
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
			filepath: "/default/qwenmzxcxzcsadsad",
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

			if findFile(t, s3, "a-root-folder", tc.filepath) {
				t.Error("file wasn't deleted")
			}
		})
	}
}

func TestListFiles(t *testing.T) {
	cases := []struct {
		name     string
		expected []string
	}{
		{
			name: "success",
			expected: []string{
				"f215cf48-7458-4596-9aa5-2159fc6a3caf/default/asd",
			},
		},
	}
	s3 := getS3()

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tc := tc
			got, err := s3.ListFiles()
			if err != nil {
				t.Error(err)
			}

			if !cmp.Equal(got, tc.expected) {
				t.Error(cmp.Diff(got, tc.expected))
			}
		})
	}
}
