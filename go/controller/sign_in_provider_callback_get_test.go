package controller_test

import (
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/sql"
	"go.uber.org/mock/gomock"
)

func getState(
	t *testing.T,
	jwtGetter *controller.JWTGetter,
	connect *string,
	options api.SignUpOptions,
) string {
	t.Helper()

	state, err := jwtGetter.SignTokenWithClaims(
		jwt.MapClaims{
			"connect": connect,
			"options": api.SignUpOptions{
				AllowedRoles: options.AllowedRoles,
				DefaultRole:  options.DefaultRole,
				DisplayName:  options.DisplayName,
				Locale:       options.Locale,
				Metadata:     options.Metadata,
				RedirectTo:   options.RedirectTo,
			},
		},
		time.Now().Add(time.Minute),
	)
	if err != nil {
		t.Fatalf("failed to sign state: %v", err)
	}

	return state
}

func TestSignInProviderCallback(t *testing.T) { //nolint:maintidx
	t.Parallel()

	jwtGetter, err := controller.NewJWTGetter(
		jwtSecret,
		time.Minute,
		nil,
		"",
		nil,
	)
	if err != nil {
		t.Fatalf("failed to create jwt getter: %v", err)
	}

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	refreshTokenID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")
	userIDConnect := uuid.MustParse("f90782de-f0a3-41fe-b778-01e4f80c2413")

	insertResponse := sql.InsertUserWithUserProviderAndRefreshTokenRow{
		ID:             userID,
		RefreshTokenID: refreshTokenID,
	}

	// Create JWT token for connect tests
	jwtToken := "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwNzExMTE4MDI0LCJodHRwczovL2hhc3VyYS5pby9qd3QvY2xhaW1zIjp7IngtaGFzdXJhLWFsbG93ZWQtcm9sZXMiOlsibWUiLCJ1c2VyIiwiZWRpdG9yIl0sIngtaGFzdXJhLWRlZmF1bHQtcm9sZSI6InVzZXIiLCJ4LWhhc3VyYS11c2VyLWlkIjoiZjkwNzgyZGUtZjBhMy00MWZlLWI3NzgtMDFlNGY4MGMyNDEzIiwieC1oYXN1cmEtdXNlci1pcy1hbm9ueW1vdXMiOiJmYWxzZSJ9LCJpYXQiOjE3MTExMTgwMjQsImlzcyI6Imhhc3VyYS1hdXRoIiwic3ViIjoiZjkwNzgyZGUtZjBhMy00MWZlLWI3NzgtMDFlNGY4MGMyNDEzIn0.wms_3kNeVVeqxQvSMcM2l7By1BTz4uteKSAGmVgafYY" //nolint:lll,gosec

	cases := []testRequest[api.SignInProviderCallbackGetRequestObject, api.SignInProviderCallbackGetResponseObject]{ //nolint:lll
		{ //nolint:dupl
			name:   "signup",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("user1@fake.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProviderAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "User One",
						AvatarUrl:             "https://fake.com/images/profile/user1.jpg",
						Email:                 sql.Text("user1@fake.com"),
						Ticket:                sql.Text(""),
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         true,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      sql.Text("asdadasdasdasd"),
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ProviderID:            "fake",
						ProviderUserID:        "1234567890",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderAndRefreshTokenParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProviderCallbackGet302Response{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `^http://localhost:3000\?refreshToken=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "signup - with options",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("user1@fake.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProviderAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "My Name",
						AvatarUrl:             "https://fake.com/images/profile/user1.jpg",
						Email:                 sql.Text("user1@fake.com"),
						Ticket:                sql.Text(""),
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         true,
						Locale:                "es",
						DefaultRole:           "me",
						Metadata:              []byte(`{"key":"value"}`),
						Roles:                 []string{"me"},
						RefreshTokenHash:      sql.Text("asdadasdasdasd"),
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ProviderID:            "fake",
						ProviderUserID:        "1234567890",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderAndRefreshTokenParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{
						AllowedRoles: &[]string{"me"},
						DefaultRole:  ptr("me"),
						DisplayName:  ptr("My Name"),
						Locale:       ptr("es"),
						Metadata: &map[string]any{
							"key": "value",
						},
						RedirectTo: ptr("http://localhost:3000/redirect/me/here"),
					}),
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProviderCallbackGet302Response{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `^http://localhost:3000/redirect/me/here\?refreshToken=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{ //nolint:dupl
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
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("user1@fake.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000\?error=signup-disabled&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name: "signup - new users disabled",
			config: func() *controller.Config {
				c := getConfig()
				c.DisableNewUsers = true
				return c
			},
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("user1@fake.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProvider(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderParams{
						ID:              userID,
						Disabled:        true,
						DisplayName:     "User One",
						AvatarUrl:       "https://fake.com/images/profile/user1.jpg",
						Email:           sql.Text("user1@fake.com"),
						Ticket:          sql.Text(""),
						TicketExpiresAt: sql.TimestampTz(time.Now()),
						EmailVerified:   true,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
						ProviderID:      "fake",
						ProviderUserID:  "1234567890",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(userID, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000\?error=disabled-user&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
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

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("user1@fake.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000\?error=invalid-email-password&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "signin - simple - provider id found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID( //nolint:dupl
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
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
						DisplayName: "Jane",
						AvatarUrl:   "https://myapp.local/jane.jpg",
						Locale:      "en",
						Email:       sql.Text("jane@myapp.local"),
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
						TicketExpiresAt:          sql.TimestampTz(time.Now()),
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
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProviderCallbackGet302Response{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `^http://localhost:3000\?refreshToken=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "signin - simple - email found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("user1@fake.com"),
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
						DisplayName: "Jane",
						AvatarUrl:   "https://myapp.local/jane.jpg",
						Locale:      "en",
						Email:       sql.Text("jane@myapp.local"),
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
						TicketExpiresAt:          sql.TimestampTz(time.Now()),
						Metadata:                 []byte{},
						WebauthnCurrentChallenge: pgtype.Text{},
					}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userID,
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
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
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProviderCallbackGet302Response{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `^http://localhost:3000\?refreshToken=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "signin - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID( //nolint:dupl
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
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
						DisplayName: "Jane",
						AvatarUrl:   "https://myapp.local/jane.jpg",
						Locale:      "en",
						Email:       sql.Text("jane@myapp.local"),
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
						TicketExpiresAt:          sql.TimestampTz(time.Now()),
						Metadata:                 []byte{},
						WebauthnCurrentChallenge: pgtype.Text{},
					}, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000\?error=disabled-user&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "wrong state",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: "wrong-state",
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `http://localhost:3000?error=invalid-state&errorDescription=Invalid+state`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "wrong redirect",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{ //nolint:exhaustruct
						RedirectTo: ptr("http://now.allowed/redirect/me/here"),
					}),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `http://localhost:3000?error=redirectTo-not-allowed&errorDescription=The+value+of+%22options.redirectTo%22+is+not+allowed.`, //nolint:lll
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "wrong provider",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-1"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "idontexist",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `http://localhost:3000?error=disabled-endpoint&errorDescription=This+endpoint+is+disabled`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "provider errors",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					State: getState(
						t, jwtGetter, nil, api.SignUpOptions{}, //nolint:exhaustruct
					),
					Error:            ptr("error-coming-from-provider"),
					ErrorDescription: ptr("This is an error coming from the provider"),
					ErrorUri:         ptr("https://example.com/error"),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `http://localhost:3000?error=oauth-provider-error&errorDescription=Provider+returned+an+error&provider_error=error-coming-from-provider&provider_error_description=This+is+an+error+coming+from+the+provider&provider_error_url=https%3A%2F%2Fexample.com%2Ferror`, //nolint:lll
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "connect - success",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				//nolint:exhaustruct
				mock.EXPECT().GetUser( //nolint:dupl
					gomock.Any(),
					userIDConnect,
				).Return(sql.AuthUser{
					ID: userID,
					CreatedAt: pgtype.Timestamptz{
						Time: time.Now(),
					},
					UpdatedAt:   pgtype.Timestamptz{},
					LastSeen:    pgtype.Timestamptz{},
					Disabled:    false,
					DisplayName: "John",
					AvatarUrl:   "",
					Locale:      "en",
					Email:       sql.Text("fake@gmail.com"),
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
					TicketExpiresAt:          sql.TimestampTz(time.Now()),
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{},
				}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userIDConnect,
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(
					//nolint:exhaustruct
					sql.AuthUserProvider{
						ID:             userIDConnect,
						CreatedAt:      pgtype.Timestamptz{},
						UpdatedAt:      pgtype.Timestamptz{},
						UserID:         userID,
						AccessToken:    "unset",
						RefreshToken:   pgtype.Text{},
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					}, nil,
				)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, &jwtToken, api.SignUpOptions{ //nolint:exhaustruct
						RedirectTo: ptr("http://localhost:3000/connect-success"),
					}),
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProviderCallbackGet302Response{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `^http://localhost:3000/connect-success$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "connect - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				//nolint:exhaustruct
				mock.EXPECT().GetUser( //nolint:dupl
					gomock.Any(),
					userIDConnect,
				).Return(sql.AuthUser{
					ID: userIDConnect,
					CreatedAt: pgtype.Timestamptz{
						Time: time.Now(),
					},
					UpdatedAt:   pgtype.Timestamptz{},
					LastSeen:    pgtype.Timestamptz{},
					Disabled:    true,
					DisplayName: "John",
					AvatarUrl:   "",
					Locale:      "en",
					Email:       sql.Text("fake@gmail.com"),
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
					TicketExpiresAt:          sql.TimestampTz(time.Now()),
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{},
				}, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, &jwtToken, api.SignUpOptions{ //nolint:exhaustruct
						RedirectTo: ptr("http://localhost:3000/connect-success"),
					}),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000/connect-success\?error=disabled-user&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "connect - user not found",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUser(
					gomock.Any(),
					userIDConnect,
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, &jwtToken, api.SignUpOptions{ //nolint:exhaustruct
						RedirectTo: ptr("http://localhost:3000/connect-success"),
					}),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000/connect-success\?error=invalid-email-password&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "connect - provider already linked",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				//nolint:exhaustruct
				mock.EXPECT().GetUser( //nolint:dupl
					gomock.Any(),
					userIDConnect,
				).Return(sql.AuthUser{
					ID: userIDConnect,
					CreatedAt: pgtype.Timestamptz{
						Time: time.Now(),
					},
					UpdatedAt:   pgtype.Timestamptz{},
					LastSeen:    pgtype.Timestamptz{},
					Disabled:    false,
					DisplayName: "John",
					AvatarUrl:   "",
					Locale:      "en",
					Email:       sql.Text("fake@gmail.com"),
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
					TicketExpiresAt:          sql.TimestampTz(time.Now()),
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{},
				}, nil)

				mock.EXPECT().InsertUserProvider(
					gomock.Any(),
					sql.InsertUserProviderParams{
						UserID:         userIDConnect,
						ProviderID:     "fake",
						ProviderUserID: "1234567890",
					},
				).Return(
					sql.AuthUserProvider{}, //nolint:exhaustruct
					errors.New(`ERROR: duplicate key value violates unique constraint "user_providers_provider_id_provider_user_id_key" (SQLSTATE 23505)`), //nolint:lll,err113
				)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, &jwtToken, api.SignUpOptions{ //nolint:exhaustruct
						RedirectTo: ptr("http://localhost:3000/connect-success"),
					}),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000/connect-success\?error=invalid-request&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name:   "connect - invalid JWT",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code: ptr("valid-code-1"),
					State: getState(t, jwtGetter, ptr("invalid-jwt-token"),
						api.SignUpOptions{ //nolint:exhaustruct
							RedirectTo: ptr("http://localhost:3000/connect-success"),
						},
					),
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000/connect-success\?error=invalid-request&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{ //nolint:dupl
			name:   "signup - empty email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByProviderID(
					gomock.Any(),
					sql.GetUserByProviderIDParams{
						ProviderID:     "fake",
						ProviderUserID: "9876543210",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text(""),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProviderAndRefreshToken(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderAndRefreshTokenParams{
						ID:                    userID,
						Disabled:              false,
						DisplayName:           "User No Email",
						AvatarUrl:             "https://fake.com/images/profile/user2.jpg",
						Email:                 sql.Text(""),
						Ticket:                sql.Text(""),
						TicketExpiresAt:       sql.TimestampTz(time.Now()),
						EmailVerified:         false,
						Locale:                "en",
						DefaultRole:           "user",
						Metadata:              []byte("null"),
						Roles:                 []string{"user", "me"},
						RefreshTokenHash:      sql.Text("asdadasdasdasd"),
						RefreshTokenExpiresAt: sql.TimestampTz(time.Now().Add(30 * 24 * time.Hour)),
						ProviderID:            "fake",
						ProviderUserID:        "9876543210",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderAndRefreshTokenParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(insertResponse, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-empty-email"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: api.SignInProviderCallbackGet302Response{
				Headers: api.SignInProviderCallbackGet302ResponseHeaders{
					Location: `^http://localhost:3000\?refreshToken=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{ //nolint:dupl
			name: "signup - empty email with signup disabled",
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
						ProviderID:     "fake",
						ProviderUserID: "9876543210",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text(""),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-empty-email"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000\?error=signup-disabled&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
		},

		{
			name: "signup - empty email with new users disabled",
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
						ProviderID:     "fake",
						ProviderUserID: "9876543210",
					},
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text(""),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUserWithUserProvider(
					gomock.Any(),
					cmpDBParams(sql.InsertUserWithUserProviderParams{
						ID:              userID,
						Disabled:        true,
						DisplayName:     "User No Email",
						AvatarUrl:       "https://fake.com/images/profile/user2.jpg",
						Email:           pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text(""),
						TicketExpiresAt: sql.TimestampTz(time.Now()),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
						ProviderID:      "fake",
						ProviderUserID:  "9876543210",
					},
						cmpopts.IgnoreFields(
							sql.InsertUserWithUserProviderParams{}, //nolint:exhaustruct
							"ID",
						),
					),
				).Return(userID, nil)

				return mock
			},
			request: api.SignInProviderCallbackGetRequestObject{
				Params: api.SignInProviderCallbackGetParams{ //nolint:exhaustruct
					Code:  ptr("valid-code-empty-email"),
					State: getState(t, jwtGetter, nil, api.SignUpOptions{}), //nolint:exhaustruct
				},
				Provider: "fake",
			},
			expectedResponse: controller.ErrorRedirectResponse{
				Headers: struct{ Location string }{
					Location: `^http://localhost:3000\?error=disabled-user&errorDescription=.*$`,
				},
			},
			expectedJWT:       nil,
			jwtTokenFn:        nil,
			getControllerOpts: nil,
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
				c.SignInProviderCallbackGet,
				tc.request,
				tc.expectedResponse,
				cmp.FilterPath(func(p cmp.Path) bool {
					if last := p.Last(); last != nil {
						return last.String() == ".Location" //nolint:goconst
					}

					return false
				}, RegexpComparer()),
			)
		})
	}
}
