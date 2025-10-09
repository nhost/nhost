package sms

import (
	"log/slog"

	"github.com/nhost/nhost/services/auth/go/notifications"
)

type Dev struct {
	logger *slog.Logger
}

func NewDev(
	templates *notifications.Templates,
	db DB,
	logger *slog.Logger,
) *SMS {
	logger.Info("Using dev SMS provider. All SMS will be logged to the console.") //nolint:noctx

	return NewSMS(
		&Dev{
			logger: logger,
		},
		templates,
		db,
	)
}

func (s *Dev) SendSMS(to string, body string) error {
	s.logger.Info("Dev SMS sent", slog.String("to", to), slog.String("body", body)) //nolint:noctx
	return nil
}
