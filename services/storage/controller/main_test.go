package controller_test

import (
	"fmt"
	"io"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/nhost/hasura-storage/api"
	gomock "go.uber.org/mock/gomock"
)

type readerMatcher struct {
	v string
}

func (m readerMatcher) Matches(x interface{}) bool {
	reader, ok := x.(io.ReadSeeker)
	if !ok {
		return false
	}

	if _, err := reader.Seek(0, 0); err != nil {
		panic(err)
	}

	b, err := io.ReadAll(reader)
	if err != nil {
		panic(err)
	}

	return string(b) == m.v
}

func (m readerMatcher) String() string {
	return m.v
}

func ReaderMatcher(v string) gomock.Matcher {
	return readerMatcher{v}
}

type fileMetadataMatcher struct {
	v api.FileMetadata
}

func (m fileMetadataMatcher) Matches(x interface{}) bool {
	return cmp.Equal(
		m.v,
		x,
		cmpopts.IgnoreFields(api.FileMetadata{}, "CreatedAt", "UpdatedAt"),
	)
}

func (m fileMetadataMatcher) String() string {
	return fmt.Sprintf("%v", m.v)
}

func FileMetadataMatcher(v api.FileMetadata) gomock.Matcher {
	return fileMetadataMatcher{v}
}

func assert(t *testing.T, got, wanted interface{}, opts ...cmp.Option) {
	t.Helper()

	if !cmp.Equal(got, wanted, opts...) {
		t.Error(cmp.Diff(got, wanted, opts...))
	}
}
