package controller_test

import (
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/hasura-auth/go/api"
	"github.com/nhost/hasura-auth/go/controller"
	"github.com/nhost/hasura-auth/go/controller/mock"
	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestPostSigninPasswordlessEmail(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.EmailPasswordlessEnabled = true
		return config
	}

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.PostSigninPasswordlessEmailRequestObject, api.PostSigninPasswordlessEmailResponseObject]{
		{
			name:   "signup required",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:              uuid.UUID{},
						Disabled:        false,
						DisplayName:     "jane@acme.com",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameSigninPasswordless,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=passwordlessEmail%3Ab66123b7-ea8b-4afe-a875-f201a2f8b224&type=signinPasswordless", //nolint:lll
							DisplayName: "jane@acme.com",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "passwordlessEmail:xxx",
							RedirectTo:  "http://localhost:3000",
							Locale:      "en",
							ServerURL:   "https://local.auth.nhost.run",
							ClientURL:   "http://localhost:3000",
						},
						testhelpers.FilterPathLast(
							[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

						testhelpers.FilterPathLast(
							[]string{".Link"}, cmp.Comparer(cmpLink)),
					)).Return(nil)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.PostSigninPasswordlessEmail200JSONResponse(api.OK),
			customClaimer:    nil,
			hibp:             nil,
			jwtTokenFn:       nil,
			expectedJWT:      nil,
		},

		{
			name: "signup required - passwordless disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.EmailPasswordlessEnabled = false
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			customClaimer: nil,
			hibp:          nil,
			jwtTokenFn:    nil,
			expectedJWT:   nil,
		},

		{
			name: "signup required - email not allowed",
			config: func() *controller.Config {
				config := getConfig()
				config.AllowedEmails = []string{"sad@acme.com"}
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "invalid-email-password",
				Message: "Incorrect email or password",
				Status:  401,
			},
			customClaimer: nil,
			hibp:          nil,
			jwtTokenFn:    nil,
			expectedJWT:   nil,
		},

		{
			name: "signup required - role not allowed",
			config: func() *controller.Config {
				config := getConfig()
				config.DisableSignup = true
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email: "jane@acme.com",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"admin"},
						DefaultRole:  nil,
						DisplayName:  nil,
						Locale:       nil,
						Metadata:     nil,
						RedirectTo:   nil,
					},
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "role-not-allowed",
				Message: "Role not allowed",
				Status:  400,
			},
			customClaimer: nil,
			hibp:          nil,
			jwtTokenFn:    nil,
			expectedJWT:   nil,
		},

		{
			name:   "signup required - locale not allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:              uuid.UUID{},
						Disabled:        false,
						DisplayName:     "jane@acme.com",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
						EmailVerified:   false,
						Locale:          "en",
						DefaultRole:     "user",
						Metadata:        []byte("null"),
						Roles:           []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameSigninPasswordless,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=passwordlessEmail%3Ab66123b7-ea8b-4afe-a875-f201a2f8b224&type=signinPasswordless", //nolint:lll
							DisplayName: "jane@acme.com",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "passwordlessEmail:xxx",
							RedirectTo:  "http://localhost:3000",
							Locale:      "en",
							ServerURL:   "https://local.auth.nhost.run",
							ClientURL:   "http://localhost:3000",
						},
						testhelpers.FilterPathLast(
							[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

						testhelpers.FilterPathLast(
							[]string{".Link"}, cmp.Comparer(cmpLink)),
					)).Return(nil)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email: "jane@acme.com",
					Options: &api.SignUpOptions{
						AllowedRoles: nil,
						DefaultRole:  nil,
						DisplayName:  nil,
						Locale:       ptr("xx"),
						Metadata:     nil,
						RedirectTo:   nil,
					},
				},
			},
			expectedResponse: api.PostSigninPasswordlessEmail200JSONResponse(api.OK),
			customClaimer:    nil,
			hibp:             nil,
			jwtTokenFn:       nil,
			expectedJWT:      nil,
		},

		{
			name:   "signup required - redirect not allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)
				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email: "jane@acme.com",
					Options: &api.SignUpOptions{
						AllowedRoles: nil,
						DefaultRole:  nil,
						DisplayName:  nil,
						Locale:       nil,
						Metadata:     nil,
						RedirectTo:   ptr("https://evil.com"),
					},
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "redirectTo-not-allowed",
				Message: `The value of "options.redirectTo" is not allowed.`,
				Status:  400,
			},
			customClaimer: nil,
			hibp:          nil,
			jwtTokenFn:    nil,
			expectedJWT:   nil,
		},

		{
			name: "signup required - options",
			config: func() *controller.Config {
				config := getConfig()
				config.AllowedLocales = []string{"en", "fr"}
				config.AllowedRedirectURLs = []string{"http://myapp"}
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:              uuid.UUID{},
						Disabled:        false,
						DisplayName:     "Jane Doe",
						AvatarUrl:       "",
						Email:           sql.Text("jane@acme.com"),
						PasswordHash:    pgtype.Text{}, //nolint:exhaustruct
						Ticket:          sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
						EmailVerified:   false,
						Locale:          "fr",
						DefaultRole:     "user",
						Metadata:        []byte(`{"asd":"asd"}`),
						Roles:           []string{"user"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"fr",
					notifications.TemplateNameSigninPasswordless,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Fmyapp&ticket=passwordlessEmail%3Ac2d0203a-2117-4445-bade-0ed8d5f44f4f&type=signinPasswordless", //nolint:lll
							DisplayName: "Jane Doe",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "passwordlessEmail:xxx",
							RedirectTo:  "http://myapp",
							Locale:      "fr",
							ServerURL:   "https://local.auth.nhost.run",
							ClientURL:   "http://localhost:3000",
						},
						testhelpers.FilterPathLast(
							[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

						testhelpers.FilterPathLast(
							[]string{".Link"}, cmp.Comparer(cmpLink)),
					)).Return(nil)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email: "jane@acme.com",
					Options: &api.SignUpOptions{
						AllowedRoles: &[]string{"user"},
						DefaultRole:  ptr("user"),
						DisplayName:  ptr("Jane Doe"),
						Locale:       ptr("fr"),
						Metadata:     &map[string]any{"asd": "asd"},
						RedirectTo:   ptr("http://myapp"),
					},
				},
			},
			expectedResponse: api.PostSigninPasswordlessEmail200JSONResponse(api.OK),
			customClaimer:    nil,
			hibp:             nil,
			jwtTokenFn:       nil,
			expectedJWT:      nil,
		},

		{
			name: "signup required - signup disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.DisableSignup = true
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			customClaimer: nil,
			hibp:          nil,
			jwtTokenFn:    nil,
			expectedJWT:   nil,
		},

		{
			name:   "signup not required",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{
					ID:                       userID,
					CreatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:                 false,
					DisplayName:              "jane@acme.com",
					AvatarUrl:                "",
					Locale:                   "en",
					Email:                    sql.Text("jane@acme.com"),
					PhoneNumber:              pgtype.Text{}, //nolint:exhaustruct
					PasswordHash:             pgtype.Text{}, //nolint:exhaustruct
					EmailVerified:            false,
					PhoneNumberVerified:      false,
					NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
					OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
					OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
					OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
					DefaultRole:              "",
					IsAnonymous:              false,
					TotpSecret:               pgtype.Text{},        //nolint:exhaustruct
					ActiveMfaType:            pgtype.Text{},        //nolint:exhaustruct
					Ticket:                   pgtype.Text{},        //nolint:exhaustruct
					TicketExpiresAt:          pgtype.Timestamptz{}, //nolint:exhaustruct
					Metadata:                 []byte{},
					WebauthnCurrentChallenge: pgtype.Text{}, //nolint:exhaustruct
				}, nil)

				mock.EXPECT().UpdateUserTicket(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserTicketParams{
						ID:              userID,
						Ticket:          sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt: sql.TimestampTz(time.Now().Add(time.Hour)),
					}),
				).Return(userID, nil)

				return mock
			},
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				mock.EXPECT().SendEmail(
					gomock.Any(),
					"jane@acme.com",
					"en",
					notifications.TemplateNameSigninPasswordless,
					testhelpers.GomockCmpOpts(
						notifications.TemplateData{
							Link:        "https://local.auth.nhost.run/verify?redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=passwordlessEmail%3Ab66123b7-ea8b-4afe-a875-f201a2f8b224&type=signinPasswordless", //nolint:lll
							DisplayName: "jane@acme.com",
							Email:       "jane@acme.com",
							NewEmail:    "",
							Ticket:      "passwordlessEmail:xxx",
							RedirectTo:  "http://localhost:3000",
							Locale:      "en",
							ServerURL:   "https://local.auth.nhost.run",
							ClientURL:   "http://localhost:3000",
						},
						testhelpers.FilterPathLast(
							[]string{".Ticket"}, cmp.Comparer(cmpTicket)),

						testhelpers.FilterPathLast(
							[]string{".Link"}, cmp.Comparer(cmpLink)),
					)).Return(nil)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: api.PostSigninPasswordlessEmail200JSONResponse(api.OK),
			customClaimer:    nil,
			hibp:             nil,
			jwtTokenFn:       nil,
			expectedJWT:      nil,
		},

		{
			name:   "signup not required - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{
					ID:                       userID,
					CreatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:                 true,
					DisplayName:              "jane@acme.com",
					AvatarUrl:                "",
					Locale:                   "en",
					Email:                    sql.Text("jane@acme.com"),
					PhoneNumber:              pgtype.Text{}, //nolint:exhaustruct
					PasswordHash:             pgtype.Text{}, //nolint:exhaustruct
					EmailVerified:            false,
					PhoneNumberVerified:      false,
					NewEmail:                 pgtype.Text{},        //nolint:exhaustruct
					OtpMethodLastUsed:        pgtype.Text{},        //nolint:exhaustruct
					OtpHash:                  pgtype.Text{},        //nolint:exhaustruct
					OtpHashExpiresAt:         pgtype.Timestamptz{}, //nolint:exhaustruct
					DefaultRole:              "",
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
			emailer: func(ctrl *gomock.Controller) *mock.MockEmailer {
				mock := mock.NewMockEmailer(ctrl)

				return mock
			},
			request: api.PostSigninPasswordlessEmailRequestObject{
				Body: &api.SignInPasswordlessEmailRequest{
					Email:   "jane@acme.com",
					Options: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-user", Message: "User is disabled", Status: 401,
			},
			customClaimer: nil,
			hibp:          nil,
			jwtTokenFn:    nil,
			expectedJWT:   nil,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)

			c, _ := getController(t, ctrl, tc.config, tc.db, getControllerOpts{
				customClaimer: nil,
				emailer:       tc.emailer,
				hibp:          nil,
			})

			assertRequest(
				context.Background(),
				t,
				c.PostSigninPasswordlessEmail,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
