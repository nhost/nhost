package controller_test

import (
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestGetProviderTokens(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

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

	cases := []testRequest[api.GetProviderTokensRequestObject, api.GetProviderTokensResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetProviderSession(
					gomock.Any(),
					sql.GetProviderSessionParams{
						UserID:     sql.UUID(userID),
						ProviderID: sql.Text("fake"),
					},
				).Return("1c6d0df04134afec1c9a3e95b4bdc48cf62780df72b537b8158845b6b71400c225f7d686cf2ca656553f7e4f771d29f6ba53b12f700d34ddab0386b92a541cdebdb15a294bcb00bbafd5cfb0072aeca0792b81a3be3a2316090b814ac3d04ef6b19eb4246ef89b461ce62abb165c5553a5a1766b1cf3bd19a3ada61abf1347fcaef1b43c134c21d8a6597aa7f2349ae3795ee7edff31ee44933b28e273bd53c768b7a5d8b5e898", nil) //nolint:lll

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: api.GetProviderTokens200JSONResponse{
				AccessToken:  "valid-accesstoken-1",
				ExpiresIn:    9000,
				ExpiresAt:    time.Date(2025, 10, 27, 12, 29, 7, 0, time.UTC),
				RefreshToken: new("valid-refreshtoken-1"),
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    true,
				}, nil)

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "session not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetProviderSession(
					gomock.Any(),
					sql.GetProviderSessionParams{
						UserID:     sql.UUID(userID),
						ProviderID: sql.Text("fake"),
					},
				).Return("", pgx.ErrNoRows)

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: api.GetProviderTokens200JSONResponse{
				AccessToken:  "",
				ExpiresIn:    0,
				ExpiresAt:    time.Time{},
				RefreshToken: nil,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "error",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetProviderSession(
					gomock.Any(),
					sql.GetProviderSessionParams{
						UserID:     sql.UUID(userID),
						ProviderID: sql.Text("fake"),
					},
				).Return("", errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name:   "missing jwt",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.GetProviderTokensRequestObject{
				Provider: "fake",
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  http.StatusBadRequest,
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

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			}

			assertRequest(
				ctx, t, c.GetProviderTokens, tc.request, tc.expectedResponse,
				testhelpers.FilterPathLast(
					[]string{".ExpiresAt"}, cmpopts.EquateApproxTime(time.Hour),
				),
			)
		})
	}
}
