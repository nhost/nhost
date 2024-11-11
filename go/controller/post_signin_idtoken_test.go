package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/oidc"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/oapi-codegen/runtime/types"
	"go.uber.org/mock/gomock"
)

func getTestIDTokenValidatorProviders() func(t *testing.T) *oidc.IDTokenValidatorProviders {
	return func(t *testing.T) *oidc.IDTokenValidatorProviders {
		t.Helper()
		idtokenValidators, err := oidc.NewIDTokenValidatorProviders(
			context.Background(),
			"appleid",
			"936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com",
			jwt.WithTimeFunc(func() time.Time {
				return time.Date(2024, 11, 8, 12, 20, 0, 0, time.UTC)
			}),
		)
		if err != nil {
			t.Fatal("failed to create id token validator providers")
		}
		return idtokenValidators
	}
}

func TestPostSigninIdToken(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.EmailPasswordlessEnabled = true
		config.GoogleClientID = "936282223875-1btqsq4l118us51kdhalqod44a17bj2e.apps.googleusercontent.com"
		return config
	}

	token := "eyJhbGciOiJSUzI1NiIsImtpZCI6ImU4NjNmZTI5MmZhMmEyOTY3Y2Q3NTUxYzQyYTEyMTFiY2FjNTUwNzEiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI5MzYyODIyMjM4NzUtbzVrMHZiZmV2N21ra3NxbGExNXNsZzlhbTQydnZoY3MuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI5MzYyODIyMjM4NzUtMWJ0cXNxNGwxMTh1czUxa2RoYWxxb2Q0NGExN2JqMmUuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMDY5NjQxNDk4MDkxNjk0MjEwODIiLCJlbWFpbCI6InZld2V5aWY2NjBAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5vbmNlIjoiZGYwNjNjYTliYmU5YzZlNWU4NGZhYjNlYjhmOTQxMmVhZmU4N2ZjNjBmMGE0Y2Y1YjY1YmExOTMwZGYzOGZmYSIsIm5hbWUiOiJKb2huIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tYNlN2MjZvQzg4UmlOR1MxQkhHc2N4V0xyZ2oxcHhiQ0hQcUZEeWN0WlJWeWV5dz1zOTYtYyIsImdpdmVuX25hbWUiOiJKb2huIiwiaWF0IjoxNzMxMDY3NzQ0LCJleHAiOjE3MzEwNzEzNDR9.P-k76nGt2m5iwciPh7yh_qIfh46-vJ0YV2NHeXkezA3zL23nXxF7HZ7O0EWPHTZyFFnpEzPZCQOEu2WvePiBthjwbDJsoMjrnK5rwd5-GdBhwZBKarH0ZzL6DxObUislLEwRocLsQHxVwqOuU-x_58d4DjPt9uPET7HE0jNoApwWaJciq50iUPMUqm_EinkUeUxYdA_iVc1mIu_mwsuwXYkOI-dRgyKZNqXs_phfhg8Qe8t6pZR-jPzlSDK1PcgtNQP5TcQA-FIMT6ErVzMS94TNSEhYXhl5SNCpeZMBl2TAwkI3lzex8eiwtV1GnkSp0Ljcvc9D0uaJqyzK5sLK3Q" //nolint:gosec,lll
	nonce := "4laVSZd0rNanAE0TS5iouQ=="

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	insertResponse := sql.InsertUserWithUserProviderAndRefreshTokenRow{
		ID:             userID,
		RefreshTokenID: refreshTokenID,
	}

	cases := []testRequest[api.PostSigninIdtokenRequestObject, api.PostSigninIdtokenResponseObject]{
		{
			name:   "signup - simple",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("veweyif660@gmail.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProviderAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "John",
						AvatarUrl:             "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						Email:                 sql.Text("veweyif660@gmail.com"),
						Ticket:                sql.Text(""),
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         true,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      sql.Text("asdadasdasdasd"),
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ProviderID:            "google",
						ProviderUserID:        "106964149809169421082",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderAndRefreshTokenParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(insertResponse, nil)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: api.PostSigninIdtoken200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "db477732-48fa-4289-b694-2886a646b6eb",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "John",
						Email:               ptr(types.Email("veweyif660@gmail.com")),
						EmailVerified:       true,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         "",
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
						"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
						"x-hasura-user-is-anonymous": "false",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "db477732-48fa-4289-b694-2886a646b6eb",
				},
				Signature: []byte{},
				Valid:     true,
			},
			jwtTokenFn: nil,
		},

		{
			name:   "signup - with options",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("veweyif660@gmail.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProviderAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "Some other name",
						AvatarUrl:             "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						Email:                 sql.Text("veweyif660@gmail.com"),
						Ticket:                sql.Text(""),
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         true,
						Locale:                "se",
						DefaultRole:           "me",
						Metadata:              []byte(`{"key":"value"}`),
						Roles:                 []string{"me"},
						RefreshTokenHash:      sql.Text("asdadasdasdasd"),
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ProviderID:            "google",
						ProviderUserID:        "106964149809169421082",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderAndRefreshTokenParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken: token,
					Nonce:   ptr(nonce),
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"me"},
						DefaultRole:  ptr("me"),
						DisplayName:  ptr("Some other name"),
						Locale:       ptr("se"),
						Metadata: &map[string]interface{}{
							"key": "value",
						},
						RedirectTo: nil,
					},
					Provider: "google",
				},
			},
			expectedResponse: api.PostSigninIdtoken200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "db477732-48fa-4289-b694-2886a646b6eb",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						CreatedAt:           time.Now(),
						DefaultRole:         "me",
						DisplayName:         "Some other name",
						Email:               ptr(types.Email("veweyif660@gmail.com")),
						EmailVerified:       true,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "se",
						Metadata:            map[string]interface{}{"key": "value"},
						PhoneNumber:         "",
						PhoneNumberVerified: false,
						Roles:               []string{"me"},
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
						"x-hasura-allowed-roles":     []any{"me"},
						"x-hasura-default-role":      "me",
						"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
						"x-hasura-user-is-anonymous": "false",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "db477732-48fa-4289-b694-2886a646b6eb",
				},
				Signature: []byte{},
				Valid:     true,
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			jwtTokenFn: nil,
		},

		{
			name: "signup - disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableSignup = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("veweyif660@gmail.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},

		{
			name: "signup - disable new users",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableNewUsers = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("veweyif660@gmail.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProvider(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderParams{
						ID:              userID,
						Disabled:        true,
						DisplayName:     "John",
						AvatarUrl:       "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						Email:           sql.Text("veweyif660@gmail.com"),
						Ticket:          sql.Text(""),
						TicketExpiresAt: pgtype.Timestamptz{}, //nolint:exhaustruct
						EmailVerified:   true,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
						ProviderID:      "google",
						ProviderUserID:  "106964149809169421082",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(userID, nil)

				return mock
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},

		{
			name: "signup - email not allowed",
			config: func() *controller.Config {
				c := getConfig()
				c.AllowedEmails = []string{"not@anemail.blah"}
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
		},

		{
			name:   "signin - simple - provider id found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID( //nolint:dupl
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(
					//nolint:exhaustruct
					sql.AuthUser{
						ID: userID,
						CreatedAt: pgtype.Timestamptz{
							Time: time.Now(),
						},
						UpdatedAt:   pgtype.Timestamptz{},
						LastSeen:    pgtype.Timestamptz{},
						Disabled:    false,
						DisplayName: "John",
						AvatarUrl:   "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c",
						Locale:      "en",
						Email:       sql.Text("veweyif660@gmail.com"),
						PhoneNumber: pgtype.Text{},
						PasswordHash: sql.Text(
							"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
						),
						EmailVerified:            true,
						PhoneNumberVerified:      false,
						NewEmail:                 pgtype.Text{},
						OtpMethodLastUsed:        pgtype.Text{},
						OtpHash:                  pgtype.Text{},
						OtpHashExpiresAt:         pgtype.Timestamptz{},
						DefaultRole:              "user",
						IsAnonymous:              false,
						TotpSecret:               pgtype.Text{},
						ActiveMfaType:            pgtype.Text{},
						Ticket:                   pgtype.Text{},
						TicketExpiresAt:          pgtype.Timestamptz{},
						Metadata:                 []byte{},
						WebauthnCurrentChallenge: pgtype.Text{},
					}, nil)

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
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: api.PostSigninIdtoken200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "db477732-48fa-4289-b694-2886a646b6eb",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "John",
						Email:               ptr(types.Email("veweyif660@gmail.com")),
						EmailVerified:       true,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         "",
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
						"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
						"x-hasura-user-is-anonymous": "false",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "db477732-48fa-4289-b694-2886a646b6eb",
				},
				Signature: []byte{},
				Valid:     true,
			},
			jwtTokenFn: nil,
		},

		{
			name:   "signin - simple - user id found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("veweyif660@gmail.com"),
				).Return(
					//nolint:exhaustruct
					sql.AuthUser{
						ID: userID,
						CreatedAt: pgtype.Timestamptz{
							Time: time.Now(),
						},
						UpdatedAt:   pgtype.Timestamptz{},
						LastSeen:    pgtype.Timestamptz{},
						Disabled:    false,
						DisplayName: "John",
						AvatarUrl:   "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c",
						Locale:      "en",
						Email:       sql.Text("veweyif660@gmail.com"),
						PhoneNumber: pgtype.Text{},
						PasswordHash: sql.Text(
							"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
						),
						EmailVerified:            true,
						PhoneNumberVerified:      false,
						NewEmail:                 pgtype.Text{},
						OtpMethodLastUsed:        pgtype.Text{},
						OtpHash:                  pgtype.Text{},
						OtpHashExpiresAt:         pgtype.Timestamptz{},
						DefaultRole:              "user",
						IsAnonymous:              false,
						TotpSecret:               pgtype.Text{},
						ActiveMfaType:            pgtype.Text{},
						Ticket:                   pgtype.Text{},
						TicketExpiresAt:          pgtype.Timestamptz{},
						Metadata:                 []byte{},
						WebauthnCurrentChallenge: pgtype.Text{},
					}, nil)

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
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: api.PostSigninIdtoken200JSONResponse{
				Session: &api.Session{
					AccessToken:          "",
					AccessTokenExpiresIn: 900,
					RefreshTokenId:       "db477732-48fa-4289-b694-2886a646b6eb",
					RefreshToken:         "1fb17604-86c7-444e-b337-09a644465f2d",
					User: &api.User{
						AvatarUrl:           "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c", //nolint:lll
						CreatedAt:           time.Now(),
						DefaultRole:         "user",
						DisplayName:         "John",
						Email:               ptr(types.Email("veweyif660@gmail.com")),
						EmailVerified:       true,
						Id:                  "db477732-48fa-4289-b694-2886a646b6eb",
						IsAnonymous:         false,
						Locale:              "en",
						Metadata:            nil,
						PhoneNumber:         "",
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
						"x-hasura-user-id":           "db477732-48fa-4289-b694-2886a646b6eb",
						"x-hasura-user-is-anonymous": "false",
					},
					"iat": float64(time.Now().Unix()),
					"iss": "hasura-auth",
					"sub": "db477732-48fa-4289-b694-2886a646b6eb",
				},
				Signature: []byte{},
				Valid:     true,
			},
			jwtTokenFn: nil,
		},

		{
			name:   "signin - simple - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID( //nolint:dupl
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "google",
						ProviderUserID: "106964149809169421082",
					},
				).Return(
					//nolint:exhaustruct
					sql.AuthUser{
						ID: userID,
						CreatedAt: pgtype.Timestamptz{
							Time: time.Now(),
						},
						UpdatedAt:   pgtype.Timestamptz{},
						LastSeen:    pgtype.Timestamptz{},
						Disabled:    true,
						DisplayName: "John",
						AvatarUrl:   "https://lh3.googleusercontent.com/a/ACg8ocKX6Sv26oC88RiNGS1BHGscxWLrgj1pxbCHPqFDyctZRVyeyw=s96-c",
						Locale:      "en",
						Email:       sql.Text("veweyif660@gmail.com"),
						PhoneNumber: pgtype.Text{},
						PasswordHash: sql.Text(
							"$2a$10$pyv7eu9ioQcFnLSz7u/enex22P3ORdh6z6116Vj5a3vSjo0oxFa1u",
						),
						EmailVerified:            true,
						PhoneNumberVerified:      false,
						NewEmail:                 pgtype.Text{},
						OtpMethodLastUsed:        pgtype.Text{},
						OtpHash:                  pgtype.Text{},
						OtpHashExpiresAt:         pgtype.Timestamptz{},
						DefaultRole:              "user",
						IsAnonymous:              false,
						TotpSecret:               pgtype.Text{},
						ActiveMfaType:            pgtype.Text{},
						Ticket:                   pgtype.Text{},
						TicketExpiresAt:          pgtype.Timestamptz{},
						Metadata:                 []byte{},
						WebauthnCurrentChallenge: pgtype.Text{},
					}, nil)

				return mock
			},
			getControllerOpts: []getControllerOptsFunc{
				withIDTokenValidatorProviders(getTestIDTokenValidatorProviders()),
			},
			request: api.PostSigninIdtokenRequestObject{
				Body: &api.SignInIdTokenRequest{
					IdToken:  token,
					Nonce:    ptr(nonce),
					Options:  nil,
					Provider: "google",
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-user",
				Message: "User is disabled",
				Status:  401,
			},
			expectedJWT: nil,
			jwtTokenFn:  nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, jwtGetter := getController(t, ctrl, tc.config, tc.db, tc.getControllerOpts...)

			resp := assertRequest(
				context.Background(),
				t,
				c.PostSigninIdtoken,
				tc.request,
				tc.expectedResponse,
			)

			resp200, ok := resp.(api.PostSigninIdtoken200JSONResponse)
			if ok {
				assertSession(t, jwtGetter, resp200.Session, tc.expectedJWT)
			}
		})
	}
}
