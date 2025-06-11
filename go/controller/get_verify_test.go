package controller_test

import (
	"regexp"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func RegexpComparer() cmp.Option {
	return cmp.Comparer(func(x, y any) bool {
		// Convert both values to strings
		xStr, ok1 := x.(string)
		yStr, ok2 := y.(string)

		if !ok1 || !ok2 {
			return false
		}

		if xStr == yStr {
			return true
		}

		// Try x as pattern, y as test string
		patternX, err := regexp.Compile(xStr)
		if err == nil && patternX.MatchString(yStr) {
			return true
		}

		// Try y as pattern, x as test string
		patternY, err := regexp.Compile(yStr)
		if err == nil && patternY.MatchString(xStr) {
			return true
		}

		return false
	})
}

func TestGetVerify(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")

	cases := []testRequest[api.GetVerifyRequestObject, api.GetVerifyResponseObject]{
		{
			name:   "emailConfirmChange",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("emailConfirmChange:123"),
				).Return(
					getSigninUser(userID),
					nil,
				)

				mock.EXPECT().UpdateUserConfirmChangeEmail(
					gomock.Any(),
					userID,
				).Return(
					getSigninUser(userID),
					nil,
				)

				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserRole{},
					nil,
				)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(
					refreshTokenID,
					nil,
				)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(),
					userID,
				).Return(
					sql.TimestampTz(time.Now()),
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "emailConfirmChange:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: api.GetVerify302Response{
				Headers: api.GetVerify302ResponseHeaders{
					Location: `http:\/\/localhost:3000\/redirect\?refreshToken=.+&type=emailConfirmChange`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name: "emailConfirmChange:email not verified",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("emailConfirmChange:123"),
				).Return(
					user,
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "emailConfirmChange:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct {
					Location string
				}{
					Location: `http://localhost:3000/redirect?error=unverified-user&errorDescription=User+is+not+verified.`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "emailConfirmChange:user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Disabled = true

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("emailConfirmChange:123"),
				).Return(
					user,
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "emailConfirmChange:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct {
					Location string
				}{
					Location: `http://localhost:3000/redirect?error=disabled-user&errorDescription=User+is+disabled`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{ //nolint:dupl
			name:   "passwordlessEmail",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordlessEmail:123"),
				).Return(
					getSigninUser(userID),
					nil,
				)

				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserRole{},
					nil,
				)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(
					refreshTokenID,
					nil,
				)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(),
					userID,
				).Return(
					sql.TimestampTz(time.Now()),
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "passwordlessEmail:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: api.GetVerify302Response{
				Headers: api.GetVerify302ResponseHeaders{
					Location: `http:\/\/localhost:3000\/redirect\?refreshToken=.+&type=passwordlessEmail`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name: "passwordlessEmail:email not verified",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordlessEmail:123"),
				).Return(
					user,
					nil,
				)

				mock.EXPECT().UpdateUserVerifyEmail(
					gomock.Any(),
					userID,
				).Return(
					getSigninUser(userID),
					nil,
				)

				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserRole{},
					nil,
				)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(
					refreshTokenID,
					nil,
				)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(),
					userID,
				).Return(
					sql.TimestampTz(time.Now()),
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "passwordlessEmail:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: api.GetVerify302Response{
				Headers: api.GetVerify302ResponseHeaders{
					Location: `http:\/\/localhost:3000\/redirect\?refreshToken=.+&type=passwordlessEmail`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{ //nolint:dupl
			name:   "verifyEmail",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("verifyEmail:123"),
				).Return(
					getSigninUser(userID),
					nil,
				)

				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserRole{},
					nil,
				)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(
					refreshTokenID,
					nil,
				)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(),
					userID,
				).Return(
					sql.TimestampTz(time.Now()),
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "verifyEmail:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: api.GetVerify302Response{
				Headers: api.GetVerify302ResponseHeaders{
					Location: `http:\/\/localhost:3000\/redirect\?refreshToken=.+&type=verifyEmail`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name: "verifyEmail:email not verified",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("verifyEmail:123"),
				).Return(
					user,
					nil,
				)

				mock.EXPECT().UpdateUserVerifyEmail(
					gomock.Any(),
					userID,
				).Return(
					getSigninUser(userID),
					nil,
				)

				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserRole{},
					nil,
				)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(
					refreshTokenID,
					nil,
				)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(),
					userID,
				).Return(
					sql.TimestampTz(time.Now()),
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "verifyEmail:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: api.GetVerify302Response{
				Headers: api.GetVerify302ResponseHeaders{
					Location: `http:\/\/localhost:3000\/redirect\?refreshToken=.+&type=verifyEmail`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name: "passwordReset:email not verified",
			config: func() *controller.Config {
				c := getConfig()
				c.RequireEmailVerification = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.EmailVerified = false

				mock.EXPECT().GetUserByTicket(
					gomock.Any(),
					sql.Text("passwordReset:123"),
				).Return(
					user,
					nil,
				)

				return mock
			},
			request: api.GetVerifyRequestObject{
				Params: api.GetVerifyParams{
					Ticket:     "passwordReset:123",
					RedirectTo: "http://localhost:3000/redirect",
					Type:       nil,
				},
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct {
					Location string
				}{
					Location: `http://localhost:3000/redirect?error=unverified-user&errorDescription=User+is+not+verified.`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			assertRequest(
				t.Context(), t, c.GetVerify, tc.request, tc.expectedResponse,
				cmp.FilterPath(func(p cmp.Path) bool {
					if last := p.Last(); last != nil {
						return last.String() == ".Location"
					}
					return false
				}, RegexpComparer()),
			)
		})
	}
}
