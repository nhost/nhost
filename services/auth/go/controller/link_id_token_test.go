package controller_test

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/oidc"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func testToken(t *testing.T, nonce string) string {
	t.Helper()

	claims := jwt.MapClaims{
		"iss":            "fake.issuer",
		"aud":            "myapp.local",
		"sub":            "106964149809169421082",
		"email":          "jane@myapp.local",
		"email_verified": true,
		"name":           "Jane",
		"picture":        "https://myapp.local/jane.jpg",
		"iat":            time.Now().Unix(),
		"exp":            time.Now().Add(time.Hour).Unix(),
	}

	if nonce != "" {
		hasher := sha256.New()
		hasher.Write([]byte(nonce))
		hashBytes := hasher.Sum(nil)
		noncestr := hex.EncodeToString(hashBytes)
		claims["nonce"] = noncestr
	}

	provider := oidc.FakeProvider{}

	token, err := provider.GenerateTestIDToken(claims)
	if err != nil {
		t.Fatalf("failed to generate test ID token: %v", err)
	}

	return token
}

func TestLinkIdToken(t *testing.T) { //nolint:maintidx
	t.Parallel()

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

	getConfig := func() *controller.Config {
		config := getConfig()
		config.EmailPasswordlessEnabled = true

		return config
	}

	nonce := "4laVSZd0rNanAE0TS5iouQ=="
	token := testToken(t, nonce)

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	// refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.LinkIdTokenRequestObject, api.LinkIdTokenResponseObject]{
		{
			name:   "success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser( //nolint:dupl
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{
					ID: userID,
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time: time.Now(),
					},
					UpdatedAt:   pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:    pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:    false,
					DisplayName: "John",
					AvatarUrl:   "",
					Locale:      "en",
					Email:       sql.Text("fake@gmail.com"),
					PhoneNumber: pgtype.Text{}, //nolint:exhaustruct
					PasswordHash: sql.Text(
						"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
					),
					EmailVerified:            true,
					PhoneNumberVerified:      false,
					NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
					OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
					OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
					OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
					DefaultRole:              "user",
					IsAnonymous:              false,
					TotpSecret:               pgtype.Text{},        //nolint:exhaustruct
					ActiveMfaType:            pgtype.Text{},        //nolint:exhaustruct
					Ticket:                   pgtype.Text{},        //nolint:exhaustruct
					TicketExpiresAt:          pgtype.Timestamptz{}, //nolint:exhaustruct
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userID,
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(
					sql.AuthUserProvider{
						ID:             userID,
						CreatedAt:      pgtype.Timestamptz{}, //nolint:exhaustruct
						UpdatedAt:      pgtype.Timestamptz{}, //nolint:exhaustruct
						UserID:         userID,
						AccessToken:    "unset",
						RefreshToken:   pgtype.Text{}, //nolint:exhaustruct
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					}, nil,
				)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.LinkIdTokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "fake",
				},
			},
			expectedResponse: api.LinkIdToken200JSONResponse("OK"),
			expectedJWT:      nil,
			jwtTokenFn:       jwtTokenFn,
		},

		{
			name:   "user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser( //nolint:dupl
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{
					ID: userID,
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time: time.Now(),
					},
					UpdatedAt:   pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:    pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:    true,
					DisplayName: "John",
					AvatarUrl:   "",
					Locale:      "en",
					Email:       sql.Text("fake@gmail.com"),
					PhoneNumber: pgtype.Text{}, //nolint:exhaustruct
					PasswordHash: sql.Text(
						"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
					),
					EmailVerified:            true,
					PhoneNumberVerified:      false,
					NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
					OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
					OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
					OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
					DefaultRole:              "user",
					IsAnonymous:              false,
					TotpSecret:               pgtype.Text{},        //nolint:exhaustruct
					ActiveMfaType:            pgtype.Text{},        //nolint:exhaustruct
					Ticket:                   pgtype.Text{},        //nolint:exhaustruct
					TicketExpiresAt:          pgtype.Timestamptz{}, //nolint:exhaustruct
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.LinkIdTokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  jwtTokenFn,
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
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.LinkIdTokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  jwtTokenFn,
		},

		{
			name:   "provider already linked",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser( //nolint:dupl
					gomock.Any(),
					userID,
				).Return(sql.AuthUser{
					ID: userID,
					CreatedAt: pgtype.Timestamptz{ //nolint:exhaustruct
						Time: time.Now(),
					},
					UpdatedAt:   pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:    pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:    false,
					DisplayName: "John",
					AvatarUrl:   "",
					Locale:      "en",
					Email:       sql.Text("fake@gmail.com"),
					PhoneNumber: pgtype.Text{}, //nolint:exhaustruct
					PasswordHash: sql.Text(
						"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
					),
					EmailVerified:            true,
					PhoneNumberVerified:      false,
					NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
					OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
					OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
					OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
					DefaultRole:              "user",
					IsAnonymous:              false,
					TotpSecret:               pgtype.Text{},        //nolint:exhaustruct
					ActiveMfaType:            pgtype.Text{},        //nolint:exhaustruct
					Ticket:                   pgtype.Text{},        //nolint:exhaustruct
					TicketExpiresAt:          pgtype.Timestamptz{}, //nolint:exhaustruct
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userID,
						ProviderID:     "fake",
						ProviderUserID: "106964149809169421082",
					},
				).Return(
					sql.AuthUserProvider{}, //nolint:exhaustruct
					errors.New(`ERROR: duplicate key value violates unique constraint "user_providers_provider_id_provider_user_id_key" (SQLSTATE 23505)`), //nolint:err113,lll
				)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.LinkIdTokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},

			expectedJWT: nil,
			jwtTokenFn:  jwtTokenFn,
		},

		{
			name:   "id token is garbage",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.LinkIdTokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  "asdasdasd",
					Nonce:    ptr(nonce),
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  jwtTokenFn,
		},

		{
			name:   "nonce is missing",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.LinkIdTokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    nil,
					Provider: "fake",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-request",
				Message: "The request payload is incorrect",
				Status:  400,
			},
			expectedJWT: nil,
			jwtTokenFn:  jwtTokenFn,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			ctx := jwtGetter.ToContext(t.Context(), tc.jwtTokenFn())
			assertRequest(
				ctx,
				t,
				c.LinkIdToken,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
