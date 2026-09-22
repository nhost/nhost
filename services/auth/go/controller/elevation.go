package controller

import "github.com/nhost/nhost/services/auth/go/sql"

func smsFactorUsable(smsEnabled bool, user sql.AuthUser) bool {
	return smsEnabled &&
		user.PhoneNumber.Valid &&
		user.PhoneNumber.String != "" &&
		user.PhoneNumberVerified
}
