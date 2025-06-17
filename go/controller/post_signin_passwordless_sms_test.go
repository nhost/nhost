package controller_test

import (
	"errors"
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
	"github.com/nhost/hasura-auth/go/sql"
	"github.com/nhost/hasura-auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

func TestPostSigninPasswordlessSms(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.SMSPasswordlessEnabled = true
		return config
	}

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.PostSigninPasswordlessSmsRequestObject, api.PostSigninPasswordlessSmsResponseObject]{ //nolint:lll
		{
			name:   "signup required",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:                uuid.UUID{},
						Disabled:          false,
						DisplayName:       "+1234567890",
						AvatarUrl:         "",
						PhoneNumber:       sql.Text("+1234567890"),
						OtpHash:           sql.Text("hashedOTP"),
						OtpHashExpiresAt:  sql.TimestampTz(time.Now().Add(time.Minute * 5)),
						OtpMethodLastUsed: sql.Text("sms"),
						Email:             pgtype.Text{},        //nolint:exhaustruct
						PasswordHash:      pgtype.Text{},        //nolint:exhaustruct
						Ticket:            pgtype.Text{},        //nolint:exhaustruct
						TicketExpiresAt:   pgtype.Timestamptz{}, //nolint:exhaustruct
						EmailVerified:     false,
						Locale:            "en",
						DefaultRole:       "user",
						Metadata:          []byte("null"),
						Roles:             []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
						testhelpers.FilterPathLast(
							[]string{".OtpHash", "text()"},
							cmp.Comparer(func(x, y string) bool { return x != "" && y != "" }),
						),
						testhelpers.FilterPathLast(
							[]string{
								".OtpHashExpiresAt",
								"time()",
							},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: api.PostSigninPasswordlessSms200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						"+1234567890",
						"en",
					).Return("hashedOTP", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name: "signup required - sms passwordless disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.SMSPasswordlessEnabled = false
				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
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
			name:   "signup required - role not allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
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
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "signup required - locale not allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:                uuid.UUID{},
						Disabled:          false,
						DisplayName:       "+1234567890",
						AvatarUrl:         "",
						PhoneNumber:       sql.Text("+1234567890"),
						OtpHash:           sql.Text("hashedOTP"),
						OtpHashExpiresAt:  sql.TimestampTz(time.Now().Add(time.Minute * 5)),
						OtpMethodLastUsed: sql.Text("sms"),
						Email:             pgtype.Text{},        //nolint:exhaustruct
						PasswordHash:      pgtype.Text{},        //nolint:exhaustruct
						Ticket:            pgtype.Text{},        //nolint:exhaustruct
						TicketExpiresAt:   pgtype.Timestamptz{}, //nolint:exhaustruct
						EmailVerified:     false,
						Locale:            "en",
						DefaultRole:       "user",
						Metadata:          []byte("null"),
						Roles:             []string{"user", "me"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
						testhelpers.FilterPathLast(
							[]string{".OtpHash", "text()"},
							cmp.Comparer(func(x, y string) bool { return x != "" && y != "" }),
						),
						testhelpers.FilterPathLast(
							[]string{
								".OtpHashExpiresAt",
								"time()",
							},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
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
			expectedResponse: api.PostSigninPasswordlessSms200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						"+1234567890",
						"en",
					).Return("hashedOTP", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name:   "signup required - redirect not allowed",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
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
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
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

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(sql.InsertUserParams{
						ID:                uuid.UUID{},
						Disabled:          false,
						DisplayName:       "Jane Doe",
						AvatarUrl:         "",
						PhoneNumber:       sql.Text("+1234567890"),
						OtpHash:           sql.Text("hashedOTP"),
						OtpHashExpiresAt:  sql.TimestampTz(time.Now().Add(time.Minute * 5)),
						OtpMethodLastUsed: sql.Text("sms"),
						Email:             pgtype.Text{},        //nolint:exhaustruct
						PasswordHash:      pgtype.Text{},        //nolint:exhaustruct
						Ticket:            pgtype.Text{},        //nolint:exhaustruct
						TicketExpiresAt:   pgtype.Timestamptz{}, //nolint:exhaustruct
						EmailVerified:     false,
						Locale:            "fr",
						DefaultRole:       "user",
						Metadata:          []byte(`{"asd":"asd"}`),
						Roles:             []string{"user"},
					},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"), //nolint:exhaustruct
						testhelpers.FilterPathLast(
							[]string{".OtpHash", "text()"},
							cmp.Comparer(func(x, y string) bool { return x != "" && y != "" }),
						),
						testhelpers.FilterPathLast(
							[]string{
								".OtpHashExpiresAt",
								"time()",
							},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(sql.InsertUserRow{
					UserID:    userID,
					CreatedAt: sql.TimestampTz(time.Now()),
				}, nil)

				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
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
			expectedResponse: api.PostSigninPasswordlessSms200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						"+1234567890",
						"fr",
					).Return("hashedOTP", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
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

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows) //nolint:exhaustruct

				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
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
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						"+1234567890",
						"en",
					).Return("hashedOTP", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name:   "signup not required",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{
					ID:                       userID,
					CreatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:                 false,
					DisplayName:              "+1234567890",
					AvatarUrl:                "",
					Locale:                   "en",
					Email:                    pgtype.Text{}, //nolint:exhaustruct
					PhoneNumber:              sql.Text("+1234567890"),
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

				mock.EXPECT().UpdateUserOTPHash(
					gomock.Any(),
					cmpDBParams(sql.UpdateUserOTPHashParams{
						ID:                userID,
						OtpHash:           sql.Text("hashedOTP"),
						OtpHashExpiresAt:  sql.TimestampTz(time.Now().Add(time.Minute * 5)),
						OtpMethodLastUsed: sql.Text("sms"),
					},
						testhelpers.FilterPathLast(
							[]string{".OtpHash", "text()"},
							cmp.Comparer(func(x, y string) bool { return x != "" && y != "" }),
						),
						testhelpers.FilterPathLast(
							[]string{
								".OtpHashExpiresAt",
								"time()",
							},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(userID, nil)

				return mock
			},
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: api.PostSigninPasswordlessSms200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						"+1234567890",
						"en",
					).Return("hashedOTP", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name:   "signup not required - user disabled",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{
					ID:                       userID,
					CreatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:                 true,
					DisplayName:              "+1234567890",
					AvatarUrl:                "",
					Locale:                   "en",
					Email:                    pgtype.Text{}, //nolint:exhaustruct
					PhoneNumber:              sql.Text("+1234567890"),
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
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error: "disabled-user", Message: "User is disabled", Status: 401,
			},
			jwtTokenFn:        nil,
			expectedJWT:       nil,
			getControllerOpts: []getControllerOptsFunc{},
		},

		{
			name:   "sms sending fails",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{
					ID:                       userID,
					CreatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					UpdatedAt:                pgtype.Timestamptz{}, //nolint:exhaustruct
					LastSeen:                 pgtype.Timestamptz{}, //nolint:exhaustruct
					Disabled:                 false,
					DisplayName:              "+1234567890",
					AvatarUrl:                "",
					Locale:                   "en",
					Email:                    pgtype.Text{}, //nolint:exhaustruct
					PhoneNumber:              sql.Text("+1234567890"),
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
			request: api.PostSigninPasswordlessSmsRequestObject{
				Body: &api.SignInPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error: "cannot-send-sms", Message: "Cannot send SMS, check your phone number is correct", Status: 400,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						"+1234567890",
						"en",
					).Return("", time.Time{}, errors.New("SMS service error")) //nolint:err113

					return mock
				}),
			},
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
				c.PostSigninPasswordlessSms,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
