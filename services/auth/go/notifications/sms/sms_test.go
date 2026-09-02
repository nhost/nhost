package sms_test

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/notifications/sms"
	"github.com/nhost/nhost/services/auth/go/notifications/sms/mock"
	"github.com/nhost/nhost/services/auth/go/sql"
	"go.uber.org/mock/gomock"
)

func assertErrAndStatus(
	t *testing.T, wantErr bool, wantStatus, gotStatus string, err error,
) {
	t.Helper()

	if wantErr {
		if err == nil {
			t.Fatalf("expected an error, got nil")
		}

		return
	}

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotStatus != wantStatus {
		t.Errorf("status = %q, want %q", gotStatus, wantStatus)
	}
}

func assertReturnedUser(t *testing.T, wantLoaded bool, wantID, gotID uuid.UUID) {
	t.Helper()

	if wantLoaded {
		if gotID != wantID {
			t.Errorf("returned user ID = %v, want %v", gotID, wantID)
		}

		return
	}

	var zero uuid.UUID
	if gotID != zero {
		t.Errorf("expected zero user, got ID %v", gotID)
	}
}

func TestCheckVerificationCode(t *testing.T) {
	t.Parallel()

	const (
		to   = "+15551230000"
		code = "654321"
	)

	errVerify := errors.New("verify boom")    //nolint:err113
	errGetUser := errors.New("get user boom") //nolint:err113

	var okUser sql.AuthUser

	okUser.ID = uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	okUser.PhoneNumber = sql.Text(to)
	okUser.PhoneNumberVerified = true

	tests := []struct {
		name              string
		status            string
		verifyErr         error
		getUserErr        error
		wantStatus        string
		wantErr           bool
		wantGetUserCalled bool
	}{
		{
			name:              "ok loads and returns the user",
			status:            sql.OTPStatusOK,
			verifyErr:         nil,
			getUserErr:        nil,
			wantStatus:        sql.OTPStatusOK,
			wantErr:           false,
			wantGetUserCalled: true,
		},
		{
			name:              "burned short-circuits without loading the user",
			status:            sql.OTPStatusBurned,
			verifyErr:         nil,
			getUserErr:        nil,
			wantStatus:        sql.OTPStatusBurned,
			wantErr:           false,
			wantGetUserCalled: false,
		},
		{
			name:              "invalid short-circuits without loading the user",
			status:            sql.OTPStatusInvalid,
			verifyErr:         nil,
			getUserErr:        nil,
			wantStatus:        sql.OTPStatusInvalid,
			wantErr:           false,
			wantGetUserCalled: false,
		},
		{
			name:              "verify error is wrapped",
			status:            "",
			verifyErr:         errVerify,
			getUserErr:        nil,
			wantStatus:        "",
			wantErr:           true,
			wantGetUserCalled: false,
		},
		{
			name:              "get user error is wrapped",
			status:            sql.OTPStatusOK,
			verifyErr:         nil,
			getUserErr:        errGetUser,
			wantStatus:        "",
			wantErr:           true,
			wantGetUserCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			ctrl := gomock.NewController(t)
			db := mock.NewMockDB(ctrl)

			db.EXPECT().VerifySMSOTPAndPromotePhoneNumber(
				gomock.Any(),
				sql.VerifySMSOTPAndPromotePhoneNumberParams{
					PhoneNumber: sql.Text(to),
					Otp:         code,
					MaxAttempts: sql.MaxOTPVerificationAttempts,
				},
			).Return(tt.status, tt.verifyErr)

			if tt.wantGetUserCalled {
				user := okUser
				if tt.getUserErr != nil {
					user = sql.AuthUser{}
				}

				db.EXPECT().
					GetUserByPhoneNumber(gomock.Any(), sql.Text(to)).
					Return(user, tt.getUserErr)
			}

			client := sms.NewSMS(nil, nil, db)

			user, status, err := client.CheckVerificationCode(t.Context(), to, code)

			assertErrAndStatus(t, tt.wantErr, tt.wantStatus, status, err)

			assertReturnedUser(
				t, tt.wantStatus == sql.OTPStatusOK && !tt.wantErr, okUser.ID, user.ID,
			)
		})
	}
}
