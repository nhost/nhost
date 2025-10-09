package controller_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"go.uber.org/mock/gomock"
)

func TestVerifyToken(t *testing.T) {
	t.Parallel()

	cases := []testRequest[api.VerifyTokenRequestObject, api.VerifyTokenResponseObject]{
		{
			name:   "error with no token provided",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: &api.VerifyTokenRequest{
					Token: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "error with nil body",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.VerifyTokenRequestObject{
				Body: nil,
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			defer ctrl.Finish()

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			resp, err := c.VerifyToken(t.Context(), tc.request)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if diff := cmp.Diff(tc.expectedResponse, resp); diff != "" {
				t.Errorf("unexpected response (-want +got):\n%s", diff)
			}
		})
	}
}
