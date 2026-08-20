package sms_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/notifications/sms"
	"github.com/nhost/nhost/services/auth/go/sql"
)

// stubVerifyDB implements sms.DB, records what it was called with, and returns
// canned results so CheckVerificationCode's branches can be exercised without a
// database. A same-package mock/ subdir cannot be imported from a black-box test
// without an import cycle, so this hand-written stub stands in.
type stubVerifyDB struct {
	status        string
	verifyErr     error
	user          sql.AuthUser
	getUserErr    error
	gotParams     sql.VerifySMSOTPAndPromotePhoneNumberParams
	getUserCalled bool
}

func (s *stubVerifyDB) VerifySMSOTPAndPromotePhoneNumber(
	_ context.Context, arg sql.VerifySMSOTPAndPromotePhoneNumberParams,
) (string, error) {
	s.gotParams = arg
	return s.status, s.verifyErr
}

func (s *stubVerifyDB) GetUserByPhoneNumber(
	_ context.Context, _ pgtype.Text,
) (sql.AuthUser, error) {
	s.getUserCalled = true
	if s.getUserErr != nil {
		var zero sql.AuthUser
		return zero, s.getUserErr
	}

	return s.user, nil
}

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

func assertVerifyParams(
	t *testing.T, got sql.VerifySMSOTPAndPromotePhoneNumberParams, wantPhone, wantOtp string,
) {
	t.Helper()

	if got.MaxAttempts != sql.MaxOTPVerificationAttempts {
		t.Errorf("MaxAttempts = %d, want %d", got.MaxAttempts, sql.MaxOTPVerificationAttempts)
	}

	if got.PhoneNumber != sql.Text(wantPhone) {
		t.Errorf("PhoneNumber = %+v, want %+v", got.PhoneNumber, sql.Text(wantPhone))
	}

	if got.Otp != wantOtp {
		t.Errorf("Otp = %q, want %q", got.Otp, wantOtp)
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

			var stub stubVerifyDB

			stub.status = tt.status
			stub.verifyErr = tt.verifyErr
			stub.user = okUser
			stub.getUserErr = tt.getUserErr

			client := sms.NewSMS(nil, nil, &stub)

			user, status, err := client.CheckVerificationCode(t.Context(), to, code)

			assertErrAndStatus(t, tt.wantErr, tt.wantStatus, status, err)

			if stub.getUserCalled != tt.wantGetUserCalled {
				t.Errorf(
					"getUserCalled = %v, want %v", stub.getUserCalled, tt.wantGetUserCalled,
				)
			}

			// The attempt cap for the general SMS flow is pinned here and nowhere
			// else, so assert every call carries it verbatim.
			assertVerifyParams(t, stub.gotParams, to, code)

			assertReturnedUser(
				t, tt.wantStatus == sql.OTPStatusOK && !tt.wantErr, okUser.ID, user.ID,
			)
		})
	}
}
