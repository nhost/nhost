package controller_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func ImageURLComparer() cmp.Option {
	return cmp.FilterPath(func(p cmp.Path) bool {
		if last := p.Last(); last != nil {
			return last.String() == ".ImageUrl"
		}
		return false
	}, cmp.Comparer(func(x, y string) bool {
		return strings.HasPrefix(x, "data:image/png;base64,") ||
			strings.HasPrefix(y, "data:image/png;base64,")
	}))
}

func TestGetMfaTotpGenerate(t *testing.T) {
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

	cases := []testRequest[api.GetMfaTotpGenerateRequestObject, api.GetMfaTotpGenerateResponseObject]{
		{
			name:   "success",
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

				mock.EXPECT().UpdateUserTotpSecret(
					gomock.Any(),
					cmpDBParams(
						sql.UpdateUserTotpSecretParams{
							ID: userID,
							TotpSecret: sql.Text(
								"FEWCQAIILM6UOYZCPFYRAPAUCIFUUUK3JUZXWKJIN4ORQNK4EQCQ",
							),
						},
						testhelpers.FilterPathLast(
							[]string{".TotpSecret", "text()"},
							cmp.Comparer(cmpTicket),
						),
					),
				).Return(nil)

				return mock
			},
			request: api.GetMfaTotpGenerateRequestObject{},
			expectedResponse: api.GetMfaTotpGenerate200JSONResponse{
				ImageUrl:   "data:image/png;base64,",
				TotpSecret: "AIRVH6M4V422LZI6IRBN5SCEO6BWVIW3G6PLKKTENHMGZYRALPOQ",
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: nil,
		},

		{
			name: "mfa disbled",
			config: func() *controller.Config {
				config := getConfig()
				config.MfaEnabled = false
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.GetMfaTotpGenerateRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  http.StatusConflict,
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
			request: api.GetMfaTotpGenerateRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  http.StatusBadRequest,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
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
			request: api.GetMfaTotpGenerateRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  http.StatusForbidden,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
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
				ctx, t, c.GetMfaTotpGenerate, tc.request, tc.expectedResponse,
				ImageURLComparer(),
				cmp.FilterPath(func(p cmp.Path) bool {
					if last := p.Last(); last != nil {
						return last.String() == ".TotpSecret"
					}
					return false
				}, cmp.Ignore()),
			)
		})
	}
}
