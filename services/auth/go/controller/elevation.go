package controller

import (
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

// totpFactorUsable reports whether TOTP can prove this user's identity.
func totpFactorUsable(mfaEnabled bool, user sql.AuthUser) bool {
	return mfaEnabled &&
		user.ActiveMfaType.String == string(api.Totp) &&
		user.TotpSecret.String != ""
}

// emailFactorUsable reports whether email OTP can prove this user's identity.
func emailFactorUsable(
	otpEmailEnabled bool,
	requireEmailVerification bool,
	user sql.AuthUser,
) bool {
	return otpEmailEnabled &&
		user.Email.Valid &&
		user.Email.String != "" &&
		(user.EmailVerified || !requireEmailVerification)
}

// smsFactorUsable reports whether SMS can prove this user's identity. An
// absent, empty, or unverified phone number is not an authentication factor.
func smsFactorUsable(smsEnabled bool, user sql.AuthUser) bool {
	return smsEnabled &&
		user.PhoneNumber.Valid &&
		user.PhoneNumber.String != "" &&
		user.PhoneNumberVerified
}
