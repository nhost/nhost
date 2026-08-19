package sms

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

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
	) (sql.VerifySMSOTPAndPromotePhoneNumberRow, error)
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

func (s *SMS) CheckVerificationCode(
	ctx context.Context, to string, code string,
) (sql.AuthUser, string, error) {
	verification, err := s.db.VerifySMSOTPAndPromotePhoneNumber(
		ctx,
		sql.VerifySMSOTPAndPromotePhoneNumberParams{
			PhoneNumber: sql.Text(to),
			Otp:         code,
		},
	)
	if err != nil {
		return sql.AuthUser{}, "", fmt.Errorf(
			"error verifying SMS OTP and promoting phone number: %w",
			err,
		)
	}

	return authUserFromVerification(verification), verification.Outcome, nil
}

func authUserFromVerification(
	verification sql.VerifySMSOTPAndPromotePhoneNumberRow,
) sql.AuthUser {
	return sql.AuthUser{
		ID:                           verification.ID,
		CreatedAt:                    verification.CreatedAt,
		UpdatedAt:                    verification.UpdatedAt,
		LastSeen:                     verification.LastSeen,
		Disabled:                     verification.Disabled,
		DisplayName:                  verification.DisplayName,
		AvatarUrl:                    verification.AvatarUrl,
		Locale:                       verification.Locale,
		Email:                        verification.Email,
		PhoneNumber:                  verification.PhoneNumber,
		PasswordHash:                 verification.PasswordHash,
		EmailVerified:                verification.EmailVerified,
		PhoneNumberVerified:          verification.PhoneNumberVerified,
		NewEmail:                     verification.NewEmail,
		OtpMethodLastUsed:            verification.OtpMethodLastUsed,
		OtpHash:                      verification.OtpHash,
		OtpHashExpiresAt:             verification.OtpHashExpiresAt,
		DefaultRole:                  verification.DefaultRole,
		IsAnonymous:                  verification.IsAnonymous,
		TotpSecret:                   verification.TotpSecret,
		ActiveMfaType:                verification.ActiveMfaType,
		Ticket:                       verification.Ticket,
		TicketExpiresAt:              verification.TicketExpiresAt,
		Metadata:                     verification.Metadata,
		WebauthnCurrentChallenge:     verification.WebauthnCurrentChallenge,
		OtpAttempts:                  verification.OtpAttempts,
		NewPhoneNumber:               verification.NewPhoneNumber,
		PendingSmsDeanonymizeOptions: verification.PendingSmsDeanonymizeOptions,
	}
}
