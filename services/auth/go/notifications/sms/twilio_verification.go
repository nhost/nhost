package sms

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/nhost/nhost/services/auth/go/sql"
	"github.com/twilio/twilio-go"
	openapi "github.com/twilio/twilio-go/rest/verify/v2"
)

type TwilioVerificationServiceDB interface {
	GetUserByPhoneNumber(ctx context.Context, phoneNumber pgtype.Text) (sql.AuthUser, error)
}

type TwilioVerificationService struct {
	client                *twilio.RestClient
	isVerificationService bool
	from                  string
	db                    TwilioVerificationServiceDB
}

func NewTwilioVerificationService(
	accountSid string, authToken string, messageServiceSid string, db TwilioVerificationServiceDB,
) *TwilioVerificationService {
	client := twilio.NewRestClientWithParams(twilio.ClientParams{ //nolint:exhaustruct
		Username: accountSid,
		Password: authToken,
	})

	return &TwilioVerificationService{
		client:                client,
		from:                  messageServiceSid,
		isVerificationService: strings.HasPrefix(messageServiceSid, "VA"),
		db:                    db,
	}
}

func (s *TwilioVerificationService) SendVerificationCode(
	_ context.Context, to string, locale string,
) (string, time.Time, error) {
	if _, err := s.client.VerifyV2.CreateVerification(
		s.from,
		&openapi.CreateVerificationParams{ //nolint:exhaustruct
			To:      &to,
			Locale:  &locale,
			Channel: new("sms"),
		},
	); err != nil {
		return "", time.Time{}, fmt.Errorf("failed to fetch verification service: %w", err)
	}

	return "", time.Now().Add(in10Minutes), nil
}

func (s *TwilioVerificationService) CheckVerificationCode(
	ctx context.Context, to string, code string,
) (sql.AuthUser, error) {
	resp, err := s.client.VerifyV2.CreateVerificationCheck(
		s.from,
		&openapi.CreateVerificationCheckParams{ //nolint:exhaustruct
			To:   &to,
			Code: &code,
		},
	)
	if err != nil {
		return sql.AuthUser{}, fmt.Errorf("failed to check verification code: %w", err)
	}

	if deptr(resp.Status) != "approved" {
		return sql.AuthUser{}, ErrInvalidOTP
	}

	user, err := s.db.GetUserByPhoneNumber(ctx, sql.Text(to))
	if err != nil {
		return sql.AuthUser{}, fmt.Errorf("failed to get user by phone number: %w", err)
	}

	return user, nil
}
