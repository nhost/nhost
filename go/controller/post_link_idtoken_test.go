package controller_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func TestPostLinkIdToken(t *testing.T) { //nolint:maintidx
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
		config.GoogleClientID = "936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com"
		return config
	}

	token := "eyJhbGciOiJSUzI1NiIsImtpZCI6ImU4NjNmZTI5MmZhMmEyOTY3Y2Q3NTUxYzQyYTEyMTFiY2FjNTUwNzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI5MzYyODIyMjM4NzUtbzVrMHZiZmV2N21ra3NxbGExNXNsZzlhbTQydnZoY3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI5MzYyODIyMjM4NzUtMWJ0cXNxNGwxMTh1czUxa2RoYWxxb2Q0NGExN2JqMmUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDY5NjQxNDk4MDkxNjk0MjEwODIiLCJlbWFpbCI6InZld2V5aWY2NjBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5vbmNlIjoiZGYwNjNjYTliYmU5YzZlNWU4NGZhYjNlYjhmOTQxMmVhZmU4N2ZjNjBmMGE0Y2Y1YjY1YmExOTMwZGYzOGZmYSIsIm5hbWUiOiJKb2huIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tYNlN2MjZvQzg4UmlOR1MxQkhHc2N4V0xyZ2oxcHhiQ0hQcUZEeWN0WlJWeWV5dz1zOTYtYyIsImdpdmVuX25hbWUiOiJKb2huIiwiaWF0IjoxNzMxMDY3NzQ0LCJleHAiOjE3MzEwNzEzNDR9.P-k76nGt2m5iwciPh7yh_qIfh46-vJ0YV2NHeXkezA3zL23nXxF7HZ7O0EWPHTZyFFnpEzPZCQOEu2WvePiBthjwbDJsoMjrnK5rwd5-GdBhwZBKarH0ZzL6DxObUislLEwRocLsQHxVwqOuU-x_58d4DjPt9uPET7HE0jNoApwWaJciq50iUPMUqm_EinkUeUxYdA_iVc1mIu_mwsuwXYkOI-dRgyKZNqXs_phfhg8Qe8t6pZR-jPzlSDK1PcgtNQP5TcQA-FIMT6ErVzMS94TNSEhYXhl5SNCpeZMBl2TAwkI3lzex8eiwtV1GnkSp0Ljcvc9D0uaJqyzK5sLK3Q" //nolint:gosec,lll
	nonce := "4laVSZd0rNanAE0TS5iouQ=="

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	// refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.PostLinkIdtokenRequestObject, api.PostLinkIdtokenResponseObject]{
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
						ProviderID:     "google",
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
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					}, nil,
				)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.PostLinkIdtokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "google",
				},
			},
			expectedResponse: api.PostLinkIdtoken200JSONResponse("OK"),
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
			request: api.PostLinkIdtokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "google",
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
			request: api.PostLinkIdtokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "google",
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
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(
					sql.AuthUserProvider{}, //nolint:exhaustruct
					errors.New(`ERROR: duplicate key value violates unique constraint "user_providers_provider_id_provider_user_id_key" (SQLSTATE 23505)`), //nolint:goerr113,lll
				)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.PostLinkIdtokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Provider: "google",
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
			request: api.PostLinkIdtokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  "asdasdasd",
					Nonce:    ptr(nonce),
					Provider: "google",
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
			request: api.PostLinkIdtokenRequestObject{
				Body: &api.LinkIdTokenRequest{
					IdToken:  token,
					Nonce:    nil,
					Provider: "google",
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

			ctx := jwtGetter.ToContext(context.Background(), tc.jwtTokenFn())
			assertRequest(
				ctx,
				t,
				c.PostLinkIdtoken,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
