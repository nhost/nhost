package controller_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestSignUpPasswordlessEmail(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.EmailPasswordlessEnabled = true

		return config
	}

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.SignUpPasswordlessEmailRequestObject, api.SignUpPasswordlessEmailResponseObject]{ //nolint:lll
		{
			name:   "success - new user signup",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				// Check user does not exist
				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:                uuid.UUID{},
						Disabled:          false,
						DisplayName:       "jane@acme.com",
						AvatarUrl:         "",
						Email:             sql.Text("jane@acme.com"),
						PasswordHash:      pgtype.Text{}, //nolint:exhaustruct
						Ticket:            sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt:   sql.TimestampTz(time.Now().Add(time.Hour)),
						EmailVerified:     false,
						Locale:            "en",
						DefaultRole:       "user",
						Metadata:          []byte("null"),
						Roles:             []string{"user", "me"},
						PhoneNumber:       pgtype.Text{}, //nolint:exhaustruct
						Otp:               "",
						OtpHashExpiresAt:  pgtype.Timestamptz{}, //nolint:exhaustruct
						OtpMethodLastUsed: pgtype.Text{},        //nolint:exhaustruct
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			request: api.SignUpPasswordlessEmailRequestObject{
				Body: &api.SignUpPasswordlessEmailRequest{
					Email:         "jane@acme.com",
					Options:       nil,
					CodeChallenge: nil,
				},
			},
			expectedResponse: api.SignUpPasswordlessEmail200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
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
				}),
			},
		},

		{ //nolint:dupl
			name:   "success - new user signup with PKCE",
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
						ID:                uuid.UUID{},
						Disabled:          false,
						DisplayName:       "jane@acme.com",
						AvatarUrl:         "",
						Email:             sql.Text("jane@acme.com"),
						PasswordHash:      pgtype.Text{}, //nolint:exhaustruct
						Ticket:            sql.Text("passwordlessEmail:xxx"),
						TicketExpiresAt:   sql.TimestampTz(time.Now().Add(time.Hour)),
						EmailVerified:     false,
						Locale:            "en",
						DefaultRole:       "user",
						Metadata:          []byte("null"),
						Roles:             []string{"user", "me"},
						PhoneNumber:       pgtype.Text{}, //nolint:exhaustruct
						Otp:               "",
						OtpHashExpiresAt:  pgtype.Timestamptz{}, //nolint:exhaustruct
						OtpMethodLastUsed: pgtype.Text{},        //nolint:exhaustruct
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			request: api.SignUpPasswordlessEmailRequestObject{
				Body: &api.SignUpPasswordlessEmailRequest{
					Email:         "jane@acme.com",
					Options:       nil,
					CodeChallenge: ptr("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"),
				},
			},
			expectedResponse: api.SignUpPasswordlessEmail200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withEmailer(func(ctrl *gomock.Controller) *mock.MockEmailer {
					mock := mock.NewMockEmailer(ctrl)

					mock.EXPECT().SendEmail(
						gomock.Any(),
						"jane@acme.com",
						"en",
						notifications.TemplateNameSigninPasswordless,
						testhelpers.GomockCmpOpts(
							notifications.TemplateData{
								Link:        "https://local.auth.nhost.run/verify?codeChallenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&redirectTo=http%3A%2F%2Flocalhost%3A3000&ticket=passwordlessEmail%3Ab66123b7-ea8b-4afe-a875-f201a2f8b224&type=signinPasswordless", //nolint:lll
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
				}),
			},
		},

		{
			name: "error - passwordless disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.EmailPasswordlessEnabled = false

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignUpPasswordlessEmailRequestObject{
				Body: &api.SignUpPasswordlessEmailRequest{
					Email:         "jane@acme.com",
					Options:       nil,
					CodeChallenge: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "disabled-endpoint",
				Message: "This endpoint is disabled",
				Status:  409,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name: "error - signup disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.DisableSignup = true

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignUpPasswordlessEmailRequestObject{
				Body: &api.SignUpPasswordlessEmailRequest{
					Email:         "jane@acme.com",
					Options:       nil,
					CodeChallenge: nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "signup-disabled",
				Message: "Sign up is disabled.",
				Status:  403,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			// When the user already exists we return 200 OK with no side effect
			// (no email sent, no mutation) to keep the signup surface
			// indistinguishable from the signin one — protecting against
			// account enumeration.
			name:   "user already exists - returns OK without sending email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: true,
				}, nil)

				return mock
			},
			request: api.SignUpPasswordlessEmailRequestObject{
				Body: &api.SignUpPasswordlessEmailRequest{
					Email:         "jane@acme.com",
					Options:       nil,
					CodeChallenge: nil,
				},
			},
			expectedResponse:  api.SignUpPasswordlessEmail200JSONResponse(api.OK),
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			// Same anti-enumeration behaviour when the user is unverified.
			name:   "user already exists but unverified - returns OK without sending email",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByEmail(
					gomock.Any(),
					sql.Text("jane@acme.com"),
				).Return(sql.AuthUser{ //nolint:exhaustruct
					ID:            userID,
					Email:         sql.Text("jane@acme.com"),
					EmailVerified: false,
				}, nil)

				return mock
			},
			request: api.SignUpPasswordlessEmailRequestObject{
				Body: &api.SignUpPasswordlessEmailRequest{
					Email:         "jane@acme.com",
					Options:       nil,
					CodeChallenge: nil,
				},
			},
			expectedResponse:  api.SignUpPasswordlessEmail200JSONResponse(api.OK),
			jwtTokenFn:        nil,
			expectedJWT:       nil,
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
				c.SignUpPasswordlessEmail,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
