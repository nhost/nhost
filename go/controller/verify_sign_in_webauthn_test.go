package controller_test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func unmarshalRequest(t *testing.T, b []byte) *api.SignInWebauthnVerifyRequest {
	t.Helper()

	var v *api.SignInWebauthnVerifyRequest
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}

	return v
}

func TestVerifySignInWebauthn(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("d0902ee3-d160-4853-af6a-8d4b6248117e")

	// credentialIDString := "EuKJAraRGDcmHon-EjDoqoU5Yvk" //nolint:gosec
	// var credentialID protocol.URLEncodedBase64
	// if err := credentialID.UnmarshalJSON([]byte(credentialIDString)); err != nil {
	// 	t.Fatal(err)
	// }

	cases := []testRequest[api.VerifySignInWebauthnRequestObject, api.VerifySignInWebauthnResponseObject]{
		{
			name: "success",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnRPOrigins = []string{"http://localhost:3000"}
				config.WebauthnRPID = "localhost"
				config.WebauthnRPName = "React pollo Example"

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return([]sql.AuthUserRole{
					{UserID: userID, Role: "user"}, //nolint:exhaustruct
					{UserID: userID, Role: "me"},   //nolint:exhaustruct
				}, nil)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(refreshTokenID, nil)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(), userID,
				).Return(sql.TimestampTz(time.Now()), nil)

				return mock
			},
			request: api.VerifySignInWebauthnRequestObject{
				Body: unmarshalRequest(
					t,
					[]byte(
						`{"email":"whasd@asd.com","credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
					),
				),
			},
			expectedResponse: api.VerifySignInWebauthn200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane Doe",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       true,
						Id:                  "d0902ee3-d160-4853-af6a-8d4b6248117e",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            map[string]any{},
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
						ActiveMfaType:       nil,
					},
				},
			},
			expectedJWT: &jwt.Token{
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
						"x-hasura-user-id":           "d0902ee3-d160-4853-af6a-8d4b6248117e",
						"x-hasura-user-is-anonymous": "false",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "d0902ee3-d160-4853-af6a-8d4b6248117e",
				},
				Signature: []byte{},
				Valid:     true,
			},
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
			request: api.VerifySignInWebauthnRequestObject{
				Body: unmarshalRequest(
					t,
					[]byte(
						`{"email":"whasd@asd.com","credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
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
			name:   "wrong origin",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.VerifySignInWebauthnRequestObject{
				Body: unmarshalRequest(
					t,
					[]byte(
						`{"email":"whasd@asd.com","credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
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

		{
			name: "user disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnRPOrigins = []string{"http://localhost:3000"}
				config.WebauthnRPID = "localhost"
				config.WebauthnRPName = "React pollo Example"

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				user := getSigninUser(userID)
				user.Disabled = true

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(user, nil)

				return mock
			},
			request: api.VerifySignInWebauthnRequestObject{
				Body: unmarshalRequest(
					t,
					[]byte(
						`{"email":"whasd@asd.com","credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
					),
				),
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
			name: "success - discoverable",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnRPOrigins = []string{"http://localhost:3000"}
				config.WebauthnRPID = "localhost"
				config.WebauthnRPName = "React pollo Example"

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				userID := uuid.MustParse("176ce216-38af-4223-af49-6be702f4676c")

				mock.EXPECT().GetSecurityKeys(
					gomock.Any(), userID,
				).Return([]sql.AuthUserSecurityKey{
					{
						ID:           uuid.MustParse("85a4af56-6c7d-4371-ae66-d4682a660900"),
						UserID:       userID,
						CredentialID: "4OXfDI7QSSQQsmOV4-sz6LlS8_8",
						CredentialPublicKey: []byte{
							165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 7, 40, 121, 244, 90, 63, 43, 44, 129,
							197, 142, 82, 36, 179, 48, 89, 160, 215, 253, 76, 155, 37, 77, 251, 237,
							219, 111, 246, 205, 183, 77, 240, 34, 88, 32, 78, 37, 134, 117, 44, 128,
							33, 35, 73, 244, 164, 148, 110, 102, 244, 44, 7, 141, 69, 207, 34, 211,
							72, 24, 53, 58, 130, 205, 150, 71, 200, 204,
						},
						Counter:    0,
						Transports: "",
						Nickname:   pgtype.Text{}, //nolint:exhaustruct
					},
				}, nil)

				mock.EXPECT().GetUser(
					gomock.Any(), userID,
				).Return(getSigninUser(userID), nil)

				mock.EXPECT().GetUserRoles(
					gomock.Any(), userID,
				).Return([]sql.AuthUserRole{
					{UserID: userID, Role: "user"}, //nolint:exhaustruct
					{UserID: userID, Role: "me"},   //nolint:exhaustruct
				}, nil)

				mock.EXPECT().InsertRefreshtoken(
					gomock.Any(),
					cmpDBParams(sql.InsertRefreshtokenParams{
						UserID:           userID,
						RefreshTokenHash: pgtype.Text{}, //nolint:exhaustruct
						ExpiresAt:        sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						Type:             sql.RefreshTokenTypeRegular,
						Metadata:         nil,
					}),
				).Return(refreshTokenID, nil)

				mock.EXPECT().UpdateUserLastSeen(
					gomock.Any(), userID,
				).Return(sql.TimestampTz(time.Now()), nil)

				return mock
			},
			request: api.VerifySignInWebauthnRequestObject{
				Body: unmarshalRequest(
					t,
					[]byte(
						`{"credential":{"id":"4OXfDI7QSSQQsmOV4-sz6LlS8_8","rawId":"4OXfDI7QSSQQsmOV4-sz6LlS8_8","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiMndUMjlCM0RhUmlIbmEzYWoxNEpsVEMtT1hqZ0lja3dCQzM1bXl6X1RfbyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCIsImNyb3NzT3JpZ2luIjpmYWxzZX0","signature":"MEUCIFTNIExdczBeaM8MrMlBYVe1mAAzBBoTAaMzK2Mzo7geAiEAuIQH3CfMo1hRXWayZ-TXxu3m6evTBZBhJWvsI_d7ypI","userHandle":"176ce216-38af-4223-af49-6be702f4676c"},"type":"public-key"}}`, //nolint:lll
					),
				),
			},
			expectedResponse: api.VerifySignInWebauthn200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "c3b747ef-76a9-4c56-8091-ed3e6b8afb2c",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "",
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "Jane Doe",
						Email:               ptr(types.Email("jane@acme.com")),
						EmailVerified:       true,
						Id:                  "176ce216-38af-4223-af49-6be702f4676c",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            map[string]any{},
						PhoneNumber:         nil,
						PhoneNumberVerified: false,
						Roles:               []string{"user", "me"},
						ActiveMfaType:       nil,
					},
				},
			},
			expectedJWT: &jwt.Token{
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
						"x-hasura-user-id":           "176ce216-38af-4223-af49-6be702f4676c",
						"x-hasura-user-is-anonymous": "false",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "176ce216-38af-4223-af49-6be702f4676c",
				},
				Signature: []byte{},
				Valid:     true,
			},
			jwtTokenFn:        nil,
			getControllerOpts: []getControllerOptsFunc{},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

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
                    "Name": "whasd@asd.com",
                    "Email": "whasd@asd.com",
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

			b = []byte(`{
                  "Session": {
                    "challenge": "2wT29B3DaRiHna3aj14JlTC-OXjgIckwBC35myz_T_o",
                    "rpId": "localhost",
                    "user_id": null,
                    "expires": "2025-01-08T12:25:01.688438+01:00",
                    "userVerification": "preferred"
                  },
                  "User": {
                    "ID": "00000000-0000-0000-0000-000000000000",
                    "Name": "",
                    "Email": "",
                    "Credentials": [],
                    "Discoverable": true
                  },
                  "Options": null
                }`)
			var sessionDataDiscoverable controller.WebauthnChallenge
			if err := json.Unmarshal(b, &sessionDataDiscoverable); err != nil {
				t.Fatal(err)
			}

			if c.Webauthn != nil {
				c.Webauthn.Storage["nM6om8lzvT5oxvRCFuAqRDOj-tlAq8FdP-eRNOwsfgs"] = sessionData
				c.Webauthn.Storage["2wT29B3DaRiHna3aj14JlTC-OXjgIckwBC35myz_T_o"] = sessionDataDiscoverable
			}

			resp := assertRequest(
				t.Context(),
				t,
				c.VerifySignInWebauthn,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.VerifySignInWebauthn200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
