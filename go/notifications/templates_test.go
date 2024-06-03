package notifications_test

import (
	"errors"
	"io/fs"
	"log/slog"
	"slices"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/hasura-auth/go/notifications"
)

func TestGetRawTemplates(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name              string
		path              string
		expectedTemplates []string
		expectedErr       error
	}{
		{
			name: "success",
			path: "../../email-templates/",
			expectedTemplates: []string{
				"bg/email-confirm-change/body.html",
				"bg/email-confirm-change/subject.txt",
				"bg/email-verify/body.html",
				"bg/email-verify/subject.txt",
				"bg/password-reset/body.html",
				"bg/password-reset/subject.txt",
				"bg/signin-passwordless-sms/body.txt",
				"bg/signin-passwordless/body.html",
				"bg/signin-passwordless/subject.txt",
				"cs/email-confirm-change/body.html",
				"cs/email-confirm-change/subject.txt",
				"cs/email-verify/body.html",
				"cs/email-verify/subject.txt",
				"cs/password-reset/body.html",
				"cs/password-reset/subject.txt",
				"cs/signin-passwordless-sms/body.txt",
				"cs/signin-passwordless/body.html",
				"cs/signin-passwordless/subject.txt",
				"en/email-confirm-change/body.html",
				"en/email-confirm-change/subject.txt",
				"en/email-verify/body.html",
				"en/email-verify/subject.txt",
				"en/password-reset/body.html",
				"en/password-reset/subject.txt",
				"en/signin-passwordless-sms/body.txt",
				"en/signin-passwordless/body.html",
				"en/signin-passwordless/subject.txt",
				"es/email-confirm-change/body.html",
				"es/email-confirm-change/subject.txt",
				"es/email-verify/body.html",
				"es/email-verify/subject.txt",
				"es/password-reset/body.html",
				"es/password-reset/subject.txt",
				"es/signin-passwordless-sms/body.txt",
				"es/signin-passwordless/body.html",
				"es/signin-passwordless/subject.txt",
				"fr/email-confirm-change/body.html",
				"fr/email-confirm-change/subject.txt",
				"fr/email-verify/body.html",
				"fr/email-verify/subject.txt",
				"fr/password-reset/body.html",
				"fr/password-reset/subject.txt",
				"fr/signin-passwordless-sms/body.txt",
				"fr/signin-passwordless/body.html",
				"fr/signin-passwordless/subject.txt",
				"test/email-verify/body.html",
				"test/email-verify/subject.txt",
			},
			expectedErr: nil,
		},
		{
			name:              "failure",
			path:              "nonexistent",
			expectedTemplates: []string{},
			expectedErr:       fs.ErrNotExist,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := slog.Default()
			templates, err := notifications.NewTemplatesFromFilesystem(tc.path, "en", logger)
			if !errors.Is(err, tc.expectedErr) {
				t.Fatalf("expected error %s, got %s", tc.expectedErr, err)
			}
			if err != nil {
				return
			}

			templatesAvailable := make([]string, 0, len(templates.GetRawTemplates()))
			for k := range templates.GetRawTemplates() {
				templatesAvailable = append(templatesAvailable, k)
			}

			slices.Sort(templatesAvailable)

			if diff := cmp.Diff(tc.expectedTemplates, templatesAvailable); diff != "" {
				t.Errorf("unexpected templates (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRenderEmailVerify(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name            string
		data            notifications.TemplateData
		locale          string
		expectedBody    string
		expectedSubject string
	}{
		{
			name: "success",
			data: notifications.TemplateData{
				Link:        "http://link.test",
				DisplayName: "Jane Doe",
				Email:       "jane@doe.com",
				NewEmail:    "",
				Ticket:      "email-verify:xxxxxxxx",
				RedirectTo:  "http://redirect.test",
				Locale:      "en",
				ServerURL:   "http://server.test",
				ClientURL:   "http://client.test",
			},
			locale:          "test",
			expectedBody:    "http://link.test,\nJane Doe,\njane@doe.com,\nemail-verify:xxxxxxxx,\nhttp://redirect.test,\nhttp://server.test,\nhttp://client.test,\ntest,\n", //nolint:lll
			expectedSubject: "http://link.test, Jane Doe, jane@doe.com, email-verify:xxxxxxxx, http://redirect.test, http://server.test, http://client.test, test\n",         //nolint:lll
		},
		{
			name: "non-existent-locale",
			data: notifications.TemplateData{
				Link:        "http://link.test",
				DisplayName: "Jane Doe",
				Email:       "jane@doe.com",
				NewEmail:    "",
				Ticket:      "email-verify:xxxxxxxx",
				RedirectTo:  "http://redirect.test",
				Locale:      "en",
				ServerURL:   "http://server.test",
				ClientURL:   "http://client.test",
			},
			locale:          "non-existent",
			expectedBody:    "<!DOCTYPE html>\n<html>\n\n<head>\n  <meta charset=\"utf-8\" />\n</head>\n\n<body>\n  <h2>Verify Email</h2>\n  <p>Use this link to verify your email:</p>\n  <p>\n    <a href=\"http://link.test\">\n      Verify Email\n    </a>\n  </p>\n</body>\n\n</html>", //nolint:lll
			expectedSubject: "Verify your email",                                                                                                                                                                                                                                             //nolint:lll
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			logger := slog.Default()
			templates, err := notifications.NewTemplatesFromFilesystem(
				"../../email-templates/", "en", logger,
			)
			if err != nil {
				t.Fatalf("unexpected error: %s", err)
			}

			body, subject, err := templates.Render(
				tc.locale, notifications.TemplateNameEmailVerify, tc.data,
			)
			if err != nil {
				t.Fatalf("unexpected error: %s", err)
			}

			if diff := cmp.Diff(tc.expectedBody, body); diff != "" {
				t.Errorf("unexpected body (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedSubject, subject); diff != "" {
				t.Errorf("unexpected subject (-want +got):\n%s", diff)
			}
		})
	}
}
