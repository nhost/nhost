package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestElevateWebauthn(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	// JWT token for authenticated user
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
					"x-hasura-allowed-roles": []any{"user"},
					"x-hasura-default-role":  "user",
					"x-hasura-user-id":       userID.String(),
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": userID.String(),
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	credentialIDString := "EuKJAraRGDcmHon-EjDoqoU5Yvk" //nolint:gosec

	var credentialID protocol.URLEncodedBase64
	if err := credentialID.UnmarshalJSON([]byte(credentialIDString)); err != nil {
		t.Fatal(err)
	}

	cases := []testRequest[api.ElevateWebauthnRequestObject, api.ElevateWebauthnResponseObject]{
		{
			name:   "success with authenticated user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetSecurityKeys(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserSecurityKey{
						{
							ID: uuid.MustParse(
								"307b758d-c0b0-4ce3-894b-f8ddec753c29",
							),
							UserID:       userID,
							CredentialID: "EuKJAraRGDcmHon-EjDoqoU5Yvk",
							CredentialPublicKey: []byte{
								165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 252, 177, 134,
								121, 67, 213, 214, 63, 237, 6, 140, 235, 18, 28, 108,
								116, 46, 248, 172, 201, 3, 152, 183, 242, 236, 130,
								102, 174, 113, 76, 228, 14, 34, 88, 32, 229, 226, 168,
								14, 4, 158, 235, 9, 15, 249, 188, 47, 65, 250, 174,
								87, 241, 33, 146, 18, 223, 140, 90, 111, 3, 45, 151,
								11, 228, 58, 46, 81,
							},
							Counter:    0,
							Transports: "",
							Nickname:   sql.Text(""),
						},
					},
					nil,
				)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request:    api.ElevateWebauthnRequestObject{},
			expectedResponse: api.ElevateWebauthn200JSONResponse(
				protocol.PublicKeyCredentialRequestOptions{
					Challenge:      protocol.URLEncodedBase64("ignoreme"),
					Timeout:        60000,
					RelyingPartyID: "react-apollo.example.nhost.io",
					AllowedCredentials: []protocol.CredentialDescriptor{
						{ //nolint:exhaustruct
							Type:         "public-key",
							CredentialID: credentialID,
						},
					},
					UserVerification: "preferred",
					Hints:            nil,
					Extensions:       nil,
				},
			),
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "webauthn disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnEnabled = false
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request:    api.ElevateWebauthnRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user has no security keys",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    false,
				}, nil)

				mock.EXPECT().GetSecurityKeys(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserSecurityKey{}, // no security keys
					nil,
				)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request:    api.ElevateWebauthnRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text("jane@acme.com"),
					DisplayName: "Jane Doe",
					Disabled:    true, // user is disabled
				}, nil)

				return mock
			},
			jwtTokenFn: jwtTokenFn,
			request:    api.ElevateWebauthnRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			// Set JWT context for authenticated endpoints
			ctx := t.Context()

			if tc.jwtTokenFn != nil {
				token := tc.jwtTokenFn()
				ctx = context.WithValue(ctx, controller.JWTContextKey, token) //nolint:staticcheck
			}

			assertRequest(
				ctx,
				t,
				c.ElevateWebauthn,
				tc.request,
				tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.ElevateWebauthn200JSONResponse{}, //nolint:exhaustruct
					"Challenge",
				),
			)
		})
	}
}
