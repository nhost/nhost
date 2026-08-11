package storage_test

import (
	"io"
	"log/slog"
	"slices"
	"testing"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/nhost/nhost/services/storage/storage"
	"github.com/nhost/nhost/services/storage/storage/mock"
	gomock "go.uber.org/mock/gomock"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

// prefixEq matches the *s3.ListObjectsV2Input whose Prefix equals want, so tests
// can assert the prefix ListFiles sends to S3 (not observable from the result).
func prefixEq(want string) gomock.Matcher {
	return gomock.Cond(func(in *s3.ListObjectsV2Input) bool {
		return aws.ToString(in.Prefix) == want
	})
}

func page(truncated bool, nextToken string, keys ...string) *s3.ListObjectsV2Output {
	contents := make([]types.Object, len(keys))
	for i, k := range keys {
		contents[i] = types.Object{Key: aws.String(k)}
	}

	out := &s3.ListObjectsV2Output{
		Contents:    contents,
		IsTruncated: aws.Bool(truncated),
	}
	if nextToken != "" {
		out.NextContinuationToken = aws.String(nextToken)
	}

	return out
}

// When no rootFolder is configured (the default), the listing prefix must be
// empty so objects stored without a leading slash are returned untouched.
func TestListFilesEmptyRootFolder(t *testing.T) {
	t.Parallel()

	c := gomock.NewController(t)
	defer c.Finish()

	client := mock.NewMockObjectAPI(c)
	client.EXPECT().ListObjectsV2(gomock.Any(), prefixEq(""), gomock.Any()).Return(
		page(false, "", "app_id/file-1", "file-2"), nil,
	)

	st := storage.NewS3ForTest(client, "", discardLogger())

	got, apiErr := st.ListFiles(t.Context())
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}

	want := []string{"app_id/file-1", "file-2"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// With a rootFolder configured, the listing prefix is "<rootFolder>/" and that
// prefix is stripped from every returned key.
func TestListFilesTrimsRootFolderPrefix(t *testing.T) {
	t.Parallel()

	c := gomock.NewController(t)
	defer c.Finish()

	client := mock.NewMockObjectAPI(c)
	client.EXPECT().ListObjectsV2(gomock.Any(), prefixEq("root/"), gomock.Any()).Return(
		page(false, "", "root/app_id/file-1", "root/file-2"), nil,
	)

	st := storage.NewS3ForTest(client, "root", discardLogger())

	got, apiErr := st.ListFiles(t.Context())
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}

	want := []string{"app_id/file-1", "file-2"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// A bucket with more than 1000 objects is returned across several pages; every
// page must be aggregated rather than silently truncated at the first one.
func TestListFilesPaginates(t *testing.T) {
	t.Parallel()

	c := gomock.NewController(t)
	defer c.Finish()

	client := mock.NewMockObjectAPI(c)
	gomock.InOrder(
		client.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any(), gomock.Any()).Return(
			page(true, "page-2", "root/file-1", "root/file-2"), nil,
		),
		client.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any(), gomock.Any()).Return(
			page(false, "", "root/file-3"), nil,
		),
	)

	st := storage.NewS3ForTest(client, "root", discardLogger())

	got, apiErr := st.ListFiles(t.Context())
	if apiErr != nil {
		t.Fatalf("unexpected error: %v", apiErr)
	}

	want := []string{"file-1", "file-2", "file-3"}
	if !slices.Equal(got, want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// An error from any page must be surfaced rather than swallowed.
func TestListFilesPaginatorError(t *testing.T) {
	t.Parallel()

	c := gomock.NewController(t)
	defer c.Finish()

	client := mock.NewMockObjectAPI(c)
	client.EXPECT().ListObjectsV2(gomock.Any(), gomock.Any(), gomock.Any()).Return(nil, io.EOF)

	st := storage.NewS3ForTest(client, "root", discardLogger())

	if _, apiErr := st.ListFiles(t.Context()); apiErr == nil {
		t.Fatal("expected an error, got nil")
	}
}
