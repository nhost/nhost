package controller_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func unmarshalUserWebauthnVerifyRequest(
	t *testing.T,
	b []byte,
) *api.VerifyAddSecurityKeyJSONRequestBody {
	t.Helper()

	var v *api.VerifyAddSecurityKeyJSONRequestBody
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}

	return v
}

func TestVerifyAddSecurityKey(t *testing.T) { //nolint:maintidx
	t.Parallel()

	userID := uuid.MustParse("cf91d1bc-875e-49bc-897f-fbccf32ede11")

	securityKeyID := uuid.MustParse("d0902ee3-d160-4853-af6a-8d4b6248117e")

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
					"x-hasura-allowed-roles":     []any{"user", "me"},
					"x-hasura-default-role":      "user",
					"x-hasura-user-id":           userID.String(),
					"x-hasura-user-is-anonymous": "false",
				},
				"iat": float64(time.Now().Unix()),
				"iss": "hasura-auth",
				"sub": userID.String(),
			},
			Signature: []byte{},
			Valid:     true,
		}
	}

	touchIDRequest, touchIDWebauthnChallenge := webAuthnTouchID(t)

	cases := []testRequest[api.VerifyAddSecurityKeyRequestObject, api.VerifyAddSecurityKeyResponseObject]{
		{
			name:   "success - with nickname",
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

				mock.EXPECT().InsertSecurityKey(
					gomock.Any(),
					sql.InsertSecurityKeyParams{
						UserID:       userID,
						CredentialID: "LychOomEPgZu4XNwiDvzlP5hd1U",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x57, 0xe1, 0xb5, 0x82, 0xa0, 0x95, 0xc4, 0x1a, 0xf3, 0x65, 0x9d, 0xdd, 0xc2, 0x68, 0xcf, 0x66, 0x35, 0x25, 0x32, 0xa5, 0x86, 0x22, 0xfb, 0xf7, 0xc6, 0xc6, 0x08, 0x6d, 0xa9, 0xc9, 0x64, 0x7f, 0x22, 0x58, 0x20, 0xa3, 0x50, 0x94, 0x11, 0xb8, 0x27, 0x52, 0xae, 0x46, 0xec, 0x56, 0x3a, 0x3b, 0x3a, 0x6d, 0x71, 0x24, 0x10, 0x66, 0xae, 0xb2, 0x57, 0x75, 0xd5, 0xbb, 0x98, 0x8c, 0xd0, 0xc5, 0x91, 0x1f, 0x65, //nolint:lll
						},
						Nickname: sql.Text("my-touch-id"),
					},
				).Return(securityKeyID, nil)

				return mock
			},
			request: api.VerifyAddSecurityKeyRequestObject{
				Body: &api.VerifyAddSecurityKeyJSONRequestBody{
					Credential: touchIDRequest,
					Nickname:   ptr("my-touch-id"),
				},
			},
			expectedResponse: api.VerifyAddSecurityKey200JSONResponse{
				Id:       "d0902ee3-d160-4853-af6a-8d4b6248117e",
				Nickname: ptr("my-touch-id"),
			},
			expectedJWT:       nil,
			jwtTokenFn:        jwtTokenFn,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "success - without nickname",
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

				mock.EXPECT().InsertSecurityKey(
					gomock.Any(),
					sql.InsertSecurityKeyParams{
						UserID:       userID,
						CredentialID: "LychOomEPgZu4XNwiDvzlP5hd1U",
						CredentialPublicKey: []uint8{
							0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, 0x57, 0xe1, 0xb5, 0x82, 0xa0, 0x95, 0xc4, 0x1a, 0xf3, 0x65, 0x9d, 0xdd, 0xc2, 0x68, 0xcf, 0x66, 0x35, 0x25, 0x32, 0xa5, 0x86, 0x22, 0xfb, 0xf7, 0xc6, 0xc6, 0x08, 0x6d, 0xa9, 0xc9, 0x64, 0x7f, 0x22, 0x58, 0x20, 0xa3, 0x50, 0x94, 0x11, 0xb8, 0x27, 0x52, 0xae, 0x46, 0xec, 0x56, 0x3a, 0x3b, 0x3a, 0x6d, 0x71, 0x24, 0x10, 0x66, 0xae, 0xb2, 0x57, 0x75, 0xd5, 0xbb, 0x98, 0x8c, 0xd0, 0xc5, 0x91, 0x1f, 0x65, //nolint:lll
						},
						Nickname: pgtype.Text{}, //nolint:exhaustruct
					},
				).Return(securityKeyID, nil)

				return mock
			},
			request: api.VerifyAddSecurityKeyRequestObject{
				Body: &api.VerifyAddSecurityKeyJSONRequestBody{
					Credential: touchIDRequest,
					Nickname:   nil,
				},
			},
			expectedResponse: api.VerifyAddSecurityKey200JSONResponse{
				Id:       "d0902ee3-d160-4853-af6a-8d4b6248117e",
				Nickname: nil,
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
			request: api.VerifyAddSecurityKeyRequestObject{
				Body: unmarshalUserWebauthnVerifyRequest(
					t,
					[]byte(
						`{"credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
					),
				),
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
			name: "wrong origin",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnRPID = "https://example.com"

				return config
			},
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

				return mock
			},
			request: api.VerifyAddSecurityKeyRequestObject{
				Body: &api.VerifyAddSecurityKeyJSONRequestBody{
					Credential: touchIDRequest,
					Nickname:   ptr("my-touch-id"),
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
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
			request: api.VerifyAddSecurityKeyRequestObject{
				Body: unmarshalUserWebauthnVerifyRequest(
					t,
					[]byte(
						`{"credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
					),
				),
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

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			// Setup webauthn session data for the test
			//nolint:lll
			b := []byte(`{
                "Session": {
                    "challenge": "nM6om8lzvT5oxvRCFuAqRDOj-tlAq8FdP-eRNOwsfgs",
                    "rpId": "localhost",
                    "user_id": "ZDA5MDJlZTMtZDE2MC00ODUzLWFmNmEtOGQ0YjYyNDgxMTdl",
                    "allowed_credentials": [
                      "rkT+z+JhiBWGseoxXEKPulXcKcM="
                    ],
                    "expires": "2138-12-25T00:16:09.50101387Z",
                    "userVerification": "preferred"
                  },
                  "User": {
                    "ID": "d0902ee3-d160-4853-af6a-8d4b6248117e",
                    "Name": "jane@acme.com",
                    "Email": "jane@acme.com",
                    "Credentials": [
                      {
                        "id": "rkT+z+JhiBWGseoxXEKPulXcKcM=",
                        "publicKey": "pQECAyYgASFYIM4zZsCd/pxWYoZUFEJAtkzQ1VQxjKRLe6w6hsqu10UsIlggq38O8aKu9VUTN3ddQF18iMRPV1DSkyIrP7AmGyIi4rA=",
                        "attestationType": "",
                        "transport": [],
                        "flags": {
                          "userPresent": false,
                          "userVerified": false,
                          "backupEligible": false,
                          "backupState": false
                        },
                        "authenticator": {
                          "AAGUID": null,
                          "signCount": 0,
                          "cloneWarning": false,
                          "attachment": ""
                        },
                        "attestation": {
                          "clientDataJSON": null,
                          "clientDataHash": null,
                          "authenticatorData": null,
                          "publicKeyAlgorithm": 0,
                          "object": null
                        }
                      }
                    ]
                  },
                  "Options": null
            }`)
			var sessionData controller.WebauthnChallenge
			if err := json.Unmarshal(b, &sessionData); err != nil {
				t.Fatal(err)
			}

			if c.Webauthn != nil {
				c.Webauthn.Storage["zznztjvFVUM0E2p8ZV6shXEcw2f4tbz5RrfZWk4VPXI"] = touchIDWebauthnChallenge
			}

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(ctx, tc.jwtTokenFn())
			}

			assertRequest(
				ctx,
				t,
				c.VerifyAddSecurityKey,
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
