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
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func unmarshalElevateRequest(t *testing.T, b []byte) *api.SignInWebauthnVerifyRequest {
	t.Helper()

	var v *api.SignInWebauthnVerifyRequest
	if err := json.Unmarshal(b, &v); err != nil {
		t.Fatal(err)
	}

	return v
}

func TestPostElevateWebauthnVerify(t *testing.T) { //nolint:maintidx
	t.Parallel()

	refreshTokenID := uuid.MustParse("c3b747ef-76a9-4c56-8091-ed3e6b8afb2c")
	userID := uuid.MustParse("d0902ee3-d160-4853-af6a-8d4b6248117e")

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

	cases := []testRequest[api.PostElevateWebauthnVerifyRequestObject, api.PostElevateWebauthnVerifyResponseObject]{
		{
			name: "success",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnRPOrigins = []string{"http://localhost:3000"}
				config.WebauthnRPID = "localhost"             //nolint:goconst
				config.WebauthnRPName = "React pollo Example" //nolint:goconst

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userID,
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
			request: api.PostElevateWebauthnVerifyRequestObject{
				Body: unmarshalElevateRequest(
					t,
					[]byte(
						`{"credential":{"id":"rkT-z-JhiBWGseoxXEKPulXcKcM","rawId":"rkT-z-JhiBWGseoxXEKPulXcKcM","response":{"authenticatorData":"SZYN5YgOjGh0NBcPZHZgW4_krrmihjLHmVzzuoMdl2MdAAAAAA","clientDataJSON":"eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoibk02b204bHp2VDVveHZSQ0Z1QXFSRE9qLXRsQXE4RmRQLWVSTk93c2ZncyIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6MzAwMCJ9","signature":"MEYCIQDAjwCZjJdHQub-tZHyXKLYdm4_IYefv2p-V8Z5k8a9lwIhAOhV5Kc5po30xgAc3XrzSiwy-Q5ItdcIMXPP5-4FvHOt","userHandle":"d0902ee3-d160-4853-af6a-8d4b6248117e"},"type":"public-key","clientExtensionResults":{},"authenticatorAttachment":"platform"}}`, //nolint:lll
					),
				),
			},
			expectedResponse: api.PostElevateWebauthnVerify200JSONResponse{
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
						"x-hasura-auth-elevated":     "d0902ee3-d160-4853-af6a-8d4b6248117e",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "d0902ee3-d160-4853-af6a-8d4b6248117e",
				},
				Signature: []byte{},
				Valid:     true,
			},
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
			request: api.PostElevateWebauthnVerifyRequestObject{
				Body: unmarshalElevateRequest(
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
			name:   "wrong origin",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.PostElevateWebauthnVerifyRequestObject{
				Body: unmarshalElevateRequest(
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

		{
			name: "no jwt token",
			config: func() *controller.Config {
				config := getConfig()
				config.WebauthnRPOrigins = []string{"http://localhost:3000"}
				config.WebauthnRPID = "localhost"
				config.WebauthnRPName = "React pollo Example"

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.PostElevateWebauthnVerifyRequestObject{
				Body: unmarshalElevateRequest(
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
				c.Webauthn.Storage["nM6om8lzvT5oxvRCFuAqRDOj-tlAq8FdP-eRNOwsfgs"] = sessionData
			}

			ctx := t.Context()
			if tc.jwtTokenFn != nil {
				ctx = jwtGetter.ToContext(ctx, tc.jwtTokenFn())
			}

			resp := assertRequest(
				ctx,
				t,
				c.PostElevateWebauthnVerify,
				tc.request,
				tc.expectedResponse,
				cmpopts.IgnoreFields(
					api.PostElevateWebauthn200JSONResponse{}, //nolint:exhaustruct
					"Challenge",
				),
			)

			resp200, ok := resp.(api.PostElevateWebauthnVerify200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
