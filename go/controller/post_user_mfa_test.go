package controller_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestPostUserdMfa(t *testing.T) { //nolint:maintidx
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

	cases := []testRequest[api.PostUserMfaRequestObject, api.PostUserMfaResponseObject]{
		{
			name:   "enable",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("user@acme.local"),
					TotpSecret:    sql.Text("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
					ActiveMfaType: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				mock.EXPECT().UpdateUserActiveMFAType(
					gomock.Any(),
					sql.UpdateUserActiveMFATypeParams{
						ID:            userID,
						ActiveMfaType: pgtype.Text{String: "totp", Valid: true},
					},
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: api.PostUserMfa200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "enable - already enabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("user@acme.local"),
					TotpSecret:    sql.Text("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
					ActiveMfaType: sql.Text("totp"),
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "totp-already-active",
				Message: "TOTP MFA is already active",
				Status:  http.StatusBadRequest,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "enable - wrong code",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("user@acme.local"),
					TotpSecret:    sql.Text("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
					ActiveMfaType: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-totp",
				Message: "Invalid TOTP code",
				Status:  http.StatusUnauthorized,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "disable",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("user@acme.local"),
					TotpSecret:    sql.Text("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
					ActiveMfaType: sql.Text("totp"),
				}, nil)

				mock.EXPECT().UpdateUserActiveMFAType(
					gomock.Any(),
					sql.UpdateUserActiveMFATypeParams{
						ID:            userID,
						ActiveMfaType: pgtype.Text{}, //nolint:exhaustruct
					},
				).Return(nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: nil,
					Code:          "373186",
				},
			},
			expectedResponse: api.PostUserMfa200JSONResponse(api.OK),
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "disable - already disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("user@acme.local"),
					TotpSecret:    pgtype.Text{}, //nolint:exhaustruct
					ActiveMfaType: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "no-totp-secret",
				Message: "User does not have a TOTP secret",
				Status:  http.StatusBadRequest,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "disable - wrong code",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("user@acme.local"),
					TotpSecret:    sql.Text("FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ"),
					ActiveMfaType: sql.Text("totp"),
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: nil,
					Code:          "123456",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-totp",
				Message: "Invalid TOTP code",
				Status:  http.StatusUnauthorized,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name: "mfa disabled",
			config: func() *controller.Config {
				cfg := getConfig()
				cfg.MfaEnabled = false
				return cfg
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  http.StatusConflict,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "missing jwt",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			jwtTokenFn: nil,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  http.StatusInternalServerError,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "user is anonymous",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					IsAnonymous: true,
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  http.StatusForbidden,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},

		{
			name:   "no user found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{}, //nolint:exhaustruct
					pgx.ErrNoRows)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request: api.PostUserMfaRequestObject{
				Body: &api.PostUserMfaJSONRequestBody{
					ActiveMfaType: ptr(api.Totp),
					Code:          "373186",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  http.StatusUnauthorized,
			},
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withTotp(controller.NewTotp(
					"auth-test",
					fakeNow(time.Date(2025, 3, 29, 14, 50, 0o0, 0, time.UTC)),
				)),
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			}
			assertRequest(
				ctx, t, c.PostUserMfa, tc.request, tc.expectedResponse,
			)
		})
	}
}
