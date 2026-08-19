package sms

import (
	"reflect"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/google/uuid"
	"github.com/nhost/nhost/services/auth/go/sql"
)

func TestAuthUserFromVerification(t *testing.T) {
	t.Parallel()

	userID := uuid.MustParse("db477732-48fa-4289-b694-2886a646b6eb")
	createdAt := sql.TimestampTz(time.Date(2025, 1, 2, 3, 4, 5, 0, time.UTC))
	updatedAt := sql.TimestampTz(time.Date(2025, 2, 3, 4, 5, 6, 0, time.UTC))
	lastSeen := sql.TimestampTz(time.Date(2025, 3, 4, 5, 6, 7, 0, time.UTC))
	otpExpiresAt := sql.TimestampTz(time.Date(2025, 4, 5, 6, 7, 8, 0, time.UTC))
	ticketExpiresAt := sql.TimestampTz(time.Date(2025, 5, 6, 7, 8, 9, 0, time.UTC))

	verification := sql.VerifySMSOTPAndPromotePhoneNumberRow{
		ID:                           userID,
		CreatedAt:                    createdAt,
		UpdatedAt:                    updatedAt,
		LastSeen:                     lastSeen,
		Disabled:                     false,
		DisplayName:                  "Jane Doe",
		AvatarUrl:                    "https://example.com/avatar.png",
		Locale:                       "en",
		Email:                        sql.Text("jane@example.com"),
		PhoneNumber:                  sql.Text("+1234567890"),
		PasswordHash:                 sql.Text("password-hash"),
		EmailVerified:                true,
		PhoneNumberVerified:          true,
		NewEmail:                     sql.Text("new@example.com"),
		OtpMethodLastUsed:            sql.Text("sms"),
		OtpHash:                      sql.Text(""),
		OtpHashExpiresAt:             otpExpiresAt,
		DefaultRole:                  "user",
		IsAnonymous:                  false,
		TotpSecret:                   sql.Text("totp-secret"),
		ActiveMfaType:                sql.Text("sms"),
		Ticket:                       sql.Text("ticket"),
		TicketExpiresAt:              ticketExpiresAt,
		Metadata:                     []byte(`{"source":"test"}`),
		WebauthnCurrentChallenge:     sql.Text("challenge"),
		OtpAttempts:                  3,
		NewPhoneNumber:               sql.Text("+1098765432"),
		PendingSmsDeanonymizeOptions: []byte(`{"default_role":"user"}`),
		Outcome:                      "verified",
	}

	got := reflect.ValueOf(authUserFromVerification(verification))
	source := reflect.ValueOf(verification)

	for i := range got.NumField() {
		field := got.Type().Field(i)

		sourceField := source.FieldByName(field.Name)
		if !sourceField.IsValid() {
			t.Fatalf("verification result has no %s field", field.Name)
		}

		if diff := cmp.Diff(sourceField.Interface(), got.Field(i).Interface()); diff != "" {
			t.Errorf("unexpected %s conversion (-want +got):\n%s", field.Name, diff)
		}
	}
}
