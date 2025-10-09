package sms

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/sql"
)

const (
	in5Minutes  = 5 * 60 * time.Second
	in10Minutes = 10 * 60 * time.Second
)

func ptr[T any](v T) *T {
	return &v
}

func deptr[T any](v *T) T { //nolint:ireturn
	if v == nil {
		var zero T
		return zero
	}

	return *v
}

type GenericSMSProvider interface {
	SendSMS(to string, body string) error
}

type DB interface {
	GetUserByPhoneNumberAndOTP(
		ctx context.Context, arg sql.GetUserByPhoneNumberAndOTPParams,
	) (sql.AuthUser, error)
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
) (sql.AuthUser, error) {
	user, err := s.db.GetUserByPhoneNumberAndOTP(ctx, sql.GetUserByPhoneNumberAndOTPParams{
		PhoneNumber: sql.Text(to),
		Otp:         code,
	})
	if err != nil {
		return sql.AuthUser{}, fmt.Errorf("error getting user by phone number and OTP: %w", err)
	}

	return user, nil
}
