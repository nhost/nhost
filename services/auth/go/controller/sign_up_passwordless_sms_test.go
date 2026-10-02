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
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/controller"
	"github.com/nhost/nhost/services/auth/go/controller/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/nhost/nhost/services/auth/go/testhelpers"
	"go.uber.org/mock/gomock"
)

// Keep the endpoint's table-driven success, retry, and error cases together so they
// share the same request harness and configuration contract.
func TestSignUpPasswordlessSms(t *testing.T) { //nolint:maintidx
	t.Parallel()

	getConfig := func() *controller.Config {
		config := getConfig()
		config.SMSPasswordlessEnabled = true

		return config
	}

	userID := uuid.MustParse("DB477732-48FA-4289-B694-2886A646B6EB")

	cases := []testRequest[api.SignUpPasswordlessSmsRequestObject, api.SignUpPasswordlessSmsResponseObject]{
		{ //nolint:dupl
			name:   "success - new user signup",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient { //nolint:dupl
				mock := mock.NewMockDBClient(ctrl)

				// Check user does not exist
				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().UpdateStagedSMSUser(
					gomock.Any(),
					gomock.Any(),
				).Return(uuid.Nil, pgx.ErrNoRows)

				mock.EXPECT().InsertUser(
					gomock.Any(),
					cmpDBParams(
						sql.InsertUserParams{
							ID:                uuid.UUID{},
							Disabled:          false,
							DisplayName:       "+1234567890",
							AvatarUrl:         "",
							PhoneNumber:       pgtype.Text{},
							NewPhoneNumber:    sql.Text("+1234567890"),
							Otp:               "otp",
							OtpHashExpiresAt:  sql.TimestampTz(time.Now().Add(time.Minute * 5)),
							OtpMethodLastUsed: sql.Text("sms"),
							Email:             pgtype.Text{},
							PasswordHash:      pgtype.Text{},
							Ticket:            pgtype.Text{},
							TicketExpiresAt:   sql.TimestampTz(time.Now()),
							EmailVerified:     false,
							Locale:            "en",
							DefaultRole:       "user",
							Metadata:          []byte("null"),
							Roles:             []string{"user", "me"},
						},
						cmpopts.IgnoreFields(sql.InsertUserParams{}, "ID"),
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
			request: api.SignUpPasswordlessSmsRequestObject{
				Body: &api.SignUpPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: api.SignUpPasswordlessSms200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						t.Context(),
						"+1234567890",
						"en",
					).Return("otp", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name:   "success - staged SMS signup retry",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().UpdateStagedSMSUser(
					gomock.Any(),
					cmpDBParams(
						sql.UpdateStagedSMSUserParams{
							PhoneNumber:      sql.Text("+1234567890"),
							Disabled:         false,
							DisplayName:      "+1234567890",
							Otp:              "otp",
							OtpHashExpiresAt: sql.TimestampTz(time.Now().Add(time.Minute * 5)),
							Locale:           "en",
							DefaultRole:      "user",
							Metadata:         []byte("null"),
							Roles:            []string{"user", "me"},
						},
						testhelpers.FilterPathLast(
							[]string{".OtpHashExpiresAt", "time()"},
							cmpopts.EquateApproxTime(time.Minute),
						),
					),
				).Return(userID, nil)

				return mock
			},
			request: api.SignUpPasswordlessSmsRequestObject{
				Body: &api.SignUpPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: api.SignUpPasswordlessSms200JSONResponse(api.OK),
			jwtTokenFn:       nil,
			expectedJWT:      nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						t.Context(),
						"+1234567890",
						"en",
					).Return("otp", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name:   "error - staged SMS signup lookup",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{}, pgx.ErrNoRows)

				mock.EXPECT().UpdateStagedSMSUser(
					gomock.Any(),
					gomock.Any(),
				).Return(uuid.Nil, errors.New("database error")) //nolint:err113

				return mock
			},
			request: api.SignUpPasswordlessSmsRequestObject{
				Body: &api.SignUpPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse: controller.ErrorResponse{
				Error:   "internal-server-error",
				Message: "Internal server error",
				Status:  500,
			},
			jwtTokenFn:  nil,
			expectedJWT: nil,
			getControllerOpts: []getControllerOptsFunc{
				withSMS(func(ctrl *gomock.Controller) *mock.MockSMSer {
					mock := mock.NewMockSMSer(ctrl)

					mock.EXPECT().SendVerificationCode(
						t.Context(),
						"+1234567890",
						"en",
					).Return("otp", time.Now().Add(time.Minute*5), nil)

					return mock
				}),
			},
		},

		{
			name: "error - sms passwordless disabled",
			config: func() *controller.Config {
				config := getConfig()
				config.SMSPasswordlessEnabled = false

				return config
			},
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)
				return mock
			},
			request: api.SignUpPasswordlessSmsRequestObject{
				Body: &api.SignUpPasswordlessSmsRequest{
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
			request: api.SignUpPasswordlessSmsRequestObject{
				Body: &api.SignUpPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
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
			// Signup returns the same 200 OK whether the phone number is
			// registered or not so that the endpoint cannot be used to
			// enumerate accounts.
			name:   "user already exists - returns OK without sending SMS",
			config: getConfig,
			db: func(ctrl *gomock.Controller) controller.DBClient {
				mock := mock.NewMockDBClient(ctrl)

				mock.EXPECT().GetUserByPhoneNumber(
					gomock.Any(),
					sql.Text("+1234567890"),
				).Return(sql.AuthUser{
					ID:          userID,
					PhoneNumber: sql.Text("+1234567890"),
				}, nil)

				return mock
			},
			request: api.SignUpPasswordlessSmsRequestObject{
				Body: &api.SignUpPasswordlessSmsRequest{
					PhoneNumber: "+1234567890",
					Options:     nil,
				},
			},
			expectedResponse:  api.SignUpPasswordlessSms200JSONResponse(api.OK),
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
				c.SignUpPasswordlessSms,
				tc.request,
				tc.expectedResponse,
			)
		})
	}
}
