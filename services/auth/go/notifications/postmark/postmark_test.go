//go:build integration

package postmark_test

import (
	"context"
	"os"
	"testing"

	"github.com/nhost/hasura-auth/go/notifications"
	"github.com/nhost/hasura-auth/go/notifications/postmark"
)

func TestSendWithTemplate(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name         string
		locale       string
		templateName notifications.TemplateName
		data         notifications.TemplateData
	}{
		{
			name:         "success",
			locale:       "en",
			templateName: notifications.TemplateNameEmailVerify,
			data: notifications.TemplateData{
				Link:        "https://auth.nhost.run/verify?ticket=123",
				DisplayName: "Jane Doe",
				Email:       "jane@acme.com",
				NewEmail:    "",
				Ticket:      "123",
				RedirectTo:  "https://app.com/profile",
				Locale:      "en",
				ServerURL:   "https://auth.nhost.run",
				ClientURL:   "https://app.com",
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			pm := postmark.New(
				os.Getenv("AUTH_TEST_POSTMARK_FROM"), os.Getenv("AUTH_TEST_POSTMARK_TOKEN"))
			if err := pm.SendEmail(
				context.Background(), os.Getenv("AUTH_TEST_POSTMARK_TO"),
				tc.locale,
				tc.templateName,
				tc.data,
			); err != nil {
				t.Fatal(err)
			}
		})
	}
}
