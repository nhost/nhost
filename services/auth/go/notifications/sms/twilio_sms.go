package sms

import (
	"fmt"

	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/twilio/twilio-go"
	twilioApi "github.com/twilio/twilio-go/rest/api/v2010"
)

type TwilioSMS struct {
	client *twilio.RestClient
	from   string
}

func NewTwilioSMS(
	templates *notifications.Templates,
	accountSid string, authToken string, messageServiceSid string,
	db DB,
) *SMS {
	client := twilio.NewRestClientWithParams(twilio.ClientParams{ //nolint:exhaustruct
		Username: accountSid,
		Password: authToken,
	})

	return NewSMS(
		&TwilioSMS{
			client: client,
			from:   messageServiceSid,
		},
		templates,
		db,
	)
}

func (s *TwilioSMS) SendSMS(to string, body string) error {
	if _, err := s.client.Api.CreateMessage(&twilioApi.CreateMessageParams{ //nolint:exhaustruct
		To:   &to,
		From: &s.from,
		Body: &body,
	}); err != nil {
		return fmt.Errorf("failed to send SMS: %w", err)
	}

	return nil
}
