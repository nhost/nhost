//go:generate ./schema.sh
package sql //nolint:revive

import (
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

type RefreshTokenType string

const (
	RefreshTokenTypeRegular RefreshTokenType = "regular"
	RefreshTokenTypePAT     RefreshTokenType = "pat"
)

type OAuth2ClientType string

const (
	OAuth2ClientTypeRegistered OAuth2ClientType = "registered"
	OAuth2ClientTypeCIMD       OAuth2ClientType = "client_id_metadata_document"
)

// MaxOTPVerificationAttempts is the @max_attempts passed to every OTP
// verification query; a code is burned after this many wrong guesses.
const MaxOTPVerificationAttempts int32 = 5

// OTPStatus values are the statuses returned by the OTP verification queries.
const (
	OTPStatusOK      = "ok"
	OTPStatusBurned  = "burned"
	OTPStatusInvalid = "invalid"
)

func UUID(value uuid.UUID) pgtype.UUID {
	return pgtype.UUID{
		Bytes: value,
		Valid: true,
	}
}

func Text[T ~string](value T) pgtype.Text {
	return pgtype.Text{
		String: string(value),
		Valid:  true,
	}
}

func TimestampTz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{
		Time:             t,
		InfinityModifier: pgtype.Finite,
		Valid:            true,
	}
}

func ToPointerString(value pgtype.Text) *string {
	if value.Valid {
		return &value.String
	}

	return nil
}
