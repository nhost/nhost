package controller_test

import (
	"testing"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestAddSecurityKey(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	credentialIDString := "EuKJAraRGDcmHon-EjDoqoU5Yvk" //nolint:gosec,goconst
	var credentialID protocol.URLEncodedBase64
	if err := credentialID.UnmarshalJSON([]byte(credentialIDString)); err != nil {
		t.Fatal(err)
	}

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

	cases := []testRequest[api.AddSecurityKeyRequestObject, api.AddSecurityKeyResponseObject]{
		{
			name:   "success - no existing security keys",
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

				mock.EXPECT().GetSecurityKeys(
					gomock.Any(),
					userID,
				).Return([]sql.AuthUserSecurityKey{}, nil)

				return mock
			},
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: api.AddSecurityKey200JSONResponse{
				RelyingParty: protocol.RelyingPartyEntity{
					CredentialEntity: protocol.CredentialEntity{
						Name: "React Apollo Example",
					},
					ID: "react-apollo.example.nhost.io",
				},
				User: protocol.UserEntity{
					CredentialEntity: protocol.CredentialEntity{
						Name: "Jane Doe",
					},
					DisplayName: "Jane Doe",
					ID:          userID.String(),
				},
				Challenge: []byte{},
				Parameters: []protocol.CredentialParameter{
					{Type: "public-key", Algorithm: -7},
					{Type: "public-key", Algorithm: -35},
					{Type: "public-key", Algorithm: -36},
					{Type: "public-key", Algorithm: -257},
					{Type: "public-key", Algorithm: -258},
					{Type: "public-key", Algorithm: -259},
					{Type: "public-key", Algorithm: -37},
					{Type: "public-key", Algorithm: -38},
					{Type: "public-key", Algorithm: -39},
					{Type: "public-key", Algorithm: -8},
				},
				Timeout:               60000,
				CredentialExcludeList: []protocol.CredentialDescriptor{},
				AttestationFormats:    nil,
				AuthenticatorSelection: protocol.AuthenticatorSelection{
					AuthenticatorAttachment: "",
					RequireResidentKey:      ptr(false),
					ResidentKey:             "preferred",
					UserVerification:        "preferred",
				},
				Attestation: "indirect",
				Extensions:  nil,
				Hints:       nil,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "success - with existing security keys",
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

				mock.EXPECT().GetSecurityKeys(
					gomock.Any(),
					userID,
				).Return([]sql.AuthUserSecurityKey{
					{
						ID:           uuid.MustParse("307b758d-c0b0-4ce3-894b-f8ddec753c29"),
						UserID:       userID,
						CredentialID: credentialIDString,
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
						Nickname:   sql.Text("My Key"),
					},
				}, nil)

				return mock
			},
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: api.AddSecurityKey200JSONResponse{
				RelyingParty: protocol.RelyingPartyEntity{
					CredentialEntity: protocol.CredentialEntity{
						Name: "React Apollo Example",
					},
					ID: "react-apollo.example.nhost.io",
				},
				User: protocol.UserEntity{
					CredentialEntity: protocol.CredentialEntity{
						Name: "Jane Doe",
					},
					DisplayName: "Jane Doe",
					ID:          userID.String(),
				},
				Challenge: protocol.URLEncodedBase64("ignoreme"),
				Timeout:   60000,
				CredentialExcludeList: []protocol.CredentialDescriptor{
					{ //nolint:exhaustruct
						Type:         "public-key",
						CredentialID: credentialID,
						Transport:    []protocol.AuthenticatorTransport{},
					},
				},
				Parameters: []protocol.CredentialParameter{
					{Type: "public-key", Algorithm: -7},
					{Type: "public-key", Algorithm: -35},
					{Type: "public-key", Algorithm: -36},
					{Type: "public-key", Algorithm: -257},
					{Type: "public-key", Algorithm: -258},
					{Type: "public-key", Algorithm: -259},
					{Type: "public-key", Algorithm: -37},
					{Type: "public-key", Algorithm: -38},
					{Type: "public-key", Algorithm: -39},
					{Type: "public-key", Algorithm: -8},
				},
				AttestationFormats: nil,
				AuthenticatorSelection: protocol.AuthenticatorSelection{
					AuthenticatorAttachment: "",
					RequireResidentKey:      ptr(false),
					ResidentKey:             "preferred",
					UserVerification:        "preferred",
				},
				Attestation: "indirect",
				Extensions:  nil,
				Hints:       nil,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
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
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "no jwt token",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.AddSecurityKeyRequestObject{},
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
			name:   "user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
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
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "anonymous user",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:          userID,
					Email:       sql.Text(""),
					DisplayName: "Anonymous",
					Disabled:    false,
					IsAnonymous: true,
				}, nil)

				return mock
			},
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "forbidden-anonymous",
				Message: "Forbidden, user is anonymous.",
				Status:  403,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "email not verified",
			config: func() *controller.Config {
				config := getConfig()
				config.RequireEmailVerification = true

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("jane@acme.com"),
					DisplayName:   "Jane Doe",
					Disabled:      false,
					EmailVerified: false,
				}, nil)

				return mock
			},
			request: api.AddSecurityKeyRequestObject{},
			expectedResponse: controller.ErrorResponse{
				Error:   "unverified-user",
				Message: "User is not verified.",
				Status:  401,
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(ctx, tc.jwtTokenFn())
			}

			assertRequest(
				ctx,
				t,
				c.AddSecurityKey,
				tc.request,
				tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.AddSecurityKey200JSONResponse{}, //nolint:exhaustruct
					"Challenge",
				),
			)
		})
	}
}
