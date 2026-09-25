package controller

import (
	"github.com/nhost/nhost/services/auth/go/api"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func hasActiveTOTP(user sql.AuthUser) bool {
	return user.ActiveMfaType.String == string(api.UserMfaRequestActiveMfaTypeTotp) &&
		user.TotpSecret.String != ""
}

func hasEmail(user sql.AuthUser) bool {
	return user.Email.Valid && user.Email.String != ""
}

func hasVerifiedPhoneNumber(user sql.AuthUser) bool {
	return user.PhoneNumber.Valid &&
		user.PhoneNumber.String != "" &&
		user.PhoneNumberVerified
}
