package controller_test

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func TestGetUser(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	createdAt := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)

	cases := []testRequest[api.GetUserRequestObject, api.GetUserResponseObject]{
		{
			name:   "success - get user data",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{
					ID:                       userID,
					CreatedAt:                sql.TimestampTz(createdAt),
					DisplayName:              "John Doe",
					AvatarUrl:                "https://example.com/avatar.jpg",
					Locale:                   "en",
					Email:                    sql.Text("john@example.com"),
					IsAnonymous:              false,
					DefaultRole:              "user",
					Metadata:                 []byte(`{"firstName":"John","lastName":"Doe"}`),
					EmailVerified:            true,
					PhoneNumber:              pgtype.Text{String: "+1234567890", Valid: true},
					PhoneNumberVerified:      true,
					ActiveMfaType:            pgtype.Text{String: "totp", Valid: true},
					UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:                 false,
					PasswordHash:             pgtype.Text{},        //nolint:exhaustruct
					NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
					OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
					OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
					OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
					TotpSecret:               pgtype.Text{},        //nolint:exhaustruct
					Ticket:                   pgtype.Text{},        //nolint:exhaustruct
					TicketExpiresAt:          pgtype.Timestamptz{}, //nolint:exhaustruct
					WebauthnCurrentChallenge: pgtype.Text{},        //nolint:exhaustruct
				}, nil)

				// Mock GetUserRoles call
				mock.EXPECT().GetUserRoles(
					gomock.Any(),
					userID,
				).Return([]sql.AuthUserRole{
					{Role: "user"},  //nolint:exhaustruct
					{Role: "admin"}, //nolint:exhaustruct
				}, nil)

				return mock
			},
			request: api.GetUserRequestObject{},
			expectedResponse: api.GetUser200JSONResponse(api.User{
				Id:                  userID.String(),
				CreatedAt:           createdAt,
				DisplayName:         "John Doe",
				AvatarUrl:           "https://example.com/avatar.jpg",
				Locale:              "en",
				Email:               func() *types.Email { e := types.Email("john@example.com"); return &e }(),
				IsAnonymous:         false,
				DefaultRole:         "user",
				Metadata:            map[string]any{"firstName": "John", "lastName": "Doe"},
				EmailVerified:       true,
				PhoneNumber:         func() *string { s := "+1234567890"; return &s }(),
				PhoneNumberVerified: true,
				ActiveMfaType:       func() *string { s := "totp"; return &s }(),
				Roles:               []string{"user", "admin"},
			}),
			expectedJWT: nil,
			jwtTokenFn: func() *jwt.Token {
				return &jwt.Token{
					Raw:    "",
					Method: jwt.SigningMethodHS256,
					Header: map[string]any{
						"alg": "HS256",
						"typ": "JWT",
					},
					Claims: &jwt.MapClaims{
						"sub": userID.String(),
						"iss": "hasura-auth",
						"aud": "hasura-auth",
						"exp": float64(1234567890),
						"iat": float64(1234567890),
						"https://hasura.io/jwt/claims": map[string]any{
							"x-hasura-allowed-roles": []any{"user", "admin"},
							"x-hasura-default-role":  "user",
							"x-hasura-user-id":       userID.String(),
						},
					},
					Signature: []byte("signature"),
					Valid:     true,
				}
			},
			getControllerOpts: []getControllerOptsFunc{},
		},
		{
			name:   "error - unauthenticated user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				return mock.NewMockDBClient(ctrl)
			},
			request: api.GetUserRequestObject{},
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

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			}

			assertRequest(
				ctx, t, c.GetUser, tc.request, tc.expectedResponse,
			)
		})
	}
}
