package sms

import (
	"context"
	"fmt"
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
	backend      GenericSMSProvider
	otpGenerator func() (string, string, error)
	otpHasher    func(string) (string, error)
	templates    *notifications.Templates
	db           DB
}

func NewSMS(
	backend GenericSMSProvider,
	otpGenerator func() (string, string, error),
	otpHasher func(string) (string, error),
	templates *notifications.Templates,
	db DB,
) *SMS {
	return &SMS{
		backend:      backend,
		otpGenerator: otpGenerator,
		otpHasher:    otpHasher,
		templates:    templates,
		db:           db,
	}
}

func (s *SMS) SendVerificationCode(to string, locale string) (string, time.Time, error) {
	code, hash, err := s.otpGenerator()
	if err != nil {
		return "", time.Time{}, fmt.Errorf("error generating OTP: %w", err)
	}

	body, err := s.templates.RenderSMS(locale, notifications.TemplateSMSData{
		Code: code,
	})
	if err != nil {
		return "", time.Time{}, fmt.Errorf("error rendering email template: %w", err)
	}

	if err := s.backend.SendSMS(to, body); err != nil {
		return "", time.Time{}, fmt.Errorf("error sending SMS: %w", err)
	}

	return hash, time.Now().Add(in5Minutes), nil
}

func (s *SMS) CheckVerificationCode(
	ctx context.Context, to string, code string,
) (sql.AuthUser, error) {
	otpHash, err := s.otpHasher(code)
	if err != nil {
		return sql.AuthUser{}, fmt.Errorf("error hashing OTP: %w", err)
	}

	user, err := s.db.GetUserByPhoneNumberAndOTP(ctx, sql.GetUserByPhoneNumberAndOTPParams{
		PhoneNumber: sql.Text(to),
		OtpHash:     sql.Text(otpHash),
	})
	if err != nil {
		return sql.AuthUser{}, fmt.Errorf("error getting user by phone number and OTP: %w", err)
	}

	return user, nil
}
