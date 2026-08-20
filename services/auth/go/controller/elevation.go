package controller

import "github.com/nhost/nhost/services/auth/go/sql"

// smsFactorUsable reports whether SMS can prove this user's identity. An
// absent, empty, or unverified phone number is not an authentication factor.
func smsFactorUsable(smsEnabled bool, user sql.AuthUser) bool {
	return smsEnabled &&
		user.PhoneNumber.Valid &&
		user.PhoneNumber.String != "" &&
		user.PhoneNumberVerified
}
