package controller_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/nhost/hasura-storage/controller"
	"github.com/nhost/hasura-storage/controller/mock"
	"github.com/sirupsen/logrus"
	gomock "go.uber.org/mock/gomock"
)

func TestDeleteFile(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name             string
		expectedStatus   int
		expectedResponse []byte
	}{
		{
			name:           "success",
			expectedStatus: 204,
		},
	}

	logger := logrus.New()
	logger.SetLevel(logrus.ErrorLevel)

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			c := gomock.NewController(t)
			defer c.Finish()

			metadataStorage := mock.NewMockMetadataStorage(c)
			contentStorage := mock.NewMockContentStorage(c)

			metadataStorage.EXPECT().DeleteFileByID(
				gomock.Any(), "55af1e60-0f28-454e-885e-ea6aab2bb288", gomock.Any(),
			).Return(nil)

			contentStorage.EXPECT().DeleteFile(
				gomock.Any(),
				"55af1e60-0f28-454e-885e-ea6aab2bb288",
			).Return(
				nil,
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

			router, _ := ctrl.SetupRouter(nil, "/v1", []string{"*"}, false, ginLogger(logger))

			responseRecorder := httptest.NewRecorder()

			req, _ := http.NewRequestWithContext(
				t.Context(),
				"DELETE",
				"/v1/files/55af1e60-0f28-454e-885e-ea6aab2bb288",
				nil,
			)

			router.ServeHTTP(responseRecorder, req)

			assert(t, tc.expectedStatus, responseRecorder.Code)
			assert(t, tc.expectedResponse, responseRecorder.Body.Bytes())
		})
	}
}
