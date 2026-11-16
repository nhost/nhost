package notifications_test

import (
	"errors"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/nhost/nhost/services/auth/go/notifications"
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
				"bg/elevate-otp/body.html",
				"bg/elevate-otp/subject.txt",
				"bg/email-confirm-change/body.html",
				"bg/email-confirm-change/subject.txt",
				"bg/email-verify/body.html",
				"bg/email-verify/subject.txt",
				"bg/password-reset/body.html",
				"bg/password-reset/subject.txt",
				"bg/signin-otp/body.html",
				"bg/signin-otp/subject.txt",
				"bg/signin-passwordless-sms/body.txt",
				"bg/signin-passwordless/body.html",
				"bg/signin-passwordless/subject.txt",
				"cs/elevate-otp/body.html",
				"cs/elevate-otp/subject.txt",
				"cs/email-confirm-change/body.html",
				"cs/email-confirm-change/subject.txt",
				"cs/email-verify/body.html",
				"cs/email-verify/subject.txt",
				"cs/password-reset/body.html",
				"cs/password-reset/subject.txt",
				"cs/signin-otp/body.html",
				"cs/signin-otp/subject.txt",
				"cs/signin-passwordless-sms/body.txt",
				"cs/signin-passwordless/body.html",
				"cs/signin-passwordless/subject.txt",
				"en/elevate-otp/body.html",
				"en/elevate-otp/subject.txt",
				"en/email-confirm-change/body.html",
				"en/email-confirm-change/subject.txt",
				"en/email-verify/body.html",
				"en/email-verify/subject.txt",
				"en/password-reset/body.html",
				"en/password-reset/subject.txt",
				"en/signin-otp/body.html",
				"en/signin-otp/subject.txt",
				"en/signin-passwordless-sms/body.txt",
				"en/signin-passwordless/body.html",
				"en/signin-passwordless/subject.txt",
				"es/elevate-otp/body.html",
				"es/elevate-otp/subject.txt",
				"es/email-confirm-change/body.html",
				"es/email-confirm-change/subject.txt",
				"es/email-verify/body.html",
				"es/email-verify/subject.txt",
				"es/password-reset/body.html",
				"es/password-reset/subject.txt",
				"es/signin-otp/body.html",
				"es/signin-otp/subject.txt",
				"es/signin-passwordless-sms/body.txt",
				"es/signin-passwordless/body.html",
				"es/signin-passwordless/subject.txt",
				"fr/elevate-otp/body.html",
				"fr/elevate-otp/subject.txt",
				"fr/email-confirm-change/body.html",
				"fr/email-confirm-change/subject.txt",
				"fr/email-verify/body.html",
				"fr/email-verify/subject.txt",
				"fr/password-reset/body.html",
				"fr/password-reset/subject.txt",
				"fr/signin-otp/body.html",
				"fr/signin-otp/subject.txt",
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
			expectedBody:    "http://link.test,\nJane Doe,\njane@doe.com,\nemail-verify:xxxxxxxx,\nhttp://redirect.test,\nhttp://server.test,\nhttp://client.test,\ntest,\n",
			expectedSubject: "http://link.test, Jane Doe, jane@doe.com, email-verify:xxxxxxxx, http://redirect.test, http://server.test, http://client.test, test\n",
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
			locale: "non-existent",

			expectedBody: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" lang="en">
  <head>
    <meta content="text/html; charset=UTF-8" http-equiv="Content-Type" />
    <meta name="x-apple-disable-message-reformatting" />
  </head>
  <body style="background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif">
    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="max-width: 560px; margin: 20px auto 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #ececec">
      <tbody>
        <tr style="width: 100%">
          <td>
            <h1 style="font-size: 24px; letter-spacing: -0.5px; line-height: 1.3; font-weight: 400; color: #484848; margin-top: 0">Verify Email</h1>
            <p style="font-size: 15px; line-height: 1.4; margin: 0 0 10px; color: #3c4149">Use this link to verify your email:</p>
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="padding: 10px 0 0px">
              <tbody>
                <tr>
                  <td>
                    <a href="http://link.test" style="line-height: 100%; text-decoration: none; display: block; max-width: 100%; background-color: #0052cd; border-radius: 3px; font-weight: 600; color: #fff; font-size: 15px; text-align: center; padding: 11px 23px 11px 23px" target="_blank"
                      ><span
                        ><!--[if mso]><i style="mso-font-width: 383.33333333333337%; mso-text-raise: 16.5" hidden>&#8202;&#8202;&#8202;</i><![endif]--></span
                      ><span style="max-width: 100%; display: inline-block; line-height: 120%; mso-padding-alt: 0px; mso-text-raise: 8.25px">Verify Email</span
                      ><span
                        ><!--[if mso]><i style="mso-font-width: 383.33333333333337%" hidden>&#8202;&#8202;&#8202;&#8203;</i><![endif]--></span
                      ></a
                    >
                  </td>
                </tr>
              </tbody>
            </table>
            <hr style="width: 100%; border: none; border-top: 1px solid #eaeaea; border-color: #dfe1e4; margin: 20px 0 20px" />
            <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
              <tbody>
                <tr>
                  <td>
                    <table align="center" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tbody style="width: 100%">
                        <tr style="width: 100%">
                          <td data-id="__react-email-column" style="width: 30px"><img alt="Nhost Logo" height="20" src="https://nhost.io/images/emails/icon.png" style="display: block; outline: none; border: none; text-decoration: none; border-radius: 0; width: 20px; height: 20px" width="20" /></td>
                          <td data-id="__react-email-column" style="margin: 0"><a href="https://nhost.io" style="color: #b4becc; text-decoration: none; font-size: 14px" target="_blank">Powered by Nhost</a></td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`,
			expectedSubject: "Verify your email",
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
				t.Context(), tc.locale, notifications.TemplateNameEmailVerify, tc.data,
			)
			if err != nil {
				t.Fatalf("unexpected error: %s", err)
			}

			// Log the body for debugging purposes
			t.Logf("Rendered Body: %s", body)

			if diff := cmp.Diff(tc.expectedBody, body); diff != "" {
				t.Errorf("unexpected body (-want +got):\n%s", diff)
			}

			if diff := cmp.Diff(tc.expectedSubject, subject); diff != "" {
				t.Errorf("unexpected subject (-want +got):\n%s", diff)
			}
		})
	}
}

func writeTemplateFiles(t *testing.T, files map[string]string) string {
	t.Helper()

	root := t.TempDir()
	for name, contents := range files {
		path := filepath.Join(root, name)
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			t.Fatal(err)
		}

		if err := os.WriteFile(path, []byte(contents), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	return root
}

func TestRenderEmailFallback(t *testing.T) {
	t.Parallel()

	embeddedBody, err := os.ReadFile("../../email-templates/en/elevate-otp/body.html")
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name            string
		defaultLocale   string
		files           map[string]string
		expectedBody    string
		expectedSubject string
	}{
		{
			name:          "requested locale overrides default locale",
			defaultLocale: "en",
			files: map[string]string{
				"fr/elevate-otp/body.html":   "French ${ticket} ${locale}",
				"fr/elevate-otp/subject.txt": "French ${locale}",
				"en/elevate-otp/body.html":   "English ${ticket}",
				"en/elevate-otp/subject.txt": "English",
			},
			expectedBody:    "French 123456 fr",
			expectedSubject: "French fr",
		},
		{
			name:          "same template in default locale overrides embedded translation",
			defaultLocale: "en",
			files: map[string]string{
				"en/elevate-otp/body.html":    "English ${ticket} ${locale}",
				"en/elevate-otp/subject.txt":  "English ${locale}",
				"en/email-verify/body.html":   "Wrong template",
				"en/email-verify/subject.txt": "Wrong template",
			},
			expectedBody:    "English 123456 en",
			expectedSubject: "English en",
		},
		{
			name:          "missing subject falls back with body",
			defaultLocale: "en",
			files: map[string]string{
				"fr/elevate-otp/body.html":   "Incomplete French body",
				"en/elevate-otp/body.html":   "English ${ticket}",
				"en/elevate-otp/subject.txt": "English",
			},
			expectedBody:    "English 123456",
			expectedSubject: "English",
		},
		{
			name:          "missing body falls back with subject",
			defaultLocale: "en",
			files: map[string]string{
				"fr/elevate-otp/subject.txt": "Incomplete French subject",
				"en/elevate-otp/body.html":   "English ${ticket}",
				"en/elevate-otp/subject.txt": "English",
			},
			expectedBody:    "English 123456",
			expectedSubject: "English",
		},
		{
			name:            "empty folder uses embedded English",
			defaultLocale:   "cs",
			files:           nil,
			expectedBody:    strings.ReplaceAll(string(embeddedBody), "${ticket}", "123456"),
			expectedSubject: "Session elevation code\n",
		},
		{
			name:          "existing custom folder without elevation template uses embedded English",
			defaultLocale: "fr",
			files: map[string]string{
				"fr/email-verify/body.html":   "Wrong template",
				"fr/email-verify/subject.txt": "Wrong template",
			},
			expectedBody:    strings.ReplaceAll(string(embeddedBody), "${ticket}", "123456"),
			expectedSubject: "Session elevation code\n",
		},
		{
			name:          "incomplete default locale uses embedded English",
			defaultLocale: "cs",
			files: map[string]string{
				"cs/elevate-otp/body.html":   "Incomplete default body",
				"en/elevate-otp/body.html":   "Unconfigured custom locale",
				"en/elevate-otp/subject.txt": "Unconfigured custom locale",
			},
			expectedBody:    strings.ReplaceAll(string(embeddedBody), "${ticket}", "123456"),
			expectedSubject: "Session elevation code\n",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			templates, err := notifications.NewTemplatesFromFilesystem(
				writeTemplateFiles(t, tc.files), tc.defaultLocale, slog.Default(),
			)
			if err != nil {
				t.Fatal(err)
			}

			body, subject, err := templates.Render(
				t.Context(), "fr", notifications.TemplateNameElevateOTP,
				notifications.TemplateData{Ticket: "123456", Locale: "user-locale"},
			)
			if err != nil {
				t.Fatal(err)
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

func TestRenderEmbeddedEmailTemplates(t *testing.T) {
	t.Parallel()

	templates, err := notifications.NewTemplatesFromFilesystem("", "cs", slog.Default())
	if err != nil {
		t.Fatal(err)
	}

	for _, name := range []notifications.TemplateName{
		notifications.TemplateNameEmailVerify,
		notifications.TemplateNameEmailConfirmChange,
		notifications.TemplateNameElevateOTP,
		notifications.TemplateNameSigninPasswordless,
		notifications.TemplateNameSigninOTP,
		notifications.TemplateNamePasswordReset,
	} {
		t.Run(string(name), func(t *testing.T) {
			t.Parallel()

			body, subject, err := templates.Render(
				t.Context(),
				"fr",
				name,
				notifications.TemplateData{
					Link:       "https://example.com",
					Ticket:     "123456",
					RedirectTo: "app",
				},
			)
			if err != nil {
				t.Fatal(err)
			}

			replacer := strings.NewReplacer(
				"${link}", "https://example.com", "${ticket}", "123456", "${redirectTo}", "app",
			)
			for filename, actual := range map[string]string{"body.html": body, "subject.txt": subject} {
				expected, err := os.ReadFile(
					filepath.Join("../../email-templates/en", string(name), filename),
				)
				if err != nil {
					t.Fatal(err)
				}

				if diff := cmp.Diff(replacer.Replace(string(expected)), actual); diff != "" {
					t.Errorf("unexpected %s (-want +got):\n%s", filename, diff)
				}
			}
		})
	}

	if _, _, err := templates.Render(
		t.Context(),
		"fr",
		"unknown",
		notifications.TemplateData{},
	); !errors.Is(
		err,
		notifications.ErrTemplateNotFound,
	) {
		t.Errorf("expected ErrTemplateNotFound, got %v", err)
	}
}

func TestRenderSMSFallback(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		defaultLocale string
		files         map[string]string
		embeddedOnly  bool
		expectedBody  string
	}{
		{
			name:          "requested locale overrides default locale",
			defaultLocale: "en",
			files: map[string]string{
				"fr/signin-passwordless-sms/body.txt": "French ${code}",
				"en/signin-passwordless-sms/body.txt": "English ${code}",
			},
			embeddedOnly: false,
			expectedBody: "French 123456",
		},
		{
			name:          "default locale overrides embedded translation",
			defaultLocale: "en",
			files: map[string]string{
				"en/signin-passwordless-sms/body.txt": "English ${code}",
			},
			embeddedOnly: false,
			expectedBody: "English 123456",
		},
		{
			name:          "empty folder uses embedded English",
			defaultLocale: "cs",
			files:         nil,
			embeddedOnly:  false,
			expectedBody:  "Your code is 123456.",
		},
		{
			name:          "no folder uses embedded English",
			defaultLocale: "cs",
			files:         nil,
			embeddedOnly:  true,
			expectedBody:  "Your code is 123456.",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var path string
			if !tc.embeddedOnly {
				path = writeTemplateFiles(t, tc.files)
			}

			templates, err := notifications.NewTemplatesFromFilesystem(
				path,
				tc.defaultLocale,
				slog.Default(),
			)
			if err != nil {
				t.Fatal(err)
			}

			body, err := templates.RenderSMS(
				t.Context(),
				"fr",
				notifications.TemplateSMSData{Code: "123456"},
			)
			if err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(tc.expectedBody, body); diff != "" {
				t.Errorf("unexpected body (-want +got):\n%s", diff)
			}
		})
	}
}

func TestRenderFallbackWarning(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name          string
		defaultLocale string
		files         map[string]string
		embeddedOnly  bool
		expectedLog   string
	}{
		{
			name:          "requested locale does not warn",
			defaultLocale: "en",
			files: map[string]string{
				"fr/elevate-otp/body.html":   "French ${ticket}",
				"fr/elevate-otp/subject.txt": "French",
			},
			embeddedOnly: false,
			expectedLog:  "",
		},
		{
			name:          "default locale warns once",
			defaultLocale: "en",
			files: map[string]string{
				"en/elevate-otp/body.html":   "English ${ticket}",
				"en/elevate-otp/subject.txt": "English",
			},
			embeddedOnly: false,
			expectedLog: `level=WARN msg="template not found, falling back" template=elevate-otp ` +
				"locale=fr fallbackSource=custom fallbackLocale=en\n",
		},
		{
			name:          "custom folder without template warns once",
			defaultLocale: "fr",
			files: map[string]string{
				"fr/email-verify/body.html":   "French",
				"fr/email-verify/subject.txt": "French",
			},
			embeddedOnly: false,
			expectedLog: `level=WARN msg="template not found, falling back" template=elevate-otp ` +
				"locale=fr fallbackSource=embedded fallbackLocale=en\n",
		},
		{
			name:          "empty folder does not warn",
			defaultLocale: "cs",
			files:         nil,
			embeddedOnly:  false,
			expectedLog:   "",
		},
		{
			name:          "no folder does not warn",
			defaultLocale: "cs",
			files:         nil,
			embeddedOnly:  true,
			expectedLog:   "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			var path string
			if !tc.embeddedOnly {
				path = writeTemplateFiles(t, tc.files)
			}

			var logs strings.Builder

			logger := slog.New(slog.NewTextHandler(&logs, &slog.HandlerOptions{
				AddSource: false,
				Level:     nil,
				ReplaceAttr: func(_ []string, attr slog.Attr) slog.Attr {
					if attr.Key == slog.TimeKey {
						return slog.Attr{}
					}

					return attr
				},
			}))

			templates, err := notifications.NewTemplatesFromFilesystem(
				path,
				tc.defaultLocale,
				logger,
			)
			if err != nil {
				t.Fatal(err)
			}

			if _, _, err := templates.Render(
				t.Context(), "fr", notifications.TemplateNameElevateOTP,
				notifications.TemplateData{Ticket: "123456"},
			); err != nil {
				t.Fatal(err)
			}

			if diff := cmp.Diff(tc.expectedLog, logs.String()); diff != "" {
				t.Errorf("unexpected logs (-want +got):\n%s", diff)
			}
		})
	}
}
