package controller_test

import (
	"testing"

	"github.com/nhost/hasura-storage/api"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

func TestListNotUploaded(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		expected api.ListFilesNotUploaded200JSONResponse
	}{
		{
			name: "successful",
			expected: api.ListFilesNotUploaded200JSONResponse{
				Metadata: &[]api.FileSummary{
					{
						Id:         "a184ad10-58e2-4619-9a22-04a90b9c4b5f",
						Name:       "file-three.txt",
						IsUploaded: false,
						BucketId:   "default",
					},
				},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := logrus.New()
			logger.SetLevel(logrus.ErrorLevel)

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)

			metadataStorage.EXPECT().ListFiles(
				gomock.Any(), gomock.Any(),
			).Return(
				[]controller.FileSummary{
					{
						ID:         "b3b4e653-ca59-412c-a165-92d251c3fe86",
						Name:       "file-1.txt",
						IsUploaded: true,
						BucketID:   "default",
					},
					{
						ID:         "e6aad336-ad79-4df7-a09b-5782f71948f4",
						Name:       "file-1.txt",
						IsUploaded: true,
						BucketID:   "default",
					},
					{
						ID:         "7dc0b0d0-b100-4667-89f1-0434942d9c15",
						Name:       "file-two.txt",
						IsUploaded: true,
						BucketID:   "default",
					},
					{
						ID:         "a184ad10-58e2-4619-9a22-04a90b9c4b5f",
						Name:       "file-three.txt",
						IsUploaded: false,
						BucketID:   "default",
					},
				}, nil,
			)

			ctrl := controller.New(
				"http://asd",
				"/v1",
				"asdasd",
				metadataStorage,
				contentStorage,
				nil,
				nil,
				logger,
			)

			resp, err := ctrl.ListFilesNotUploaded(
				t.Context(),
				api.ListFilesNotUploadedRequestObject{},
			)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assert(t, tc.expected, resp)
		})
	}
}
