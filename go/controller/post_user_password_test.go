package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestPostUserdReset(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	jwtTokenFn := func() *jwt.Token {
		return &jwt.Token{
			Raw:    "",
			Method: jwt.SigningMethodHS256,
			Header: map[string]any{
				"alg": "HS256",
				"typ": "JWT",
			},
			Claims: jwt.MapClaims{
				"exp": float64(time.Now().Add(900 * time.Second).Unix()),
				"https://hasura.io/jwt/claims": map[string]any{
					"x-hasura-allowed-roles":     []any{"anonymous"},
					"x-hasura-default-role":      "anonymous",
					"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
					"x-hasura-user-is-anonymous": "true",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": "db477732-48fa-4289-b694-2886a646b6eb",
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	cases := []testRequest[api.PostUserPasswordRequestObject, api.PostUserPasswordResponseObject]{
		{
			name:   "ticket",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordReset:ticket"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:    userID,
					Email: sql.Text("user@acme.local"),
				}, nil)

				mock.EXPECT().UpdateUserChangePassword(
					gomock.Any(),
					testhelpers.GomockCmpOpts(
						sql.UpdateUserChangePasswordParams{
							ID:           userID,
							PasswordHash: sql.Text("password"),
						},
						cmpopts.IgnoreFields(
							sql.UpdateUserChangePasswordParams{}, //nolint:exhaustruct
							"PasswordHash",
						),
					),
				).Return(userID, nil)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      ptr("passwordReset:ticket"),
				},
			},
			expectedResponse: api.PostUserPassword200JSONResponse(api.OK),
			emailer:          nil,
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name:   "ticket - user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordReset:ticket"),
				).Return(
					sql.AuthUser{}, //nolint:exhaustruct
					pgx.ErrNoRows)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      ptr("passwordReset:ticket"),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-ticket",
				Message: "Invalid ticket",
				Status:  401,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "ticket - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordReset:ticket"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:       userID,
					Email:    sql.Text("user@acme.local"),
					Disabled: true,
				}, nil)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      ptr("passwordReset:ticket"),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "ticket - user anonymous",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordReset:ticket"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("user@acme.local"),
					IsAnonymous: true,
				}, nil)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      ptr("passwordReset:ticket"),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  403,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "ticket - password length",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordReset:ticket"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:    userID,
					Email: sql.Text("user@acme.local"),
				}, nil)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "p",
					Ticket:      ptr("passwordReset:ticket"),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "password-too-short",
				Message: "Password is too short",
				Status:  400,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "auth header",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:    userID,
					Email: sql.Text("user@acme.local"),
				}, nil)

				mock.EXPECT().UpdateUserChangePassword(
					gomock.Any(),
					testhelpers.GomockCmpOpts(
						sql.UpdateUserChangePasswordParams{
							ID:           userID,
							PasswordHash: sql.Text("password"),
						},
						cmpopts.IgnoreFields(
							sql.UpdateUserChangePasswordParams{}, //nolint:exhaustruct
							"PasswordHash",
						),
					),
				).Return(userID, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      nil,
				},
			},
			expectedResponse: api.PostUserPassword200JSONResponse(api.OK),
			emailer:          nil,
			customClaimer:    nil,
			expectedJWT:      nil,
			hibp:             nil,
		},

		{
			name:   "no header and no ticket",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "auth header - user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{}, //nolint:exhaustruct
					pgx.ErrNoRows,
				)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "auth header - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:       userID,
					Email:    sql.Text("user@acme.local"),
					Disabled: true,
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "auth header - anonymous",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("user@acme.local"),
					IsAnonymous: true,
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "password",
					Ticket:      nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  403,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},

		{
			name:   "auth header - password length",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:    userID,
					Email: sql.Text("user@acme.local"),
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserPasswordRequestObject{
				Body: &api.PostUserPasswordJSONRequestBody{
					NewPassword: "p",
					Ticket:      nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "password-too-short",
				Message: "Password is too short",
				Status:  400,
			},
			emailer:       nil,
			customClaimer: nil,
			expectedJWT:   nil,
			hibp:          nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: nil,
				emailer:       nil,
				hibp:          nil,
			})

			ctx := context.Background()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(context.Background(), tc.jwtTokenFn())
			}
			assertRequest(
				ctx, t, c.PostUserPassword, tc.request, tc.expectedResponse,
			)
		})
	}
}
