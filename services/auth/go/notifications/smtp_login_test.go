package notifications_test

import (
	"testing"

	"github.com/nhost/hasura-auth/go/notifications"
)

func TestSMTPAuthLogin(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name     string
		user     string
		password string
		host     string
	}{
		{
			name:     "success",
			user:     "user",
			password: "password",
			host:     "localhost",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mail := notifications.NewEmail(
				"localhost",
				1025,
				false,
				notifications.LoginAuth(tc.user, tc.password, tc.host),
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
