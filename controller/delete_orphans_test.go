package controller_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock_controller"
	"github.com/sirupsen/logrus"
)

func TestDeleteOrphans(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		expected controller.ListOrphansResponse
	}{
		{
			name: "successful",
			expected: controller.ListOrphansResponse{
				Files: []string{"default/garbage", "bucket2/7dc0b0d0-b100-4667-89f1-0434942d9c15"},
			},
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			tc := tc

			t.Parallel()

			logger := logrus.New()
			logger.SetLevel(logrus.ErrorLevel)

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock_controller.NewMockMetadataStorage(c)
			contentStorage := mock_controller.NewMockContentStorage(c)

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
						ID:         "7dc0b0d0-b100-4667-89f1-0434942d9c15",
						Name:       "file-two.txt",
						IsUploaded: true,
						BucketID:   "default",
					},
				}, nil,
			)

			contentStorage.EXPECT().ListFiles().Return(
				[]string{
					"default/b3b4e653-ca59-412c-a165-92d251c3fe86",
					"default/7dc0b0d0-b100-4667-89f1-0434942d9c15",
					"default/garbage",
					"bucket2/7dc0b0d0-b100-4667-89f1-0434942d9c15",
				}, nil,
			)

			contentStorage.EXPECT().DeleteFile("default/garbage").Return(nil)
			contentStorage.EXPECT().DeleteFile("bucket2/7dc0b0d0-b100-4667-89f1-0434942d9c15").Return(nil)

			ctrl := controller.New(metadataStorage, contentStorage, logger)

			router, _ := ctrl.SetupRouter(nil, ginLogger(logger))

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(context.Background(), "POST", "/api/v1/ops/delete-orphans", nil)

			router.ServeHTTP(responseRecorder, req)

			assert(t, 200, responseRecorder.Code)

			resp := &controller.ListOrphansResponse{}
			if err := json.Unmarshal(responseRecorder.Body.Bytes(), &resp); err != nil {
				t.Fatal(err)
			}
			assert(t, &tc.expected, resp)
		})
	}
}
