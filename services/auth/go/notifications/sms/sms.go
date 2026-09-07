//go:generate mockgen -package mock -destination mock/sms.go --source=sms.go
package sms

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/notifications"
	"github.com/nhost/nhost/services/auth/go/sql"
)

const in5Minutes = 5 * 60 * time.Second

type GenericSMSProvider interface {
	SendSMS(to string, body string) error
}

type DB interface {
	VerifySMSOTPAndPromotePhoneNumber(
		ctx context.Context, arg sql.VerifySMSOTPAndPromotePhoneNumberParams,
	) (string, error)
	GetUserByPhoneNumber(ctx context.Context, phoneNumber pgtype.Text) (sql.AuthUser, error)
}

type SMS struct {
	backend   GenericSMSProvider
	templates *notifications.Templates
	db        DB
}

func NewSMS(
	backend GenericSMSProvider,
	templates *notifications.Templates,
	db DB,
) *SMS {
	return &SMS{
		backend:   backend,
		templates: templates,
		db:        db,
	}
}

func (s *SMS) SendVerificationCode(
	ctx context.Context, to string, locale string,
) (string, time.Time, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000)) //nolint:mnd
	if err != nil {
		return "", time.Time{}, fmt.Errorf("error generating OTP: %w", err)
	}

	code := fmt.Sprintf("%06d", n)

	body, err := s.templates.RenderSMS(ctx, locale, notifications.TemplateSMSData{
		Code: code,
	})
	if err != nil {
		return "", time.Time{}, fmt.Errorf("error rendering email template: %w", err)
	}

	if err := s.backend.SendSMS(to, body); err != nil {
		return "", time.Time{}, fmt.Errorf("error sending SMS: %w", err)
	}

	return code, time.Now().Add(in5Minutes), nil
}

// CheckVerificationCode verifies an SMS OTP and, on 'ok', loads the user;
// 'burned'/'invalid' distinguish too-many-attempts from a wrong or expired code.
func (s *SMS) CheckVerificationCode(
	ctx context.Context, to string, code string,
) (sql.AuthUser, string, error) {
	var user sql.AuthUser

	status, err := s.db.VerifySMSOTPAndPromotePhoneNumber(
		ctx,
		sql.VerifySMSOTPAndPromotePhoneNumberParams{
			PhoneNumber: sql.Text(to),
			Otp:         code,
			MaxAttempts: sql.MaxOTPVerificationAttempts,
		},
	)
	if err != nil {
		return user, "", fmt.Errorf(
			"error verifying SMS OTP and promoting phone number: %w",
			err,
		)
	}

	if status != sql.OTPStatusOK {
		return user, status, nil
	}

	user, err = s.db.GetUserByPhoneNumber(ctx, sql.Text(to))
	if err != nil {
		return user, "", fmt.Errorf(
			"error loading user after SMS OTP verification: %w",
			err,
		)
	}

	return user, status, nil
}
