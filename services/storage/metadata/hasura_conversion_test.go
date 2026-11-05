package metadata_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/storage/api"
	"github.com/nhost/nhost/services/storage/metadata"
)

func TestFileMetadataFragmentToControllerType(t *testing.T) {
	t.Parallel()

	createdAt := time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(time.Minute)
	customMetadata := map[string]any{"description": "example"}
	fragment := metadata.FileMetadataFragment{
		ID:               "e6aad336-ad79-4df7-a09b-5782f71948f4",
		Name:             new("file.txt"),
		Size:             new(int64(123)),
		BucketID:         "default",
		Etag:             new("etag"),
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
		IsUploaded:       new(true),
		MimeType:         new("text/plain"),
		UploadedByUserID: new("b3b4e653-ca59-412c-a165-92d251c3fe86"),
		Metadata:         customMetadata,
	}
	expected := api.FileMetadata{
		Id:               fragment.ID,
		Name:             "file.txt",
		Size:             123,
		BucketId:         "default",
		Etag:             "etag",
		CreatedAt:        createdAt,
		UpdatedAt:        updatedAt,
		IsUploaded:       true,
		MimeType:         "text/plain",
		Metadata:         &customMetadata,
		UploadedByUserId: fragment.UploadedByUserID,
	}

	tests := []struct {
		name    string
		prepare func(*metadata.FileMetadataFragment, *api.FileMetadata)
	}{
		{
			name:    "uploaded file preserves metadata",
			prepare: func(_ *metadata.FileMetadataFragment, _ *api.FileMetadata) {},
		},
		{
			name: "pending upload",
			prepare: func(md *metadata.FileMetadataFragment, want *api.FileMetadata) {
				md.Etag = nil
				md.IsUploaded = new(false)
				md.UploadedByUserID = nil
				md.Metadata = nil
				want.Etag = ""
				want.IsUploaded = false
				want.UploadedByUserId = nil
				want.Metadata = new(map[string]any(nil))
			},
		},
		{
			name: "nullable file fields unset",
			prepare: func(md *metadata.FileMetadataFragment, want *api.FileMetadata) {
				md.Name = nil
				md.Size = nil
				md.Etag = nil
				md.IsUploaded = nil
				md.MimeType = nil
				want.Name = ""
				want.Size = 0
				want.Etag = ""
				want.IsUploaded = false
				want.MimeType = ""
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			md, want := fragment, expected
			tt.prepare(&md, &want)

			if diff := cmp.Diff(want, md.ToControllerType()); diff != "" {
				t.Errorf("unexpected file metadata (-want +got):\n%s", diff)
			}
		})
	}
}
