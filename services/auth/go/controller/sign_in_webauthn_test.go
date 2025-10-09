package controller_test

import (
	"testing"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func TestSignInWebauthn(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	credentialIDString := "EuKJAraRGDcmHon-EjDoqoU5Yvk" //nolint:gosec,goconst,nolintlint

	var credentialID protocol.URLEncodedBase64
	if err := credentialID.UnmarshalJSON([]byte(credentialIDString)); err != nil {
		t.Fatal(err)
	}

	cases := []testRequest[api.SignInWebauthnRequestObject, api.SignInWebauthnResponseObject]{
		{
			name:   "success with email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetSecurityKeys(
					gomock.Any(),
					userID,
				).Return(
					[]sql.AuthUserSecurityKey{
						{
							ID: uuid.MustParse(
								"307b758d-c0b0-4ce3-894b-f8ddec753c29",
							),
							UserID: uuid.MustParse(
								"53b008ee-bafb-489c-bcea-9237e0b778a7",
							),
							CredentialID: "EuKJAraRGDcmHon-EjDoqoU5Yvk",
							CredentialPublicKey: []byte{
								165,
								1,
								2,
								3,
								38,
								32,
								1,
								33,
								88,
								32,
								252,
								177,
								134,
								121,
								67,
								213,
								214,
								63,
								237,
								6,
								140,
								235,
								18,
								28,
								108,
								116,
								46,
								248,
								172,
								201,
								3,
								152,
								183,
								242,
								236,
								130,
								102,
								174,
								113,
								76,
								228,
								14,
								34,
								88,
								32,
								229,
								226,
								168,
								14,
								4,
								158,
								235,
								9,
								15,
								249,
								188,
								47,
								65,
								250,
								174,
								87,
								241,
								33,
								146,
								18,
								223,
								140,
								90,
								111,
								3,
								45,
								151,
								11,
								228,
								58,
								46,
								81,
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
			request: api.SignInWebauthnRequestObject{
				Body: &api.SignInWebauthnJSONRequestBody{
					Email: ptr(types.Email("jane@acme.com")),
				},
			},
			expectedResponse: api.SignInWebauthn200JSONResponse(
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
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Disabled = true

				mock.EXPECT().GetUserByEmail(
					gomock.Any(), sql.Text("jane@acme.com"),
				).Return(user, nil)

				return mock
			},
			request: api.SignInWebauthnRequestObject{
				Body: &api.SignInWebauthnJSONRequestBody{
					Email: ptr(types.Email("jane@acme.com")),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
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
			request: api.SignInWebauthnRequestObject{
				Body: &api.SignInWebauthnJSONRequestBody{
					Email: ptr(types.Email("jane@acme.com")),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "success discoverable login",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInWebauthnRequestObject{
				Body: &api.SignInWebauthnJSONRequestBody{
					Email: nil,
				},
			},
			expectedResponse: api.SignInWebauthn200JSONResponse(
				protocol.PublicKeyCredentialRequestOptions{
					Challenge:          protocol.URLEncodedBase64("ignoreme"),
					Timeout:            60000,
					RelyingPartyID:     "react-apollo.example.nhost.io",
					AllowedCredentials: nil,
					UserVerification:   "preferred",
					Hints:              nil,
					Extensions:         nil,
				},
			),
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			assertRequest(
				t.Context(),
				t,
				c.SignInWebauthn,
				tc.request,
				tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.SignInWebauthn200JSONResponse{}, //nolint:exhaustruct
					"Challenge",
				),
			)
		})
	}
}
