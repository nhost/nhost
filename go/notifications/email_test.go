package notifications_test

import (
	"log/slog"
	"net/smtp"
	"testing"

	"github.com/nhost/hasura-auth/go/notifications"
)

func TestEmailSend(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name string
	}{
		{
			name: "",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			// tc := tc

			mail := notifications.NewEmail(
				"localhost",
				1025,
				smtp.PlainAuth("", "user", "password", "localhost"),
				"admin@localhost",
				map[string]string{
					"x-something": "asd",
				},
				nil,
			)
			headers := map[string]string{
				"x-another": "qwe",
			}
			if err := mail.Send("user@localhost", "some email", "contents", headers); err != nil {
				t.Fatalf("error sending email: %v", err)
			}
		})
	}
}

func TestEmailSendEmailVerify(t *testing.T) {
	t.Parallel()

	logger := slog.Default()
	templates, err := notifications.NewTemplatesFromFilesystem(
		"../../email-templates/", "en", logger,
	)
	if err != nil {
		t.Fatalf("unexpected error: %s", err)
	}
	mail := notifications.NewEmail(
		"localhost",
		1025,
		smtp.PlainAuth("", "user", "password", "localhost"),
		"admin@localhost",
		map[string]string{
			"x-something": "asd",
		},
		templates,
	)

	cases := []struct {
		name   string
		data   notifications.EmailVerifyData
		locale string
	}{
		{
			name: "",
			data: notifications.EmailVerifyData{
				Link:        "http://link",
				DisplayName: "Display Name",
				Email:       "user@email",
				Ticket:      "ticket",
				RedirectTo:  "http://redirect-to",
				ServerURL:   "http://servier-url",
				ClientURL:   "http://client-url",
			},
			locale: "en",
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			// tc := tc

			if err != nil {
				t.Fatalf("error creating mailer: %v", err)
			}

			if err := mail.SendEmailVerify("user@localhost", tc.locale, tc.data); err != nil {
				t.Fatalf("error sending email: %v", err)
			}
		})
	}
}
